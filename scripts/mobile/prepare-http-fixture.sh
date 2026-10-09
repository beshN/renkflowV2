#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../apps/web"
# These credentials describe only the disposable db:local instance, never a deployed database.
export DATABASE_URL='postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test'
export ALLOW_LOCAL_DATABASE=1 AUTH_SECRET='field-integration-local-only-12345678901234567890'
export AUTH_URL='http://127.0.0.1:3022' NEXTAUTH_URL='http://127.0.0.1:3022'
export AUTH_TRUST_HOST=true ALLOW_INSECURE_HTTP=1 PUBLIC_SITE_MODE=off PRIVATE_ACCESS_EMAIL=''
export STORAGE_BACKEND=local ALLOW_LOCAL_STORAGE=1 RESEND_API_KEY=''
npm run db:local > /tmp/mobile-db.log 2>&1 &
for attempt in $(seq 1 90); do
  if grep -q 'Local PostgreSQL ready:' /tmp/mobile-db.log; then break; fi
  if [ "$attempt" = 90 ]; then cat /tmp/mobile-db.log; exit 1; fi
  sleep 1
done
npm run build > /tmp/mobile-build.log 2>&1 || { tail -100 /tmp/mobile-build.log; exit 1; }
npx tsx ../../scripts/mobile/apply-local-schema.ts
npm run test:field -- --fixture=/tmp/renkflow-mobile-fixture.json
npm run start:next -- -p 3022 > /tmp/mobile-server.log 2>&1 &
for attempt in $(seq 1 60); do
  if curl --silent --output /dev/null http://127.0.0.1:3022/api/mobile/v1/snapshot; then break; fi
  if [ "$attempt" = 60 ]; then cat /tmp/mobile-server.log; exit 1; fi
  sleep 1
done
npx tsx --require ./scripts/register-server-only.cjs scripts/test-mobile-sync.ts --server=http://127.0.0.1:3022
openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/mobile-test.key -out /tmp/mobile-test.crt -days 1 -subj /CN=localhost -addext 'subjectAltName=IP:127.0.0.1,DNS:localhost' > /tmp/mobile-tls.log 2>&1
node ../../scripts/mobile/test-https-server.mjs /tmp/renkflow-mobile-fixture.json /tmp/mobile-test.crt /tmp/mobile-test.key > /tmp/mobile-https.log 2>&1 &
for attempt in $(seq 1 30); do
  if curl --silent --insecure --output /dev/null https://127.0.0.1:3043/fixture; then exit 0; fi
  sleep 1
done
cat /tmp/mobile-https.log
exit 1
