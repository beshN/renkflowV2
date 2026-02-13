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

info() { printf '[smoke] PASS: %s\n' "$*"; }
warn() { printf '[smoke] WARN: %s\n' "$*"; }
fail() { printf '[smoke] FAIL: %s\n' "$*" >&2; FAILED=$((FAILED + 1)); }
pass() { PASSED=$((PASSED + 1)); }

debug() {
  if [[ "$VERBOSE" == "--verbose" ]]; then
    printf '[smoke] DEBUG: %s\n' "$*"
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
  grep -q "$pattern" "$TMP_BODY" 2>/dev/null
}

sitemap_has_path() {
  local expected_path="$1"
  local loc_entry
  local loc_url
  local loc_path

  while IFS= read -r loc_entry; do
    loc_url="${loc_entry#<loc>}"
    loc_url="${loc_url%</loc>}"
    loc_path="$(printf '%s' "$loc_url" | sed -E 's#^[A-Za-z]+://[^/]+##')"
    loc_path="${loc_path%%\?*}"
    loc_path="${loc_path%%\#*}"
    if [[ -z "$loc_path" ]]; then
      loc_path="/"
    fi

    if [[ "$expected_path" == "/" ]]; then
      if [[ "$loc_path" == "/" ]]; then
        return 0
      fi
      continue
    fi

    if [[ "$loc_path" == "$expected_path" || "$loc_path" == "$expected_path/" ]]; then
      return 0
    fi
  done < <(grep -oE '<loc>[^<]+</loc>' "$TMP_BODY")

  return 1
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

assert_redirect() {
  local method="$1"
  local path="$2"
  local expected_status="$3"
  local expected_location="$4"
  local note="${5:-}"

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

  if [[ "$location" != "$expected_location" ]]; then
    fail "$method $path expected location '$expected_location', got '$location'"
    return
  fi

  info "$method $path -> $LAST_STATUS + location=$location${note:+ ($note)}"
  pass
}

assert_body_pattern() {
  local pattern="$1"
  local note="$2"
  if body_contains "$pattern"; then
    info "$note"
    pass
  else
    fail "$note (missing pattern: $pattern)"
  fi
}

echo "=============================================="
echo "Coming-Soon Smoke Test"
echo "Target: $BASE_URL"
echo "Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "=============================================="

echo "--- Connectivity ---"
if http_request "GET" "/"; then
  info "Target reachable"
  pass
else
  fail "Target not reachable ($LAST_STATUS)"
  echo "=============================================="
  echo "Results: $PASSED passed, $FAILED failed"
  exit 2
fi

echo "--- Core Routes ---"
assert_status "GET" "/" "200" "Root should show coming-soon"
assert_status "HEAD" "/" "200" "HEAD root"
assert_status "GET" "/coming-soon" "200" "Direct route"
assert_status "GET" "/auth/login" "200" "Auth entry page is reachable for internal testing"

echo "--- Redirects ---"
assert_redirect "GET" "/dashboard" "302" "/coming-soon" "Private page blocked"
assert_redirect "GET" "/pricing" "302" "/coming-soon"
assert_redirect "GET" "/orders" "302" "/coming-soon"
assert_redirect "HEAD" "/dashboard" "302" "/coming-soon" "HEAD private route"

echo "--- API Security ---"
assert_status "GET" "/api/auth/session" "200" "Auth API must stay reachable"
assert_status "GET" "/api/orders" "404" "Orders API blocked"
assert_status "GET" "/api/v1/orders" "404" "v1 Orders API blocked"
assert_status "DELETE" "/api/subscribe" "404" "DELETE blocked"
assert_status "PUT" "/api/subscribe" "404" "PUT blocked"

echo "--- Subscribe API ---"
assert_status "OPTIONS" "/api/subscribe" "204" "CORS preflight"
allow_methods="$(header_value 'access-control-allow-methods')"
if [[ "$allow_methods" == *"POST"* && "$allow_methods" == *"OPTIONS"* ]]; then
  info "CORS methods include POST, OPTIONS"
  pass
else
  fail "CORS methods invalid: '$allow_methods'"
fi

if http_request "POST" "/api/subscribe" '{"email":"invalid"}' "application/json"; then
  if [[ "$LAST_STATUS" == "200" || "$LAST_STATUS" == "400" ]]; then
    info "POST /api/subscribe responds with expected class ($LAST_STATUS)"
    pass
  else
    fail "POST /api/subscribe unexpected status $LAST_STATUS"
  fi
else
  fail "POST /api/subscribe request failed ($LAST_STATUS)"
fi

echo "--- Static + SEO ---"
assert_status "GET" "/favicon.ico" "200" "Favicon"
assert_status "GET" "/robots.txt" "200" "robots.txt"
assert_status "GET" "/sitemap.xml" "200" "sitemap.xml"

if http_request "GET" "/robots.txt"; then
  assert_body_pattern 'Allow: /coming-soon' 'robots.txt includes coming-soon allow'
  assert_body_pattern 'Disallow: /dashboard/' 'robots.txt includes dashboard disallow'
else
  fail "GET /robots.txt request failed ($LAST_STATUS)"
fi

if http_request "GET" "/sitemap.xml"; then
  if sitemap_has_path "/"; then
    info "sitemap includes root"
    pass
  else
    fail "sitemap missing root entry"
  fi

  if sitemap_has_path "/coming-soon"; then
    info "sitemap includes /coming-soon"
    pass
  else
    fail "sitemap missing /coming-soon entry"
  fi
else
  fail "GET /sitemap.xml request failed ($LAST_STATUS)"
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
