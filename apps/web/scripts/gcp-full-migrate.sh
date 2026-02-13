#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
APP_DIR="$ROOT_DIR/apps/web"

KEY_FILE="${KEY_FILE:-/Users/beshnovski/Downloads/dauntless-host-486823-j3-502b171b5e13.json}"
SOURCE_ENV_FILE="${SOURCE_ENV_FILE:-$APP_DIR/.env.local}"

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-europe-west3}"
SERVICE_NAME="${SERVICE_NAME:-renkflow-web}"
AR_REPOSITORY="${AR_REPOSITORY:-renkflow-containers}"
SQL_INSTANCE="${SQL_INSTANCE:-renkflow-db-prod}"
DB_NAME="${DB_NAME:-renkflow_db}"
DB_USER="${DB_USER:-renkflow_user}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-renkflow-runtime}"
GCS_BUCKET_NAME="${GCS_BUCKET_NAME:-}"
PUBLIC_SITE_MODE="${PUBLIC_SITE_MODE:-off}"
APP_BASE_URL="${APP_BASE_URL:-https://renkflow.com}"
SKIP_DB_IMPORT="${SKIP_DB_IMPORT:-0}"

PG_DUMP_BIN="${PG_DUMP_BIN:-/opt/homebrew/opt/libpq/bin/pg_dump}"
PSQL_BIN="${PSQL_BIN:-/opt/homebrew/opt/libpq/bin/psql}"

function log() {
  printf '[gcp-full-migrate] %s\n' "$*"
}

function warn() {
  printf '[gcp-full-migrate] WARN: %s\n' "$*" >&2
}

function fail() {
  printf '[gcp-full-migrate] ERROR: %s\n' "$*" >&2
  exit 1
}

function require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command not found: $1"
  fi
}

function read_env_value() {
  local key="$1"
  python3 - "$SOURCE_ENV_FILE" "$key" <<'PY'
from pathlib import Path
import sys

env_file = Path(sys.argv[1])
target = sys.argv[2]

if not env_file.exists():
    print("")
    raise SystemExit(0)

for raw_line in env_file.read_text().splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key.strip() != target:
        continue
    value = value.strip()
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        value = value[1:-1]
    print(value)
    raise SystemExit(0)

print("")
PY
}

function upsert_secret() {
  local secret_name="$1"
  local secret_value="$2"

  if [[ -z "$secret_value" ]]; then
    return
  fi

  if gcloud secrets describe "$secret_name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    printf "%s" "$secret_value" | gcloud secrets versions add "$secret_name" \
      --project "$PROJECT_ID" \
      --data-file=-
  else
    printf "%s" "$secret_value" | gcloud secrets create "$secret_name" \
      --project "$PROJECT_ID" \
      --replication-policy="automatic" \
      --data-file=-
  fi
}

function secret_exists() {
  local secret_name="$1"
  gcloud secrets describe "$secret_name" --project "$PROJECT_ID" >/dev/null 2>&1
}

require_cmd gcloud
require_cmd python3
require_cmd npm
require_cmd node
require_cmd cloud-sql-proxy
require_cmd openssl
require_cmd curl

[[ -f "$KEY_FILE" ]] || fail "Service account key file not found: $KEY_FILE"
[[ -f "$SOURCE_ENV_FILE" ]] || fail "Source env file not found: $SOURCE_ENV_FILE"
[[ -x "$PG_DUMP_BIN" ]] || fail "pg_dump not found at: $PG_DUMP_BIN"
[[ -x "$PSQL_BIN" ]] || fail "psql not found at: $PSQL_BIN"

export PATH="$(dirname "$PG_DUMP_BIN"):$(dirname "$PSQL_BIN"):$PATH"

if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="$(python3 - "$KEY_FILE" <<'PY'
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as fh:
    data = json.load(fh)
print(data["project_id"])
PY
)"
fi

if [[ -z "$PROJECT_ID" ]]; then
  fail "Could not determine PROJECT_ID"
fi

if [[ -z "$GCS_BUCKET_NAME" ]]; then
  GCS_BUCKET_NAME="renkflowv2-storage-${PROJECT_ID}"
