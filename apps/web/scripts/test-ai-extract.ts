import { localTestDatabaseUrl } from './local-test-database';
/**
 * Integration test for input → record drafts (gece 3, AI-5) on the isolated local test database only:
 * a pasted WhatsApp message becomes a quote draft (preview first, nothing written until approval,
 * contact details on the internal note), a supplier's offer becomes the answer to our price request,
 * and role limits hold (a worker cannot, a closed request is refused). No model is used.
 */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseUrl();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const f of ['029_ai_suggestions.sql', '041_quote_order_depth.sql', '043_stock_purchasing_depth.sql', '044_access_control.sql', '048_ai_assistant.sql']) await db.unsafe(readFileSync(`lib/db/migrations/${f}`, 'utf8'));

  const { quoteRequestPreview, supplierOfferPreview } = await import('../lib/ai/extract/run.server');
  const svc = await import('../lib/ai/suggestions/service');
  const depth = await import('../lib/features/stock/depth.server');
  const { sql } = await import('../lib/db');

  const tenantId = randomUUID();
  const ids: Record<string, string> = {};
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Çıkarım test', ${'ext-' + tenantId.slice(0, 8)})`;
  for (const role of ['owner', 'worker']) {
    ids[role] = randomUUID();
    await db`INSERT INTO users (id, email, name) VALUES (${ids[role]}, ${`${role}-${ids[role]}@test.local`}, ${role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${ids[role]}, ${role})`;
  }
  const owner = { tenantId, userId: ids.owner, role: 'owner' as any };
  const worker = { tenantId, userId: ids.worker, role: 'worker' as any };

  // Pasted message → preview with confidence per field; nothing written before approval.
  const msg = `Merhaba, bahçe için 3x4 bioklimatik pergola antrasit istiyoruz. Bir de 2 adet 2,5x2 zip perde beyaz.
Adres: Bağdat Cad. No 12 Kadıköy
0532 123 45 67
Selin Aydın`;
  const pv: any = await quoteRequestPreview(owner, { text: msg });
  assert.equal(pv.type, 'preview');
  assert.equal(pv.usedModel, false, 'mode "rules" by default: no model call');
  assert.equal(pv.request.lines.length, 2);
  assert.equal(pv.request.customer.confidence, 'medium', 'a signature line is not "sure"');
  assert.equal((await db`SELECT count(*)::int AS n FROM quotations WHERE tenant_id = ${tenantId}`)[0].n, 0);
  const done: any = await svc.decideSuggestion(owner, pv.suggestionId, { action: 'approve', expectedVersion: pv.version });
  const [q] = await db`SELECT status, customer_name, internal_notes FROM quotations WHERE id = ${done.result.quotationId}`;
  assert.deepEqual([q.status, q.customer_name], ['draft', 'Selin Aydın']);
  assert.match(q.internal_notes, /Tel: 05321234567/);
  const items = await db`SELECT width_mm, projection_mm, color, quantity FROM quotation_items WHERE quotation_id = ${done.result.quotationId} ORDER BY position NULLS LAST, created_at`;
  assert.deepEqual(items.map((i: any) => [Number(i.width_mm), Number(i.projection_mm), i.color, Number(i.quantity)]).sort(), [[2500, 2000, 'RAL 9016', 2], [3000, 4000, 'RAL 7016', 1]]);
  // No measure → it says so, files nothing.
  assert.equal(((await quoteRequestPreview(owner, { text: 'abi pergola fiyatı ne kadar ölçü sonra atarım' })) as any).type, 'need');
  await assert.rejects(quoteRequestPreview(worker, { text: msg }), /yetkiniz yok/);

  // Supplier offer → answer to our price request (line by line), approval records it.
  const sup = randomUUID();
  await db`INSERT INTO suppliers (id, tenant_id, name, is_active) VALUES (${sup}, ${tenantId}, 'Örnek Alüminyum', true)`;
  const [wh] = await db`INSERT INTO warehouses (tenant_id, code, name, warehouse_type) VALUES (${tenantId}, ${'RAW-' + tenantId.slice(0, 4)}, 'Hammadde', 'RAW') RETURNING id`;
  const [i1] = await db`INSERT INTO inventory_items (tenant_id, name, sku, stock_uom) VALUES (${tenantId}, 'Kenar kapak profili', ${'KK-40'}, 'adet') RETURNING id`;
  const [i2] = await db`INSERT INTO inventory_items (tenant_id, name, sku, stock_uom) VALUES (${tenantId}, 'Motor seti Somfy', ${'MS-' + tenantId.slice(0, 4)}, 'adet') RETURNING id`;
  const rfqId: any = await depth.createRfq(owner as any, { supplierIds: [sup], lines: [{ itemId: i1.id, warehouseId: wh.id, quantity: 10 }, { itemId: i2.id, warehouseId: wh.id, quantity: 2 }] });
  const rfq = (await depth.listRfqs(owner as any)).rfqs[0];
  assert.equal(String(rfq.id), String(typeof rfqId === 'object' ? rfqId.id ?? rfq.id : rfqId));
  const offer: any = await supplierOfferPreview(owner, { rfqId: rfq.id, supplierId: sup, text: `ÖRNEK ALÜMİNYUM — FİYAT TEKLİFİ
Kenar kapak profili KK40 eloksal 10 adet birim fiyat: 480,00 TL toplam 4.800,00 TL
Teslim süresi: 7 iş günü
Teklif 15 gün süreyle geçerlidir.` });
  assert.equal(offer.type, 'preview');
  assert.equal(offer.offer.unmatched[0], 'Motor seti Somfy', 'a line not in the offer stays empty (never guessed)');
  await svc.decideSuggestion(owner, offer.suggestionId, { action: 'approve', expectedVersion: offer.version });
  const [resp] = await db`SELECT lead_time_days, prices FROM purchase_rfq_responses WHERE tenant_id = ${tenantId} AND rfq_id = ${rfq.id}`;
  assert.equal(resp.lead_time_days, 7);
  assert.deepEqual(resp.prices.map((p: any) => Number(p.unitPrice)), [480]);
  await assert.rejects(supplierOfferPreview(owner, { rfqId: rfq.id, supplierId: randomUUID(), text: 'KK40 480 TL' }), /teklif istenmedi/);
  // Another currency is not taken as ours; a role that hides prices does not read supplier answers.
  const eur: any = await supplierOfferPreview(owner, { rfqId: rfq.id, supplierId: sup, text: 'KK40 kenar kapak 12,50 EUR birim fiyat' });
  assert.equal(eur.type, 'need');
  assert.match(eur.message, /fiyatlar çevrilmez/);
  const team = await import('../lib/security/team.server');
  const access = await import('../lib/security/member-access.server');
  ids.office = randomUUID();
  await db`INSERT INTO users (id, email, name) VALUES (${ids.office}, ${`office-${ids.office}@test.local`}, 'office')`;
  await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${ids.office}, 'office')`;
  const hidden = await team.saveRole(owner as any, null, { name: 'Fiyatsız satın alma', base: 'office', permissions: { purchasing: ['view', 'create', 'edit'] }, hidden: ['price'] });
  await team.updateMember(owner as any, ids.office, { accessRole: hidden });
  access.forgetMemberAccess(ids.office, tenantId);
  await assert.rejects(supplierOfferPreview({ tenantId, userId: ids.office, role: 'office' as any }, { rfqId: rfq.id, supplierId: sup, text: 'KK40 480 TL' }), /yetkiniz yok/);

  for (const t of ['purchase_rfq_responses', 'purchase_rfq_lines', 'purchase_rfqs', 'suppliers', 'warehouse_locations', 'warehouses', 'inventory_items', 'quotation_items', 'quotations', 'audit_logs', 'ai_suggestions'])
    await db`DELETE FROM ${db(t)} WHERE tenant_id = ${tenantId}`.catch(() => {});
  await db`UPDATE tenant_members SET access_role_id = NULL WHERE tenant_id = ${tenantId}`.catch(() => {});
  await db`DELETE FROM access_roles WHERE tenant_id = ${tenantId}`.catch(() => {});
  await db`DELETE FROM tenants WHERE id = ${tenantId}`;
  await db`DELETE FROM users WHERE id = ANY(${Object.values(ids)}::uuid[])`;
  await db.end();
  await (sql as any).end?.();
  console.log('test:ai-extract OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
