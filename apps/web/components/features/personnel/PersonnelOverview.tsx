'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AttendanceEntryDialog } from './AttendanceEntryDialog';
import type { AttendancePolicy } from '@/lib/features/personnel/attendance-policy';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, CalendarRange, HandCoins, List, Plus, UserRound, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, PageHeader } from '@/components/kit';
import { monthDays, isSunday, type AttendanceKind, type LedgerKind, type MonthPay } from '@/lib/features/personnel/payroll';
import { cn } from '@/lib/utils';
import { ATTENDANCE, DayMenu, EmployeeDialog, LedgerDialog, Legend, MonthSwitch, initials, kindTone, money, trDate, usePersonnel } from './shared';

type Row = {
  id: string; fullName: string; title: string | null; department: string | null; active: boolean;
  startDate: string | null; endDate: string | null; payType: 'monthly' | 'daily'; payAmount: number | null; currency: string; payDay: number | null;
  tenure: { years: number; months: number; days: number } | null; anniversarySoon: boolean; pay: MonthPay; payDate: string | null;
  attendance: Array<{ day: string; kind: AttendanceKind; deducted: boolean; note: string | null }>;
};
type Overview = {
  period: string; today: string; rows: Row[]; policy: AttendancePolicy;
  totals: { active: number; earned: Record<string, number>; advance: Record<string, number>; remaining: Record<string, number>; absentDays: number; missingPay: number };
  canEdit: boolean; canLedger: boolean; canDeleteLedger: boolean;
};

const sumText = (m: Record<string, number>) => Object.entries(m).map(([c, v]) => money(v, c)).join(' · ') || money(0);
const tenureShort = (t: Row['tenure']) => (!t ? '—' : t.years ? `${t.years} yıl${t.months ? ` ${t.months} ay` : ''}` : t.months ? `${t.months} ay` : `${t.days} gün`);

function AbsenceChips({ pay }: { pay: MonthPay }) {
  const list = (Object.keys(pay.days) as AttendanceKind[]).filter((k) => pay.days[k] > 0);
  if (!list.length) return <span className="text-xs text-muted-foreground">Tam</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {list.map((k) => <span key={k} title={ATTENDANCE[k].label} className={cn('inline-flex h-5 items-center gap-0.5 rounded border px-1 text-[11px] font-semibold tabular-nums', kindTone(k))}>{ATTENDANCE[k].short} {pay.days[k].toLocaleString('tr-TR')}</span>)}
    </span>
  );
}

