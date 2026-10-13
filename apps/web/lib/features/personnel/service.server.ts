import 'server-only';

import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { tableExists } from '@/lib/db/schema-guard';
import { recordAudit } from '@/lib/audit/audit-log';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can } from '@/lib/security/access-matrix';
import { hasPermission } from '@/lib/auth/permissions';
import { istanbulToday } from '@/lib/features/sales/order-status.server';
import { ATTENDANCE, ATTENDANCE_KINDS, annualLeave, monthPay, payDate, periodOf, shiftPeriod, tenure, type Attendance, type Employee, type Ledger, type LedgerKind } from './payroll';
import { normalizeIban, validIban } from './iban';

type Row = Record<string, any>;
const PERIOD = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const DATE = z.iso.date();
const addDays = (date: string, n: number) => new Date(Date.parse(date + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
const fail = (message: string, status = 400): never => { throw new WorkOrderApiError(message, status); };

type Need = 'view' | 'create' | 'edit' | 'delete';
const ROLE_PERMISSION = { view: 'finance.employees.view', create: 'finance.employees.create', edit: 'finance.employees.edit', delete: 'finance.ledger.delete' } as const;
/** Pay, IBAN and attendance are finance data: the finance module and the personnel permission both. */
async function need(actor: WorkOrderActor, action: Need) {
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated || !hasPermission(actor.role, ROLE_PERMISSION[action]) || !can(access, 'finance', action === 'delete' ? 'delete' : action === 'view' ? 'view' : action === 'create' ? 'create' : 'edit')) fail('Bu işlem için yetkiniz yok', 403);
  return access!;
}

async function ready() {
  if (!(await tableExists('employee_attendance'))) fail('Personel modülü için veritabanı güncellemesi (049) bekleniyor', 409);
}

/** A hard-closed accounting month cannot change (same rule as the other finance records). */
async function assertOpenPeriod(tx: any, tenantId: string, date: string) {
  if (!(await tableExists('accounting_period_closes'))) return;
  const [row] = await tx`SELECT status FROM accounting_period_closes WHERE tenant_id = ${tenantId} AND period = ${date.slice(0, 7)}`;
  if (row?.status === 'hard_closed') fail('Bu muhasebe dönemi kapalı. Önce dönemi açın.', 409);
}

const asEmployee = (r: Row): Employee & Row => ({
  ...r,
  start_date: r.start_date ? String(r.start_date instanceof Date ? r.start_date.toISOString().slice(0, 10) : r.start_date).slice(0, 10) : null,
  end_date: r.end_date ? String(r.end_date instanceof Date ? r.end_date.toISOString().slice(0, 10) : r.end_date).slice(0, 10) : null,
  birth_date: r.birth_date ? String(r.birth_date instanceof Date ? r.birth_date.toISOString().slice(0, 10) : r.birth_date).slice(0, 10) : null,
  pay_type: r.pay_type === 'daily' ? 'daily' : 'monthly',
  pay_amount: r.pay_amount === null || r.pay_amount === undefined ? null : Number(r.pay_amount),
  pay_day: r.pay_day === null || r.pay_day === undefined ? null : Number(r.pay_day),
});
const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
/** Months before the card was created were paid outside the app: shown as not tracked, never as owed. */
const trackedFrom = (r: Row) => (r.created_at ? periodOf(day(r.created_at)) : '0000-00');
const untracked = (pay: ReturnType<typeof monthPay>) => ({ ...pay, base: null, earned: null, remaining: null, tracked: false });
const asAttendance = (r: Row): Attendance & Row => ({ ...r, day: day(r.day), kind: r.kind, deducted: Boolean(r.deducted) });
const asLedger = (r: Row): Ledger & Row => ({ ...r, kind: r.kind as LedgerKind, amount: Number(r.amount), entry_date: day(r.entry_date), period: r.period ?? null });

/** Everyone employed in the month, with the month's pay worked out. */
export async function personnelOverview(actor: WorkOrderActor, rawPeriod?: string | null) {
  await need(actor, 'view');
  await ready();
  const today = istanbulToday();
  const period = PERIOD.parse(rawPeriod || periodOf(today));
  const first = `${period}-01`;
  const next = `${shiftPeriod(period, 1)}-01`;
  const [employees, attendance, ledger] = (await Promise.all([
    sql`SELECT * FROM employees WHERE tenant_id = ${actor.tenantId} AND (start_date IS NULL OR start_date < ${next}) AND (end_date IS NULL OR end_date >= ${first}) ORDER BY active DESC, full_name LIMIT 1000`,
    sql`SELECT employee_id, day, kind, deducted, note FROM employee_attendance WHERE tenant_id = ${actor.tenantId} AND day >= ${first} AND day < ${next}`,
    sql`SELECT employee_id, kind, amount, currency, entry_date, period FROM employee_ledger_entries WHERE tenant_id = ${actor.tenantId} AND (period = ${period} OR (period IS NULL AND entry_date >= ${first} AND entry_date < ${next}))`,
  ])) as [Row[], Row[], Row[]];
  const rows = employees.map((raw: Row) => {
    const e = asEmployee(raw);
    const att = attendance.filter((a: Row) => a.employee_id === e.id).map(asAttendance);
    const led = ledger.filter((l: Row) => l.employee_id === e.id && l.currency === e.pay_currency).map(asLedger);
    const leave = annualLeave(e, att, today);
    return {
      id: String(e.id), fullName: e.full_name, title: e.title, department: e.department, active: Boolean(e.active),
      startDate: e.start_date, endDate: e.end_date, payType: e.pay_type, payAmount: e.pay_amount, currency: e.pay_currency, payDay: e.pay_day,
      tenure: tenure(e.start_date, today), anniversarySoon: leave ? leave.nextAnniversary <= addDays(today, 30) : false,
      pay: period < trackedFrom(raw) ? untracked(monthPay(e, period, att, led)) : { ...monthPay(e, period, att, led), tracked: true }, payDate: payDate(e, period),
      attendance: att.map((a) => ({ day: a.day, kind: a.kind, deducted: a.deducted, note: a.note ?? null })),
    };
  });
  const byCurrency = (pick: (r: (typeof rows)[number]) => number | null) => rows.reduce<Record<string, number>>((s, r) => {
    const v = pick(r);
    if (v !== null) s[r.currency] = Math.round(((s[r.currency] ?? 0) + v) * 100) / 100;
    return s;
  }, {});
  return {
    period, today, rows,
    totals: {
      active: rows.filter((r) => r.active).length,
      earned: byCurrency((r) => r.pay.earned), advance: byCurrency((r) => r.pay.advance), remaining: byCurrency((r) => r.pay.remaining),
      absentDays: rows.reduce((s, r) => s + r.pay.days.absent + r.pay.days.half_day + r.pay.days.unpaid_leave, 0),
      missingPay: rows.filter((r) => r.active && r.payAmount === null).length,
    },
    canEdit: hasPermission(actor.role, 'finance.employees.edit'), canLedger: hasPermission(actor.role, 'finance.ledger.create'), canDeleteLedger: hasPermission(actor.role, 'finance.ledger.delete'),
  };
}

/** One person: card, the month's calendar and pay, the last six months, leave and all ledger lines. */
export async function employeeDetail(actor: WorkOrderActor, id: string, rawPeriod?: string | null) {
  await need(actor, 'view');
  await ready();
  const today = istanbulToday();
  const period = PERIOD.parse(rawPeriod || periodOf(today));
  const [raw] = await sql`SELECT * FROM employees WHERE tenant_id = ${actor.tenantId} AND id = ${z.string().uuid().parse(id)}`;
  if (!raw) fail('Çalışan bulunamadı', 404);
  const e = asEmployee(raw);
  const from = `${shiftPeriod(period < periodOf(today) ? period : periodOf(today), -24)}-01`;
  const [attendance, ledger] = (await Promise.all([
    sql`SELECT id, day, kind, deducted, note FROM employee_attendance WHERE tenant_id = ${actor.tenantId} AND employee_id = ${e.id} AND day >= ${from} ORDER BY day`,
    sql`SELECT l.id, l.kind, l.amount, l.currency, l.entry_date, l.period, l.note, l.created_at, u.name AS created_by_name FROM employee_ledger_entries l LEFT JOIN users u ON u.id = l.created_by WHERE l.tenant_id = ${actor.tenantId} AND l.employee_id = ${e.id} ORDER BY l.entry_date DESC, l.created_at DESC LIMIT 1000`,
  ])) as [Row[], Row[]];
  const att = attendance.map(asAttendance);
  const led = ledger.map(asLedger);
  const sameCurrency = led.filter((l) => l.currency === e.pay_currency);
  const since = [trackedFrom(raw), e.start_date ? periodOf(e.start_date) : '0000-00'].sort().pop()!;
  const months = Array.from({ length: 6 }, (_, k) => shiftPeriod(period, -k)).filter((p, k) => k === 0 || p >= since)
    .map((p) => (p < trackedFrom(raw) ? untracked(monthPay(e, p, att, sameCurrency)) : { ...monthPay(e, p, att, sameCurrency), tracked: true }));
  return {
    period, today,
    employee: {
      id: String(e.id), fullName: e.full_name, title: e.title, department: e.department, email: e.email, phone: e.phone, active: Boolean(e.active), version: Number(e.version ?? 1),
      startDate: e.start_date, endDate: e.end_date, birthDate: e.birth_date, payType: e.pay_type, payAmount: e.pay_amount, currency: e.pay_currency, payDay: e.pay_day, iban: e.iban, notes: e.notes,
    },
    tenure: tenure(e.start_date, today),
    leave: annualLeave(e, att, today),
    pay: months[0], payDate: payDate(e, period), months,
    attendance: att.filter((a) => periodOf(a.day) === period).map((a) => ({ id: String(a.id), day: a.day, kind: a.kind, deducted: a.deducted, note: a.note ?? null })),
    ledger: led.map((l) => ({ id: String(l.id), kind: l.kind, amount: l.amount, currency: l.currency, entryDate: l.entry_date, period: l.period || periodOf(l.entry_date), note: l.note ?? null, createdBy: l.created_by_name ?? null })),
    otherCurrency: led.some((l) => l.currency !== e.pay_currency),
    canEdit: hasPermission(actor.role, 'finance.employees.edit'), canLedger: hasPermission(actor.role, 'finance.ledger.create'), canDeleteLedger: hasPermission(actor.role, 'finance.ledger.delete'),
  };
}

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable().optional();
export const EmployeeInput = z.object({
  id: z.string().uuid().optional(),
  version: z.number().int().positive().optional(),
  fullName: z.string().trim().min(2, 'Ad soyad en az 2 harf').max(180),
  title: text(120), department: text(120), email: z.union([z.literal(''), z.email('Geçerli e-posta girin')]).nullable().optional(), phone: text(40),
  startDate: DATE.nullable().optional(), endDate: DATE.nullable().optional(), birthDate: DATE.nullable().optional(),
  payType: z.enum(['monthly', 'daily']).default('monthly'),
  payAmount: z.number().finite().min(0).max(100_000_000).multipleOf(0.01).nullable().optional(),
  currency: z.enum(['TRY', 'USD', 'EUR']).default('TRY'),
  payDay: z.number().int().min(1).max(31).nullable().optional(),
  iban: z.string().trim().max(42).nullable().optional(),
  notes: text(2000),
  active: z.boolean().default(true),
}).superRefine((d, ctx) => {
  if (d.startDate && d.endDate && d.endDate < d.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Çıkış tarihi giriş tarihinden önce olamaz' });
  if (d.iban && !validIban(d.iban)) ctx.addIssue({ code: 'custom', path: ['iban'], message: 'IBAN geçersiz (TR ve 24 rakam, kontrol hanesi tutmalı)' });
});

export async function saveEmployee(actor: WorkOrderActor, raw: unknown) {
  const d = EmployeeInput.parse(raw);
  await need(actor, d.id ? 'edit' : 'create');
  await ready();
  const iban = d.iban ? normalizeIban(d.iban) : null;
  // Leaving sets the card passive; a passive card keeps its history.
  const active = d.endDate && d.endDate <= istanbulToday() ? false : d.active;
  return withTransaction(async (tx) => {
    const values = {
      full_name: d.fullName, title: d.title ?? null, department: d.department ?? null, email: d.email || null, phone: d.phone ?? null,
      start_date: d.startDate ?? null, end_date: d.endDate ?? null, birth_date: d.birthDate ?? null, pay_type: d.payType, pay_amount: d.payAmount ?? null,
      pay_currency: d.currency, pay_day: d.payDay ?? null, iban, notes: d.notes ?? null, active,
    };
    let row: Row;
    if (d.id) {
      const [current] = await tx`SELECT * FROM employees WHERE tenant_id = ${actor.tenantId} AND id = ${d.id} FOR UPDATE`;
      if (!current) fail('Çalışan bulunamadı', 404);
      if (d.version !== undefined && Number(current.version) !== d.version) fail('Çalışan kaydı bu arada değişti. Sayfayı yenileyin.', 409);
      [row] = await tx`UPDATE employees SET ${tx(values)}, version = version + 1, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${d.id} RETURNING id`;
      const changed = Object.keys(values).filter((k) => String(current[k] ?? '') !== String((values as Row)[k] ?? '') && !(current[k] instanceof Date && day(current[k]) === (values as Row)[k]));
      // Pay and IBAN changes are logged by name only; the values stay in the finance screens.
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'employee', entityId: String(row.id), action: 'updated', metadata: { fields: changed } });
    } else {
      [row] = await tx`INSERT INTO employees ${tx({ tenant_id: actor.tenantId, ...values })} RETURNING id`;
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'employee', entityId: String(row.id), action: 'created', metadata: { fullName: d.fullName } });
    }
    return { id: String(row.id) };
  });
}