fi

RUNTIME_SA_EMAIL="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

log "Using project: $PROJECT_ID"
log "Authenticating with service account..."
gcloud auth activate-service-account --key-file="$KEY_FILE" >/dev/null
gcloud config set project "$PROJECT_ID" >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
COMPUTE_DEFAULT_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

log "Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  iamcredentials.googleapis.com \
  --project "$PROJECT_ID" >/dev/null

log "Ensuring Artifact Registry repository exists..."
if ! gcloud artifacts repositories describe "$AR_REPOSITORY" \
  --project "$PROJECT_ID" \
  --location "$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$AR_REPOSITORY" \
    --project "$PROJECT_ID" \
    --location "$REGION" \
    --repository-format docker \
    --description "RenkFlow container images"
fi

log "Ensuring runtime service account exists..."
if ! gcloud iam service-accounts describe "$RUNTIME_SA_EMAIL" \
  --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$RUNTIME_SA_NAME" \
    --project "$PROJECT_ID" \
    --display-name "RenkFlow Cloud Run Runtime"
fi

log "Ensuring Cloud SQL instance exists..."
if ! gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud sql instances create "$SQL_INSTANCE" \
    --project "$PROJECT_ID" \
    --database-version=POSTGRES_15 \
    --tier=db-custom-1-3840 \
    --region="$REGION" \
    --storage-type=SSD \
    --storage-size=20GB \
    --availability-type=ZONAL \
    --backup-start-time=03:00 \
    --enable-point-in-time-recovery
fi

if ! gcloud sql databases describe "$DB_NAME" \
  --instance "$SQL_INSTANCE" \
  --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud sql databases create "$DB_NAME" \
    --instance "$SQL_INSTANCE" \
    --project "$PROJECT_ID"
fi

DB_PASSWORD=""
if secret_exists "DB_PASSWORD"; then
  DB_PASSWORD="$(gcloud secrets versions access latest --secret DB_PASSWORD --project "$PROJECT_ID" | tr -d '\r\n')"
else
  DB_PASSWORD="$(openssl rand -base64 32)"
  upsert_secret "DB_PASSWORD" "$DB_PASSWORD"
fi

if gcloud sql users list \
  --project "$PROJECT_ID" \
  --instance "$SQL_INSTANCE" \
  --format='value(name)' | grep -qx "$DB_USER"; then
  gcloud sql users set-password "$DB_USER" \
    --project "$PROJECT_ID" \
    --instance "$SQL_INSTANCE" \
    --password "$DB_PASSWORD"
else
  gcloud sql users create "$DB_USER" \
    --project "$PROJECT_ID" \
    --instance "$SQL_INSTANCE" \
    --password "$DB_PASSWORD"
fi

INSTANCE_CONNECTION_NAME="$(gcloud sql instances describe "$SQL_INSTANCE" \
  --project "$PROJECT_ID" \
  --format='value(connectionName)')"

DB_PASSWORD_ENCODED="$(python3 - "$DB_PASSWORD" <<'PY'
import urllib.parse, sys
print(urllib.parse.quote(sys.argv[1], safe=""))
PY
)"

TARGET_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD_ENCODED}@localhost/${DB_NAME}?host=/cloudsql/${INSTANCE_CONNECTION_NAME}&sslmode=disable"
upsert_secret "DATABASE_URL" "$TARGET_DATABASE_URL"

log "Ensuring Cloud Storage bucket exists..."
if ! gcloud storage buckets describe "gs://${GCS_BUCKET_NAME}" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${GCS_BUCKET_NAME}" \
    --project "$PROJECT_ID" \
    --location "$REGION" \
    --uniform-bucket-level-access
fi

gcloud storage buckets update "gs://${GCS_BUCKET_NAME}" \
  --project "$PROJECT_ID" \
  --uniform-bucket-level-access >/dev/null

log "Applying IAM bindings..."
for role in roles/cloudsql.client roles/secretmanager.secretAccessor roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:${RUNTIME_SA_EMAIL}" \
    --role "$role" \
    --condition=None \
    --quiet >/dev/null
