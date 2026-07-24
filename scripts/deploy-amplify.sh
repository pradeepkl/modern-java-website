#!/usr/bin/env bash
# Build the site and deploy dist/ to the AWS Amplify production branch.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Load local Vite env (gitignored) so deploys pick up Turnstile and other keys.
if [[ -f "$ROOT_DIR/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.local"
  set +a
fi

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
APP_ID="${AMPLIFY_APP_ID:-dd9kgrhw8x8dv}"
BRANCH="${AMPLIFY_BRANCH:-main}"
export VITE_ORDER_API_URL="${VITE_ORDER_API_URL:-https://vgtwwchwuh.execute-api.ap-south-1.amazonaws.com}"
TURNSTILE_SITE_KEY="${VITE_TURNSTILE_SITE_KEY:-}"
GA_MEASUREMENT_ID="${VITE_GA_MEASUREMENT_ID:-}"
CLARITY_ID="${VITE_CLARITY_ID:-}"

# Production defaults for paperback surface (build-time Vite flags).
# Must be exported into the Vite process — undefined vars bake as false.
# Override via shell env or .env.local before running this script.
export VITE_PAPERBACK_SALES_ENABLED="${VITE_PAPERBACK_SALES_ENABLED:-false}"
export VITE_PAPERBACK_WAITLIST_ENABLED="${VITE_PAPERBACK_WAITLIST_ENABLED:-true}"

SITE_URL="${DEPLOY_SITE_URL:-https://modern-java.classpath.in}"
ZIP_PATH="${ROOT_DIR}/.amplify-deploy.zip"
POLL_SECONDS="${DEPLOY_POLL_SECONDS:-5}"
MAX_ATTEMPTS="${DEPLOY_MAX_ATTEMPTS:-36}"

usage() {
  cat <<'EOF'
Usage: npm run deploy
       ./scripts/deploy-amplify.sh

Builds the production site and uploads it to AWS Amplify (manual zip deploy).

Environment (also loaded from .env.local when present):
  AMPLIFY_APP_ID            Amplify app id (default: dd9kgrhw8x8dv)
  AMPLIFY_BRANCH            Amplify branch (default: main)
  AWS_REGION                AWS region (default: ap-south-1)
  VITE_ORDER_API_URL        Order API base URL baked into the build
  VITE_TURNSTILE_SITE_KEY   Cloudflare Turnstile site key (checkout + lead forms)
  VITE_GA_MEASUREMENT_ID    GA4 measurement ID (consent-gated analytics)
  VITE_CLARITY_ID           Microsoft Clarity project ID (optional)
  VITE_PAPERBACK_SALES_ENABLED     Build-time flag (default: false)
  VITE_PAPERBACK_WAITLIST_ENABLED  Build-time flag (default: true)
  DEPLOY_SITE_URL           Printed after success (default: https://modern-java.classpath.in)
  SKIP_BUILD=1              Reuse an existing dist/ without rebuilding

Restore paperback ordering (requires rebuild + redeploy):
  VITE_PAPERBACK_SALES_ENABLED=true VITE_PAPERBACK_WAITLIST_ENABLED=false npm run deploy
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd aws
require_cmd curl
require_cmd npm
require_cmd python3
require_cmd zip

cleanup() {
  rm -f "$ZIP_PATH"
}
trap cleanup EXIT

echo "==> Deploy target: Amplify app ${APP_ID} / branch ${BRANCH} (${REGION})"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> Building production bundle"
  echo "    VITE_PAPERBACK_SALES_ENABLED=${VITE_PAPERBACK_SALES_ENABLED}"
  echo "    VITE_PAPERBACK_WAITLIST_ENABLED=${VITE_PAPERBACK_WAITLIST_ENABLED}"
  echo "    VITE_ORDER_API_URL=${VITE_ORDER_API_URL}"

  build_env=(
    "VITE_ORDER_API_URL=${VITE_ORDER_API_URL}"
    "VITE_PAPERBACK_SALES_ENABLED=${VITE_PAPERBACK_SALES_ENABLED}"
    "VITE_PAPERBACK_WAITLIST_ENABLED=${VITE_PAPERBACK_WAITLIST_ENABLED}"
  )
  # Only set optional keys when present — empty values would override .env.local.
  if [[ -n "$TURNSTILE_SITE_KEY" ]]; then
    build_env+=("VITE_TURNSTILE_SITE_KEY=${TURNSTILE_SITE_KEY}")
  fi
  if [[ -n "$GA_MEASUREMENT_ID" ]]; then
    build_env+=("VITE_GA_MEASUREMENT_ID=${GA_MEASUREMENT_ID}")
  fi
  if [[ -n "$CLARITY_ID" ]]; then
    build_env+=("VITE_CLARITY_ID=${CLARITY_ID}")
  fi

  if [[ -n "$GA_MEASUREMENT_ID" ]]; then
    echo "    analytics: GA4=${GA_MEASUREMENT_ID}"
  else
    echo "    analytics: GA4 not set (cookie banner will show; no tracking scripts)"
  fi
  if [[ -n "$CLARITY_ID" ]]; then
    echo "    analytics: Clarity=${CLARITY_ID}"
  fi

  # Forward flags into the Vite child process (npm scripts do not always inherit
  # non-exported shell locals). env PREFIX=... is authoritative for this build.
  env "${build_env[@]}" npm run build
else
  echo "==> Skipping build (SKIP_BUILD=1)"
  echo "    WARNING: SKIP_BUILD reuses dist/; paperback flags are whatever was baked earlier."
fi

if [[ ! -d "$ROOT_DIR/dist" ]]; then
  echo "Build output not found: $ROOT_DIR/dist" >&2
  exit 1
fi

echo "==> Packaging dist/"
rm -f "$ZIP_PATH"
(
  cd "$ROOT_DIR/dist"
  zip -r "$ZIP_PATH" . \
    -x '*/.DS_Store' \
    -x '.DS_Store' \
    >/dev/null
)

echo "==> Creating Amplify deployment"
CREATE_JSON="$(
  aws amplify create-deployment \
    --app-id "$APP_ID" \
    --branch-name "$BRANCH" \
    --region "$REGION" \
    --output json
)"

JOB_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["jobId"])' <<<"$CREATE_JSON")"
UPLOAD_URL="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["zipUploadUrl"])' <<<"$CREATE_JSON")"

echo "==> Uploading artifact (job ${JOB_ID})"
curl -sS --fail \
  -X PUT \
  -H 'Content-Type: application/zip' \
  --upload-file "$ZIP_PATH" \
  "$UPLOAD_URL" \
  >/dev/null

echo "==> Starting deployment"
aws amplify start-deployment \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --job-id "$JOB_ID" \
  --region "$REGION" \
  --output json \
  >/dev/null

echo "==> Waiting for Amplify job ${JOB_ID}"
STATUS="PENDING"
attempt=1
while [[ "$attempt" -le "$MAX_ATTEMPTS" ]]; do
  STATUS="$(
    aws amplify get-job \
      --app-id "$APP_ID" \
      --branch-name "$BRANCH" \
      --job-id "$JOB_ID" \
      --region "$REGION" \
      --query 'job.summary.status' \
      --output text
  )"
  echo "    attempt ${attempt}: ${STATUS}"

  case "$STATUS" in
    SUCCEED)
      echo "==> Deploy succeeded"
      echo "Live: ${SITE_URL}"
      exit 0
      ;;
    FAILED|CANCELLED)
      echo "Deploy failed with status: ${STATUS}" >&2
      exit 1
      ;;
  esac

  attempt=$((attempt + 1))
  sleep "$POLL_SECONDS"
done

echo "Timed out waiting for Amplify job ${JOB_ID} (last status: ${STATUS})" >&2
exit 1