export const AttendanceInput = z.object({
  employeeId: z.string().uuid(),
  days: z.array(DATE).min(1).max(62),
  kind: z.enum(ATTENDANCE_KINDS as [string, ...string[]]).nullable(),
  deducted: z.boolean().optional(),
  note: text(500),
});

/** Marks (or clears, kind null) one or more days for one person. */
export async function setAttendance(actor: WorkOrderActor, raw: unknown) {
  const d = AttendanceInput.parse(raw);
  await need(actor, 'edit');
  await ready();
  return withTransaction(async (tx) => {
    const [e] = await tx`SELECT id, start_date, end_date FROM employees WHERE tenant_id = ${actor.tenantId} AND id = ${d.employeeId} FOR SHARE`;
    if (!e) fail('Çalışan bulunamadı', 404);
    const emp = asEmployee(e);
    for (const dd of [...new Set(d.days)].sort()) {
      if (emp.start_date && dd < emp.start_date) fail(`${dd.split('-').reverse().join('.')} işe girişten önce`);
      if (emp.end_date && dd > emp.end_date) fail(`${dd.split('-').reverse().join('.')} işten çıkıştan sonra`);
      await assertOpenPeriod(tx, actor.tenantId, dd);
      if (d.kind === null) await tx`DELETE FROM employee_attendance WHERE tenant_id = ${actor.tenantId} AND employee_id = ${d.employeeId} AND day = ${dd}`;
      else {
        const deducted = d.deducted ?? ATTENDANCE[d.kind as keyof typeof ATTENDANCE].deducted;
        await tx`INSERT INTO employee_attendance (tenant_id, employee_id, day, kind, deducted, note, created_by) VALUES (${actor.tenantId}, ${d.employeeId}, ${dd}, ${d.kind}, ${deducted}, ${d.note ?? null}, ${actor.userId})
          ON CONFLICT (tenant_id, employee_id, day) DO UPDATE SET kind = EXCLUDED.kind, deducted = EXCLUDED.deducted, note = EXCLUDED.note, updated_at = now()`;
      }
    }
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'employee', entityId: d.employeeId, action: d.kind ? 'attendance.marked' : 'attendance.cleared', metadata: { days: d.days, kind: d.kind } });
    return { ok: true };
  });
}