done

gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET_NAME}" \
  --member "serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role "roles/storage.objectAdmin" >/dev/null

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA_EMAIL" \
  --member "serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role "roles/iam.serviceAccountTokenCreator" \
  --condition=None \
  --project "$PROJECT_ID" >/dev/null

log "Ensuring Cloud Build service account permissions..."
for sa in "$CLOUD_BUILD_SA" "$COMPUTE_DEFAULT_SA"; do
  for role in \
    roles/storage.objectViewer \
    roles/storage.objectCreator \
    roles/storage.objectAdmin \
    roles/artifactregistry.writer \
    roles/logging.logWriter
  do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member "serviceAccount:${sa}" \
      --role "$role" \
      --condition=None \
      --quiet >/dev/null || true
  done
done

log "Upserting application secrets from $SOURCE_ENV_FILE..."
AUTH_SECRET_VALUE="$(read_env_value AUTH_SECRET)"
NEXTAUTH_SECRET_VALUE="$(read_env_value NEXTAUTH_SECRET)"
if [[ -z "$AUTH_SECRET_VALUE" && -n "$NEXTAUTH_SECRET_VALUE" ]]; then
  AUTH_SECRET_VALUE="$NEXTAUTH_SECRET_VALUE"
fi
if [[ -z "$NEXTAUTH_SECRET_VALUE" && -n "$AUTH_SECRET_VALUE" ]]; then
  NEXTAUTH_SECRET_VALUE="$AUTH_SECRET_VALUE"
fi
if [[ -z "$AUTH_SECRET_VALUE" && -z "$NEXTAUTH_SECRET_VALUE" ]]; then
  NEXTAUTH_SECRET_VALUE="$(openssl rand -base64 48)"
  AUTH_SECRET_VALUE="$NEXTAUTH_SECRET_VALUE"
fi
if [[ -n "$AUTH_SECRET_VALUE" && -n "$NEXTAUTH_SECRET_VALUE" && "$AUTH_SECRET_VALUE" != "$NEXTAUTH_SECRET_VALUE" ]]; then
  fail "AUTH_SECRET and NEXTAUTH_SECRET must be identical to avoid auth/session drift"
fi

upsert_secret AUTH_SECRET "$AUTH_SECRET_VALUE"
upsert_secret NEXTAUTH_SECRET "$NEXTAUTH_SECRET_VALUE"

for key in \
  RESEND_API_KEY \
  GOOGLE_CLIENT_ID \
  GOOGLE_CLIENT_SECRET \
  AZURE_AD_CLIENT_ID \
  AZURE_AD_CLIENT_SECRET \
  AZURE_AD_TENANT_ID \
  VAPID_PRIVATE_KEY \
  GEMINI_API_KEY \
  GOOGLE_API_KEY
do
  value="$(read_env_value "$key")"
  if [[ -n "$value" ]]; then
    upsert_secret "$key" "$value"
  fi
done

SOURCE_DATABASE_URL="$(read_env_value DATABASE_URL)"

if [[ "$SKIP_DB_IMPORT" == "1" ]]; then
  warn "SKIP_DB_IMPORT=1 set; skipping DB import"
