#!/usr/bin/env bash
set -uo pipefail

BASE_URL="${1:-}"
VERBOSE="${2:-}"
CURL_TIMEOUT="${CURL_TIMEOUT:-10}"
CURL_RETRY="${CURL_RETRY:-2}"
CURL_RETRY_DELAY="${CURL_RETRY_DELAY:-2}"

if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 <base-url> [--verbose]" >&2
  exit 2
fi

BASE_URL="${BASE_URL%/}"
TMP_HEADERS="$(mktemp)"
TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_HEADERS" "$TMP_BODY"' EXIT

PASSED=0
FAILED=0
LAST_STATUS=""

info() { printf '[smoke-live] PASS: %s\n' "$*"; }
fail() { printf '[smoke-live] FAIL: %s\n' "$*" >&2; FAILED=$((FAILED + 1)); }
pass() { PASSED=$((PASSED + 1)); }

debug() {
  if [[ "$VERBOSE" == "--verbose" ]]; then
    printf '[smoke-live] DEBUG: %s\n' "$*"
  fi
}

http_request() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local content_type="${4:-application/json}"

  local args=(
    -sS
    --max-time "$CURL_TIMEOUT"
    --retry "$CURL_RETRY"
    --retry-delay "$CURL_RETRY_DELAY"
    -D "$TMP_HEADERS"
  )

  if [[ "$method" == "HEAD" ]]; then
    args+=( -I )
  else
    args+=( -o "$TMP_BODY" -X "$method" )
  fi

  if [[ -n "$data" ]]; then
    args+=( -H "Content-Type: $content_type" --data "$data" )
  fi

  debug "curl ${args[*]} $BASE_URL$path"

  if ! curl "${args[@]}" "$BASE_URL$path" >/dev/null 2>&1; then
    LAST_STATUS="CURL_ERROR"
    return 1
  fi

  LAST_STATUS="$(awk 'toupper($1) ~ /^HTTP\// {print $2; exit}' "$TMP_HEADERS")"
  if [[ -z "$LAST_STATUS" ]]; then
    LAST_STATUS="PARSE_ERROR"
    return 1
  fi

  return 0
}

header_value() {
  local key="$1"
  awk -v k="$(echo "$key" | tr '[:upper:]' '[:lower:]')" '
    {
      line = $0
      sub(/\r$/, "", line)
      split(line, parts, ": ")
      if (tolower(parts[1]) == k) {
        print substr(line, index(line, ": ") + 2)
        exit
      }
    }
  ' "$TMP_HEADERS"
}

body_contains() {
  local pattern="$1"
  grep -qi "$pattern" "$TMP_BODY" 2>/dev/null
}

assert_status() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local note="${4:-}"

  if ! http_request "$method" "$path"; then
    fail "$method $path request failed ($LAST_STATUS)"
    return
  fi

  if [[ "$LAST_STATUS" != "$expected" ]]; then
    fail "$method $path expected $expected, got $LAST_STATUS${note:+ - $note}"
    return
  fi

  info "$method $path -> $LAST_STATUS${note:+ ($note)}"
  pass
}

assert_redirect_prefix() {
  local method="$1"
  local path="$2"
  local expected_status="$3"
  local expected_prefix="$4"

  if ! http_request "$method" "$path"; then
    fail "$method $path request failed ($LAST_STATUS)"
    return
  fi

  local location
  location="$(header_value 'location')"

  if [[ "$LAST_STATUS" != "$expected_status" ]]; then
    fail "$method $path expected status $expected_status, got $LAST_STATUS"
    return
  fi

  if [[ "$location" != ${expected_prefix}* ]]; then
    fail "$method $path expected location prefix '$expected_prefix', got '$location'"
    return
  fi

  info "$method $path -> $LAST_STATUS + location=$location"
  pass
}

echo "=============================================="
echo "Live Mode Smoke Test"
echo "Target: $BASE_URL"
echo "Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "=============================================="

echo "--- Connectivity ---"
assert_status "GET" "/" "200" "Root should be publicly accessible"
assert_status "HEAD" "/" "200" "Root HEAD"

echo "--- Auth Surface ---"
assert_status "GET" "/auth/login" "200" "Login page must be reachable"
assert_status "GET" "/api/auth/session" "200" "Session API must be reachable"

if http_request "GET" "/api/auth/session"; then
  content_type="$(header_value 'content-type')"
  if [[ "$content_type" == *"application/json"* ]]; then
    info "Session endpoint returns JSON"
    pass
  else
    fail "Session endpoint content-type is not JSON: '$content_type'"
  fi
else
  fail "GET /api/auth/session request failed ($LAST_STATUS)"
fi

echo "--- Protected Routes ---"
assert_redirect_prefix "GET" "/dashboard" "302" "/auth/login"
assert_redirect_prefix "HEAD" "/dashboard" "302" "/auth/login"

echo "--- Public Marketing Routes ---"
assert_status "GET" "/features" "200"
assert_status "GET" "/pricing" "200"
assert_status "GET" "/blog" "200"

echo "--- SEO Routes ---"
assert_status "GET" "/robots.txt" "200"
assert_status "GET" "/sitemap.xml" "200"

if http_request "GET" "/robots.txt"; then
  if body_contains 'Disallow: /api/'; then
    info "robots.txt disallows API routes"
    pass
  else
    fail "robots.txt is missing API disallow rule"
  fi
else
  fail "GET /robots.txt request failed ($LAST_STATUS)"
fi

echo "=============================================="
TOTAL=$((PASSED + FAILED))
echo "Results: $PASSED/$TOTAL passed"
if [[ "$FAILED" -gt 0 ]]; then
  echo "Status: FAILED"
  exit 1
fi

echo "Status: PASSED"
exit 0
