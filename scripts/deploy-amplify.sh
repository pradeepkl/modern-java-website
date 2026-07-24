#!/usr/bin/env bash
# Build and deploy the site to an Amplify branch matching APP_ENV.
# Default APP_ENV=dev. Production requires an explicit deploy:prod path.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_ENV="${APP_ENV:-dev}"
if [[ "$APP_ENV" != "dev" && "$APP_ENV" != "prod" ]]; then
  echo "APP_ENV must be \"dev\" or \"prod\" (got: \"${APP_ENV}\")" >&2
  exit 1
fi

# Load environment-specific Vite env (gitignored). Prefer .env.<APP_ENV>, then .env.local.
ENV_FILE=""
if [[ -f "$ROOT_DIR/.env.${APP_ENV}" ]]; then
  ENV_FILE="$ROOT_DIR/.env.${APP_ENV}"
elif [[ -f "$ROOT_DIR/.env.local" ]]; then
  ENV_FILE="$ROOT_DIR/.env.local"
fi

if [[ -n "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
APP_ID="${AMPLIFY_APP_ID:-dd9kgrhw8x8dv}"

if [[ "$APP_ENV" == "prod" ]]; then
  BRANCH="${AMPLIFY_BRANCH:-main}"
  SITE_URL="${DEPLOY_SITE_URL:-https://modern-java.classpath.in}"
else
  BRANCH="${AMPLIFY_BRANCH:-dev}"
  SITE_URL="${DEPLOY_SITE_URL:-https://dev.modern-java.classpath.in}"
fi

ORDER_API_URL="${VITE_ORDER_API_URL:-}"
TURNSTILE_SITE_KEY="${VITE_TURNSTILE_SITE_KEY:-}"
GA_MEASUREMENT_ID="${VITE_GA_MEASUREMENT_ID:-}"
CLARITY_ID="${VITE_CLARITY_ID:-}"

export VITE_PAPERBACK_SALES_ENABLED="${VITE_PAPERBACK_SALES_ENABLED:-false}"
export VITE_PAPERBACK_WAITLIST_ENABLED="${VITE_PAPERBACK_WAITLIST_ENABLED:-true}"

ZIP_PATH="${ROOT_DIR}/.amplify-deploy.zip"
POLL_SECONDS="${DEPLOY_POLL_SECONDS:-5}"
MAX_ATTEMPTS="${DEPLOY_MAX_ATTEMPTS:-36}"

usage() {
  cat <<'EOF'
Usage: APP_ENV=dev ./scripts/deploy-amplify.sh
       npm run deploy          # defaults to APP_ENV=dev
       npm run deploy:dev
       npm run deploy:prod     # requires typing PROD

Deploys the frontend to an Amplify branch:
  APP_ENV=dev  -> Amplify branch "dev"  (must use modern-java-dev API URL)
  APP_ENV=prod -> Amplify branch "main" (must use modern-java-prod API URL)

Never put Razorpay secrets in frontend env files. The API returns the Key ID.

Environment files (gitignored):
  .env.dev   — VITE_ORDER_API_URL for modern-java-dev
  .env.prod  — VITE_ORDER_API_URL for modern-java-prod
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

if [[ -z "$ORDER_API_URL" ]]; then
  echo "VITE_ORDER_API_URL is required for APP_ENV=${APP_ENV}." >&2
  echo "Set it in .env.${APP_ENV} to the OrderApiUrl of stack modern-java-${APP_ENV}." >&2
  exit 1
fi

# Reject accidental Razorpay secrets in frontend env.
for forbidden in \
  RAZORPAY_KEY_SECRET \
  RAZORPAY_WEBHOOK_SECRET \
  RAZORPAY_TEST_KEY_SECRET \
  RAZORPAY_LIVE_KEY_SECRET \
  VITE_RAZORPAY_KEY_SECRET \
  VITE_RAZORPAY_WEBHOOK_SECRET
do
  if [[ -n "${!forbidden:-}" ]]; then
    echo "Refusing to deploy: ${forbidden} must not be present in frontend environment." >&2
    exit 1
  fi
done

cleanup() {
  rm -f "$ZIP_PATH"
}
trap cleanup EXIT

echo "==> Frontend deploy APP_ENV=${APP_ENV}"
echo "    Amplify app ${APP_ID} / branch ${BRANCH} (${REGION})"
echo "    VITE_ORDER_API_URL=${ORDER_API_URL}"
echo "    Site URL: ${SITE_URL}"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> Building bundle for ${APP_ENV}"
  echo "    VITE_PAPERBACK_SALES_ENABLED=${VITE_PAPERBACK_SALES_ENABLED}"
  echo "    VITE_PAPERBACK_WAITLIST_ENABLED=${VITE_PAPERBACK_WAITLIST_ENABLED}"

  build_env=(
    "VITE_APP_ENV=${APP_ENV}"
    "VITE_ORDER_API_URL=${ORDER_API_URL}"
    "VITE_PAPERBACK_SALES_ENABLED=${VITE_PAPERBACK_SALES_ENABLED}"
    "VITE_PAPERBACK_WAITLIST_ENABLED=${VITE_PAPERBACK_WAITLIST_ENABLED}"
  )
  if [[ -n "$TURNSTILE_SITE_KEY" ]]; then
    build_env+=("VITE_TURNSTILE_SITE_KEY=${TURNSTILE_SITE_KEY}")
  fi
  if [[ -n "$GA_MEASUREMENT_ID" ]]; then
    build_env+=("VITE_GA_MEASUREMENT_ID=${GA_MEASUREMENT_ID}")
  fi
  if [[ -n "$CLARITY_ID" ]]; then
    build_env+=("VITE_CLARITY_ID=${CLARITY_ID}")
  fi

  env "${build_env[@]}" npm run build
else
  echo "==> Skipping build (SKIP_BUILD=1)"
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
      echo "==> Deploy succeeded (APP_ENV=${APP_ENV})"
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
