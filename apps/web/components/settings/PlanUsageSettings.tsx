'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Download, Gauge } from 'lucide-react';
import { Skeleton } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';

type Usage = {
  plan: { key: string; label: string };
  firmName: string | null;
  firmCreatedAt: string | null;
  activeMembers: number | null;
  ordersThisMonth: number | null;
  ai: { monthSpendUsd: number | null; todaySpendUsd: number | null; monthCalls: number | null; dailyBudgetUsd: number | null };
  files: { count: number | null; bytes: number | null; partial: boolean };
};
type Closure = { alreadyRequested: boolean; ticketId: string; requestedAt: string; exportUrl: string; processingDays: number; deletionDays: number };

const DASH = '—';
const int = (n: number | null) => (n === null ? DASH : new Intl.NumberFormat('tr-TR').format(n));
const usd = (n: number | null) => (n === null ? DASH : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n));
const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeZone: 'Europe/Istanbul' }).format(new Date(iso)) : DASH);
function bytes(n: number | null) {
  if (n === null) return DASH;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: i ? 1 : 0 }).format(v)} ${units[i]}`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

/** Plan, this month's usage, the full data export and the account-closure request. */
export function PlanUsageSettings() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [reason, setReason] = useState('');
  const [closeError, setCloseError] = useState('');
  const [sending, setSending] = useState(false);
  const [closure, setClosure] = useState<Closure | null>(null);

  const load = useCallback(async () => {
    const r = await requestJson<{ usage: Usage; isOwner: boolean }>('/api/v1/tenant/usage', { cache: 'no-store' });
    if (r.ok && r.data) { setUsage(r.data.usage); setIsOwner(r.data.isOwner); } else setError(r.error || 'Kullanım bilgisi alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function requestClosure(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setCloseError('');
    const r = await requestJson<Closure>('/api/v1/tenant/closure-request', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmName, reason: reason || undefined }),
    });
    setSending(false);
    if (!r.ok || !r.data) { setCloseError(r.error || 'Talep gönderilemedi'); return; }
    setClosure(r.data);
    setClosing(false);
    setConfirmName('');
    setReason('');
  }

  const ai = usage?.ai;
  const budgetHint = ai?.dailyBudgetUsd != null
    ? `Bugün ${usd(ai.todaySpendUsd)} / günlük bütçe ${usd(ai.dailyBudgetUsd)}`
    : `Bugün ${usd(ai?.todaySpendUsd ?? null)} · günlük bütçe tanımlı değil`;
  const firmName = usage?.firmName ?? '';

  return (
    <section className="space-y-6" aria-labelledby="plan-title">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"><Gauge size={24} aria-hidden /></div>
        <div>
          <h2 id="plan-title" className="text-lg font-semibold">Plan ve kullanım</h2>
          <p className="text-sm text-muted-foreground">Firmanızın planı, bu ayki kullanımı ve verileriniz üzerindeki haklarınız.</p>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Mevcut plan</p>
            <p className="text-base font-semibold">{usage?.plan.label ?? 'Pilot'}</p>
          </div>
          <Link href="/contact" className="rf-secondary-button">Teklif isteyin</Link>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Fiyatlandırma firmanızın ihtiyacına göre teklifle belirlenir; şu an herhangi bir ödeme alınmıyor. Ayrıntılar için <Link href="/pricing" className="underline">fiyatlandırma</Link> sayfasına bakabilirsiniz.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Bu ay</h3>
        {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
        {!usage && !error ? <Skeleton className="mt-3 h-24 w-full" /> : (
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Etkin üye" value={int(usage?.activeMembers ?? null)} />
            <Stat label="Bu ay açılan sipariş" value={int(usage?.ordersThisMonth ?? null)} />
            <Stat label="Asistan harcaması (bu ay)" value={usd(ai?.monthSpendUsd ?? null)} hint={`${int(ai?.monthCalls ?? null)} çağrı · ${budgetHint}`} />
            <Stat label="Yüklenen dosya" value={int(usage?.files.count ?? null)} hint={usage?.files.partial ? 'Bazı dosya türleri okunamadı' : undefined} />
            <Stat label="Dosya boyutu" value={bytes(usage?.files.bytes ?? null)} />
            <Stat label="Firma kaydı" value={day(usage?.firmCreatedAt ?? null)} />
          </dl>
        )}
      </div>

      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Verilerinizi indirin</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Firmanıza ait tüm kayıtlar CSV dosyaları hâlinde tek bir ZIP arşivinde indirilir (KVKK m.11, veri taşınabilirliği). Şifreler, oturum anahtarları ve iki adımlı doğrulama sırları dahil edilmez; yüklenen dosyaların listesi arşivdeki files.csv içindedir.
        </p>
        {isOwner
          ? <a href="/api/v1/tenant/export" className="rf-primary-button mt-3 inline-flex items-center gap-2" download><Download size={16} aria-hidden /> Tüm verileri indir (ZIP)</a>
          : <p className="mt-3 text-sm text-muted-foreground">Tüm verileri firma sahibi indirebilir.</p>}
      </div>

      {isOwner && (
        <div className="rounded-lg border border-red-200 p-4 dark:border-red-900/50">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">Firma hesabını kapat</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Bu işlem hiçbir veriyi hemen silmez: ekibimize bir kapatma talebi iletilir ve sizinle iletişime geçilir. Kapatmadan önce verilerinizi indirmenizi öneririz.
          </p>
          {closure ? (
            <div className="mt-3 rounded-md bg-muted p-3 text-sm" role="status">
              <p className="font-medium">{closure.alreadyRequested ? 'Açık bir kapatma talebiniz zaten var.' : 'Kapatma talebiniz alındı.'}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Talep numarası: <span className="font-mono">{closure.ticketId.slice(0, 8)}</span> ({day(closure.requestedAt)})</li>
                <li>Hesabınız kapanana kadar her şey çalışmaya devam eder; verilerinizi <a href={closure.exportUrl} className="underline" download>buradan indirebilirsiniz</a>.</li>
                <li>Kullanım koşullarına göre sözleşme sona erdikten sonra {closure.processingDays} gün içinde verilerinizin teslimini isteyebilirsiniz; ardından veriler yedekler dahil en geç {closure.deletionDays} gün içinde silinir veya anonimleştirilir.</li>
                <li>Kanunen saklanması gereken kayıtlar (ör. faturalar) ilgili süre boyunca saklanır. Ayrıntılar: <Link href="/terms#fesih" className="underline">Kullanım koşulları m.10</Link>.</li>
              </ul>
            </div>
          ) : (
            <button type="button" className="rf-secondary-button mt-3 !border-red-300 !text-red-700 dark:!text-red-300" onClick={() => { setCloseError(''); setClosing(true); }}>
              Firma hesabını kapat
            </button>
          )}
        </div>
      )}

      <Dialog.Root open={closing} onOpenChange={(open) => { if (!open && !sending) setClosing(false); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/55" />
          <Dialog.Content
            onPointerDownOutside={(event) => event.preventDefault()}
            className="rf-command-dialog fixed left-1/2 top-1/2 z-[91] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl outline-none"
          >
            <form onSubmit={requestClosure}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  <AlertTriangle size={17} aria-hidden />
                </span>
                <div className="min-w-0">
                  <Dialog.Title className="text-sm font-semibold">Firma hesabını kapatma talebi</Dialog.Title>
                  <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">
                    Onaylamak için firma adını <strong className="text-foreground">{firmName || 'firma adı'}</strong> olarak yazın. Hiçbir veri otomatik silinmez.
                  </Dialog.Description>
                </div>
              </div>
              <label className="mt-4 block text-sm font-medium" htmlFor="closure-name">Firma adı</label>
              <input id="closure-name" className="rf-input mt-1 w-full" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" required />
              <label className="mt-3 block text-sm font-medium" htmlFor="closure-reason">Neden kapatıyorsunuz? (isteğe bağlı)</label>
              <textarea id="closure-reason" className="rf-input mt-1 w-full" rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
              {closeError && <p className="mt-2 text-sm text-red-600" role="alert">{closeError}</p>}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="rf-secondary-button" onClick={() => setClosing(false)} disabled={sending}>Vazgeç</button>
                <button type="submit" disabled={sending || !confirmName.trim()} className="rf-primary-button !border-red-700 !bg-red-700 !text-white hover:!bg-red-800 dark:!border-red-600 dark:!bg-red-600">
                  {sending ? 'Gönderiliyor…' : 'Kapatma talebi gönder'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
