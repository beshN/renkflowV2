import {
  BASE_CAPS, MODULES, PRESETS, can, effectiveAccess, meets, passwordProblem, presetFor, redactFields, routeRequirement, sanitizeMatrix,
} from '@/lib/security/access-matrix';

describe('roles never exceed their base role', () => {
  it('every preset is inside its base role and hides at least what the base hides', () => {
    for (const p of PRESETS) {
      const a = effectiveAccess(p.base, p);
      for (const m of MODULES) for (const act of a.permissions[m] ?? []) expect(BASE_CAPS[p.base][m] ?? []).toContain(act);
    }
    expect(effectiveAccess('worker', { key: 'x', name: 'x', permissions: { finance: ['view'] }, hidden: [] }).hidden).toEqual(['price', 'cost', 'profit', 'customer_contact']);
  });

  it('a custom role asking for more than its base gets only the base', () => {
    const a = effectiveAccess('office', { key: 'c', name: 'Özel', permissions: { finance: ['view', 'edit'], orders: ['view', 'delete'] }, hidden: [] });
    expect(a.permissions).toEqual({ orders: ['view', 'delete'] });
    expect(can(a, 'finance', 'view')).toBe(false);
  });

  it('without a chosen role a member keeps today\'s behaviour (preset of the base role)', () => {
    expect(effectiveAccess('office', null).roleKey).toBe('office');
    expect(effectiveAccess('accountant', null).roleKey).toBe('accounting');
    expect(effectiveAccess('worker', null).hidden).toContain('price');
  });

  it('the job presets are narrower than plain office', () => {
    const sales = effectiveAccess('office', presetFor('sales'));
    const warehouse = effectiveAccess('office', presetFor('warehouse'));
    expect([can(sales, 'crm', 'create'), can(sales, 'production', 'edit'), can(sales, 'purchasing', 'view')]).toEqual([true, false, false]);
    expect([can(warehouse, 'inventory', 'delete'), can(warehouse, 'quotations', 'view'), warehouse.hidden]).toEqual([true, false, ['price', 'cost', 'profit', 'customer_contact']]);
    expect(can(effectiveAccess('admin', presetFor('admin')), 'fleet', 'view')).toBe(true);
    expect(can(effectiveAccess('office', presetFor('office')), 'fleet', 'view')).toBe(false);
  });

  it('stores only known modules/actions inside the base, and any action implies view', () => {
    expect(sanitizeMatrix('office', { orders: ['edit', 'hack'], finance: ['view'], nope: ['view'] })).toEqual({ orders: ['view', 'edit'] });
    expect(sanitizeMatrix('member', null)).toEqual({});
  });
});

describe('route requirements', () => {
  it('maps API paths and methods to module and action', () => {
    expect(routeRequirement('/api/v1/orders', 'GET')).toEqual({ module: 'orders', action: 'view' });
    expect(routeRequirement('/api/v1/orders', 'POST')).toEqual({ module: 'orders', action: 'create' });
    expect(routeRequirement('/api/v1/orders/abc/sales', 'POST')).toEqual({ module: 'orders', action: 'edit', orCreate: true });
    expect(routeRequirement('/api/v1/orders/abc', 'PATCH')).toEqual({ module: 'orders', action: 'edit' });
    expect(routeRequirement('/api/v1/quotations/abc', 'DELETE')).toEqual({ module: 'quotations', action: 'delete' });
    expect(routeRequirement('/api/v1/reports/export', 'GET')).toEqual({ module: 'reports', action: 'export' });
    expect(routeRequirement('/api/v1/vehicles/x', 'GET')).toEqual({ module: 'fleet', action: 'view' });
    expect(routeRequirement('/api/v1/sales/settings', 'PUT')).toEqual({ module: 'settings', action: 'edit' });
    // Quote screens read the sales defaults; only changing them is a settings edit.
    expect(routeRequirement('/api/v1/sales/settings', 'GET')).toEqual({ module: 'quotations', action: 'view' });
  });

  it('a POST under a record passes with create or edit; PATCH needs edit', () => {
    const createOnly = { permissions: { inventory: ['view', 'create'] as const } } as any;
    expect(meets(createOnly, routeRequirement('/api/v1/inventory/stock-entries', 'POST')!)).toBe(true);
    expect(meets(createOnly, routeRequirement('/api/v1/inventory/items/1', 'PATCH')!)).toBe(false);
  });

  it('Salt okunur really only reads; a member without a chosen role keeps today\'s rights', () => {
    const ro = effectiveAccess('member', presetFor('readonly'));
    expect([can(ro, 'orders', 'view'), can(ro, 'orders', 'edit')]).toEqual([true, false]);
    expect(effectiveAccess('member', null).roleKey).toBe('member');
    expect(can(effectiveAccess('member', null), 'orders', 'edit')).toBe(true);
  });

  it('self-scoped and unknown paths are not module-gated', () => {
    expect(routeRequirement('/api/v1/search', 'GET')).toBeNull();
    expect(routeRequirement('/api/v1/records/order/1', 'POST')).toBeNull();
    expect(routeRequirement('/api/health', 'GET')).toBeNull();
    expect(routeRequirement('/dashboard', 'GET')).toBeNull();
  });

  it('pages need view of their module', () => {
    expect(routeRequirement('/orders/123', 'GET')).toEqual({ module: 'orders', action: 'view' });
    expect(routeRequirement('/vehicles', 'GET')).toEqual({ module: 'fleet', action: 'view' });
    expect(routeRequirement('/purchases', 'POST')).toEqual({ module: 'purchasing', action: 'view' });
  });
});

