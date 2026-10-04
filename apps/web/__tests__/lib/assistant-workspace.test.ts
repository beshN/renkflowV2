jest.mock("@/lib/features/manufacturing/quality.service",()=>({qualityAnalytics:jest.fn().mockResolvedValue({})}));
jest.mock("@/lib/features/manufacturing/analytics.service",()=>({productionAnalytics:jest.fn().mockResolvedValue({centers:[],predictions:[]})}));
import {assistantSnapshot,buildInsights} from '@/lib/ai/workspace';
import {sql} from '@/lib/db';
jest.mock('@/lib/db',()=>({sql:jest.fn()}));
it('prioritizes stock alerts on stock screens and marks unapproved counts',()=>{
 const insights=buildInsights({metrics:[{overdue:3}],stock:[{name:'Profil',min_stock:10,available_qty:2,stock_uom:'m'}],counts:[{pending:1}]},'/warehouse');
 expect(insights[0].id).toBe('critical');expect(insights.find(i=>i.id==='counts')?.detail).toContain('henüz stoğa işlenmedi');
});
it('does not turn zero minimum levels into false critical alarms',()=>{expect(buildInsights({stock:[{min_stock:0,available_qty:0}]},'/inventory').map(i=>i.id)).not.toContain('critical');});
it('worker context uses only assigned technical jobs/operations, no finance or customer lists',async()=>{
 (sql as unknown as jest.Mock).mockResolvedValue([]);
 const actor={userId:'u',tenantId:'t',role:'worker' as const};const snapshot=await assistantSnapshot(actor,'/factory');
 expect(Object.keys(snapshot.data)).toEqual(expect.arrayContaining(['jobs','operations']));
 expect(snapshot.data).not.toHaveProperty('orders');expect(snapshot.data).not.toHaveProperty('payments');
 for(const call of (sql as unknown as jest.Mock).mock.calls)expect(call.slice(1)).toContain('t');
});
