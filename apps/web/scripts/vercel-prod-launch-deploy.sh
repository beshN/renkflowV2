#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

VERCEL_TOKEN="${VERCEL_TOKEN:-}"
VERCEL_SCOPE="${VERCEL_SCOPE:-beratsahin-9207s-projects}"
VERCEL_PROJECT="${VERCEL_PROJECT:-renkflowv2}"
PUBLIC_SITE_MODE_RAW="${PUBLIC_SITE_MODE:-coming-soon}"
TARGET_URL="${TARGET_URL:-https://renkflow.com}"
SKIP_SMOKE="${SKIP_SMOKE:-false}"
DRY_RUN="${DRY_RUN:-false}"

log() {
  printf '[vercel-deploy] %s\n' "$*"
}

fatal() {
  printf '[vercel-deploy] ERROR: %s\n' "$*" >&2
  exit 2
}

normalize_bool() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    true|1|yes|y) echo "true" ;;
    false|0|no|n|'') echo "false" ;;
    *) fatal "Invalid boolean value: '$1'" ;;
  esac
}

normalize_mode() {
  local value
  value="$(printf '%s' "$1" | tr -d '\r\n' | xargs)"
  printf '%s' "${value,,}"
}

PUBLIC_SITE_MODE="$(normalize_mode "$PUBLIC_SITE_MODE_RAW")"
SKIP_SMOKE="$(normalize_bool "$SKIP_SMOKE")"
DRY_RUN="$(normalize_bool "$DRY_RUN")"

if [[ -z "$VERCEL_TOKEN" ]]; then
  fatal "VERCEL_TOKEN is required"
fi

if [[ "$PUBLIC_SITE_MODE" != "coming-soon" && "$PUBLIC_SITE_MODE" != "off" ]]; then
  fatal "PUBLIC_SITE_MODE must be 'coming-soon' or 'off'"
fi

if [[ ! "$TARGET_URL" =~ ^https?:// ]]; then
  fatal "TARGET_URL must start with http:// or https://"
fi

log "Configuration"
log "  scope=$VERCEL_SCOPE"
log "  project=$VERCEL_PROJECT"
log "  mode=$PUBLIC_SITE_MODE"
log "  target=$TARGET_URL"
log "  dry_run=$DRY_RUN"
log "  skip_smoke=$SKIP_SMOKE"

if [[ "$DRY_RUN" == "true" ]]; then
  log "Dry run completed. No deploy executed."
  exit 0
fi

log "Validating Vercel token..."
npx -y vercel whoami --token "$VERCEL_TOKEN" >/dev/null

log "Linking project..."
npx -y vercel link --yes --scope "$VERCEL_SCOPE" --project "$VERCEL_PROJECT" --token "$VERCEL_TOKEN" >/dev/null

log "Syncing PUBLIC_SITE_MODE across production/preview/development..."
for env_name in production preview development; do
  npx -y vercel env rm PUBLIC_SITE_MODE "$env_name" --yes --token "$VERCEL_TOKEN" >/dev/null 2>&1 || true
  printf '%s' "$PUBLIC_SITE_MODE" | npx -y vercel env add PUBLIC_SITE_MODE "$env_name" --token "$VERCEL_TOKEN" >/dev/null
  log "  $env_name -> $PUBLIC_SITE_MODE"
done

log "Deploying production build..."
npx -y vercel deploy --prod --yes --archive=tgz --token "$VERCEL_TOKEN"

if [[ "$SKIP_SMOKE" == "true" ]]; then
  log "SKIP_SMOKE=true, skipping smoke checks"
  exit 0
fi

SMOKE_SCRIPT="$REPO_ROOT/apps/web/scripts/smoke-coming-soon.sh"
if [[ ! -x "$SMOKE_SCRIPT" ]]; then
  chmod +x "$SMOKE_SCRIPT"
fi

log "Waiting for propagation..."
sleep 10

log "Running smoke checks on $TARGET_URL"
if ! "$SMOKE_SCRIPT" "$TARGET_URL"; then
  printf '[vercel-deploy] ERROR: Smoke checks failed.\n' >&2
  printf '[vercel-deploy] ERROR: Rollback suggestion: npx vercel rollback --token "$VERCEL_TOKEN"\n' >&2
  exit 1
fi

log "Deployment and smoke checks completed successfully"
