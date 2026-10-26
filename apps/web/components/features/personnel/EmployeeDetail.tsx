'use client';

import { PayCutReview } from './PayCutReview';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarCheck, Pencil, Phone, Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { StatusChip, useConfirm } from '@/components/kit';
import { CopyChip } from '@/components/spells/CopyChip';
import { formatIban } from '@/lib/features/personnel/iban';
import { LEDGER, monthDays, isSunday, periodLabel, tenureText, type AttendanceKind, type LedgerKind, type MonthPay } from '@/lib/features/personnel/payroll';
import { cn } from '@/lib/utils';
import { ATTENDANCE, DayMenu, EmployeeDialog, LedgerDialog, Legend, MonthSwitch, initials, kindTone, money, trDate, usePersonnel, type EmployeeCard } from './shared';

type Detail = {
  period: string; today: string;
  employee: Required<Pick<EmployeeCard, 'id' | 'fullName' | 'currency'>> & EmployeeCard & { version: number; active: boolean };
  tenure: { years: number; months: number; days: number } | null;
  leave: { entitled: number; used: number; remaining: number; yearStart: string; nextAnniversary: string; serviceYears: number; eligible: boolean } | null;
  pay: MonthPay; payDate: string | null; months: MonthPay[];
  attendance: Array<{ id: string; day: string; kind: AttendanceKind; deducted: boolean; note: string | null }>;
  ledger: Array<{ id: string; kind: LedgerKind; amount: number; currency: string; entryDate: string; period: string; note: string | null; createdBy: string | null; payrollSnapshot?: { currency: string; calculation: MonthPay } | null }>;
  otherCurrency: boolean; canEdit: boolean; canLedger: boolean; canDeleteLedger: boolean;
};

