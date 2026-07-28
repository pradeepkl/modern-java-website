#!/usr/bin/env bash
# Store the Meta Conversions API access token in SSM SecureString.
# Never put this token in Vite env files or commit it to git.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
PARAM_NAME="${META_ACCESS_TOKEN_SSM_PARAM:-/modern-java/meta/access-token}"

if [[ -z "${META_ACCESS_TOKEN:-}" ]]; then
  echo "Set META_ACCESS_TOKEN to the Meta system user / CAPI access token." >&2
  echo "Example:" >&2
  echo "  META_ACCESS_TOKEN='EAAB...' ./scripts/ensure-meta-capi-secret.sh" >&2
  exit 1
fi

echo "==> Writing Meta CAPI token -> ssm:$PARAM_NAME ($REGION) as SecureString"
aws ssm put-parameter \
  --region "$REGION" \
  --name "$PARAM_NAME" \
  --type SecureString \
  --value "$META_ACCESS_TOKEN" \
  --overwrite \
  >/dev/null

echo "Done. Deploy the Order API so Lambda can read $PARAM_NAME."
echo "  Optional test events: set MetaTestEventCode in sam-secrets.env.<env>"
echo "  Disable switch: MetaCapiEnabled=false"
