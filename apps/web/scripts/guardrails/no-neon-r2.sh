#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT_DIR"

legacy_db_tag="$(printf '%s%s' 'neo' 'n')"
legacy_db_host_pattern="$(printf '\\.%s\\.tech' "$legacy_db_tag")"
legacy_db_pkg_tag="$(printf '@%sdatabase' "$legacy_db_tag")"

legacy_store_prefix="$(printf '%s%s' 'R2' '_')"
legacy_store_public_var="$(printf '%s%s' "$legacy_store_prefix" 'PUBLIC_URL')"
legacy_store_host="$(printf '%s%s' 'r2.cloud' 'flarestorage')"

pattern="$(
  printf '%s|%s|%s|%s|%s|%s' \
    "$legacy_db_tag" \
    "$legacy_db_host_pattern" \
    "$legacy_db_pkg_tag" \
    "$legacy_store_prefix" \
    "$legacy_store_host" \
    "$legacy_store_public_var"
)"

guard_script_path="$(printf '%s%s%s' 'apps/web/scripts/guardrails/no-' "$legacy_db_tag" '-r2.sh')"

if git grep -nI -E "$pattern" -- apps/web .github \
  ':!apps/web/package-lock.json' \
  ':!apps/web/__tests__/lib/db-url-policy.test.ts' \
  ":!$guard_script_path"
then
  echo "[guard] Legacy backend patterns detected."
  exit 1
fi

echo "[guard] Legacy backend patterns not detected."
