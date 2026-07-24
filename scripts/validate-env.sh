#!/usr/bin/env bash
# Validate frontend deploy env for APP_ENV without deploying.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ENV="${APP_ENV:-dev}"

if [[ "$APP_ENV" != "dev" && "$APP_ENV" != "prod" ]]; then
  echo "APP_ENV must be \"dev\" or \"prod\"" >&2
  exit 1
fi

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

if [[ -z "${VITE_ORDER_API_URL:-}" ]]; then
  echo "Missing VITE_ORDER_API_URL for APP_ENV=${APP_ENV}" >&2
  echo "Set it in .env.${APP_ENV} to OrderApiUrl from stack modern-java-${APP_ENV}." >&2
  exit 1
fi

for forbidden in \
  RAZORPAY_KEY_SECRET \
  RAZORPAY_WEBHOOK_SECRET \
  VITE_RAZORPAY_KEY_SECRET \
  VITE_RAZORPAY_WEBHOOK_SECRET
do
  if [[ -n "${!forbidden:-}" ]]; then
    echo "Frontend env must not contain ${forbidden}" >&2
    exit 1
  fi
done

EXPECTED_BRANCH="dev"
if [[ "$APP_ENV" == "prod" ]]; then
  EXPECTED_BRANCH="main"
fi

echo "Frontend environment: ${APP_ENV}"
echo "Amplify branch: ${AMPLIFY_BRANCH:-$EXPECTED_BRANCH}"
echo "Order API URL: ${VITE_ORDER_API_URL}"
echo "Razorpay secrets in frontend: none (Key ID comes from API)"
echo "Validation passed"
