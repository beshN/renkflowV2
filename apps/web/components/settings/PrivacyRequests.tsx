'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { EmptyState, Skeleton, StatusChip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';

type Kind = 'access' | 'rectification' | 'erasure' | 'objection' | 'other';
type Request = {
  id: string; kind: Kind; subjectName: string; subjectContact: string | null; customerId: string | null; customerName: string | null;
  details: string | null; receivedOn: string; dueOn: string; status: 'open' | 'completed' | 'rejected'; resolution: string | null; overdue: boolean;
};
const KIND_LABELS: Record<Kind, string> = { access: 'Bilgi / veri dökümü', rectification: 'Düzeltme', erasure: 'Silme', objection: 'İtiraz', other: 'Diğer' };
const dmy = (d: string) => d.split('-').reverse().join('.');
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());

/** KVKK request register: every request from a customer or lead, with its 30-day answer deadline. */
export function PrivacyRequests() {
  const [rows, setRows] = useState<Request[] | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ kind: 'access' as Kind, subjectName: '', subjectContact: '', details: '', receivedOn: today() });
  const [closing, setClosing] = useState<{ id: string; status: 'completed' | 'rejected'; resolution: string } | null>(null);

  const load = useCallback(async () => {
    const r = await requestJson<{ requests: Request[] }>('/api/v1/privacy/requests', { cache: 'no-store' });
    if (r.ok && r.data) setRows(r.data.requests); else setError(r.error || 'Başvurular alınamadı');
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const r = await requestJson('/api/v1/privacy/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, subjectContact: form.subjectContact || undefined, details: form.details || undefined }) });
    if (!r.ok) { setError(r.error || 'Kaydedilemedi'); return; }
    setError('');
    setForm({ kind: 'access', subjectName: '', subjectContact: '', details: '', receivedOn: today() });
    await load();
  }

  async function close(e: FormEvent) {
    e.preventDefault();
    if (!closing) return;
    const r = await requestJson(`/api/v1/privacy/requests/${closing.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: closing.status, resolution: closing.resolution }) });
    if (!r.ok) { setError(r.error || 'Kapatılamadı'); return; }
    setClosing(null);
    await load();
  }

  const open = rows?.filter((r) => r.status === 'open').length ?? 0;
  const overdue = rows?.filter((r) => r.overdue).length ?? 0;

  return (
    <section className="space-y-5" aria-labelledby="kvkk-title">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"><ShieldCheck size={24} aria-hidden /></div>
        <div>
          <h2 id="kvkk-title" className="text-lg font-semibold">KVKK başvuruları</h2>
          <p className="text-sm text-muted-foreground">Müşterilerden gelen bilgi, düzeltme, silme ve itiraz başvuruları en geç 30 gün içinde yanıtlanmalı (KVKK m.13). Veri dökümü ve silme müşterinin sayfasından yapılır.</p>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {rows && (open > 0 || overdue > 0) && (
        <p className="text-sm">{open} açık başvuru{overdue > 0 && <> · <strong className="text-rose-700 dark:text-rose-300">{overdue} tanesinin süresi geçti</strong></>}</p>
      )}

      <form onSubmit={create} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2" aria-label="Yeni başvuru">
        <div className="text-sm"><label htmlFor="kvkk-field-1" className="mb-1 block font-medium">Başvuru türü</label>
          <select id="kvkk-field-1" className="rf-input w-full" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
            {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="text-sm"><label htmlFor="kvkk-field-2" className="mb-1 block font-medium">Başvuru tarihi</label>
          <input id="kvkk-field-2" type="date" className="rf-input w-full" required max={today()} value={form.receivedOn} onChange={(e) => setForm({ ...form, receivedOn: e.target.value })} /></div>
        <div className="text-sm"><label htmlFor="kvkk-field-3" className="mb-1 block font-medium">Başvuran</label>
          <input id="kvkk-field-3" className="rf-input w-full" required maxLength={200} value={form.subjectName} onChange={(e) => setForm({ ...form, subjectName: e.target.value })} /></div>
        <div className="text-sm"><label htmlFor="kvkk-field-4" className="mb-1 block font-medium">İletişim (e-posta / telefon)</label>
          <input id="kvkk-field-4" className="rf-input w-full" maxLength={200} value={form.subjectContact} onChange={(e) => setForm({ ...form, subjectContact: e.target.value })} /></div>
        <div className="text-sm sm:col-span-2"><label htmlFor="kvkk-field-5" className="mb-1 block font-medium">Talep</label>
          <textarea id="kvkk-field-5" className="rf-input w-full" rows={2} maxLength={4000} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} /></div>
        <div className="sm:col-span-2"><button type="submit" className="rf-primary-button text-sm">Başvuruyu kaydet</button></div>
      </form>

      {!rows ? <Skeleton className="h-24" /> : rows.length === 0 ? <EmptyState title="Kayıtlı başvuru yok" /> : (
        <ul className="divide-y divide-border text-sm" aria-label="Başvurular">
          {rows.map((r) => (
            <li key={r.id} className="space-y-1 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip tone={r.status === 'open' ? (r.overdue ? 'danger' : 'warning') : r.status === 'completed' ? 'success' : 'neutral'}
                  label={r.status === 'open' ? (r.overdue ? 'Süresi geçti' : 'Açık') : r.status === 'completed' ? 'Yanıtlandı' : 'Reddedildi'} />
                <strong>{r.subjectName}</strong>
                <span className="text-muted-foreground">{KIND_LABELS[r.kind]} · başvuru {dmy(r.receivedOn)} · son gün {dmy(r.dueOn)}</span>
                {r.customerId && <Link href={`/crm/${r.customerId}`} className="text-primary underline">müşteri kartı</Link>}
                <span className="flex-1" />
                {r.status === 'open' && <button type="button" className="rf-secondary-button text-xs" onClick={() => setClosing({ id: r.id, status: 'completed', resolution: '' })}>Kapat</button>}
              </div>
              {r.details && <p className="text-xs text-muted-foreground">{r.details}</p>}
              {r.resolution && <p className="text-xs">Yanıt: {r.resolution}</p>}
              {closing?.id === r.id && (
                <form onSubmit={close} className="flex flex-wrap items-end gap-2">
                  <div className="text-xs"><label htmlFor="kvkk-close-1" className="mb-1 block">Sonuç</label>
                    <select id="kvkk-close-1" className="rf-input" value={closing.status} onChange={(e) => setClosing({ ...closing, status: e.target.value as 'completed' | 'rejected' })}>
                      <option value="completed">Yanıtlandı</option><option value="rejected">Reddedildi</option>
                    </select></div>
                  <div className="flex-1 text-xs"><label htmlFor="kvkk-close-2" className="mb-1 block">Verilen yanıt</label>
                    <input id="kvkk-close-2" className="rf-input w-full" required minLength={3} value={closing.resolution} onChange={(e) => setClosing({ ...closing, resolution: e.target.value })} /></div>
                  <button type="submit" className="rf-primary-button text-xs">Kaydet</button>
                  <button type="button" className="rf-secondary-button text-xs" onClick={() => setClosing(null)}>Vazgeç</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
