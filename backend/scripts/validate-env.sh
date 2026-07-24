#!/usr/bin/env bash
# Validate APP_ENV and Razorpay credentials for the selected deployment target.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_ENV="${APP_ENV:-}"
SECRETS_FILE="${SAM_SECRETS_FILE:-}"

usage() {
  cat <<'EOF'
Usage: APP_ENV=dev|prod ./scripts/validate-env.sh

Loads backend/sam-secrets.env.<APP_ENV> (or SAM_SECRETS_FILE) and validates:
  - APP_ENV is exactly "dev" or "prod"
  - RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET are set
  - Key ID prefix matches the environment (rzp_test_ for dev, rzp_live_ for prod)

Never prints secrets. Key IDs are masked.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "$APP_ENV" != "dev" && "$APP_ENV" != "prod" ]]; then
  echo "APP_ENV must be \"dev\" or \"prod\" (got: \"${APP_ENV:-}\")" >&2
  exit 1
fi

if [[ -z "$SECRETS_FILE" ]]; then
  SECRETS_FILE="$ROOT/sam-secrets.env.${APP_ENV}"
fi

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Missing secrets file: $SECRETS_FILE" >&2
  echo "Copy sam-secrets.env.example to sam-secrets.env.${APP_ENV} and fill values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$SECRETS_FILE"
set +a

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required variable in $SECRETS_FILE: $name" >&2
    exit 1
  fi
}

require_var RAZORPAY_KEY_ID
require_var RAZORPAY_KEY_SECRET
require_var RAZORPAY_WEBHOOK_SECRET

mask_key() {
  local key="$1"
  local len=${#key}
  if (( len < 12 )); then
    echo "****"
    return
  fi
  echo "${key:0:9}****${key: -4}"
}

KEY_ID="$RAZORPAY_KEY_ID"
if [[ "$APP_ENV" == "dev" ]]; then
  if [[ "$KEY_ID" != rzp_test_* ]]; then
    echo "APP_ENV=dev requires RAZORPAY_KEY_ID to start with rzp_test_ (got $(mask_key "$KEY_ID"))" >&2
    exit 1
  fi
  if [[ "$KEY_ID" == rzp_live_* ]]; then
    echo "APP_ENV=dev must not use a live Razorpay key" >&2
    exit 1
  fi
fi

if [[ "$APP_ENV" == "prod" ]]; then
  if [[ "$KEY_ID" != rzp_live_* ]]; then
    echo "APP_ENV=prod requires RAZORPAY_KEY_ID to start with rzp_live_ (got $(mask_key "$KEY_ID"))" >&2
    exit 1
  fi
  if [[ "$KEY_ID" == rzp_test_* ]]; then
    echo "APP_ENV=prod must not use a test Razorpay key" >&2
    exit 1
  fi
fi

# Also run the Node config module for a single source of truth.
export APP_ENV
export RAZORPAY_KEY_ID
export RAZORPAY_KEY_SECRET
export RAZORPAY_WEBHOOK_SECRET
(
  cd "$ROOT"
  node -e "
const { getRazorpayConfig, formatRazorpayDiagnostics } = require('./src/razorpayConfig');
const config = getRazorpayConfig();
process.stdout.write(formatRazorpayDiagnostics(config) + '\n');
"
)

echo "Environment validation passed for APP_ENV=${APP_ENV}"
echo "Secrets file: ${SECRETS_FILE}"
