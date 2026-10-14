import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { WorkOrderActor, WorkOrderApiError } from '@/lib/features/work-orders/security';
import { postStockEntryInTransaction } from './inventory.service';
import { COUNT_UNITS, unitLabel } from '@/lib/features/inventory/vocabulary';
const uuid = z.string().uuid();
const qty = z.number().finite().nonnegative().max(1000000);
const note = z.string().trim().max(2000).default('');
const count = (v: unknown) => Number(v || 0);
const json = (v: unknown) => JSON.stringify(v);
const fail = (message: string, status = 409): never => { throw new WorkOrderApiError(message, status); };
export function requireProcurementRead(actor: WorkOrderActor) {
  if (!['owner', 'admin', 'office', 'accountant'].includes(actor.role)) fail('Satın alma erişim yetkiniz yok', 403);
}
export function requireProcurementWrite(actor: WorkOrderActor) {
  if (!['owner', 'admin', 'office'].includes(actor.role)) fail('Satın alma yönetim yetkisi gerekli', 403);
}
export const SupplierInputSchema = z.object({
  id: uuid.optional(), version: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(180), contactName: z.string().trim().max(180).default(''),
  phone: z.string().trim().max(60).default(''), email: z.union([z.literal(''), z.email()]).default(''),
  paymentTerms: z.number().int().min(0).max(365).default(30),
  notes: note, isActive: z.boolean().default(true),
}).refine(d => !d.id || !!d.version, 'Düzenleme için kayıt sürümü gerekli');
export const PurchaseInputSchema = z.object({
  currency:z.enum(["TRY","EUR","USD","GBP"]).default("TRY"),
  supplierId: uuid, expectedAt: z.iso.date().optional(), notes: note,
  lines: z.array(z.object({
    itemId: uuid, warehouseId: uuid, quantity: qty.positive(), unitPrice: qty,
    lengthMm: z.number().int().min(100).max(30000).optional(),
    color: z.string().trim().max(100).default(''),
  })).min(1).max(100),
});
export const ReceiptInputSchema = z.object({
  purchaseOrderId: uuid, version: z.number().int().positive(), notes: note,
  lines: z.array(z.object({
    lineId: uuid, acceptedQty: qty, rejectedQty: qty.default(0),
    // For a profile line ordered before colour was required: the colour of the bars received.
    color: z.string().trim().max(100).optional(),
    rejectedWarehouseId: uuid.optional(), rejectionReason: z.string().trim().max(1000).default(''),
  }).refine(d => d.acceptedQty + d.rejectedQty > 0, 'Kabul veya red miktarı gerekli')
    .refine(d => !d.rejectedQty || (!!d.rejectedWarehouseId && d.rejectionReason.length >= 5), 'Red deposu ve gerekçesi gerekli'))
    .min(1).max(100),
});
export type ProcurementLine = {
  id: string; item_id: string; item_name: string; warehouse_id: string; warehouse_name: string;
  ordered_qty: number; received_qty: number; uom: string; unit_price: number;
  metadata: { lengthMm?: number; color?: string }; position: number;
};
export type ProcurementOrder = {
  id: string; purchase_order_number: string; supplier_name: string; status: string; version: number;
  currency:string|null; expected_at: string | null; notes: string; created_at: string; lines: ProcurementLine[];
};
export type ProcurementSupplier = { id: string; name: string; contact_name: string; phone: string; email: string; payment_terms: number; notes: string; is_active: boolean; version: number };
export type ProcurementReceipt = { id: string; receipt_number: string; purchase_order_number: string; supplier_name: string; status: string; notes: string; created_at: string; stock_entry_id: string; lines: Array<{ item_name: string; accepted_qty: number; rejected_qty: number; uom: string; metadata: { rejectionReason?: string } }> };
export type ProcurementWorkspaceData = {
  actor: WorkOrderActor; suppliers: ProcurementSupplier[]; orders: ProcurementOrder[]; receipts: ProcurementReceipt[];
  items: Array<{ id: string; name: string; stock_uom: string; standard_length_m: number }>;
  warehouses: Array<{ id: string; name: string; warehouse_type: string }>;
};
export async function procurementOrders(actor: WorkOrderActor) {
  requireProcurementRead(actor);
  return sql`SELECT po.*,s.name AS supplier_name,COALESCE((SELECT json_agg(json_build_object('id',l.id,'item_id',l.item_id,'item_name',i.name,'warehouse_id',l.warehouse_id,'warehouse_name',w.name,'ordered_qty',l.ordered_qty,'received_qty',l.received_qty,'uom',l.uom,'unit_price',l.unit_price,'metadata',l.metadata,'position',l.position) ORDER BY l.position) FROM purchase_order_lines l JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id JOIN warehouses w ON w.id=l.warehouse_id AND w.tenant_id=l.tenant_id WHERE l.purchase_order_id=po.id AND l.tenant_id=po.tenant_id),'[]'::json)AS lines FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id AND s.tenant_id=po.tenant_id WHERE po.tenant_id=${actor.tenantId} ORDER BY po.created_at DESC LIMIT 300`;
}
export async function procurementReceipts(actor: WorkOrderActor) {
  requireProcurementRead(actor);
  return sql`SELECT gr.*,po.purchase_order_number,s.name AS supplier_name,u.name AS received_by_name,COALESCE((SELECT json_agg(json_build_object('id',l.id,'item_name',i.name,'accepted_qty',l.accepted_qty,'rejected_qty',l.rejected_qty,'uom',l.uom,'metadata',l.metadata,'accepted_warehouse_name',w.name)) FROM goods_receipt_lines l JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id JOIN warehouses w ON w.id=l.accepted_warehouse_id AND w.tenant_id=l.tenant_id WHERE l.goods_receipt_id=gr.id AND l.tenant_id=gr.tenant_id),'[]'::json)AS lines FROM goods_receipts gr LEFT JOIN purchase_orders po ON po.id=gr.purchase_order_id AND po.tenant_id=gr.tenant_id LEFT JOIN suppliers s ON s.id=po.supplier_id AND s.tenant_id=po.tenant_id LEFT JOIN users u ON u.id=gr.received_by WHERE gr.tenant_id=${actor.tenantId} ORDER BY gr.created_at DESC LIMIT 300`;
}
export async function procurementWorkspace(actor: WorkOrderActor) {
  requireProcurementRead(actor);
  const [suppliers, orders, receipts, items, warehouses] = await Promise.all([
    sql`SELECT * FROM suppliers WHERE tenant_id=${actor.tenantId} ORDER BY name`,
    procurementOrders(actor), procurementReceipts(actor),
    sql`SELECT id,name,stock_uom,standard_length_m FROM inventory_items WHERE tenant_id=${actor.tenantId} AND active=true AND item_type<>'finished_good' ORDER BY name`,
    sql`SELECT id,name,warehouse_type FROM warehouses WHERE tenant_id=${actor.tenantId} AND active=true AND warehouse_type IN('RAW','REJECTED') ORDER BY name`,
  ]);
  return { actor, suppliers, orders, receipts, items, warehouses };
}
export async function executeProcurement(tx: any, actor: WorkOrderActor, action: string, raw: unknown, key: string) {
  requireProcurementWrite(actor);
  const t = actor.tenantId;
  if (action === 'procurement.supplier.save') {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${t + ':supplier-create'}, 0))`;
    const d = SupplierInputSchema.parse(raw);
    if (d.id) {
      const [current] = await tx`SELECT * FROM suppliers WHERE tenant_id=${t} AND id=${d.id} FOR UPDATE`;
      if (!current) fail('Tedarikçi bulunamadı', 404);
      if (current.version !== d.version) fail('Tedarikçi başka bir kullanıcı tarafından değiştirildi. Listeyi yenileyin.');
      return (await tx`UPDATE suppliers SET name=${d.name},contact_name=${d.contactName},phone=${d.phone},email=${d.email},payment_terms=${d.paymentTerms},notes=${d.notes},is_active=${d.isActive},version=version+1,updated_at=now()WHERE tenant_id=${t} AND id=${d.id} RETURNING *`)[0];
    }
    if ((await tx`SELECT 1 FROM suppliers WHERE tenant_id=${t} AND lower(name)=lower(${d.name})`).length) fail('Bu tedarikçi zaten kayıtlı',400);
    return (await tx`INSERT INTO suppliers(tenant_id,name,contact_name,phone,email,payment_terms,notes,is_active)VALUES(${t},${d.name},${d.contactName},${d.phone},${d.email},${d.paymentTerms},${d.notes},${d.isActive})RETURNING *`)[0];
  }
  if (action === 'procurement.purchase.create') {
    const d = PurchaseInputSchema.parse(raw);
    if (!(await tx`SELECT 1 FROM suppliers WHERE tenant_id=${t} AND id=${d.supplierId} AND is_active=true`).length) fail('Aktif tedarikçi seçin',400);
    const [order] = await tx`INSERT INTO purchase_orders(tenant_id,purchase_order_number,supplier_id,created_by,expected_at,notes,currency)VALUES(${t},${'SAT-'+Date.now().toString(36).toUpperCase()+'-'+randomUUID().slice(0,6)},${d.supplierId},${actor.userId},${d.expectedAt || null},${d.notes},${d.currency})RETURNING *`;
    for (const [position, line] of d.lines.entries()) {
      const [item] = await tx`SELECT * FROM inventory_items WHERE tenant_id=${t} AND id=${line.itemId} AND active=true AND item_type<>'finished_good'`;
      if (!item) fail('Aktif hammadde veya sarf malzeme seçin',400);
      if (!(await tx`SELECT 1 FROM warehouses WHERE tenant_id=${t} AND id=${line.warehouseId} AND warehouse_type='RAW' AND active=true`).length) fail('Geçerli hammadde deposu gerekli',400);
      if (item.stock_uom === 'm' && line.quantity > 10000) fail('Bir kalemde en fazla 10.000 fiziksel çubuk alınabilir',400);
      if (item.stock_uom === 'm' && !line.lengthMm) fail('Metre ile izlenen profil için fiziksel çubuk boyu gerekli',400);
      // Each bar received from this line carries the colour; a profile bar without one cannot be cut.
      if (item.stock_uom === 'm' && !String(line.color ?? '').trim()) fail('Profil çubuğunun rengini girin (boyasız için "Boyasız")',400);
      if (item.stock_uom !== 'm' && line.lengthMm) fail('Fiziksel boy yalnız metre ile izlenen profilde kullanılır',400);
      if ((COUNT_UNITS.has(item.stock_uom) || item.stock_uom === 'm') && !Number.isInteger(line.quantity)) fail('Adet, takım veya çubuk miktarı tam sayı olmalı',400);
      const quantity = item.stock_uom === 'm' ? line.quantity * line.lengthMm! / 1000 : line.quantity;
      await tx`INSERT INTO purchase_order_lines(tenant_id,purchase_order_id,item_id,warehouse_id,ordered_qty,uom,unit_price,position,metadata)VALUES(${t},${order.id},${item.id},${line.warehouseId},${quantity},${item.stock_uom},${line.unitPrice},${position},${json({ lengthMm: line.lengthMm, color: line.color, orderedBarCount: item.stock_uom === 'm' ? line.quantity : undefined })}::text::jsonb)`;
    }
    return order;
  }
  if (action === 'procurement.purchase.transition') {
    const d = z.object({ id: uuid, version: z.number().int().positive(), status: z.enum(['submitted','cancelled']) }).parse(raw);
    const [order] = await tx`SELECT * FROM purchase_orders WHERE tenant_id=${t} AND id=${d.id} FOR UPDATE`;
    if (!order) fail('Satın alma siparişi bulunamadı',404);
    if (order.version !== d.version) fail('Sipariş değişti. Listeyi yenileyin.');
    if (d.status === 'submitted' && order.status !== 'draft') fail('Yalnız taslak satın alma siparişi onaylanabilir');
    if (d.status === 'cancelled' && !['draft','submitted'].includes(order.status)) fail('Kabul edilmiş sipariş iptal edilemez. Stok düzeltmesi ve yeni sipariş kullanın.');
    return (await tx`UPDATE purchase_orders SET status=${d.status},version=version+1,updated_at=now()WHERE tenant_id=${t} AND id=${order.id} RETURNING *`)[0];
  }
  if (action === 'procurement.receipt.reverse') {
    if (!['owner','admin'].includes(actor.role)) fail('Mal kabul düzeltmesi için yönetici yetkisi gerekli',403);
    const d = z.object({ id: uuid, version: z.number().int().positive(), reason: z.string().trim().min(5).max(1000) }).parse(raw);
    const [receipt] = await tx`SELECT * FROM goods_receipts WHERE tenant_id=${t} AND id=${d.id} FOR UPDATE`;
    if (!receipt || receipt.status !== 'submitted') fail('Bu mal kabul düzeltilemez');
    const [order] = await tx`SELECT * FROM purchase_orders WHERE tenant_id=${t} AND id=${receipt.purchase_order_id} FOR UPDATE`;
    if (!order || order.version !== d.version) fail('Satın alma siparişi değişti; listeyi yenileyin.');
    const [entry] = await tx`SELECT * FROM stock_entries WHERE tenant_id=${t} AND id=${receipt.stock_entry_id} FOR UPDATE`;
    if (!entry || (await tx`SELECT 1 FROM stock_entries WHERE tenant_id=${t} AND reversal_of_id=${entry.id}`).length) fail('Stok girişi zaten geri alınmış');
    const stock = await tx`SELECT * FROM stock_entry_lines WHERE tenant_id=${t} AND stock_entry_id=${entry.id}`;
    for (const line of stock) if (line.lot_id) {
      const [lot] = await tx`SELECT * FROM stock_lots WHERE tenant_id=${t} AND id=${line.lot_id} FOR UPDATE`;
      if (!lot || lot.status !== 'available' || count(lot.remaining_qty) !== count(lot.original_qty)) fail('Tüketilmiş veya rezerve profil kabulü geri alınamaz');
    }
    const reversal = await postStockEntryInTransaction(tx,actor,{
      entryType:'REVERSAL',idempotencyKey:key,referenceType:'stock_entry_reversal',referenceId:entry.id,note:d.reason,
      lines:stock.map((l: any)=>({ itemId:l.item_id,warehouseId:l.warehouse_id,lotId:l.lot_id || undefined,quantityDelta:-count(l.quantity_delta),uom:l.uom,unitCost:count(l.unit_cost),metadata:{ reversalOf:entry.id,goodsReceiptId:receipt.id,reason:d.reason } })),
    },{ reversalOfId:entry.id });
    for (const line of stock) if (line.lot_id) await tx`UPDATE stock_lots SET remaining_qty=0,status='consumed',updated_at=now()WHERE tenant_id=${t} AND id=${line.lot_id}`;
    const lines = await tx`SELECT * FROM goods_receipt_lines WHERE tenant_id=${t} AND goods_receipt_id=${receipt.id}`;
    for (const line of lines) {
      const updated = await tx`UPDATE purchase_order_lines SET received_qty=received_qty-${count(line.accepted_qty)} WHERE tenant_id=${t} AND purchase_order_id=${order.id} AND id=${line.purchase_order_line_id} AND received_qty>=${count(line.accepted_qty)} RETURNING id`;
      if (!updated.length) fail('Kabul miktarı düzeltmeyle uyuşmuyor');
    }
    await tx`UPDATE goods_receipts SET status='reversed',notes=COALESCE(notes,'') || ${' · Ters kayıt: '+d.reason} WHERE tenant_id=${t} AND id=${receipt.id}`;
    await tx`UPDATE purchase_orders po SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM purchase_order_lines l WHERE l.tenant_id=po.tenant_id AND l.purchase_order_id=po.id AND l.received_qty>0)THEN 'submitted' ELSE 'partially_received' END,version=version+1,updated_at=now()WHERE tenant_id=${t} AND id=${order.id}`;
    return reversal;
  }
  if (action === 'procurement.receipt.create') {
    const d = ReceiptInputSchema.parse(raw);
    if (new Set(d.lines.map(l=>l.lineId)).size !== d.lines.length) fail('Aynı kalem iki kez kabul edilemez',400);
    const [order] = await tx`SELECT * FROM purchase_orders WHERE tenant_id=${t} AND id=${d.purchaseOrderId} FOR UPDATE`;
    if (!order) fail('Satın alma siparişi bulunamadı',404);
    if (order.version !== d.version) fail('Sipariş değişti; güncel kalan miktarları inceleyin.');
    if (!['submitted','partially_received'].includes(order.status)) fail('Yalnız onaylı veya kısmi kabul edilmiş sipariş teslim alınabilir');
    const [receipt] = await tx`INSERT INTO goods_receipts(tenant_id,receipt_number,purchase_order_id,idempotency_key,received_by,notes)VALUES(${t},${'KAB-'+Date.now().toString(36).toUpperCase()+'-'+randomUUID().slice(0,6)},${order.id},${key},${actor.userId},${d.notes})RETURNING *`;
    const stockLines: any[] = [];
    for (const input of d.lines) {
      const [line] = await tx`SELECT l.*,i.weight_per_meter_kg,i.active FROM purchase_order_lines l JOIN inventory_items i ON i.id=l.item_id AND i.tenant_id=l.tenant_id WHERE l.tenant_id=${t} AND l.purchase_order_id=${order.id} AND l.id=${input.lineId} FOR UPDATE OF l`;
      if (!line || !line.active) fail('Sipariş kalemi bu firmaya veya siparişe ait değil',400);
      if (input.acceptedQty + input.rejectedQty > count(line.ordered_qty) - count(line.received_qty) + 0.000001) fail('Kabul ve red toplamı kalan sipariş miktarını aşamaz');
      if (!(await tx`SELECT 1 FROM warehouses WHERE tenant_id=${t} AND id=${line.warehouse_id} AND warehouse_type='RAW' AND active=true`).length) fail('Hammadde deposu aktif değil');
      if (input.rejectedQty && !(await tx`SELECT 1 FROM warehouses WHERE tenant_id=${t} AND id=${input.rejectedWarehouseId!} AND warehouse_type='REJECTED' AND active=true`).length) fail('Red miktarı için firmanın aktif red deposu gerekli',400);
      if (COUNT_UNITS.has(line.uom) && (!Number.isInteger(input.acceptedQty) || !Number.isInteger(input.rejectedQty))) fail(`${unitLabel(line.uom)} miktarı tam sayı olmalı`,400);
      const lengthMm = Number(line.metadata?.lengthMm);
      if (line.uom === 'm' && !lengthMm) fail('Eski profil kaleminde fiziksel boy eksik. Bu sipariş için yeni boy tanımlı kalem oluşturun.',400);
      // Every profile bar carries a colour; an older order line without one takes it from the receipt.
      const barColor = String(line.metadata?.color || input.color || '').trim();
      if (line.uom === 'm' && !barColor) fail('Bu profil satırında renk yok; kabulde çubuk rengini girin (boyasız için "Boyasız")',400);
      await tx`INSERT INTO goods_receipt_lines(tenant_id,goods_receipt_id,purchase_order_line_id,item_id,accepted_warehouse_id,rejected_warehouse_id,accepted_qty,rejected_qty,uom,metadata)VALUES(${t},${receipt.id},${line.id},${line.item_id},${line.warehouse_id},${input.rejectedWarehouseId || null},${input.acceptedQty},${input.rejectedQty},${line.uom},${json({ ...line.metadata, rejectionReason: input.rejectionReason })}::text::jsonb)`;
      for (const disposition of ['accepted','rejected'] as const) {
        const amount = disposition === 'accepted' ? input.acceptedQty : input.rejectedQty;
        if (!amount) continue;
        const warehouseId = disposition === 'accepted' ? line.warehouse_id : input.rejectedWarehouseId;
        const metadata = { goodsReceiptId: receipt.id, purchaseOrderId: order.id, purchaseOrderLineId: line.id, currency:order.currency,disposition, rejectionReason: input.rejectionReason };
        if (line.uom === 'm') {
          const barCount = amount * 1000 / lengthMm;
          if (Math.abs(barCount - Math.round(barCount)) > 0.000001 || barCount > 10000) fail('Profil kabulü fiziksel çubuk boyunun tam katı olmalı',400);
          for (let n=0;n<Math.round(barCount);n++) {
            const [lot] = await tx`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,length_m,weight_kg,metadata)VALUES(${t},${line.item_id},${warehouseId},${receipt.receipt_number+'-'+line.position+'-'+disposition+'-'+(n+1)},${lengthMm/1000},${lengthMm/1000},${lengthMm/1000},${lengthMm/1000*count(line.weight_per_meter_kg)},${json({ ...metadata, color: barColor, unitCost: count(line.unit_price), isRemnant: false })}::text::jsonb)RETURNING id`;
            stockLines.push({ itemId: line.item_id, warehouseId, lotId: lot.id, quantityDelta: lengthMm/1000, uom: line.uom, unitCost: count(line.unit_price), metadata });
          }
        } else {
          const [lot]=await tx`INSERT INTO stock_lots(tenant_id,item_id,warehouse_id,lot_number,original_qty,remaining_qty,metadata)VALUES(${t},${line.item_id},${warehouseId},${receipt.receipt_number+'-'+line.position+'-'+disposition},${amount},${amount},${json({...metadata,unitCost:count(line.unit_price)})}::text::jsonb)RETURNING id`;
          stockLines.push({ itemId:line.item_id,warehouseId,lotId:lot.id,quantityDelta:amount,uom:line.uom,unitCost:count(line.unit_price),metadata });
        }
      }
      // Rejected goods are quarantined and still await replacement; only accepted goods fulfill the PO.
      await tx`UPDATE purchase_order_lines SET received_qty=received_qty+${input.acceptedQty} WHERE tenant_id=${t} AND id=${line.id}`;
    }
    const entry = await postStockEntryInTransaction(tx,actor,{ entryType:'MATERIAL_RECEIPT', idempotencyKey:'procurement:'+key, referenceType:'goods_receipt', referenceId:receipt.id, note:receipt.receipt_number, lines:stockLines });
    await tx`UPDATE purchase_orders po SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM purchase_order_lines l WHERE l.tenant_id=po.tenant_id AND l.purchase_order_id=po.id AND l.received_qty<l.ordered_qty)THEN 'received' ELSE 'partially_received' END,version=version+1,updated_at=now()WHERE tenant_id=${t} AND id=${order.id}`;
    return (await tx`UPDATE goods_receipts SET status='submitted',stock_entry_id=${entry.id},received_at=now()WHERE tenant_id=${t} AND id=${receipt.id} RETURNING *`)[0];
  }
  fail('Satın alma işlemi tanınmıyor',400);
}
