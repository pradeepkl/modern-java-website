#!/usr/bin/env bash
# Build and deploy the Order API for a single APP_ENV (dev or prod).
# Uses a dedicated CloudFormation stack and secrets file per environment.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_ENV="${APP_ENV:-}"
if [[ "$APP_ENV" != "dev" && "$APP_ENV" != "prod" ]]; then
  echo "APP_ENV must be set to \"dev\" or \"prod\" before deploying the API." >&2
  echo "Use: npm run deploy:dev   or   npm run deploy:prod" >&2
  exit 1
fi

STACK_NAME="modern-java-${APP_ENV}"
SECRETS_FILE="${SAM_SECRETS_FILE:-$ROOT/sam-secrets.env.${APP_ENV}}"
export APP_ENV
export SAM_SECRETS_FILE="$SECRETS_FILE"

echo "==> Validating ${APP_ENV} environment"
"$ROOT/scripts/validate-env.sh"

set -a
# shellcheck disable=SC1090
source "$SECRETS_FILE"
set +a

: "${ZohoClientId:=}"
: "${ZohoClientSecret:=}"
: "${ZohoRefreshToken:=}"
: "${ZohoOrganizationId:=}"
: "${ZohoTaxId:=}"
: "${ZohoTaxExemptionId:=}"
: "${ZohoInvoiceTemplateId:=}"
: "${DigitalCheckoutBypassSecret:=}"
: "${TurnstileSecretKey:=}"
: "${MetaPixelId:=}"
: "${MetaAccessTokenSsmParam:=/modern-java/meta/access-token}"
: "${MetaGraphApiVersion:=v21.0}"
: "${MetaTestEventCode:=}"
: "${MetaCapiEnabled:=true}"
: "${RAZORPAY_KEY_ID:?RAZORPAY_KEY_ID is required}"
: "${RAZORPAY_KEY_SECRET:?RAZORPAY_KEY_SECRET is required}"
: "${RAZORPAY_WEBHOOK_SECRET:?RAZORPAY_WEBHOOK_SECRET is required}"

if [[ -z "${UnsubscribeTokenSecret:-}" ]]; then
  UnsubscribeTokenSecret="$(openssl rand -hex 32)"
  printf '\nUnsubscribeTokenSecret=%s\n' "$UnsubscribeTokenSecret" >> "$SECRETS_FILE"
  echo "==> Generated UnsubscribeTokenSecret and appended to ${SECRETS_FILE}"
fi

echo "==> Ensuring CloudFront signing keys in SSM"
"$ROOT/scripts/ensure-cloudfront-keys.sh"

# Escape values for sam --parameter-overrides (double-quoted tokens).
escape_param() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

PARAMETER_OVERRIDES=$(
  cat <<EOF
AppEnv="${APP_ENV}" RazorpayKeyId="$(escape_param "$RAZORPAY_KEY_ID")" RazorpayKeySecret="$(escape_param "$RAZORPAY_KEY_SECRET")" RazorpayWebhookSecret="$(escape_param "$RAZORPAY_WEBHOOK_SECRET")" AdminEmail="pradeep@classpath.in" AllowedOrigin="https://modern-java.classpath.in,http://localhost:5173" MailFromEmail="no-reply@classpath.in" ReplyToEmail="pradeep@classpath.in" SesRegion="us-east-1" WebsiteUrl="https://modern-java.classpath.in" SamplePdfKey="sample/modern-java-preview.pdf" DigitalPdfKey="digital/modern-java-drm-free_v1.0.pdf" DigitalEpubKey="digital/modern-java-drm-free_v1.0.epub" DigitalCheckoutBypassSecret="$(escape_param "${DigitalCheckoutBypassSecret}")" TurnstileSecretKey="$(escape_param "${TurnstileSecretKey}")" ZohoClientId="$(escape_param "${ZohoClientId}")" ZohoClientSecret="$(escape_param "${ZohoClientSecret}")" ZohoRefreshToken="$(escape_param "${ZohoRefreshToken}")" ZohoOrganizationId="$(escape_param "${ZohoOrganizationId}")" ZohoTaxId="$(escape_param "${ZohoTaxId}")" ZohoTaxExemptionId="$(escape_param "${ZohoTaxExemptionId}")" ZohoInvoiceTemplateId="$(escape_param "${ZohoInvoiceTemplateId}")" SesConfigurationSetName="classpath-email-${APP_ENV}" UnsubscribeTokenSecret="$(escape_param "${UnsubscribeTokenSecret}")" MetaPixelId="$(escape_param "${MetaPixelId}")" MetaAccessTokenSsmParam="$(escape_param "${MetaAccessTokenSsmParam}")" MetaGraphApiVersion="$(escape_param "${MetaGraphApiVersion}")" MetaTestEventCode="$(escape_param "${MetaTestEventCode}")" MetaCapiEnabled="$(escape_param "${MetaCapiEnabled}")"
EOF
)

echo "==> Syncing product prices config into Lambda package"
cp "$ROOT/../config/product-prices.json" "$ROOT/src/product-prices.json"

echo "==> Deploying API stack ${STACK_NAME} (APP_ENV=${APP_ENV})"
sam build
sam deploy \
  --stack-name "$STACK_NAME" \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --parameter-overrides "${PARAMETER_OVERRIDES}"

echo "==> Deploying SES email infra in us-east-1"
chmod +x "$ROOT/scripts/deploy-ses-infra.sh"
"$ROOT/scripts/deploy-ses-infra.sh"

echo "==> Stack ${STACK_NAME} deploy complete"
echo "    Configure the Razorpay ${APP_ENV} webhook to this stack's RazorpayWebhookUrl output."
echo "    Point the matching frontend build at this stack's OrderApiUrl output."
echo "    Confirm SNS alarm email subscription for pradeep@classpath.in if new."