function Tile({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="truncate text-sm font-semibold">{children}</div>
      {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Breakdown({ pay, currency, payDate }: { pay: MonthPay; currency: string; payDate: string | null }) {
  const m = (n: number | null) => money(n, currency);
  const line = (label: string, value: React.ReactNode, cls?: string, note?: string) => (
    <div className={cn('flex items-baseline justify-between gap-3 py-1.5 text-[13px]', cls)}>
      <span>{label}{note && <span className="ml-1.5 text-[11px] text-muted-foreground">{note}</span>}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
  if ((pay as MonthPay & { tracked?: boolean }).tracked === false) return <p className="text-sm text-muted-foreground">Bu ay çalışan sisteme eklenmeden önce; ödemeler burada izlenmedi.</p>;
  if (pay.base === null) return <p className="text-sm text-muted-foreground">Ücret girilmemiş; hesap için çalışan kartına ücret ekleyin.</p>;
  const paidPart = pay.earned && pay.earned > 0 ? Math.min(1, (pay.advance + pay.paid) / pay.earned) : 0;
  return (
    <div>
      {line('Ücret esası', m(pay.base), undefined, `${pay.basisDays} gün × ${m(pay.dailyRate)}`)}
      {pay.absenceCut > 0 && line('Devamsızlık kesintisi', `− ${m(pay.absenceCut)}`, 'text-rose-700 dark:text-rose-300', `${pay.deductedDays.toLocaleString('tr-TR')} gün`)}
      {pay.deductions?.length > 0 && <details className="mb-2 rounded-md border border-border p-3"><summary className="cursor-pointer text-xs font-medium">Gün bazında kesinti hesabı ve kayıt anındaki kurallar</summary><ul className="mt-2 space-y-2 text-xs">{pay.deductions.map(d => <li key={d.day}><span className="font-medium">{trDate(d.day)} · {ATTENDANCE[d.kind].label}</span><p className="text-muted-foreground">{d.cutDays.toLocaleString('tr-TR')} günlük × {m(d.dailyRate)} = {m(d.amount)} · {d.policyVersion === null ? 'eski kayıt kuralı' : `kural sürümü ${d.policyVersion}`}</p></li>)}</ul></details>}
      {pay.bonus > 0 && line('Prim', `+ ${m(pay.bonus)}`, 'text-emerald-700 dark:text-emerald-300')}
      {pay.deduction > 0 && line('Kesinti', `− ${m(pay.deduction)}`, 'text-rose-700 dark:text-rose-300')}
      {line('Hak edilen', m(pay.earned), 'border-t border-border font-semibold')}
      {pay.advance > 0 && line('Avans', `− ${m(pay.advance)}`)}
      {pay.paid > 0 && line('Ödenen', `− ${m(pay.paid)}`)}
      {line((pay.remaining ?? 0) < 0 ? 'Fazla ödendi' : 'Kalan ödeme', m(Math.abs(pay.remaining ?? 0)), cn('border-t border-border text-base font-semibold', (pay.remaining ?? 0) < 0 && 'text-rose-700 dark:text-rose-300'), payDate ? `ödeme ${trDate(payDate)}` : undefined)}
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(paidPart * 100)} aria-label="Ödenen oran">
        <div className="h-full rounded-full bg-primary" style={{ width: `${paidPart * 100}%` }} />
      </div>
    </div>
  );
}

const WEEK = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export function EmployeeDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [period, setPeriodState] = useState(params.get('period') || '');
  const { data, error, loading, busy, act } = usePersonnel<Detail>(`employeeId=${id}${period ? `&period=${period}` : ''}`);
  const [editing, setEditing] = useState(false);
  const [ledgerKind, setLedgerKind] = useState<LedgerKind | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const setPeriod = (v: string) => { setPeriodState(v); router.replace(`${pathname}?period=${v}`, { scroll: false }); };

  if (error && !data) return <main className="rf-page"><p role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</p><Link href="/finance/employees" className="mt-3 inline-block text-sm underline">Personele dön</Link></main>;
  if (loading && !data) return <main className="rf-page space-y-3">{[0, 1, 2].map((k) => <div key={k} className="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />)}</main>;
  if (!data) return null;
  const e = data.employee;
  const days = monthDays(data.period);
  const offset = (new Date(days[0] + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const byDay = new Map(data.attendance.map((a) => [a.day, a]));
  const mark = async (day: string, kind: AttendanceKind | null, deducted?: boolean) => {
    try { await act('attendance.set', { employeeId: e.id, days: [day], kind, deducted }); } catch (err) { toast.error(err instanceof Error ? err.message : 'Kaydedilemedi'); }
  };
  const maxMonth = Math.max(1, ...data.months.map((m) => Math.max(m.earned ?? 0, m.advance + m.paid)));

  return (
    <main className="rf-page space-y-5">
      {confirmDialog}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/finance/employees?period=${data.period}`} className="rf-icon-button grid h-9 w-9 place-items-center border border-border" aria-label="Personele dön"><ArrowLeft size={16} /></Link>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-base font-semibold text-primary">{initials(e.fullName)}</span>
          <div className="min-w-0">
            <p className="rf-eyebrow">Personel</p>
            <h1 className="rf-page-title truncate">{e.fullName}</h1>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{[e.title, e.department].filter(Boolean).join(' · ') || 'Görev yok'} <StatusChip tone={e.active ? 'success' : 'muted'} label={e.active ? 'Aktif' : `Ayrıldı ${trDate(e.endDate)}`} /></p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSwitch period={data.period} onChange={setPeriod} />
          {data.canEdit && <button type="button" onClick={() => setEditing(true)} className="rf-secondary-button h-9 items-center gap-1.5 px-3 text-xs"><Pencil size={14} />Düzenle</button>}
          {data.canLedger && e.active && <button type="button" onClick={() => setLedgerKind('advance')} className="rf-secondary-button h-9 px-3 text-xs">Avans ver</button>}
          {data.canLedger && <button type="button" onClick={() => setLedgerKind('salary')} className="rf-primary-button h-9 items-center gap-1.5 px-3 text-xs"><Wallet size={14} />Maaş öde</button>}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        <Tile label="İşe giriş" sub={data.tenure ? tenureText(data.tenure) : undefined}>{trDate(e.startDate)}</Tile>
        <Tile label={e.payType === 'daily' ? 'Günlük ücret' : 'Aylık net maaş'} sub={e.payDay ? `Her ayın ${e.payDay}'i ödenir` : undefined}>{money(e.payAmount ?? null, e.currency)}</Tile>
        <Tile label="Yıllık izin" sub={data.leave ? (data.leave.eligible ? `Hak ${data.leave.entitled} · kullanılan ${data.leave.used} · yenilenme ${trDate(data.leave.nextAnniversary)}` : `Hak ${trDate(data.leave.nextAnniversary)}'de doğar`) : 'Giriş tarihi yok'}>
          {data.leave ? (data.leave.eligible ? <span className={cn(data.leave.remaining < 0 && 'text-rose-700 dark:text-rose-300')}>{data.leave.remaining} gün kaldı</span> : 'Henüz yok') : '—'}
        </Tile>
        {e.iban && <Tile label="IBAN"><span className="flex items-center gap-1"><span className="truncate font-mono text-[12px]">{formatIban(e.iban)}</span><CopyChip value={e.iban} /></span></Tile>}
        {e.phone && <Tile label="Telefon"><a href={`tel:${e.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone size={13} />{e.phone}</a></Tile>}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold capitalize">{periodLabel(data.period)} hesabı</h2>
          <Breakdown pay={data.pay} currency={e.currency} payDate={data.payDate} />
          {data.otherCurrency && <p className="mt-2 text-[11px] text-muted-foreground">Ücretten farklı para birimindeki hareketler hesaba katılmaz.</p>}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-2"><h2 className="flex items-center gap-1.5 text-sm font-semibold"><CalendarCheck size={15} />Devam takvimi</h2><span className="text-[11px] text-muted-foreground">Güne dokunun</span></div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK.map((w) => <span key={w} className="text-[10px] font-medium text-muted-foreground">{w}</span>)}
            {Array.from({ length: offset }, (_, k) => <span key={`x${k}`} />)}
            {days.map((d) => {
              const a = byDay.get(d);
              const out = (e.startDate && d < e.startDate) || (e.endDate && d > e.endDate);
              const cell = (
                <button type="button" disabled={Boolean(out) || !data.canEdit || busy} aria-label={`${trDate(d)}: ${a ? ATTENDANCE[a.kind].label : 'normal gün'}`}
                  className={cn('flex aspect-square w-full flex-col items-center justify-center rounded-md border text-xs tabular-nums', a ? kindTone(a.kind) : 'border-border/60 hover:border-primary/50', isSunday(d) && !a && 'bg-muted text-muted-foreground', d === data.today && 'ring-2 ring-primary/50', out && 'opacity-30')}>
                  <span>{Number(d.slice(8))}</span>
                  {a && <span className={cn('text-[10px] font-bold leading-none', !a.deducted && ATTENDANCE[a.kind].deducted && 'line-through')}>{ATTENDANCE[a.kind].short}</span>}
                </button>
              );
              return <div key={d}>{out || !data.canEdit ? cell : <DayMenu current={a?.kind ?? null} deducted={a?.deducted} onPick={(k, ded) => mark(d, k, ded)}>{cell}</DayMenu>}</div>;
            })}
          </div>
          <div className="mt-3"><Legend /></div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Son 6 ay</h2>
        <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {data.months.map((m) => (
            <li key={m.period}>
              <button type="button" onClick={() => setPeriod(m.period)} className={cn('w-full rounded-lg border p-2 text-left text-xs', m.period === data.period ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-accent')}>
                <p className="font-medium capitalize">{periodLabel(m.period)}</p>
                <div className="mt-2 flex h-12 items-end gap-1" aria-hidden>
                  <span className="w-1/2 rounded-t bg-primary/70" style={{ height: `${((m.earned ?? 0) / maxMonth) * 100}%` }} />
                  <span className="w-1/2 rounded-t bg-amber-500/70" style={{ height: `${((m.advance + m.paid) / maxMonth) * 100}%` }} />
                </div>
                <p className="mt-1 flex justify-between"><span className="text-muted-foreground">Kalan</span><span className={cn('font-semibold tabular-nums', (m.remaining ?? 0) < 0 && 'text-rose-700 dark:text-rose-300')}>{(m as MonthPay & { tracked?: boolean }).tracked === false ? 'kayıt öncesi' : money(m.remaining, e.currency)}</span></p>
                {m.deductedDays > 0 && <p className="text-[11px] text-rose-700 dark:text-rose-300">{m.deductedDays.toLocaleString('tr-TR')} gün kesinti</p>}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex gap-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/70" />Hak edilen</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500/70" />Avans + ödenen</span></p>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-semibold">Hesap hareketleri</h2>
          {data.canLedger && <button type="button" onClick={() => setLedgerKind('advance')} className="rf-secondary-button h-8 items-center gap-1 px-2.5 text-xs"><Plus size={13} />Hareket</button>}
        </div>
        {data.ledger.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Tarih</th><th className="px-2 py-2 font-medium">Tür</th><th className="px-2 py-2 font-medium">Ay</th><th className="px-2 py-2 font-medium">Açıklama</th><th className="px-2 py-2 text-right font-medium">Tutar</th><th className="w-10" /></tr></thead>
              <tbody>
                {data.ledger.map((l) => (
                  <tr key={l.id} className="border-t border-border/60">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">{trDate(l.entryDate)}</td>
                    <td className="px-2 py-2"><span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', l.kind === 'bonus' ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' : l.kind === 'deduction' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : l.kind === 'advance' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300' : 'bg-primary/10 text-primary')}>{LEDGER[l.kind].label}</span></td>
                    <td className="whitespace-nowrap px-2 py-2 capitalize text-muted-foreground">{periodLabel(l.period)}</td>
                    <td className="px-2 py-2 text-muted-foreground">{l.note || '—'}{l.payrollSnapshot && <details className="mt-2"><summary className="cursor-pointer text-xs text-primary">Ödeme anındaki gün kuralları ve kesinti hesabı</summary><PayCutReview pay={l.payrollSnapshot.calculation} currency={l.payrollSnapshot.currency} /></details>}{l.createdBy && <span className="ml-1 text-[11px]">· {l.createdBy}</span>}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums">{money(l.amount, l.currency)}</td>
                    <td className="px-2 py-2">{data.canDeleteLedger && (
                      <button type="button" aria-label="Hareketi sil" disabled={busy} className="rf-icon-button grid h-7 w-7 place-items-center text-muted-foreground hover:text-rose-600"
                        onClick={async () => { if (!(await confirm({ title: `${LEDGER[l.kind].label} ${money(l.amount, l.currency)} silinsin mi?`, description: 'Hareket personel hesabından kaldırılır.', confirmLabel: 'Hareketi sil' }))) return; try { await act('ledger.delete', { id: l.id }); toast.success('Silindi'); } catch (err) { toast.error(err instanceof Error ? err.message : 'Silinemedi'); } }}>
                        <Trash2 size={14} />
                      </button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-4 py-6 text-center text-sm text-muted-foreground">Henüz hareket yok</p>}
      </section>

      {e.notes && <section className="rounded-xl border border-border bg-card p-4 text-[13px] whitespace-pre-line">{e.notes}</section>}

      <EmployeeDialog open={editing} onClose={() => setEditing(false)} employee={e} busy={busy} onSave={async (input) => { await act('employee.save', input); toast.success('Kaydedildi'); }} />
      {ledgerKind && (
        <LedgerDialog open onClose={() => setLedgerKind(null)} busy={busy} employeeName={e.fullName} currency={e.currency} defaultKind={ledgerKind} calculation={data.pay} period={data.period} today={data.today}
          onSave={async (input) => { await act('ledger.add', { ...input, employeeId: e.id }); toast.success('Kaydedildi'); }} />
      )}
    </main>
  );
}