export const LedgerInput = z.object({
  employeeId: z.string().uuid(),
  kind: z.enum(['salary', 'advance', 'deduction', 'payment', 'bonus']),
  amount: z.number().finite().positive('Tutar sıfırdan büyük olmalı').max(100_000_000).multipleOf(0.01),
  entryDate: DATE,
  period: PERIOD.nullable().optional(),
  note: text(2000),
});

export async function addLedger(actor: WorkOrderActor, raw: unknown) {
  const d = LedgerInput.parse(raw);
  await need(actor, 'create');
  if (!hasPermission(actor.role, 'finance.ledger.create')) fail('Bu işlem için yetkiniz yok', 403);
  await ready();
  return withTransaction(async (tx) => {
    const [e] = await tx`SELECT id, pay_currency FROM employees WHERE tenant_id = ${actor.tenantId} AND id = ${d.employeeId} FOR SHARE`;
    if (!e) fail('Çalışan bulunamadı', 404);
    await assertOpenPeriod(tx, actor.tenantId, d.entryDate);
    const [row] = await tx`INSERT INTO employee_ledger_entries (tenant_id, employee_id, kind, amount, currency, entry_date, period, note, created_by)
      VALUES (${actor.tenantId}, ${d.employeeId}, ${d.kind}, ${d.amount}, ${e.pay_currency}, ${d.entryDate}, ${d.period ?? periodOf(d.entryDate)}, ${d.note ?? null}, ${actor.userId}) RETURNING id`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'employee', entityId: d.employeeId, action: `ledger.${d.kind}`, metadata: { entryId: String(row.id), amount: d.amount, currency: e.pay_currency, period: d.period ?? periodOf(d.entryDate) } });
    return { id: String(row.id) };
  });
}

export async function deleteLedger(actor: WorkOrderActor, raw: unknown) {
  const { id } = z.object({ id: z.string().uuid() }).parse(raw);
  await need(actor, 'delete');
  return withTransaction(async (tx) => {
    const [row] = await tx`SELECT id, employee_id, kind, amount, currency, entry_date, period FROM employee_ledger_entries WHERE tenant_id = ${actor.tenantId} AND id = ${id} FOR UPDATE`;
    if (!row) fail('Hareket bulunamadı', 404);
    await assertOpenPeriod(tx, actor.tenantId, day(row.entry_date));
    await tx`DELETE FROM employee_ledger_entries WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'employee', entityId: String(row.employee_id), action: 'ledger.deleted', metadata: { entryId: id, kind: row.kind, amount: Number(row.amount), currency: row.currency, period: row.period } });
    return { ok: true };
  });
}
