#!/usr/bin/env bash
# Production frontend deploy — requires typing PROD.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -t 0 ]]; then
  echo "You are about to deploy the production website"
  echo "(Amplify branch main, modern-java-prod API, Razorpay live mode)."
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
exec "$ROOT_DIR/scripts/deploy-amplify.sh"
