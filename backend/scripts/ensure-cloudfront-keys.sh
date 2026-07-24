#!/usr/bin/env bash
# Generate (once) and sync CloudFront URL-signing keys to SSM Parameter Store.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
KEYS_DIR="${CLOUDFRONT_KEYS_DIR:-$ROOT/.cloudfront-keys}"
PUBLIC_SSM_PARAM="${CLOUDFRONT_PUBLIC_SSM_PARAM:-/modern-java/cloudfront/public-key}"
PRIVATE_SSM_PARAM="${CLOUDFRONT_PRIVATE_SSM_PARAM:-/modern-java/cloudfront/private-key}"

mkdir -p "$KEYS_DIR"

if [[ ! -f "$KEYS_DIR/private.pem" || ! -f "$KEYS_DIR/public.pem" ]]; then
  echo "==> Generating CloudFront signing key pair in $KEYS_DIR"
  openssl genrsa -out "$KEYS_DIR/private.pem" 2048
  openssl rsa -pubout -in "$KEYS_DIR/private.pem" -out "$KEYS_DIR/public.pem"
  chmod 600 "$KEYS_DIR/private.pem"
fi

echo "==> Syncing public key -> ssm:$PUBLIC_SSM_PARAM ($REGION)"
aws ssm put-parameter \
  --region "$REGION" \
  --name "$PUBLIC_SSM_PARAM" \
  --type String \
  --value "file://$KEYS_DIR/public.pem" \
  --overwrite \
  >/dev/null

echo "==> Syncing private key -> ssm:$PRIVATE_SSM_PARAM ($REGION)"
aws ssm put-parameter \
  --region "$REGION" \
  --name "$PRIVATE_SSM_PARAM" \
  --type SecureString \
  --value "file://$KEYS_DIR/private.pem" \
  --overwrite \
  >/dev/null

echo "Done. Keys are ready for sam deploy."
echo "  public:  $PUBLIC_SSM_PARAM"
echo "  private: $PRIVATE_SSM_PARAM"
echo "  local:   $KEYS_DIR/"
