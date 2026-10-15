import type { AttendanceSnapshot } from './attendance-policy';
/**
 * Personnel arithmetic, pure and testable. Pay here is the net amount the firm agreed to pay, not a
 * legal payroll (bordro): SGK, income tax and stamp duty stay with the accountant.
 *
 * Month basis: a monthly salary is 30 days (Turkish practice), so one day is salary / 30 whatever
 * the calendar length; joining or leaving mid-month pays the days in employment on that basis.
 * A daily wage is paid for Monday–Saturday working days in employment (Sunday is the weekly rest).
 */
export type PayType = 'monthly' | 'daily';
export type AttendanceKind = 'absent' | 'half_day' | 'sick' | 'paid_leave' | 'unpaid_leave' | 'annual_leave';
export type LedgerKind = 'salary' | 'advance' | 'deduction' | 'payment' | 'bonus';

export const ATTENDANCE: Record<AttendanceKind, { label: string; short: string; days: number; deducted: boolean; tone: string }> = {
  absent: { label: 'Habersiz gelmedi', short: 'D', days: 1, deducted: true, tone: 'rose' },
  half_day: { label: 'Yarım gün', short: '½', days: 0.5, deducted: true, tone: 'amber' },
  sick: { label: 'Raporlu', short: 'R', days: 1, deducted: false, tone: 'sky' },
  paid_leave: { label: 'Ücretli izin', short: 'Ü', days: 1, deducted: false, tone: 'emerald' },
  unpaid_leave: { label: 'Ücretsiz izin', short: 'Z', days: 1, deducted: true, tone: 'zinc' },
  annual_leave: { label: 'Yıllık izin', short: 'Y', days: 1, deducted: false, tone: 'violet' },
};
export const ATTENDANCE_KINDS = Object.keys(ATTENDANCE) as AttendanceKind[];

export const LEDGER: Record<LedgerKind, { label: string; sign: 1 | -1 }> = {
  bonus: { label: 'Prim', sign: 1 },
  deduction: { label: 'Kesinti', sign: -1 },
  advance: { label: 'Avans', sign: -1 },
  salary: { label: 'Maaş ödemesi', sign: -1 },
  payment: { label: 'Diğer ödeme', sign: -1 },
};

