/**
 * Cut list from an order sheet on the isolated local test database only: a real föy (customer name
 * replaced) is planned against bars, a leftover and a scrap bar in three warehouses. Leftover and
 * scrap are used first, a lot of another colour is never cut, reserved and consumed lots are left
 * alone, stock of another firm is invisible, and a worker may not plan.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'cut-list-integration-local-only-123456789012345';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {}, max: 2 });
  try {
    assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
    const { planCutListFromDoc } = await import('../lib/features/manufacturing/cut-list.server');
    const { parseFoy } = await import('../lib/features/foy/parse');
    const doc = parseFoy(JSON.parse(readFileSync('__tests__/fixtures/foy/pergola-g.json', 'utf8')));

    const seed = async (label: string) => {
      const tenantId = randomUUID();
      const userId = randomUUID();
      await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, ${label}, ${`cl-${tenantId.slice(0, 8)}`})`;
      await db`INSERT INTO users (id, email, name) VALUES (${userId}, ${`o-${userId}@test.local`}, 'Sahip')`;
      await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${userId}, 'owner')`;
      const wh: Record<string, string> = {};
      for (const type of ['RAW', 'REUSABLE_REMNANTS', 'SCRAP']) {
        const [w] = await db`INSERT INTO warehouses (tenant_id, code, name, warehouse_type) VALUES (${tenantId}, ${`${type}-${tenantId.slice(0, 4)}`}, ${type}, ${type}) RETURNING id`;
        wh[type] = w.id;
      }
      const item = async (name: string, sku: string, profileCode: string | null) =>
        (await db`INSERT INTO inventory_items (tenant_id, name, sku, stock_uom, profile_code, standard_length_m) VALUES (${tenantId}, ${name}, ${`${sku}-${tenantId.slice(0, 4)}`}, 'm', ${profileCode}, 6) RETURNING id`)[0].id as string;
      const lot = (itemId: string, warehouse: string, meters: number, color: string, extra: { status?: string; remnant?: boolean } = {}) =>
        db`INSERT INTO stock_lots (tenant_id, item_id, warehouse_id, lot_number, original_qty, remaining_qty, length_m, status, metadata)
           VALUES (${tenantId}, ${itemId}, ${wh[warehouse]}, ${`L-${randomUUID().slice(0, 8)}`}, ${meters}, ${meters}, ${meters}, ${extra.status ?? 'available'}, ${JSON.stringify({ color, isRemnant: extra.remnant === true })}::text::jsonb)`;
      return { tenantId, userId, item, lot };
    };

    const a = await seed('Kesim A');
    const dere = await a.item('Dere profili', 'DERE', null);
    const boru = await a.item('Alüminyum boru', 'BORU', null);
    const led = await a.item('LED profili 40x60', 'LED', '40*60');
    const demir = await a.item('Demir 50x100', 'DMR', '50*100');
    const color = 'RAL 7016 Mat';
    for (let i = 0; i < 2; i++) await a.lot(dere, 'RAW', 6, color);
    await a.lot(dere, 'REUSABLE_REMNANTS', 4.1, color, { remnant: true });
    for (let i = 0; i < 2; i++) await a.lot(boru, 'RAW', 6, '7016 MAT'); // another spelling of the same colour
    for (let i = 0; i < 8; i++) await a.lot(led, 'RAW', 6, color);
    for (let i = 0; i < 3; i++) await a.lot(demir, 'RAW', 6, '');
    await a.lot(demir, 'SCRAP', 2.85, '');
    // These must never be cut: reserved, consumed, and a wrong colour.
    await a.lot(dere, 'RAW', 6, color, { status: 'reserved' });
    await a.lot(dere, 'RAW', 6, color, { status: 'consumed' });
    await a.lot(boru, 'RAW', 6, 'RAL 9005 Mat');

    const owner = { tenantId: a.tenantId, userId: a.userId, role: 'owner' as const };
    const r = await planCutListFromDoc(owner, { doc });
    assert.equal(r.color, color);
    assert.equal(r.plan.unmatched.length, 0);
    assert.equal(r.plan.summary.pieces, 17);
    assert.equal(r.plan.summary.toBuy, 0, 'stock is enough');
    assert.equal(r.plan.summary.remnantsUsed, 1, 'the leftover is used');
    assert.equal(r.plan.summary.scrapUsed, 1, 'the scrap bar is used');
    const used = r.plan.groups.flatMap((g) => g.bars);
    assert.ok(used.every((b) => b.sourceLengthMm > 0));
    const boruGroup = r.plan.groups.find((g) => g.itemId === boru)!;
    assert.equal(boruGroup.bars.length, 2, 'both 7016 boru bars (written "7016 MAT") are used');
    assert.equal(r.plan.groups.find((g) => g.itemId === dere)!.bars.some((b) => b.sourceLengthMm === 6000 && b.cuts.length === 0), false);
    assert.equal((await db`SELECT count(*)::int AS n FROM stock_lots WHERE tenant_id = ${a.tenantId} AND status = 'available'`)[0].n, 2 + 1 + 2 + 8 + 3 + 1 + 1, 'nothing was reserved or changed');

    // Fewer bars than pieces → the shortfall is bought, nothing is lost.
    await db`DELETE FROM stock_lots WHERE tenant_id = ${a.tenantId} AND item_id = ${led} AND id IN (SELECT id FROM stock_lots WHERE tenant_id = ${a.tenantId} AND item_id = ${led} LIMIT 3)`;
    const short = await planCutListFromDoc(owner, { doc });
    const ledGroup = short.plan.groups.find((g) => g.itemId === led)!;
    assert.equal(ledGroup.bars.length + (ledGroup.buy?.bars ?? 0), 8);
    assert.equal(ledGroup.buy?.bars, 3);

    // Another firm sees none of this stock and plans everything as a purchase.
    const b = await seed('Kesim B');
    const none = await planCutListFromDoc({ tenantId: b.tenantId, userId: b.userId, role: 'owner' }, { doc });
    assert.equal(none.stock.bars, 0);
    assert.equal(none.plan.unmatched.length, 5, 'firm B has no profile cards yet');

    // A worker may not plan; a row picks its profile when two cards fit.
    await assert.rejects(planCutListFromDoc({ ...owner, role: 'worker' }, { doc }), /yetkiniz yok/);
    const demir2 = await a.item('Demir 50x100 kalın', 'DMR2', null);
    await a.lot(demir2, 'RAW', 6, '');
    const ambiguous = await planCutListFromDoc(owner, { doc });
    assert.equal(ambiguous.plan.unmatched.length, 2);
    const steel = ambiguous.rows.filter((row) => row.kind === 'demir');
    const picked = await planCutListFromDoc(owner, { doc, choices: Object.fromEntries(steel.map((row) => [row.id, demir2])) });
    assert.equal(picked.plan.unmatched.length, 0);
    assert.ok(picked.plan.groups.find((g) => g.itemId === demir2)!.bars.length >= 1);

    console.log('PASS · cut list: leftover and scrap bars used first, colours matched across spellings, reserved/consumed lots untouched, shortfall bought, firms isolated, worker refused, ambiguous profile chosen by the person');
  } finally {
    await db.end({ timeout: 5 });
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
