#!/usr/bin/env bash
# Confirm production API deployment. Requires typing PROD.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -t 0 ]]; then
  echo "You are about to deploy the production Order API"
  echo "(stack modern-java-prod, Razorpay live mode)."
  printf "Type PROD to continue: "
  read -r confirmation
else
  confirmation="${PROD_CONFIRM:-}"
fi

if [[ "$confirmation" != "PROD" ]]; then
  echo "Production deploy cancelled (expected exactly: PROD)." >&2
  exit 1
fi

export APP_ENV=prod
exec "$ROOT/scripts/deploy-api.sh"
