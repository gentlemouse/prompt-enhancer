#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[smoke] root=$ROOT_DIR"

required_files=(
  "AGENTS.md"
  "README.md"
  "docs/04_architecture.md"
  "docs/05_release_checklist.md"
  "docs/06_harness.md"
  "harness/feature_registry.json"
  "harness/progress.md"
  "harness/contracts/contract_template.md"
  "harness/evaluations/evaluation_template.md"
)

for file in "${required_files[@]}"; do
  [[ -e "$file" ]] || { echo "[smoke] missing required file: $file"; exit 1; }
done

if [[ ! -f package.json ]]; then
  echo "[smoke] package.json not found; cannot map real project commands."
  exit 1
fi

echo "[smoke] package manager: npm"

run_or_fail() {
  local script_name="$1"
  echo "[smoke] running npm run $script_name"
  npm run "$script_name"
}

run_or_fail lint
run_or_fail type-check

echo "[smoke] success"
