import 'server-only';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { WorkOrderActor,WorkOrderApiError } from '@/lib/features/work-orders/security';
import { hasPermission,type Permission } from '@/lib/auth/permissions';
import { CurrencySchema } from '@/lib/types/currency';
import { PaymentMethodSchema,LedgerEntryKindSchema } from '@/lib/types/finance';
const uuid=z.string().uuid();
const optionalText=z.string().trim().max(180).default('');
function permission(a:WorkOrderActor,p:Permission){if(!hasPermission(a.role,p))throw new WorkOrderApiError('Finans işlem yetkiniz yok',403);}
const fail=(s:string,status=409):never=>{throw new WorkOrderApiError(s,status);};
export async function financeWorkspace(a:WorkOrderActor,employeeId?:string) {
  permission(a,'finance.view');
  const [employees,entries,payments,orders]=await Promise.all([
    sql`SELECT * FROM employees WHERE tenant_id=${a.tenantId} AND (${!employeeId} OR id=${employeeId || null}) ORDER BY full_name LIMIT 500`,
    sql`SELECT l.*,e.full_name FROM employee_ledger_entries l JOIN employees e ON e.id=l.employee_id AND e.tenant_id=l.tenant_id WHERE l.tenant_id=${a.tenantId} AND (${!employeeId} OR l.employee_id=${employeeId || null}) ORDER BY l.entry_date DESC,l.created_at DESC LIMIT 500`,
    sql`SELECT p.*,o.order_number,o.customer_name FROM payments p JOIN orders o ON o.id=p.order_id AND o.tenant_id=p.tenant_id WHERE p.tenant_id=${a.tenantId} ORDER BY p.paid_at DESC LIMIT 500`,
    sql`SELECT o.id,o.order_number,o.customer_name,o.currency,o.total_amount,COALESCE(SUM(p.amount)FILTER(WHERE p.currency=o.currency),0)AS paid_amount FROM orders o LEFT JOIN payments p ON p.order_id=o.id AND p.tenant_id=o.tenant_id WHERE o.tenant_id=${a.tenantId} GROUP BY o.id ORDER BY o.created_at DESC LIMIT 500`,
  ]);
  return {actor:a,employees,entries,payments,orders};
}
async function writablePeriod(tx:any,a:WorkOrderActor,date:string){
  const period=date.slice(0,7);
  await tx`INSERT INTO accounting_period_closes(tenant_id,period,status)VALUES(${a.tenantId},${period},'open')ON CONFLICT(tenant_id,period)DO NOTHING`;
  const [row]=await tx`SELECT status FROM accounting_period_closes WHERE tenant_id=${a.tenantId} AND period=${period} FOR SHARE`;
  if(row.status==='hard_closed')fail('Bu muhasebe dönemi kapalı. Önce dönemi açın.');
}
export async function executeFinance(tx:any,a:WorkOrderActor,action:string,raw:unknown) {
  const t=a.tenantId;
  if(action==='finance.employee.save'){
    const d=z.object({id:uuid.optional(),version:z.number().int().positive().optional(),fullName:z.string().trim().min(2).max(180),title:optionalText,email:z.union([z.literal(''),z.email()]).default(''),phone:optionalText,active:z.boolean().default(true)}).parse(raw);
    permission(a,d.id?'finance.employees.edit':'finance.employees.create');
    if(d.id){
      const [current]=await tx`SELECT id,version FROM employees WHERE tenant_id=${t} AND id=${d.id} FOR UPDATE`;
      if(!current)fail('Çalışan kaydı bulunamadı',404);
      if(current.version!==d.version)fail('Çalışan kaydı değişti. Güncel kaydı açın.');
      return (await tx`UPDATE employees SET full_name=${d.fullName},title=${d.title || null},email=${d.email || null},phone=${d.phone || null},active=${d.active},version=version+1,updated_at=now()WHERE tenant_id=${t} AND id=${d.id} RETURNING *`)[0];
    }
    return (await tx`INSERT INTO employees(tenant_id,full_name,title,email,phone,active)VALUES(${t},${d.fullName},${d.title || null},${d.email || null},${d.phone || null},${d.active})RETURNING *`)[0];
  }
  if(action==='finance.ledger.create'){
    permission(a,'finance.ledger.create');
    const d=z.object({employeeId:uuid,kind:LedgerEntryKindSchema,amount:z.number().finite().positive().max(100000000).multipleOf(0.01),currency:CurrencySchema,entryDate:z.iso.date(),note:z.string().trim().max(2000).default('')}).parse(raw);
    if(!(await tx`SELECT id FROM employees WHERE tenant_id=${t} AND id=${d.employeeId} AND active=true FOR SHARE`).length)fail('Aktif çalışan bulunamadı',404);
    await writablePeriod(tx,a,d.entryDate);
    return (await tx`INSERT INTO employee_ledger_entries(tenant_id,employee_id,kind,amount,currency,entry_date,note,created_by)VALUES(${t},${d.employeeId},${d.kind},${d.amount},${d.currency},${d.entryDate},${d.note || null},${a.userId})RETURNING *`)[0];
  }
  if(action==='finance.payment.create'){
    permission(a,'finance.payments.create');
    const d=z.object({orderId:uuid,amount:z.number().finite().positive().max(100000000).multipleOf(0.01),currency:CurrencySchema,method:PaymentMethodSchema,paidAt:z.iso.datetime({offset:true}),note:z.string().trim().max(2000).default('')}).parse(raw);
    const [order]=await tx`SELECT id,currency,total_amount FROM orders WHERE tenant_id=${t} AND id=${d.orderId} FOR UPDATE`;
    if(!order)fail('Sipariş bulunamadı',404);
    if(order.currency!==d.currency)fail('Tahsilat para birimi siparişle aynı olmalı',400);
    const [paid]=await tx`SELECT COALESCE(SUM(amount),0)AS total FROM payments WHERE tenant_id=${t} AND order_id=${d.orderId} AND currency=${d.currency}`;
    if(Number(paid.total)+d.amount>Number(order.total_amount)+0.005)fail('Tahsilat siparişin kalan tutarını aşamaz');
    await writablePeriod(tx,a,d.paidAt);
    return (await tx`INSERT INTO payments(tenant_id,order_id,amount,currency,method,paid_at,note,created_by)VALUES(${t},${d.orderId},${d.amount},${d.currency},${d.method},${d.paidAt},${d.note || null},${a.userId})RETURNING *`)[0];
  }
  fail('Finans işlemi tanınmıyor',400);
}