export type Employee = {
  start_date: string | null;
  end_date: string | null;
  birth_date?: string | null;
  pay_type: PayType;
  pay_amount: number | null;
  pay_day?: number | null;
  pay_currency?: string;
};
export type Attendance = { day: string; kind: AttendanceKind; deducted: boolean; deductionSnapshot?: AttendanceSnapshot | null };
export type Ledger = { kind: LedgerKind; amount: number; entry_date: string; period?: string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function periodOf(date: string) {
  return date.slice(0, 7);
}
export function shiftPeriod(period: string, by: number) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function periodLabel(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
/** Every date of the month, YYYY-MM-DD. */
export function monthDays(period: string) {
  const [y, m] = period.split('-').map(Number);
  return Array.from({ length: daysIn(y, m) }, (_, k) => iso(y, m, k + 1));
}
export const isSunday = (day: string) => new Date(day + 'T00:00:00Z').getUTCDay() === 0;

/** The part of the month the person was employed: [from, to] dates, or null when not at all. */
export function employedRange(e: Pick<Employee, 'start_date' | 'end_date'>, period: string): [string, string] | null {
  const days = monthDays(period);
  const from = e.start_date && e.start_date > days[0] ? e.start_date : days[0];
  const to = e.end_date && e.end_date < days[days.length - 1] ? e.end_date : days[days.length - 1];
  return from <= to ? [from, to] : null;
}

/** Days paid on the 30-day basis for a monthly salary. */
export function monthlyBasisDays(e: Pick<Employee, 'start_date' | 'end_date'>, period: string) {
  const range = employedRange(e, period);
  if (!range) return 0;
  const days = monthDays(period);
  const first = Number(range[0].slice(8));
  const last = range[1] === days[days.length - 1] ? 30 : Math.min(30, Number(range[1].slice(8)));
  return Math.max(0, Math.min(30, last - first + 1));
}

export function workingDays(e: Pick<Employee, 'start_date' | 'end_date'>, period: string) {
  const range = employedRange(e, period);
  if (!range) return 0;
  return monthDays(period).filter((d) => d >= range[0] && d <= range[1] && !isSunday(d)).length;
}

export type MonthPay = {
  period: string;
  dailyRate: number | null;
  basisDays: number;
  base: number | null;
  days: Record<AttendanceKind, number>;
  deductedDays: number;
  absenceCut: number;
  reviewRequired?: boolean;
  deductions: Array<{ day: string; kind: AttendanceKind; cutDays: number; dailyRate: number | null; amount: number; policyVersion: number | null; currency?: string }>;

  bonus: number;
  deduction: number;
  advance: number;
  paid: number;
  /** What the month's work is worth after cuts, bonus and deductions. */
  earned: number | null;
  /** Still owed to the person for this month (negative: paid more than earned). */
  remaining: number | null;
};

export function monthPay(e: Employee, period: string, attendance: Attendance[], ledger: Ledger[]): MonthPay {
  const range = employedRange(e, period);
  const days = Object.fromEntries(Object.keys(ATTENDANCE).map((k) => [k, 0])) as Record<AttendanceKind, number>;
  const applicable = attendance.filter(a => periodOf(a.day) === period && range && a.day >= range[0] && a.day <= range[1]).sort((a,b) => a.day.localeCompare(b.day));
  let deductedDays = 0;
  for (const a of applicable) {
    days[a.kind] += ATTENDANCE[a.kind].days;
    if (a.deducted) deductedDays += a.deductionSnapshot?.cutDays ?? ATTENDANCE[a.kind].days;
  }
  const mine = ledger.filter((l) => (l.period || periodOf(l.entry_date)) === period);
  const sum = (k: LedgerKind) => round2(mine.filter((l) => l.kind === k).reduce((s, l) => s + Number(l.amount), 0));
  const bonus = sum('bonus');
  const deduction = sum('deduction');
  const advance = sum('advance');
  const paid = round2(sum('salary') + sum('payment'));
  const amount = e.pay_amount === null || e.pay_amount === undefined ? null : Number(e.pay_amount);
  const basisDays = e.pay_type === 'daily' ? workingDays(e, period) : monthlyBasisDays(e, period);
  const dailyRate = amount === null ? null : e.pay_type === 'daily' ? amount : amount / 30;
  const base = dailyRate === null ? null : round2(dailyRate * basisDays);
  const deductions = applicable.filter(a => a.deducted).map(a => {
    const cutDays = a.deductionSnapshot?.cutDays ?? ATTENDANCE[a.kind].days;
    const rate = a.deductionSnapshot ? a.deductionSnapshot.dailyRate : dailyRate;
    return { day: a.day, kind: a.kind, cutDays, dailyRate: rate === null ? null : round2(rate), amount: rate === null ? 0 : round2(rate * cutDays), policyVersion: a.deductionSnapshot?.policyVersion ?? null, currency: a.deductionSnapshot?.currency ?? e.pay_currency };
  });
  const reviewRequired = deductions.some(d => d.cutDays > 0 && (d.dailyRate === null || Boolean(e.pay_currency && d.currency && d.currency !== e.pay_currency)));
  const absenceCut = round2(Math.min(deductions.reduce((sum, d) => sum + d.amount, 0), base ?? 0));
  const earned = base === null || reviewRequired ? null : round2(base - absenceCut + bonus - deduction);
  const remaining = earned === null ? null : round2(earned - advance - paid);
  return { period, dailyRate: dailyRate === null ? null : round2(dailyRate), basisDays, base, days, deductedDays, absenceCut, deductions, reviewRequired, bonus, deduction, advance, paid, earned, remaining };
}

/** Whole years, months and days between two dates. */
export function tenure(start: string | null, asOf: string) {
  if (!start || start > asOf) return null;
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = asOf.split('-').map(Number);
  let years = y2 - y1;
  let months = m2 - m1;
  let days = d2 - d1;
  if (days < 0) { months -= 1; days += daysIn(y2, m2 - 1 || 12); }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days };
}
export function tenureText(t: ReturnType<typeof tenure>) {
  if (!t) return '—';
  const parts = [t.years && `${t.years} yıl`, t.months && `${t.months} ay`, !t.years && !t.months && `${t.days} gün`].filter(Boolean);
  return parts.join(' ') || '0 gün';
}

/** The anniversary of `start` on or before `asOf`. */
function lastAnniversary(start: string, asOf: string) {
  const [, m, d] = start.split('-').map(Number);
  const y = Number(asOf.slice(0, 4));
  const on = (yy: number) => iso(yy, m, Math.min(d, daysIn(yy, m)));
  const a = on(y) > asOf ? on(y - 1) : on(y);
  return a < start ? start : a;
}

/**
 * Annual paid leave under İş Kanunu md. 53: after one year of service 14 days, from five years 20,
 * from fifteen years 26; a worker under 18 or 50 and over gets at least 20. The leave year starts at
 * the work anniversary; carried-over days from earlier years are not tracked here.
 */
export function annualLeave(e: Pick<Employee, 'start_date' | 'birth_date'>, attendance: Attendance[], asOf: string) {
  const t = tenure(e.start_date, asOf);
  if (!t || !e.start_date) return null;
  let entitled = t.years >= 15 ? 26 : t.years >= 5 ? 20 : t.years >= 1 ? 14 : 0;
  const age = e.birth_date ? tenure(e.birth_date, asOf)?.years ?? null : null;
  if (entitled > 0 && age !== null && (age < 18 || age >= 50)) entitled = Math.max(entitled, 20);
  const yearStart = lastAnniversary(e.start_date, asOf);
  const used = attendance.filter((a) => a.kind === 'annual_leave' && a.day >= yearStart && a.day <= asOf).reduce((s, a) => s + ATTENDANCE[a.kind].days, 0);
  const [y, m, d] = yearStart.split('-').map(Number);
  const next = iso(y + 1, m, Math.min(d, daysIn(y + 1, m)));
  return { entitled, used, remaining: entitled - used, yearStart, nextAnniversary: next, serviceYears: t.years, eligible: t.years >= 1 };
}

/** The pay date for a month's salary: pay_day of the following month (clamped to its length). */
export function payDate(e: Pick<Employee, 'pay_day'>, period: string) {
  if (!e.pay_day) return null;
  const next = shiftPeriod(period, 1);
  const [y, m] = next.split('-').map(Number);
  return iso(y, m, Math.min(e.pay_day, daysIn(y, m)));
}
