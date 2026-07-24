#!/usr/bin/env bash
# Unit-style checks for deployment script behaviour (no AWS calls).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

assert_eq() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $label (expected='$expected' actual='$actual')" >&2
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local label="$1"
  local needle="$2"
  local haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $label (missing '$needle')" >&2
    FAIL=$((FAIL + 1))
  fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --- Backend validate-env: rejects bad APP_ENV ---
set +e
OUT="$(APP_ENV=staging "$ROOT/backend/scripts/validate-env.sh" 2>&1)"
CODE=$?
set -e
assert_eq "backend validate rejects unsupported APP_ENV" "1" "$CODE"
assert_contains "backend validate mentions APP_ENV" "APP_ENV" "$OUT"

# --- Backend validate-env: missing secrets file ---
set +e
OUT="$(APP_ENV=dev SAM_SECRETS_FILE="$TMP/missing.env" "$ROOT/backend/scripts/validate-env.sh" 2>&1)"
CODE=$?
set -e
assert_eq "backend validate fails when secrets file missing" "1" "$CODE"

# --- Backend validate-env: rejects live key in dev ---
cat >"$TMP/bad-dev.env" <<'EOF'
RAZORPAY_KEY_ID=rzp_live_ABCDEFGHijkl
RAZORPAY_KEY_SECRET=secret
RAZORPAY_WEBHOOK_SECRET=webhook
EOF
set +e
OUT="$(
  APP_ENV=dev SAM_SECRETS_FILE="$TMP/bad-dev.env" \
    "$ROOT/backend/scripts/validate-env.sh" 2>&1
)"
CODE=$?
set -e
assert_eq "backend validate rejects live key in dev" "1" "$CODE"
assert_contains "backend validate live-in-dev message" "rzp_test_" "$OUT"

# --- Backend validate-env: accepts test key in dev ---
cat >"$TMP/good-dev.env" <<'EOF'
RAZORPAY_KEY_ID=rzp_test_ABCDEFGHijkl
RAZORPAY_KEY_SECRET=secret
RAZORPAY_WEBHOOK_SECRET=webhook
EOF
set +e
OUT="$(
  APP_ENV=dev SAM_SECRETS_FILE="$TMP/good-dev.env" \
    "$ROOT/backend/scripts/validate-env.sh" 2>&1
)"
CODE=$?
set -e
assert_eq "backend validate accepts test key in dev" "0" "$CODE"
assert_contains "backend validate masks key" "Razorpay key:" "$OUT"
assert_contains "backend validate reports env" "Razorpay environment: dev" "$OUT"
if [[ "$OUT" == *"test_secret_value"* ]] || [[ "$OUT" == *"RAZORPAY_KEY_SECRET="* ]]; then
  echo "FAIL: secrets leaked in validation output" >&2
  FAIL=$((FAIL + 1))
else
  echo "PASS: backend validate does not leak secret values"
  PASS=$((PASS + 1))
fi

# --- Prod API deploy confirmation gate ---
set +e
OUT="$(printf 'nope\n' | "$ROOT/backend/scripts/deploy-api-prod.sh" 2>&1)"
CODE=$?
set -e
assert_eq "prod API deploy cancels without PROD" "1" "$CODE"
assert_contains "prod API cancel message" "cancelled" "$OUT"

# --- Prod frontend deploy confirmation gate ---
set +e
OUT="$(printf 'nope\n' | "$ROOT/scripts/deploy-amplify-prod.sh" 2>&1)"
CODE=$?
set -e
assert_eq "prod frontend deploy cancels without PROD" "1" "$CODE"

# --- Default package scripts target dev ---
ROOT_DEPLOY="$(node -p "require('$ROOT/package.json').scripts.deploy")"
BACKEND_DEPLOY="$(node -p "require('$ROOT/backend/package.json').scripts.deploy")"
assert_contains "root deploy defaults to deploy:dev" "deploy:dev" "$ROOT_DEPLOY"
assert_contains "backend deploy defaults to deploy:dev" "deploy:dev" "$BACKEND_DEPLOY"

echo
echo "Deployment behaviour tests: ${PASS} passed, ${FAIL} failed"
if (( FAIL > 0 )); then
  exit 1
fi
