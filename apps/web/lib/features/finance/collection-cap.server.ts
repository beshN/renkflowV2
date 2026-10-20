import 'server-only';

// What an order can still be paid: the order total less the VAT withheld on its issued invoices (the
// buyer pays that to the tax office, not to the seller), or what was invoiced if more (extra lines
// such as shipping). Both collection paths (invoice screen, finance screen) use this one rule.

type Db = any;

export async function collectionCap(db: Db, tenantId: string, orderId: string, orderTotal: number): Promise<number> {
  const [billed] = await db`
    SELECT coalesce(sum(coalesce((to_jsonb(invoices) ->> 'payable_total')::numeric, total)), 0) AS total,
      coalesce(sum(coalesce((to_jsonb(invoices) ->> 'withholding_total')::numeric, 0)), 0) AS withheld
    FROM invoices WHERE tenant_id = ${tenantId} AND order_id = ${orderId} AND status = 'issued'`;
  return Math.max(Number(orderTotal) - Number(billed.withheld), Number(billed.total));
}