elif [[ -n "$SOURCE_DATABASE_URL" ]]; then
  log "Migrating PostgreSQL data from source to Cloud SQL..."
  TMP_DIR="$(mktemp -d)"
  DUMP_FILE="$TMP_DIR/renkflow_dump.sql"

  "$PG_DUMP_BIN" "$SOURCE_DATABASE_URL" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --quote-all-identifiers \
    --file "$DUMP_FILE"

  # pg_dump from newer PostgreSQL versions may emit settings unavailable on PG15.
  # Remove known incompatible session parameters to keep restore portable.
  sed -i.bak '/^SET transaction_timeout = /d' "$DUMP_FILE"
  rm -f "${DUMP_FILE}.bak"

  PROXY_PORT="${PROXY_PORT:-9470}"
  GOOGLE_APPLICATION_CREDENTIALS="$KEY_FILE" \
    cloud-sql-proxy "${INSTANCE_CONNECTION_NAME}" --port "${PROXY_PORT}" >/tmp/renkflow-cloudsql-proxy.log 2>&1 &
  PROXY_PID=$!
  trap 'kill ${PROXY_PID} >/dev/null 2>&1 || true' EXIT

  PROXY_READY=0
  for _ in $(seq 1 20); do
    if PGPASSWORD="$DB_PASSWORD" \
      "$PSQL_BIN" \
      "host=127.0.0.1 port=${PROXY_PORT} user=${DB_USER} dbname=${DB_NAME} sslmode=disable" \
      --command "SELECT 1" >/dev/null 2>&1; then
      PROXY_READY=1
      break
    fi
    sleep 1
  done

  if [[ "$PROXY_READY" -ne 1 ]]; then
    cat /tmp/renkflow-cloudsql-proxy.log >&2
    fail "Cloud SQL Proxy did not become ready on port ${PROXY_PORT}"
  fi

  PGPASSWORD="$DB_PASSWORD" \
    "$PSQL_BIN" \
    "host=127.0.0.1 port=${PROXY_PORT} user=${DB_USER} dbname=${DB_NAME} sslmode=disable" \
    --set ON_ERROR_STOP=1 \
    --file "$DUMP_FILE"

  kill "${PROXY_PID}" >/dev/null 2>&1 || true
  trap - EXIT

  rm -rf "$TMP_DIR"
else
  warn "DATABASE_URL not found in source env; skipping DB import"
fi

log "Ensuring required backend schema on Cloud SQL..."
PROXY_PORT="${PROXY_PORT:-9470}"
GOOGLE_APPLICATION_CREDENTIALS="$KEY_FILE" \
  cloud-sql-proxy "${INSTANCE_CONNECTION_NAME}" --port "${PROXY_PORT}" >/tmp/renkflow-cloudsql-proxy-ensure.log 2>&1 &
ENSURE_PROXY_PID=$!
trap 'kill ${ENSURE_PROXY_PID} >/dev/null 2>&1 || true' EXIT

ENSURE_PROXY_READY=0
for _ in $(seq 1 20); do
  if PGPASSWORD="$DB_PASSWORD" \
    "$PSQL_BIN" \
    "host=127.0.0.1 port=${PROXY_PORT} user=${DB_USER} dbname=${DB_NAME} sslmode=disable" \
    --command "SELECT 1" >/dev/null 2>&1; then
    ENSURE_PROXY_READY=1
    break
  fi
  sleep 1
done

if [[ "$ENSURE_PROXY_READY" -ne 1 ]]; then
  cat /tmp/renkflow-cloudsql-proxy-ensure.log >&2
  fail "Cloud SQL Proxy did not become ready for schema ensure on port ${PROXY_PORT}"
fi

ENSURE_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD_ENCODED}@127.0.0.1:${PROXY_PORT}/${DB_NAME}?sslmode=disable"
(
  cd "$APP_DIR"
  DATABASE_URL="$ENSURE_DATABASE_URL" npm exec -- tsx scripts/ensure-backend-schema.ts
)

kill "${ENSURE_PROXY_PID}" >/dev/null 2>&1 || true
trap - EXIT

NEXT_PUBLIC_USE_DATABASE_VALUE="$(read_env_value NEXT_PUBLIC_USE_DATABASE)"
NEXT_PUBLIC_GA_MEASUREMENT_ID_VALUE="$(read_env_value NEXT_PUBLIC_GA_MEASUREMENT_ID)"
NEXT_PUBLIC_VAPID_PUBLIC_KEY_VALUE="$(read_env_value NEXT_PUBLIC_VAPID_PUBLIC_KEY)"
RESEND_INFO_EMAIL_VALUE="$(read_env_value RESEND_INFO_EMAIL)"
RESEND_UPDATES_EMAIL_VALUE="$(read_env_value RESEND_UPDATES_EMAIL)"
RESEND_SUPPORT_EMAIL_VALUE="$(read_env_value RESEND_SUPPORT_EMAIL)"

