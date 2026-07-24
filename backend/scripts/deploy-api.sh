#!/usr/bin/env bash
# Build and deploy the Order API, loading secrets from sam-secrets.env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SECRETS_FILE="${SAM_SECRETS_FILE:-$ROOT/sam-secrets.env}"
if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Missing $SECRETS_FILE" >&2
  echo "Copy sam-secrets.env.example to sam-secrets.env and fill in values." >&2
  exit 1
fi

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

echo "==> Ensuring CloudFront signing keys in SSM"
"$ROOT/scripts/ensure-cloudfront-keys.sh"

PARAMETER_OVERRIDES=$(
  cat <<EOF
AdminEmail="pradeep@classpath.in" AllowedOrigin="https://modern-java.classpath.in,http://localhost:5173" MailFromEmail="no-reply@classpath.in" ReplyToEmail="pradeep@classpath.in" SesRegion="us-east-1" WebsiteUrl="https://modern-java.classpath.in" SamplePdfKey="sample/modern-java-preview.pdf" DigitalPdfKey="digital/modern-java-drm-free_v1.0.pdf" DigitalEpubKey="digital/modern-java-drm-free_v1.0.epub" DigitalCheckoutBypassSecret="${DigitalCheckoutBypassSecret}" TurnstileSecretKey="${TurnstileSecretKey}" ZohoClientId="${ZohoClientId}" ZohoClientSecret="${ZohoClientSecret}" ZohoRefreshToken="${ZohoRefreshToken}" ZohoOrganizationId="${ZohoOrganizationId}" ZohoTaxId="${ZohoTaxId}" ZohoTaxExemptionId="${ZohoTaxExemptionId}" ZohoInvoiceTemplateId="${ZohoInvoiceTemplateId}"
EOF
)

sam build
sam deploy \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides "${PARAMETER_OVERRIDES}"
