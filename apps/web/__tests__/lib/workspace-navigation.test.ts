import {getVisibleNavGroups} from '@/lib/core/dashboard-nav';
const paths=(role:Parameters<typeof getVisibleNavGroups>[0])=>getVisibleNavGroups(role).flatMap(g=>g.items.map(i=>i.href));
it('shows only modules the factory employee can actually access',()=>{
 expect(paths('worker')).toContain('/factory');
 for(const path of ['/production','/finance','/accounting','/purchases','/quotations','/crm'])expect(paths('worker')).not.toContain(path);
});
it('gives accounting users finance and procurement read screens',()=>{
 expect(paths('accountant')).toEqual(expect.arrayContaining(['/finance','/accounting','/purchases','/receipts']));
 expect(paths('office')).not.toContain('/finance');
});
