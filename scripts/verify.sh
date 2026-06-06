#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[verify] root=$ROOT_DIR"

bash scripts/smoke.sh

run_or_fail() {
  local script_name="$1"
  echo "[verify] running npm run $script_name"
  npm run "$script_name"
}

run_or_fail test
run_or_fail build
run_or_fail test:e2e

if [[ "${RUN_VERIFY_APIS:-0}" == "1" ]]; then
  run_or_fail verify-apis
else
  echo "[verify] skipped verify-apis (set RUN_VERIFY_APIS=1 to enable network-dependent API verification)"
fi

if [[ "${RUN_PROVIDER_SMOKE:-0}" == "1" ]]; then
  run_or_fail smoke:providers
else
  echo "[verify] skipped smoke:providers (set RUN_PROVIDER_SMOKE=1 and provide valid API keys to enable provider smoke tests)"
fi

echo "[verify] success"
