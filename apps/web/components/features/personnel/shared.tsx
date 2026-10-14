'use client';

import { PayCutReview } from './PayCutReview';
import type { MonthPay } from '@/lib/features/personnel/payroll';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronLeft, ChevronRight, Eraser } from 'lucide-react';
import { BusinessDialog, BusinessField as Field } from '@/components/shared/ui/BusinessDialog';
import { ATTENDANCE, ATTENDANCE_KINDS, LEDGER, periodLabel, shiftPeriod, type AttendanceKind, type LedgerKind } from '@/lib/features/personnel/payroll';
import { cn } from '@/lib/utils';

export const money = (n: number | null | undefined, currency = 'TRY') =>
  n === null || n === undefined ? '—' : n.toLocaleString('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 });
export const trDate = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('.') : '—');

export const TONE: Record<string, string> = {
  rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  amber: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  sky: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  zinc: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30',
  violet: 'bg-violet-500/15 text-violet-800 dark:text-violet-300 border-violet-500/30',
};
export const kindTone = (k: AttendanceKind) => TONE[ATTENDANCE[k].tone];

/** GET a personnel view and POST its actions, with a reload after each write. */
export function usePersonnel<T>(query: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/finance/personnel?' + query, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Personel kayıtları alınamadı');
      setData(body as T);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Personel kayıtları alınamadı');
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => { void load(); }, [load]);
  const act = useCallback(async (action: string, input: unknown) => {
    setBusy(true);
    try {
      const res = await fetch('/api/v1/finance/personnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, input }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'İşlem tamamlanamadı');
      await load();
      return body;
    } finally {
      setBusy(false);
    }
  }, [load]);
  return { data, error, loading, busy, reload: load, act };
}

export function MonthSwitch({ period, onChange }: { period: string; onChange: (p: string) => void }) {
  return (
    <div className="flex items-center rounded-md border border-border bg-card" role="group" aria-label="Ay seçimi">
      <button type="button" className="grid h-9 w-9 place-items-center hover:bg-accent" aria-label="Önceki ay" onClick={() => onChange(shiftPeriod(period, -1))}><ChevronLeft size={16} /></button>
      <span className="min-w-[8.5rem] px-1 text-center text-xs font-semibold capitalize tabular-nums">{periodLabel(period)}</span>
      <button type="button" className="grid h-9 w-9 place-items-center hover:bg-accent" aria-label="Sonraki ay" onClick={() => onChange(shiftPeriod(period, 1))}><ChevronRight size={16} /></button>
    </div>
  );
}

/** A day cell's menu: choose what the day was, or clear it. */
export function DayMenu({ children, current, deducted, onPick, disabled }: {
  children: React.ReactNode;
  current: AttendanceKind | null;
  deducted?: boolean;
  disabled?: boolean;
  onPick: (kind: AttendanceKind | null, deducted?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={4} className="z-[90] w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          {ATTENDANCE_KINDS.map((k) => (
            <button key={k} type="button" onClick={() => { onPick(k); setOpen(false); }} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent', current === k && 'bg-accent')}>
              <span className={cn('grid h-6 w-6 place-items-center rounded border text-[11px] font-semibold', kindTone(k))}>{ATTENDANCE[k].short}</span>
              <span className="flex-1">{ATTENDANCE[k].label}</span>
              <span className="text-[10px] text-muted-foreground">{ATTENDANCE[k].deducted ? 'kesilir' : 'ücretli'}</span>
            </button>
          ))}
          {current && (
            <>
              {ATTENDANCE[current].deducted && <label className="flex items-center gap-2 border-t border-border px-2 pt-2 text-[12px]">
                <input type="checkbox" checked={Boolean(deducted)} onChange={(e) => { onPick(current, e.target.checked); setOpen(false); }} />
                Bu gün maaştan kesilsin
              </label>}
              <button type="button" onClick={() => { onPick(null); setOpen(false); }} className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-accent"><Eraser size={14} />Normal gün (temizle)</button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Gösterge">
      {ATTENDANCE_KINDS.map((k) => (
        <li key={k} className="flex items-center gap-1"><span className={cn('grid h-4 w-4 place-items-center rounded border text-[9px] font-semibold', kindTone(k))}>{ATTENDANCE[k].short}</span>{ATTENDANCE[k].label}</li>
      ))}
      <li className="flex items-center gap-1"><span className="h-4 w-4 rounded bg-muted" />Pazar</li>
    </ul>
  );
}

export type EmployeeCard = {
  id?: string; version?: number; fullName?: string; title?: string | null; department?: string | null; email?: string | null; phone?: string | null;
  startDate?: string | null; endDate?: string | null; birthDate?: string | null; payType?: 'monthly' | 'daily'; payAmount?: number | null; currency?: string;
  payDay?: number | null; iban?: string | null; notes?: string | null; active?: boolean;
};

