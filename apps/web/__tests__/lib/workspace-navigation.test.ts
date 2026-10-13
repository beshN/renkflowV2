import {activeNavHref, getVisibleNavGroups} from '@/lib/core/dashboard-nav';
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
