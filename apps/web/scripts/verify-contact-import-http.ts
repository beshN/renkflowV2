/** Real HTTP checks against an explicitly selected local preview, with its synthetic test fixture. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  const origin = new URL(
    process.argv[2] || 'http://127.0.0.1:3131',
  );
  assert(
    ['localhost', '127.0.0.1'].includes(origin.hostname) &&
      origin.protocol === 'http:',
    'local preview required',
  );
  const fixture = JSON.parse(
    readFileSync('.data/import-preview-fixture.json', 'utf8'),
  );
  const db = postgres(localTestDatabaseURL());
  try {
    assert.equal(
      (await db`SELECT current_database() AS name`)[0].name,
      'renkflow_test',
    );
    const login = async (email: string) => {
      const cookies = new Map<string, string>();
      const fetchLocal = async (path: string, init: RequestInit = {}) => {
        const response = await fetch(new URL(path, origin), {
          ...init,
          redirect: 'manual',
          headers: {
            cookie: [...cookies]
              .map(([key, value]) => `${key}=${value}`)
              .join('; '),
            ...init.headers,
          },
          signal: AbortSignal.timeout(30_000),
        });
        for (const header of response.headers.getSetCookie()) {
          const cookie = header.split(';')[0],
            equals = cookie.indexOf('=');
          cookies.set(cookie.slice(0, equals), cookie.slice(equals + 1));
        }
        return response;
      };
      const csrf = await (await fetchLocal('/api/auth/csrf')).json();
      const signIn = await fetchLocal('/api/auth/callback/credentials', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-auth-return-redirect': '1',
          origin: origin.origin,
        },
        body: new URLSearchParams({
          email,
          password: fixture.password,
          csrfToken: csrf.csrfToken,
          callbackUrl: origin.origin + '/dashboard',
        }),
      });
      assert.equal(signIn.status, 200, 'synthetic sign-in succeeds');
      const session = await (await fetchLocal('/api/auth/session')).json();
      assert(session.user?.id, 'real server session exists');
      return fetchLocal;
    };
    const owner = await login(fixture.email);
    const worker = await login(fixture.workerEmail);
    const customerPath = '/api/v1/customers/import';
    const supplierPath = '/api/v1/procurement/suppliers/import';
    const input = {
      text: 'Ad Soyad;E-posta\nHTTP Denemesi;http-check@test.local',
    };
    const post = (
      client: typeof owner,
      path: string,
      body: unknown,
      requestOrigin = origin.origin,
    ) =>
      client(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: requestOrigin },
        body: JSON.stringify(body),
      });
    for (const path of [customerPath, supplierPath]) {
      const text =
        path === supplierPath
          ? 'Firma;E-posta\nHTTP Tedarik;http-supplier@test.local'
          : input.text;
      assert.equal(
        (await post(worker, path, { text })).status,
        403,
        'worker cannot preview or import cards',
      );
      assert.equal(
        (await post(owner, path, { text }, 'https://foreign.invalid')).status,
        403,
        'cross-site writes refused',
      );
      const preview = await post(owner, path, { text });
      assert.equal(preview.status, 200);
      const payload = await preview.json();
      assert.match(payload.previewHash, /^[a-f0-9]{64}$/);
      assert.equal(
        (await post(owner, path, { text, dryRun: false })).status,
        409,
        'confirmation requires the reviewed fingerprint',
      );
      assert.equal(
        (
          await post(owner, path, {
            text,
            dryRun: false,
            previewHash: payload.previewHash,
            fillEmpty: true,
          })
        ).status,
        409,
        'changed options invalidate review',
      );
      assert.equal(
        (await post(owner, path, { text: 'Firma;Not\nÖrnek;"kapanmamış' }))
          .status,
        400,
        'bad CSV is a client error',
      );
    }
    const [counts] =
      await db`SELECT (SELECT count(*) FROM customers WHERE tenant_id = ${fixture.tenantId} AND email = 'http-check@test.local') AS customers,
      (SELECT count(*) FROM suppliers WHERE tenant_id = ${fixture.tenantId} AND email = 'http-supplier@test.local') AS suppliers`;
    assert.deepEqual(
      [Number(counts.customers), Number(counts.suppliers)],
      [0, 0],
      'denied writes and previews create nothing',
    );
    const countPath = '/api/v1/inventory/count-import';
    const itemName = 'HTTP Köşebent ' + randomUUID().slice(0, 8);
    const countInput = { format: 'csv', fileName: 'http-sayim.csv', warehouseId: fixture.warehouseId,
      text: `Malzeme;Miktar;Birim\n${itemName};7;adet\nGeçersiz;1,5;adet` };
    assert.equal((await worker(countPath)).status, 403);
    assert.equal((await post(worker, countPath, countInput)).status, 403);
    assert.equal((await owner(countPath, { method: 'POST', headers: { 'content-type': 'application/json', origin: origin.origin }, body: '{' })).status, 400);
    assert.equal((await post(owner, countPath, countInput, 'https://foreign.invalid')).status, 403);
    assert.equal((await post(owner, countPath, { ...countInput, warehouseId: '00000000-0000-4000-8000-000000000001' })).status, 400);
    assert.equal((await post(owner, countPath, { ...countInput, text: 'Malzeme;Miktar\nKapak;2' })).status, 400);
    const filedResponse = await post(owner, countPath, countInput);
    assert.equal(filedResponse.status, 200);
    const { data: filed } = await filedResponse.json();
    assert.deepEqual(filed.summary, { rows: 2, counted: 1, metres: 0, uncertain: 1 });
    assert.equal((await db`SELECT count(*)::int AS n FROM inventory_items WHERE tenant_id=${fixture.tenantId} AND name=${itemName}`)[0].n, 0);
    const approvePath = '/api/v1/ai/suggestions/' + filed.suggestionId;
    const [suggestion] = await db`SELECT version FROM ai_suggestions WHERE tenant_id=${fixture.tenantId} AND id=${filed.suggestionId}`;
    const decision = { action: 'approve', expectedVersion: suggestion.version };
    assert.equal((await post(worker, approvePath, decision)).status, 403);
    assert.equal((await post(owner, approvePath, decision, 'https://foreign.invalid')).status, 403);
    const approved = await post(owner, approvePath, decision);
    assert.equal(approved.status, 200);
    assert.equal((await approved.json()).result.applied, 1);
    const [balance] = await db`SELECT b.on_hand_qty FROM stock_balances b JOIN inventory_items i ON i.id=b.item_id AND i.tenant_id=b.tenant_id WHERE b.tenant_id=${fixture.tenantId} AND i.name=${itemName}`;
    assert.equal(Number(balance.on_hand_qty), 7);
    assert.equal((await post(owner, countPath, countInput)).status, 409);
    console.log('PASS · stock CSV HTTP/session: manager approval posts exactly 7 pieces, uncertain row excluded, roles/cross-site/warehouse/header denied, duplicate 409');
    console.log(
      'PASS · real HTTP/session: owner preview succeeds, worker/cross-site requests denied, missing/stale confirmation 409, bad CSV 400 and database unchanged',
    );
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