describe('field hiding', () => {
  const order = {
    id: 'o1', orderNumber: 'ORD-1', customerName: 'Ayşe', phone: '0555', email: 'a@b.c', totalAmount: 1200, currency: 'TRY',
    items: [{ productName: 'Pergola', unitPrice: 600, totalPrice: 1200, widthMm: 4000, cost: 300 }],
    plan: { rows: [{ amount: 400 }] }, profit: 500,
  };

  it('removes each hidden kind at any depth and marks price hidden', () => {
    const r: any = redactFields(order, ['price', 'cost', 'profit', 'customer_contact']);
    expect(r).toEqual({ id: 'o1', orderNumber: 'ORD-1', customerName: 'Ayşe', items: [{ productName: 'Pergola', widthMm: 4000, financialHidden: true }], plan: { rows: [{ financialHidden: true }], financialHidden: true }, financialHidden: true });
  });

  it('keeps a page count next to a list and walks a non-money record under a generic name', () => {
    const r: any = redactFields({ rows: [{ sku: 'A', total: 5 }], total: 1, balance: { onHand: 3, amount: 9 }, price: { value: 7 } }, ['price']);
    expect(r.total).toBe(1);
    expect(r.rows[0].total).toBeUndefined();
    expect(r.balance).toEqual({ onHand: 3, financialHidden: true });
    expect(r.price).toBeUndefined();
  });

  it('only what is hidden goes; nothing hidden leaves the data as it is', () => {
    const r: any = redactFields(order, ['cost', 'profit']);
    expect([r.totalAmount, r.items[0].unitPrice, r.items[0].cost, r.profit, r.phone]).toEqual([1200, 600, undefined, undefined, '0555']);
    expect(redactFields(order, [])).toBe(order);
  });

  it('no preset that hides price leaks a price key', () => {
    for (const p of PRESETS.filter((x) => x.hidden.includes('price'))) {
      const text = JSON.stringify(redactFields(order, effectiveAccess(p.base, p).hidden));
      expect(text).not.toMatch(/unitPrice|totalAmount|totalPrice|"amount"/);
    }
  });
});

describe('password policy', () => {
  it('asks for length, a letter and a digit, and not the e-mail name', () => {
    expect(passwordProblem('kisa1')).toMatch(/en az 10/);
    expect(passwordProblem('sadeceharfler')).toMatch(/harf ve bir rakam/);
    expect(passwordProblem('1234567890')).toMatch(/harf ve bir rakam/);
    expect(passwordProblem('ahmetyilmaz2026', 'ahmetyilmaz@renk.com')).toMatch(/e-posta/);
    expect(passwordProblem('Pergola-7016-guclu')).toBeNull();
  });
});

it('product cards and recipes use their actual module gates', () => {
  expect(routeRequirement('/api/v1/products/import','POST')).toEqual({module:'inventory',action:'create'});
  expect(routeRequirement('/api/v1/products/recipes','POST')).toEqual({module:'production',action:'create'});
  expect(routeRequirement('/products/import','GET')).toEqual({module:'inventory',action:'view'});
  expect(routeRequirement('/products','GET')).toEqual({module:'production',action:'view'});
});
