import { AttendanceRulesSchema,DEFAULT_ATTENDANCE_POLICY,policyDays,type AttendanceSnapshot } from '@/lib/features/personnel/attendance-policy';
import { monthPay } from '@/lib/features/personnel/payroll';
import { assistantFormHref } from '@/lib/ai/assistant-form-drafts';
const employee={pay_type:'monthly' as const,pay_amount:30000,start_date:'2026-01-01',end_date:null};
const saved:AttendanceSnapshot={version:1,policyVersion:4,kind:'absent',cutDays:1.5,dailyRate:1000,currency:'TRY',basis:'monthly_30',recordedAt:'2026-10-14T00:00:00Z'};
test('physical absence days and weighted pay cuts remain separate; recorded rate survives salary change',()=>{
 const days=[{day:'2026-10-14',kind:'absent' as const,deducted:true,deductionSnapshot:saved}];const pay=monthPay({...employee,pay_amount:60000},'2026-10',days,[]);expect(pay.days.absent).toBe(1);expect(pay.deductedDays).toBe(1.5);expect(pay.absenceCut).toBe(1500);expect(pay.deductions[0]).toMatchObject({policyVersion:4,amount:1500});
});
test('legacy rows retain one-day cuts and paid leave factors are zero',()=>{
 expect(monthPay(employee,'2026-10',[{day:'2026-10-14',kind:'absent',deducted:true}],[]).absenceCut).toBe(1000);expect(policyDays('annual_leave',DEFAULT_ATTENDANCE_POLICY)).toBe(0);expect(policyDays('unpaid_leave',DEFAULT_ATTENDANCE_POLICY)).toBe(1);expect(AttendanceRulesSchema.safeParse({absent:NaN,unpaid_leave:1,half_day:0.5}).success).toBe(false);
});
test('assistant form drafts validate input; URLs only open internal review forms',()=>{
 expect(assistantFormHref('warehouseDraft',JSON.stringify({name:'Ana depo',type:'RAW'}))).toContain('/warehouse?create=warehouse');expect(assistantFormHref('attendanceDraft',JSON.stringify({employeeId:'not-uuid',day:'2026-10-14',kind:'absent'}))).toBeNull();expect(assistantFormHref('warehouseDraft','{broken')).toBeNull();
});

test('missing saved wage and currency mismatches require review instead of silently repricing the day',()=>{
 const a={day:'2026-10-14',kind:'absent' as const,deducted:true,deductionSnapshot:{...saved,dailyRate:null}};
 expect(monthPay(employee,'2026-10',[a],[])).toMatchObject({remaining:null,reviewRequired:true});
 expect(monthPay({...employee,pay_currency:'EUR'},'2026-10',[{...a,deductionSnapshot:saved}],[])).toMatchObject({remaining:null,reviewRequired:true});
});