export function EmployeeDialog({ open, onClose, employee, busy, onSave }: { open: boolean; onClose: () => void; employee: EmployeeCard | null; busy: boolean; onSave: (input: Record<string, unknown>) => Promise<unknown> }) {
  const [error, setError] = useState('');
  const e = employee ?? {};
  return (
    <BusinessDialog open={open} title={e.id ? 'Çalışanı düzenle' : 'Yeni çalışan'} busy={busy} error={error} onClose={() => { setError(''); onClose(); }}>
      <form key={(e.id ?? 'new') + ':' + (e.version ?? 0)} className="space-y-5" onSubmit={async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        const s = (k: string) => String(f.get(k) ?? '').trim();
        const num = (k: string) => (s(k) === '' ? null : Number(s(k).replace(',', '.')));
        try {
          await onSave({
            id: e.id, version: e.version, fullName: s('fullName'), title: s('title'), department: s('department'), email: s('email'), phone: s('phone'),
            birthDate: s('birthDate') || null, startDate: s('startDate') || null, endDate: s('endDate') || null,
            payType: s('payType') || 'monthly', payAmount: num('payAmount'), currency: s('currency') || 'TRY', payDay: num('payDay'), iban: s('iban') || null, notes: s('notes'),
            active: f.get('active') === 'on',
          });
          setError('');
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Kaydedilemedi');
        }
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ad soyad" name="fullName" required minLength={2} defaultValue={e.fullName ?? ''} autoFocus />
          <Field label="Görev" name="title" placeholder="Usta, montajcı, ofis…" defaultValue={e.title ?? ''} />
          <Field label="Aylık net maaş" name="payAmount" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={e.payAmount ?? ''} />
          <Field label="İşe giriş tarihi" name="startDate" type="date" defaultValue={e.startDate ?? ''} />
        </div>
        <details className="group rounded-lg border border-border px-3 py-2" open={Boolean(e.id && (e.iban || e.payDay || e.phone || e.birthDate || e.endDate || e.payType === 'daily'))}>
          <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">Diğer bilgiler (isteğe bağlı)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Telefon" name="phone" type="tel" defaultValue={e.phone ?? ''} />
            <Field label="Ödeme günü (ayın kaçı)" name="payDay" type="number" min={1} max={31} defaultValue={e.payDay ?? ''} />
            <Field label="IBAN" name="iban" placeholder="TR00 0000 …" defaultValue={e.iban ?? ''} />
            <label className="block text-xs font-medium">Ücret türü
              <select name="payType" defaultValue={e.payType ?? 'monthly'} className="rf-input mt-2 w-full"><option value="monthly">Aylık maaş</option><option value="daily">Günlük yevmiye</option></select>
            </label>
            <Field label="Doğum tarihi (izin hakkı için)" name="birthDate" type="date" defaultValue={e.birthDate ?? ''} />
            <Field label="İşten çıkış tarihi" name="endDate" type="date" defaultValue={e.endDate ?? ''} />
            <Field label="Bölüm" name="department" defaultValue={e.department ?? ''} />
            <Field label="E-posta" name="email" type="email" defaultValue={e.email ?? ''} />
            <label className="block text-xs font-medium">Para birimi<select name="currency" defaultValue={e.currency ?? 'TRY'} className="rf-input mt-2 w-full">{['TRY', 'USD', 'EUR'].map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input name="active" type="checkbox" defaultChecked={e.active ?? true} />Aktif çalışan</label>
            <label className="block text-xs font-medium sm:col-span-2">Not<textarea name="notes" rows={2} maxLength={2000} defaultValue={e.notes ?? ''} className="rf-input mt-2 w-full" /></label>
          </div>
        </details>
        <div className="flex justify-end border-t border-border pt-4"><button type="submit" className="rf-primary-button h-9 px-4 text-xs" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button></div>
      </form>
    </BusinessDialog>
  );
}

const LEDGER_ORDER: LedgerKind[] = ['advance', 'salary', 'bonus', 'deduction', 'payment'];
export function LedgerDialog({ open, onClose, busy, employeeName, currency, defaultKind = 'advance', period, today, onSave, calculation }: {
  open: boolean; onClose: () => void; busy: boolean; employeeName: string; currency: string; defaultKind?: LedgerKind; period: string; today: string;
  calculation?: MonthPay;
  onSave: (input: Record<string, unknown>) => Promise<unknown>;
}) {
  const commandId = useRef(crypto.randomUUID());
  useEffect(() => { if (open) commandId.current = crypto.randomUUID(); }, [open]);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<LedgerKind>(defaultKind);
  useEffect(() => { if (open) setKind(defaultKind); }, [open, defaultKind]);
  return (
    <BusinessDialog open={open} title={`${employeeName} · hesap hareketi`} busy={busy} error={error} onClose={() => { setError(''); onClose(); }}>
      <form className="space-y-4" onSubmit={async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        try {
          await onSave({ commandId: commandId.current, kind, amount: Number(String(f.get('amount')).replace(',', '.')), entryDate: String(f.get('entryDate')), period: String(f.get('period')) || null, note: String(f.get('note') ?? '') });
          setError('');
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Kaydedilemedi');
        }
      }}>
        {calculation && kind === 'salary' && <PayCutReview pay={calculation} currency={currency} />}
        <div role="radiogroup" aria-label="Hareket türü" className="flex flex-wrap gap-1.5">
          {LEDGER_ORDER.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn('h-9 rounded-md border px-3 text-xs font-medium', kind === k ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent')}>{LEDGER[k].label}</button>
          ))}
        </div>
        <Field label={`Tutar · ${currency}`} name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required autoFocus />
        <details className="rounded-lg border border-border px-3 py-2">
          <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">Tarih, ay ve açıklama · {trDate(today)}, {periodLabel(period)}</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Tarih" name="entryDate" type="date" required defaultValue={today} />
            <Field label="Hangi ayın maaşı" name="period" type="month" required defaultValue={period} />
            <div className="sm:col-span-2"><Field label="Açıklama" name="note" maxLength={2000} placeholder={kind === 'advance' ? 'Ör. bayram avansı' : ''} /></div>
          </div>
        </details>
        <div className="flex justify-end border-t border-border pt-4"><button type="submit" className="rf-primary-button h-9 px-4 text-xs" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button></div>
      </form>
    </BusinessDialog>
  );
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toLocaleUpperCase('tr-TR')).join('');
export { ATTENDANCE, periodLabel, shiftPeriod };
