#!/usr/bin/env bash
# Upload sample (and optional paid digital) assets to the private DigitalAssets bucket.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
STACK_NAME="${STACK_NAME:-sam-app}"
SAMPLE_PDF="${SAMPLE_PDF:-$ROOT_DIR/assets/books/modern-java-preview.pdf}"
SAMPLE_KEY="${SAMPLE_KEY:-sample/modern-java-preview.pdf}"
DIGITAL_PDF="${DIGITAL_PDF:-}"
DIGITAL_PDF_KEY="${DIGITAL_PDF_KEY:-digital/modern-java.pdf}"
DIGITAL_EPUB="${DIGITAL_EPUB:-}"
DIGITAL_EPUB_KEY="${DIGITAL_EPUB_KEY:-digital/modern-java.epub}"

usage() {
  cat <<'EOF'
Usage: upload-digital-assets.sh [--sample-only]

Uploads the free sample chapter PDF from assets/books/modern-java-preview.pdf
to the DigitalAssetsBucket created by the SAM stack.

Optional paid editions:
  DIGITAL_PDF=/path/to/book.pdf DIGITAL_EPUB=/path/to/book.epub ./scripts/upload-digital-assets.sh

Environment:
  STACK_NAME          CloudFormation/SAM stack name (default: sam-app)
  AWS_REGION          AWS region (default: ap-south-1)
  SAMPLE_PDF          Local sample PDF path
  SAMPLE_KEY          Destination object key (default: sample/modern-java-preview.pdf)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ ! -f "$SAMPLE_PDF" ]]; then
  echo "Sample PDF not found: $SAMPLE_PDF" >&2
  exit 1
fi

BUCKET="$(
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='DigitalAssetsBucketName'].OutputValue" \
    --output text
)"

if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  echo "Could not resolve DigitalAssetsBucketName from stack '$STACK_NAME'." >&2
  exit 1
fi

echo "Uploading sample chapter -> s3://$BUCKET/$SAMPLE_KEY"
aws s3 cp "$SAMPLE_PDF" "s3://$BUCKET/$SAMPLE_KEY" \
  --region "$REGION" \
  --content-type application/pdf \
  --metadata-directive REPLACE

if [[ -n "$DIGITAL_PDF" ]]; then
  if [[ ! -f "$DIGITAL_PDF" ]]; then
    echo "Digital PDF not found: $DIGITAL_PDF" >&2
    exit 1
  fi
  echo "Uploading digital PDF -> s3://$BUCKET/$DIGITAL_PDF_KEY"
  aws s3 cp "$DIGITAL_PDF" "s3://$BUCKET/$DIGITAL_PDF_KEY" \
    --region "$REGION" \
    --content-type application/pdf \
    --metadata-directive REPLACE
fi

if [[ -n "$DIGITAL_EPUB" ]]; then
  if [[ ! -f "$DIGITAL_EPUB" ]]; then
    echo "Digital ePub not found: $DIGITAL_EPUB" >&2
    exit 1
  fi
  echo "Uploading digital ePub -> s3://$BUCKET/$DIGITAL_EPUB_KEY"
  aws s3 cp "$DIGITAL_EPUB" "s3://$BUCKET/$DIGITAL_EPUB_KEY" \
    --region "$REGION" \
    --content-type application/epub+zip \
    --metadata-directive REPLACE
fi

echo "Done."
echo "Sample object: s3://$BUCKET/$SAMPLE_KEY"
echo "Redeploy the API if you have not yet shipped the S3 sample-delivery code:"
echo "  cd \"$BACKEND_DIR\" && sam build && sam deploy"
