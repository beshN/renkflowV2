import {getAccountingWorkspace,setPeriodCloseStatus,getProfitLossReport,getCashFlowReport,getReceivablesAging} from '@/app/actions/accounting.actions';
import {getServerUserContext,requirePermission} from '@/lib/features/auth/serverAuth';
import {sql} from '@/lib/db';
import {tableExists} from '@/lib/db/schema-guard';
jest.mock('@/lib/db',()=>({sql:jest.fn()}));
jest.mock('next/cache',()=>({revalidatePath:jest.fn()}));
jest.mock('@/lib/features/auth/serverAuth',()=>({getServerUserContext:jest.fn(),requirePermission:jest.fn()}));
jest.mock('@/lib/db/schema-guard',()=>({tableExists:jest.fn(),isMissingRelationError:jest.fn(()=>false)}));
afterEach(()=>jest.resetAllMocks());
it('rejects a financial workspace read before querying financial tables',async()=>{
 (getServerUserContext as jest.Mock).mockResolvedValue({userId:'worker',tenantId:'tenant',role:'worker'});
 (requirePermission as jest.Mock).mockImplementation(()=>{throw new Error('Forbidden');});
 await expect(getAccountingWorkspace('2026-10')).rejects.toThrow('Forbidden');
 expect(requirePermission).toHaveBeenCalledWith(expect.objectContaining({role:'worker'}),'finance.view');
});
function allowFinance(){(getServerUserContext as jest.Mock).mockResolvedValue({userId:'owner',tenantId:'tenant',role:'owner'});(requirePermission as jest.Mock).mockImplementation(()=>{});}
it('separates salary accrual and recorded tax expense in profit/loss without an invented tax rate',async()=>{
 allowFinance();(sql as unknown as jest.Mock).mockResolvedValueOnce([{gross_revenue:1000}]).mockResolvedValueOnce([{category:'rent',total:100},{category:'tax',total:50}]).mockResolvedValueOnce([{total_salaries:100}]).mockResolvedValueOnce([{monthly_depreciation:0}]).mockResolvedValueOnce([{cogs:400,missing_total_price:0}]);
 const report=await getProfitLossReport('2026-10-01T00:00:00Z','2026-10-31T23:59:59Z');
 expect(report?.operatingExpenses.total).toBe(200);expect(report?.taxExpense).toBe(50);expect(report?.netProfit).toBe(350);
 const salaryQuery=(sql as unknown as jest.Mock).mock.calls[2][0].join('');expect(salaryQuery).toContain("kind = 'salary'");expect(salaryQuery).toContain("currency = 'TRY'");
});
it('counts disbursements rather than salary accrual as cash outflow',async()=>{
 allowFinance();(sql as unknown as jest.Mock).mockResolvedValueOnce([{total:500}]).mockResolvedValueOnce([{total:50}]).mockResolvedValueOnce([{total:80}]);
 expect((await getCashFlowReport('2026-10-01T00:00:00Z','2026-10-31T23:59:59Z'))?.netChangeInCash).toBe(370);
 expect((sql as unknown as jest.Mock).mock.calls[2][0].join('')).toContain("kind IN ('payment', 'advance')");
});
it('handles a database timestamp due date without losing the receivable',async()=>{
 allowFinance();(tableExists as jest.Mock).mockResolvedValue(true);(sql as unknown as jest.Mock).mockResolvedValue([{id:'order',order_number:'TEST',customer_name:'Test customer',remaining_amount:200,due_date:new Date('2026-10-01T00:00:00Z')}]);
 const result=await getReceivablesAging('2026-10-03T00:00:00Z');expect(result.total).toBe(200);expect(result.items[0].daysOverdue).toBe(2);
});
it('prevents an accountant from reopening a closed period',async()=>{
 (getServerUserContext as jest.Mock).mockResolvedValue({userId:'accountant',tenantId:'tenant',role:'accountant'});
 (requirePermission as jest.Mock).mockImplementation(()=>{});
 await expect(setPeriodCloseStatus({period:'2026-10',status:'open'})).resolves.toEqual({success:false,error:'Dönem durumunu firma yöneticisi değiştirebilir.'});
});
