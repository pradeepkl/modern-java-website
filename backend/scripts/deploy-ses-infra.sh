#!/usr/bin/env bash
# Deploy SES configuration set + event Lambda + reputation alarms in us-east-1.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_ENV="${APP_ENV:-}"
if [[ "$APP_ENV" != "dev" && "$APP_ENV" != "prod" ]]; then
  echo "APP_ENV must be set to \"dev\" or \"prod\"." >&2
  exit 1
fi

API_STACK="modern-java-${APP_ENV}"
SES_STACK="modern-java-ses-${APP_ENV}"
SES_REGION="${SES_REGION:-us-east-1}"
API_REGION="${AWS_REGION:-ap-south-1}"
CONFIG_SET="${SES_CONFIGURATION_SET_NAME:-classpath-email-${APP_ENV}}"

SAMPLE_TABLE="$(aws cloudformation describe-stacks \
  --stack-name "$API_STACK" \
  --region "$API_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='SampleRequestsTableName'].OutputValue | [0]" \
  --output text 2>/dev/null || true)"

if [[ -z "$SAMPLE_TABLE" || "$SAMPLE_TABLE" == "None" ]]; then
  SAMPLE_TABLE="$(aws cloudformation describe-stack-resources \
    --stack-name "$API_STACK" \
    --region "$API_REGION" \
    --query "StackResources[?LogicalResourceId=='SampleRequestsTable'].PhysicalResourceId | [0]" \
    --output text)"
fi

if [[ -z "$SAMPLE_TABLE" || "$SAMPLE_TABLE" == "None" ]]; then
  echo "Unable to resolve SampleRequestsTable from stack ${API_STACK}." >&2
  exit 1
fi

echo "==> Deploying SES infra ${SES_STACK} in ${SES_REGION}"
echo "    Leads table: ${SAMPLE_TABLE} (${API_REGION})"
echo "    Configuration set: ${CONFIG_SET}"

sam build --template-file ses-infra.yaml
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name "$SES_STACK" \
  --region "$SES_REGION" \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --parameter-overrides \
    "AppEnv=${APP_ENV} SampleRequestsTableName=${SAMPLE_TABLE} SampleRequestsTableRegion=${API_REGION} ConfigurationSetName=${CONFIG_SET} AlarmEmail=pradeep@classpath.in"

echo "==> SES infra ${SES_STACK} deploy complete"
echo "    Confirm the SNS email subscription for pradeep@classpath.in if prompted."
