/**
 * TCMB rates on the isolated local test database only: the rate in force on a day is the previous
 * bulletin, weekends fall back to Friday, stored bulletins are not fetched again, and the daily sync.
 * The network is replaced by the real 13.10.2026 bulletin (and dated copies of it).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'fx-integration-local-only-1234567890123456789';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const fx = await import('../lib/features/fx/rates.server');
    const fixture = readFileSync('__tests__/fixtures/tcmb-13102026.xml', 'utf8');
    // Published bulletins in this fake archive: Fri 9.10 (EUR shifted) and Tue 13.10; Sat–Mon none.
    const published: Record<string, string> = {
      '09102026': fixture.replace('Tarih="13.10.2026"', 'Tarih="09.10.2026"').replace('<ForexBuying>55.1128</ForexBuying>', '<ForexBuying>54.9000</ForexBuying>'),
      '13102026': fixture,
    };
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(url);
      const key = /(\d{8})\.xml$/.exec(url)?.[1] ?? (url.endsWith('today.xml') ? '13102026' : '');
      return published[key] ? new Response(published[key], { status: 200 }) : new Response('Not found', { status: 404 });
    }) as unknown as typeof fetch;

    // Wednesday 14.10 uses Tuesday's bulletin.
    const wed = await fx.effectiveRate(db, 'eur', '2026-10-14', fakeFetch);
    assert.deepEqual(wed, { currency: 'EUR', rate: 55.1128, bulletinDate: '2026-10-13', source: 'TCMB' });
    const fetchedOnce = calls.length;
    // Asked again: served from the table, no new request.
    assert.deepEqual(await fx.effectiveRate(db, 'EUR', '2026-10-14', fakeFetch), wed);
    assert.equal(calls.length, fetchedOnce);

    // Monday 12.10: Sunday and Saturday have no bulletin → Friday 9.10.
    const mon = await fx.effectiveRate(db, 'EUR', '2026-10-12', fakeFetch);
    assert.deepEqual([mon?.rate, mon?.bulletinDate], [54.9, '2026-10-09']);

    // Per-unit rates, TRY and unknown currencies.
    const jpy = await fx.effectiveRate(db, 'JPY', '2026-10-14', fakeFetch);
    assert(jpy && jpy.rate < 1, 'JPY is per 1 yen, not per 100');
    assert.equal(await fx.effectiveRate(db, 'TRY', '2026-10-14', fakeFetch), null);
    assert.equal(await fx.effectiveRate(db, 'XXX', '2026-10-14', fakeFetch), null);

    // Nothing published in the whole window → null, not a stale or invented rate.
    assert.equal(await fx.effectiveRate(db, 'EUR', '2025-01-01', fakeFetch), null);

    // The daily sync stores today's bulletin and can run twice.
    await db`DELETE FROM exchange_rates WHERE bulletin_date = '2026-10-13'`;
    const synced = await fx.syncTcmb(db, fakeFetch);
    assert.equal((synced as any).date, '2026-10-13');
    await fx.syncTcmb(db, fakeFetch);
    const [count] = await db`SELECT count(*)::int AS n FROM exchange_rates WHERE bulletin_date = '2026-10-13'`;
    assert.equal(count.n, published['13102026'].match(/<Currency /g)!.length);

    // Issuing a EUR invoice stores the rate in force on its date (13.10 bulletin for 14.10).
    const inv = await import('../lib/features/finance/invoices.server');
    const { randomUUID } = await import('node:crypto');
    const tenantId = randomUUID();
    const userId = randomUUID();
    await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Kur Test', ${'fx-' + tenantId.slice(0, 8)})`;
    await db`INSERT INTO users (id, email, name) VALUES (${userId}, ${`acc-${userId}@test.local`}, 'Muhasebe')`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${userId}, 'accountant')`;
    const [o] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, status, total_amount, currency, product_name) VALUES (${tenantId}, 'FX-1', 'GmbH', 'approved', 1200, 'EUR', 'Pergola') RETURNING id`;
    const [it] = await db`INSERT INTO order_items (order_id, product_name, quantity, unit_price, total_price) VALUES (${o.id}, 'Pergola', 1, 1000, 1000) RETURNING id`;
    const acc = { tenantId, userId, role: 'accountant' as any };
    const draft = await inv.createInvoiceDraft(acc, String(o.id), { lines: [{ orderItemId: it.id, quantity: 1 }] });
    await inv.issueInvoice(acc, draft.id, { issuedOn: '2026-10-14' });
    const [issued] = await db`SELECT exchange_rate::float AS r FROM invoices WHERE id = ${draft.id}`;
    assert.equal(issued.r, 55.1128, 'EUR invoice takes the TCMB rate in force on its date');

    console.log('PASS · TCMB: rate in force = previous bulletin, weekend → Friday, stored bulletins reused, per-unit JPY, TRY/unknown/no-bulletin → null, idempotent daily sync, EUR invoice stamped with its date’s rate');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