export function PersonnelOverview() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [attendanceDraft, setAttendanceDraft] = useState<{employeeId:string;day:string;kind:AttendanceKind} | null>(null);
  useEffect(() => { const q = new URLSearchParams(window.location.search), employeeId = q.get('employeeId'), day = q.get('day'), kind = q.get('kind'); if (q.get('attendance') === 'new') setAttendanceOpen(true); if (employeeId && day && kind && kind in ATTENDANCE) { setAttendanceDraft({ employeeId, day, kind: kind as AttendanceKind }); setAttendanceOpen(true); } }, []);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [period, setPeriodState] = useState(params.get('period') || '');
  const view = params.get('view') === 'puantaj' ? 'puantaj' : 'list';
  const { data, error, loading, busy, act } = usePersonnel<Overview>(period ? `period=${period}` : '');
  const p = data?.period ?? period;
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v); else next.delete(k);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const setPeriod = (v: string) => { setPeriodState(v); setParam('period', v); };
  const [creating, setCreating] = useState(false);
  const [ledger, setLedger] = useState<{ row: Row; kind: LedgerKind } | null>(null);
  const [showPassive, setShowPassive] = useState(false);
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => showPassive || r.active), [data, showPassive]);
  const days = p ? monthDays(p) : [];

  const mark = async (row: Row, day: string, kind: AttendanceKind | null, deducted?: boolean) => {
    try {
      await act('attendance.set', { employeeId: row.id, days: [day], kind, deducted });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    }
  };

  return (
    <div className="rf-page space-y-5">
      <PageHeader eyebrow="Finans & muhasebe" title="Personel"
        hint="Aylık maaş 30 gün esasıyla hesaplanır: bir gün = maaş / 30. Gelmediği gün, yarım gün ve ücretsiz izin maaştan kesilir; raporlu, ücretli izin ve yıllık izin kesilmez. Avans ve maaş ödemeleri seçtiğiniz ayın kalanından düşer. Tutarlar net ücrettir; resmi bordro muhasebecinizdedir."
        kpis={data ? [
          { label: 'aktif çalışan', value: data.totals.active, icon: Users },
          { label: 'bu ay hak edilen', value: sumText(data.totals.earned), icon: Wallet },
          { label: 'verilen avans', value: sumText(data.totals.advance), icon: HandCoins },
          { label: 'kalan ödeme', value: sumText(data.totals.remaining), icon: Wallet, tone: Object.values(data.totals.remaining).some((v) => v > 0) ? 'warning' : 'success' },
          { label: 'devamsızlık günü', value: data.totals.absentDays.toLocaleString('tr-TR'), icon: CalendarRange, tone: data.totals.absentDays ? 'danger' : 'neutral' },
        ] : undefined}
        action={<>
          {p && <MonthSwitch period={p} onChange={setPeriod} />}
          <div role="group" aria-label="Görünüm" className="flex rounded-md border border-border p-0.5">
            <button type="button" aria-pressed={view === 'list'} aria-label="Liste" onClick={() => setParam('view', '')} className={cn('grid h-8 w-8 place-items-center rounded', view === 'list' && 'bg-primary/10 text-primary')}><List size={16} /></button>
            <button type="button" aria-pressed={view === 'puantaj'} aria-label="Puantaj" onClick={() => setParam('view', 'puantaj')} className={cn('grid h-8 w-8 place-items-center rounded', view === 'puantaj' && 'bg-primary/10 text-primary')}><CalendarRange size={16} /></button>
          </div>
          {data?.canEdit && <button type="button" onClick={() => setCreating(true)} className="rf-primary-button h-9 items-center gap-2 px-3 text-xs"><Plus size={14} /> Çalışan ekle</button>}
        </>} />

      {data && <div className="flex flex-wrap gap-2">{data.canEdit && <button className="rf-primary-button" onClick={() => { setAttendanceDraft(null); setAttendanceOpen(true); }}>Devamsızlık / izin ekle</button>}<Link className="rf-secondary-button" href="/settings#personel">Kesinti kuralları</Link></div>}
      {data && <AttendanceEntryDialog open={attendanceOpen} initial={attendanceDraft} onClose={() => setAttendanceOpen(false)} busy={busy} rows={rows} today={data.today} policy={data.policy} onSave={input => act('attendance.set', input)} />}
      {error && <p role="alert" className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      {data && data.totals.missingPay > 0 && (
        <p className="flex items-center gap-2 rounded-md border border-amber-600/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"><AlertTriangle size={14} />{data.totals.missingPay} çalışanın ücreti girilmemiş; hesap için kartına ücret ekleyin.</p>
      )}

      {loading && !data ? (
        <div className="space-y-2">{[0, 1, 2].map((k) => <div key={k} className="h-16 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />)}</div>
      ) : data && !data.rows.length ? (
        <div className="rounded-xl border border-dashed border-border"><EmptyState icon={UserRound} title="Henüz çalışan yok" action={data.canEdit ? { label: 'Çalışan ekle', onClick: () => setCreating(true) } : undefined} /></div>
      ) : data && view === 'list' ? (
        <section className="space-y-2">
          <div className="flex justify-end"><label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={showPassive} onChange={(e) => setShowPassive(e.target.checked)} />Ayrılanları da göster</label></div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {rows.map((r) => {
              const overpaid = (r.pay.remaining ?? 0) < 0;
              return (
                <li key={r.id} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                  <Link href={`/finance/employees/${r.id}?period=${p}`} className="flex min-w-0 items-center gap-3">
                    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold', r.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{initials(r.fullName)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{r.fullName}{!r.active && <span className="ml-2 text-[11px] font-normal text-muted-foreground">ayrıldı {trDate(r.endDate)}</span>}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[[r.title, r.department].filter(Boolean).join(' · '), r.tenure && tenureShort(r.tenure), r.anniversarySoon && 'yıldönümü yaklaşıyor'].filter(Boolean).join(' · ') || '—'}</span>
                    </span>
                  </Link>
                  <div className="text-xs">
                    <p className="text-muted-foreground">{r.payType === 'daily' ? 'Günlük' : 'Aylık'} {money(r.payAmount, r.currency)}</p>
                    <div className="mt-1"><AbsenceChips pay={r.pay} /></div>
                  </div>
                  {(r.pay as MonthPay & { tracked?: boolean }).tracked === false ? <p className="text-xs text-muted-foreground">Bu ay kayıt öncesi</p> : <div className="text-xs">
                    <p className="flex justify-between gap-2"><span className="text-muted-foreground">Hak edilen</span><span className="tabular-nums">{money(r.pay.earned, r.currency)}</span></p>
                    <p className="flex justify-between gap-2"><span className="text-muted-foreground">Avans + ödenen</span><span className="tabular-nums">{money(r.pay.advance + r.pay.paid, r.currency)}</span></p>
                    <p className="flex justify-between gap-2 font-semibold"><span>{overpaid ? 'Fazla ödendi' : 'Kalan'}</span><span className={cn('tabular-nums', overpaid ? 'text-rose-700 dark:text-rose-300' : (r.pay.remaining ?? 0) > 0 ? 'text-foreground' : 'text-emerald-700 dark:text-emerald-300')}>{money(r.pay.remaining === null ? null : Math.abs(r.pay.remaining), r.currency)}</span></p>
                    {r.payDate && <p className="text-[11px] text-muted-foreground">Ödeme {trDate(r.payDate)}</p>}
                  </div>}
                  {data.canLedger && r.active && (
                    <div className="flex gap-1.5 sm:flex-col">
                      <button type="button" onClick={() => setLedger({ row: r, kind: 'advance' })} className="rf-secondary-button h-8 px-2.5 text-xs">Avans</button>
                      <button type="button" onClick={() => setLedger({ row: r, kind: 'salary' })} className="rf-secondary-button h-8 px-2.5 text-xs">Maaş öde</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : data ? (
        <section className="space-y-3">
          <Legend />
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-max min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="sticky left-0 z-10 min-w-[11rem] bg-card px-3 py-2 text-left font-semibold">Çalışan</th>
                  {days.map((d) => <th key={d} scope="col" className={cn('w-8 px-0 py-2 text-center font-medium tabular-nums', isSunday(d) && 'bg-muted text-muted-foreground', d === data.today && 'text-primary')}>{Number(d.slice(8))}</th>)}
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Kesilen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const byDay = new Map(r.attendance.map((a) => [a.day, a]));
                  return (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-medium"><Link href={`/finance/employees/${r.id}?period=${p}`} className="hover:underline">{r.fullName}</Link></th>
                      {days.map((d) => {
                        const a = byDay.get(d);
                        const out = (r.startDate && d < r.startDate) || (r.endDate && d > r.endDate);
                        const cell = (
                          <button type="button" disabled={Boolean(out) || !data.canEdit || busy} aria-label={`${r.fullName} ${trDate(d)}: ${a ? ATTENDANCE[a.kind].label : 'normal'}`}
                            className={cn('grid h-7 w-7 place-items-center rounded border text-[11px] font-semibold', a ? kindTone(a.kind) : 'border-transparent hover:border-border', isSunday(d) && !a && 'bg-muted', out && 'opacity-30', a && !a.deducted && ATTENDANCE[a.kind].deducted && 'line-through')}>
                            {a ? ATTENDANCE[a.kind].short : ''}
                          </button>
                        );
                        return <td key={d} className="px-0.5 py-1 text-center">{out || !data.canEdit ? cell : <DayMenu current={a?.kind ?? null} deducted={a?.deducted} onPick={(k, ded) => mark(r, d, k, ded)}>{cell}</DayMenu>}</td>;
                      })}
                      <td className="px-3 py-1 text-right tabular-nums">{r.pay.deductedDays ? `${r.pay.deductedDays.toLocaleString('tr-TR')} gün` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <EmployeeDialog open={creating} onClose={() => setCreating(false)} employee={null} busy={busy} onSave={async (input) => { await act('employee.save', input); toast.success('Çalışan eklendi'); }} />
      {ledger && data && (
        <LedgerDialog open onClose={() => setLedger(null)} busy={busy} employeeName={ledger.row.fullName} currency={ledger.row.currency} defaultKind={ledger.kind} calculation={ledger.row.pay} period={p} today={data.today}
          onSave={async (input) => { await act('ledger.add', { ...input, employeeId: ledger.row.id }); toast.success('Kaydedildi'); }} />
      )}
    </div>
  );
}
