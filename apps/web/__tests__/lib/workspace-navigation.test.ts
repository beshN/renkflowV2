import {activeNavHref, getVisibleNavGroups, getPrimaryNavItems, canUseWorkspaceAction} from '@/lib/core/dashboard-nav';
const paths=(role:Parameters<typeof getVisibleNavGroups>[0])=>getVisibleNavGroups(role).flatMap(g=>g.items.map(i=>i.href));
it('shows only modules the factory employee can actually access',()=>{
 expect(paths('worker')).toContain('/factory');
 for(const path of ['/production','/finance','/accounting','/purchases','/quotations','/crm'])expect(paths('worker')).not.toContain(path);
});
it('groups quotes and orders together and keeps deployed personnel accessible without duplicate action links', () => {
 const groups=getVisibleNavGroups('owner');
 expect(groups.find(g=>g.id==='sales')?.items.map(i=>i.href)).toEqual(expect.arrayContaining(['/quotations','/orders','/crm']));
 expect(paths('owner')).toContain('/finance/employees');
 expect(paths('owner')).not.toContain('/new-order');
 expect(activeNavHref('/finance/employees/employee-id',groups)).toBe('/finance/employees');
 expect(activeNavHref('/finance/invoices/invoice-id',groups)).toBe('/finance/invoices');
});
it('gives accounting users finance and procurement read screens',()=>{
 expect(paths('accountant')).toEqual(expect.arrayContaining(['/finance','/accounting','/purchases','/receipts']));
 expect(paths('office')).not.toContain('/finance');
});
it('does not flash restricted modules while the session is loading', () => {
 expect(paths(undefined)).toEqual(['/dashboard']);
 expect(getPrimaryNavItems().map(item => item.href)).toEqual(['/dashboard']);
});
it.each(['owner', 'admin', 'office', 'accountant', 'worker', 'member'] as const)('keeps %s daily links within its authorized full directory', role => {
 const daily = getPrimaryNavItems(role);
 expect(daily.length).toBeLessThanOrEqual(6);
 expect(daily[0].href).toBe('/dashboard');
 expect(new Set(daily.map(item => item.id)).size).toBe(daily.length);
 for (const item of daily) expect(paths(role)).toContain(item.href);
});
it('keeps factory and accounting daily work distinct', () => {
 expect(getPrimaryNavItems('worker').map(item => item.href)).toEqual(['/dashboard', '/factory', '/work-orders', '/warehouse/scan']);
 expect(getPrimaryNavItems('accountant').map(item => item.href)).toEqual(['/dashboard', '/finance', '/finance/invoices', '/accounting']);
 expect(paths('owner')).toEqual(expect.arrayContaining(['/products', '/orders/foy', '/settings', '/service', '/vehicles']));
});
it('applies a narrowed role to both daily links and the full directory', () => {
 const scoped = { narrowed: true, permissions: { inventory: ['view' as const] } };
 const directory = getVisibleNavGroups('admin', scoped).flatMap(group => group.items).filter(item => !item.action);
 for (const denied of ['/orders', '/crm', '/finance', '/settings']) expect(directory.map(item => item.href)).not.toContain(denied);
 expect(getPrimaryNavItems('admin', scoped).map(item => item.href)).toEqual(['/dashboard', '/inventory']);
 expect(directory.map(item => item.href)).toContain('/warehouse/scan');
});
it('does not offer create actions to narrowed read-only administrators or factory employees', () => {
 const readOnly = { narrowed: true, permissions: { orders: ['view' as const], inventory: ['view' as const] } };
 expect(canUseWorkspaceAction('admin', readOnly, { module: 'orders', action: 'create' })).toBe(false);
 expect(canUseWorkspaceAction('admin', readOnly, { module: 'orders', action: 'view' })).toBe(true);
 expect(canUseWorkspaceAction('worker', null, { module: 'inventory', action: 'create' })).toBe(false);
 expect(canUseWorkspaceAction('worker', null, { module: 'inventory', action: 'view' })).toBe(true);
 expect(canUseWorkspaceAction('member', null, { module: 'inventory', action: 'view' })).toBe(false);
 expect(canUseWorkspaceAction(undefined, null, { module: 'orders', action: 'create' })).toBe(false);
});
