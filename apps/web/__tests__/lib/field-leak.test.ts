/**
 * Price / cost / profit / customer-contact leak test, for every preset role and a custom role:
 * the payload shapes the API returns (orders, quotes, customers, purchasing, stock, work orders,
 * reports) go through the same filter the routes use, and no hidden key survives at any depth.
 */
import { BASE_HIDDEN, FIELD_GROUPS, FIELD_KEYS, PRESETS, effectiveAccess, redactFields, type FieldGroup } from '@/lib/security/access-matrix';

const PAYLOADS: Record<string, unknown> = {
  ordersList: { success: true, data: [{ id: 'o1', orderNumber: 'SAT-1', customerName: 'Ayşe Yılmaz', email: 'a@x.com', phone: '0555', totalAmount: 12000, currency: 'TRY', status: 'production', deliveryDate: '2026-11-01', items: [{ productName: 'Pergola', quantity: 1, unitPrice: 12000, totalPrice: 12000, widthMm: 4000, heightMm: 3000, color: 'RAL 7016' }] }] },
  orderSales: { plan: { rows: [{ label: 'Peşinat', amount: 4000, paid: 4000 }], balance: 8000, collected: 4000 }, changeOrders: [{ id: 'c1', title: 'Ek LED', amount: 500, tryTotal: 500, fxRate: 1 }], payments: [{ amount: 4000 }], paymentStatus: 'partial' },
  quotation: { id: 'q1', number: 'TKL-1', customer: { name: 'Ayşe', email: 'a@x.com', phone: '0555', address: 'Kadıköy', taxNumber: '123', taxOffice: 'Kadıköy' }, lines: [{ product: 'Pergola', unit_price: 100, total_price: 100, matrixUnitPrice: 100, discount_amount: 5, tax_amount: 18, profileCost: 40, margin: 0.4 }], subtotal: 100, total_amount: 113, revisions: [{ total: 113 }] },
  customer: { id: 'c1', name: 'Ayşe', contacts: [{ name: 'Ali', phone: '1', email: 'b@x.com' }], billing_address: 'X', shipping_address: 'Y', siteAddress: 'Z', mapUrl: 'https://maps', balance: 300 },
  purchasing: { orders: [{ id: 'p1', supplier: 'Tedarikçi', lines: [{ item: 'Profil', quantity: 10, unit_price: 50, cost: 50 }], invoiceTotal: 500, cheapest: { supplierId: 's', unitPrice: 45 } }], prices: [{ unitPrice: 50 }] },
  stock: { items: [{ id: 'i1', name: 'Vida', unitCost: 2, unit_cost: 2, costs: { last: 2 }, onHand: 100 }] },
  workOrder: { id: 'w1', title: 'Kesim', costSnapshot: { materialCost: 10, laborCost: 5, scrapCost: 1 }, laborCostPerHour: 200, labor_cost_per_hour: 200 },
  reports: { estimatedProfit: 900, grossProfit: 1200, marginPercent: 12, profit: 900 },
};

const ROLES = [
  ...PRESETS.map((p) => ({ label: p.name, access: effectiveAccess(p.base, p) })),
  { label: 'Özel: ofis, müşteri iletişimi gizli', access: effectiveAccess('office', { key: 'c', name: 'Özel', permissions: { orders: ['view'] }, hidden: ['customer_contact'] }) },
  { label: 'Özel: atölye (temel rol her şeyi gizler)', access: effectiveAccess('worker', { key: 'w', name: 'Saha', permissions: { installations: ['view'] }, hidden: [] }) },
];

/** Every key at any depth of a value, not looking inside the keys in `skip`. */
function keys(value: unknown, skip = new Set<string>(), out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keys(v, skip, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { if (skip.has(k)) continue; out.add(k); keys(v, skip, out); }
  return out;
}

describe.each(ROLES)('$label', ({ access }) => {
  it('no hidden field reaches the response; visible ones stay', () => {
    for (const [name, payload] of Object.entries(PAYLOADS)) {
      const seen = keys(redactFields(payload, access.hidden));
      for (const group of FIELD_GROUPS) {
        const leaked = FIELD_KEYS[group].filter((k) => seen.has(k));
        if (access.hidden.includes(group)) expect({ name, group, leaked }).toEqual({ name, group, leaked: [] });
      }
      // What is not hidden is not stripped (the filter only removes the hidden kinds).
      const removable = new Set(access.hidden.flatMap((g: FieldGroup) => FIELD_KEYS[g]));
      for (const k of keys(payload, removable)) expect({ name, k, kept: seen.has(k) }).toEqual({ name, k, kept: true });
    }
  });
});

describe('field hiding by role', () => {
  it('the roles that must not see prices hide them; the worker base hides all four', () => {
    const hides = (key: string) => effectiveAccess(PRESETS.find((p) => p.key === key)!.base, PRESETS.find((p) => p.key === key)!).hidden;
    expect(hides('operator')).toEqual(expect.arrayContaining(['price', 'cost', 'profit', 'customer_contact']));
    expect(hides('warehouse')).toEqual(expect.arrayContaining(['price', 'cost', 'profit', 'customer_contact']));
    expect(hides('planning')).toEqual(expect.arrayContaining(['price', 'profit']));
    expect(hides('sales')).toEqual(expect.arrayContaining(['cost', 'profit']));
    expect(hides('owner')).toEqual([]);
    expect(BASE_HIDDEN.worker).toEqual(['price', 'cost', 'profit', 'customer_contact']);
  });
});
