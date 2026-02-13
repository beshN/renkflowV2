#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT_DIR"

TARGET_DIRS=(
  "apps/web/app/actions"
  "apps/web/app/api"
)

SENSITIVE_TABLE_PATTERN='(FROM|JOIN)[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*\.)?(orders|inventory_items|inventory_item_stocks|payments|order_documents|work_orders)\b'
LOOK_CONTEXT_LINES=20
violations=0

while IFS=: read -r file line _; do
  [[ -z "${file:-}" || -z "${line:-}" ]] && continue

  start_line=$((line - LOOK_CONTEXT_LINES))
  if [[ "$start_line" -lt 1 ]]; then
    start_line=1
  fi
  end_line=$((line + LOOK_CONTEXT_LINES))
  context="$(sed -n "${start_line},${end_line}p" "$file")"

  if [[ "$context" != *"tenant_id"* && "$context" != *"tenantId"* ]]; then
    echo "[tenant-guard] Missing tenant scope near ${file}:${line}" >&2
    violations=1
  fi
done < <(grep -RInE "$SENSITIVE_TABLE_PATTERN" "${TARGET_DIRS[@]}" || true)

if [[ "$violations" -ne 0 ]]; then
  echo "[tenant-guard] Tenant isolation check failed." >&2
  exit 1
fi

echo "[tenant-guard] Tenant isolation checks passed."
