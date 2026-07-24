#!/usr/bin/env bash
# Upload sample (and paid digital) assets to the private DigitalAssets bucket.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
STACK_NAME="${STACK_NAME:-sam-app}"
SAMPLE_PDF="${SAMPLE_PDF:-$ROOT_DIR/assets/books/modern-java-preview.pdf}"
SAMPLE_KEY="${SAMPLE_KEY:-sample/modern-java-preview.pdf}"
DIGITAL_PDF="${DIGITAL_PDF:-$ROOT_DIR/assets/books/modern-java-drm-free_v1.0.pdf}"
DIGITAL_PDF_KEY="${DIGITAL_PDF_KEY:-digital/modern-java-drm-free_v1.0.pdf}"
DIGITAL_EPUB="${DIGITAL_EPUB:-$ROOT_DIR/assets/books/modern-java-drm-free_v1.0.epub}"
DIGITAL_EPUB_KEY="${DIGITAL_EPUB_KEY:-digital/modern-java-drm-free_v1.0.epub}"
SAMPLE_ONLY=0

usage() {
  cat <<'EOF'
Usage: upload-digital-assets.sh [--sample-only]

Uploads:
  - Free sample chapter: assets/books/modern-java-preview.pdf
  - Paid DRM-free PDF:   assets/books/modern-java-drm-free_v1.0.pdf
  - Paid DRM-free ePub:  assets/books/modern-java-drm-free_v1.0.epub

Environment:
  STACK_NAME          CloudFormation/SAM stack name (default: sam-app)
  AWS_REGION          AWS region (default: ap-south-1)
  SAMPLE_PDF          Local sample PDF path
  SAMPLE_KEY          Destination object key (default: sample/modern-java-preview.pdf)
  DIGITAL_PDF         Local DRM-free PDF path
  DIGITAL_PDF_KEY     Destination object key (default: digital/modern-java-drm-free_v1.0.pdf)
  DIGITAL_EPUB        Local DRM-free ePub path
  DIGITAL_EPUB_KEY    Destination object key (default: digital/modern-java-drm-free_v1.0.epub)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--sample-only" ]]; then
  SAMPLE_ONLY=1
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
  --cache-control "public, max-age=31536000, immutable" \
  --content-disposition 'attachment; filename="modern-java-preview.pdf"' \
  --metadata-directive REPLACE

if [[ "$SAMPLE_ONLY" -eq 0 ]]; then
  if [[ ! -f "$DIGITAL_PDF" ]]; then
    echo "Digital PDF not found: $DIGITAL_PDF" >&2
    exit 1
  fi
  echo "Uploading DRM-free PDF -> s3://$BUCKET/$DIGITAL_PDF_KEY"
  aws s3 cp "$DIGITAL_PDF" "s3://$BUCKET/$DIGITAL_PDF_KEY" \
    --region "$REGION" \
    --content-type application/pdf \
    --cache-control "public, max-age=31536000, immutable" \
    --content-disposition 'attachment; filename="modern-java-drm-free.pdf"' \
    --metadata-directive REPLACE

  if [[ ! -f "$DIGITAL_EPUB" ]]; then
    echo "Digital ePub not found: $DIGITAL_EPUB" >&2
    exit 1
  fi
  echo "Uploading DRM-free ePub -> s3://$BUCKET/$DIGITAL_EPUB_KEY"
  aws s3 cp "$DIGITAL_EPUB" "s3://$BUCKET/$DIGITAL_EPUB_KEY" \
    --region "$REGION" \
    --content-type application/epub+zip \
    --cache-control "public, max-age=31536000, immutable" \
    --content-disposition 'attachment; filename="modern-java-drm-free.epub"' \
    --metadata-directive REPLACE
fi

echo "Done."
echo "Sample object: s3://$BUCKET/$SAMPLE_KEY"
if [[ "$SAMPLE_ONLY" -eq 0 ]]; then
  echo "Digital PDF:  s3://$BUCKET/$DIGITAL_PDF_KEY"
  echo "Digital ePub: s3://$BUCKET/$DIGITAL_EPUB_KEY"
fi

DISTRIBUTION_ID="$(
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='DigitalAssetsDistributionId'].OutputValue" \
    --output text 2>/dev/null || true
)"

if [[ -n "$DISTRIBUTION_ID" && "$DISTRIBUTION_ID" != "None" ]]; then
  echo "Invalidating CloudFront cache for uploaded keys ($DISTRIBUTION_ID)"
  PATHS=("/$SAMPLE_KEY")
  if [[ "$SAMPLE_ONLY" -eq 0 ]]; then
    PATHS+=("/$DIGITAL_PDF_KEY" "/$DIGITAL_EPUB_KEY")
  fi
  aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "${PATHS[@]}" \
    --query 'Invalidation.Id' \
    --output text
fi

echo "Redeploy the API if DigitalPdfKey/DigitalEpubKey changed in template.yaml:"
echo "  cd \"$BACKEND_DIR\" && npm run deploy"