IMAGE_TAG="$(date -u +%Y%m%d-%H%M%S)"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPOSITORY}/${SERVICE_NAME}:${IMAGE_TAG}"

log "Building container image via Cloud Build..."
TMP_CLOUDBUILD_CONFIG="$(mktemp)"
cat > "$TMP_CLOUDBUILD_CONFIG" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -t
      - ${IMAGE_URI}
      - -f
      - apps/web/Dockerfile
      - .
images:
  - ${IMAGE_URI}
EOF

gcloud builds submit "$ROOT_DIR" \
  --project "$PROJECT_ID" \
  --config "$TMP_CLOUDBUILD_CONFIG"

rm -f "$TMP_CLOUDBUILD_CONFIG"

ENV_VARS=(
  "NODE_ENV=production"
  "AUTH_TRUST_HOST=true"
  "PUBLIC_SITE_MODE=${PUBLIC_SITE_MODE}"
  "STORAGE_BACKEND=gcs"
  "GCS_BUCKET_NAME=${GCS_BUCKET_NAME}"
)

if [[ -n "$NEXT_PUBLIC_USE_DATABASE_VALUE" ]]; then
  ENV_VARS+=("NEXT_PUBLIC_USE_DATABASE=${NEXT_PUBLIC_USE_DATABASE_VALUE}")
fi
if [[ -n "$NEXT_PUBLIC_GA_MEASUREMENT_ID_VALUE" ]]; then
  ENV_VARS+=("NEXT_PUBLIC_GA_MEASUREMENT_ID=${NEXT_PUBLIC_GA_MEASUREMENT_ID_VALUE}")
fi
if [[ -n "$NEXT_PUBLIC_VAPID_PUBLIC_KEY_VALUE" ]]; then
  ENV_VARS+=("NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY_VALUE}")
fi
if [[ -n "$RESEND_INFO_EMAIL_VALUE" ]]; then
  ENV_VARS+=("RESEND_INFO_EMAIL=${RESEND_INFO_EMAIL_VALUE}")
fi
if [[ -n "$RESEND_UPDATES_EMAIL_VALUE" ]]; then
  ENV_VARS+=("RESEND_UPDATES_EMAIL=${RESEND_UPDATES_EMAIL_VALUE}")
fi
if [[ -n "$RESEND_SUPPORT_EMAIL_VALUE" ]]; then
  ENV_VARS+=("RESEND_SUPPORT_EMAIL=${RESEND_SUPPORT_EMAIL_VALUE}")
fi

SECRET_VARS=()
for secret_name in \
  DATABASE_URL \
  AUTH_SECRET \
  NEXTAUTH_SECRET \
  RESEND_API_KEY \
  GOOGLE_CLIENT_ID \
  GOOGLE_CLIENT_SECRET \
  AZURE_AD_CLIENT_ID \
  AZURE_AD_CLIENT_SECRET \
  AZURE_AD_TENANT_ID \
  VAPID_PRIVATE_KEY \
  GEMINI_API_KEY \
  GOOGLE_API_KEY
do
  if secret_exists "$secret_name"; then
    SECRET_VARS+=("${secret_name}=${secret_name}:latest")
  fi
done

ENV_VAR_CSV="$(IFS=,; echo "${ENV_VARS[*]}")"
SECRET_VAR_CSV="$(IFS=,; echo "${SECRET_VARS[*]-}")"

log "Deploying Cloud Run service..."
DEPLOY_CMD=(
  gcloud run deploy "$SERVICE_NAME"
  --project "$PROJECT_ID"
  --region "$REGION"
  --platform managed
  --image "$IMAGE_URI"
  --service-account "$RUNTIME_SA_EMAIL"
  --no-invoker-iam-check
  --port 3000
  --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME"
  --set-env-vars "$ENV_VAR_CSV"
)

if [[ -n "$SECRET_VAR_CSV" ]]; then
  DEPLOY_CMD+=(--set-secrets "$SECRET_VAR_CSV")
fi

"${DEPLOY_CMD[@]}"

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format='value(status.url)')"

APP_BASE_URL="${APP_BASE_URL%/}"
if [[ -z "$APP_BASE_URL" ]]; then
  APP_BASE_URL="$SERVICE_URL"
fi

log "Updating runtime URL variables..."
gcloud run services update "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --no-invoker-iam-check \
  --update-env-vars "NEXTAUTH_URL=${APP_BASE_URL},AUTH_URL=${APP_BASE_URL},NEXT_PUBLIC_APP_URL=${APP_BASE_URL}" >/dev/null

INVOKER_IAM_DISABLED="$(gcloud run services describe "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --format=json | python3 -c '
import json
import sys

service = json.load(sys.stdin)
annotations = service.get("metadata", {}).get("annotations", {})
value = str(annotations.get("run.googleapis.com/invoker-iam-disabled", "")).lower()
print("1" if value == "true" else "0")
')"

if [[ "$INVOKER_IAM_DISABLED" == "1" ]]; then
  SERVICE_IS_PUBLIC="1"
else
  SERVICE_IS_PUBLIC="$(gcloud run services get-iam-policy "$SERVICE_NAME" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --format=json | python3 -c '
import json
import sys

policy = json.load(sys.stdin)
for binding in policy.get("bindings", []):
    if binding.get("role") != "roles/run.invoker":
        continue
    if "allUsers" in binding.get("members", []):
        print("1")
        raise SystemExit(0)

print("0")
')"
fi

if [[ "$SERVICE_IS_PUBLIC" == "1" ]]; then
  if [[ "$PUBLIC_SITE_MODE" == "coming-soon" ]]; then
    bash "$APP_DIR/scripts/smoke-coming-soon.sh" "$SERVICE_URL"
  else
    bash "$APP_DIR/scripts/smoke-live.sh" "$SERVICE_URL"
  fi
else
  warn "Service is not publicly invokable (likely due organization policy). Running authenticated smoke check."
  ID_TOKEN="$(gcloud auth print-identity-token || true)"
  if [[ -z "$ID_TOKEN" ]]; then
    warn "Could not obtain identity token for authenticated smoke check"
  else
    HTTP_CODE="$(curl --max-time 20 -sSI -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer ${ID_TOKEN}" \
      "$SERVICE_URL" || true)"
    if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 500 ]]; then
      warn "Authenticated smoke check returned HTTP ${HTTP_CODE} for ${SERVICE_URL}"
    else
      log "Authenticated smoke check passed with HTTP ${HTTP_CODE}"
    fi
  fi
fi

log "Migration completed."
log "Cloud Run URL: ${SERVICE_URL}"
log "Cloud SQL instance: ${INSTANCE_CONNECTION_NAME}"
log "GCS bucket: gs://${GCS_BUCKET_NAME}"

RUNTIME_SECRET_ALLOWLIST=(
  DATABASE_URL
  AUTH_SECRET
  NEXTAUTH_SECRET
  DB_PASSWORD
  RESEND_API_KEY
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  AZURE_AD_CLIENT_ID
  AZURE_AD_CLIENT_SECRET
  AZURE_AD_TENANT_ID
  VAPID_PRIVATE_KEY
  GEMINI_API_KEY
  GOOGLE_API_KEY
)

UNUSED_SECRETS="$(
  gcloud secrets list --project "$PROJECT_ID" --format='value(name)' \
    | while read -r secret_name; do
        skip="0"
        for allowed_secret in "${RUNTIME_SECRET_ALLOWLIST[@]}"; do
          if [[ "$secret_name" == "$allowed_secret" ]]; then
            skip="1"
            break
          fi
        done
        if [[ "$skip" == "0" ]]; then
          printf '%s\n' "$secret_name"
        fi
      done
)"

if [[ -n "$UNUSED_SECRETS" ]]; then
  warn "Unused Secret Manager entries detected (safe-phaseout candidates):"
  while read -r secret_name; do
    [[ -z "$secret_name" ]] && continue
    warn "  - ${secret_name}"
  done <<<"$UNUSED_SECRETS"
fi
