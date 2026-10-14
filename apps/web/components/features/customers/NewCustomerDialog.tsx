'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BusinessDialog, BusinessField as Field } from '@/components/shared/ui/BusinessDialog';

export type CreatedCustomer = { id: string; full_name: string };
type Similar = { id: string; full_name: string; company_name: string | null; phone: string | null };

const TEXT_FIELDS = ['fullName', 'companyName', 'phone', 'email', 'taxNumber', 'taxOffice', 'address', 'notes'] as const;

/**
 * "Yeni Müşteri" (POST /api/v1/customers). Similar existing cards are listed while typing the name:
 * orders match customers by name, so a second card with the same name makes later orders ask
 * which one is meant.
 */
export function NewCustomerDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (customer: CreatedCustomer | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [similar, setSimilar] = useState<Similar[]>([]);

  useEffect(() => {
    if (!open) { setError(''); setName(''); setSimilar([]); }
  }, [open]);

  useEffect(() => {
    const query = name.trim();
    setSimilar([]);
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/v1/customers?suggest=1&search=' + encodeURIComponent(query), { signal: controller.signal, cache: 'no-store' });
        const body = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) setSimilar(Array.isArray(body?.customers) ? body.customers : []);
      } catch {
        // The list is a hint; saving still works without it.
      }
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [name]);

  async function submit(form: FormData) {
    const payload: Record<string, string> = {};
    for (const key of TEXT_FIELDS) {
      const value = String(form.get(key) ?? '').trim();
      if (value) payload[key] = value;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error || 'Müşteri kaydedilemedi.'); return; }
      // Saved even if the body is unreadable; never ask the user to save (and duplicate) again.
      onCreated(body?.customer?.id ? body.customer : null);
    } catch {
      setError('Bağlantı kurulamadı. Bilgileriniz korunuyor, tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BusinessDialog open={open} title="Yeni müşteri" busy={busy} error={error} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(new FormData(e.currentTarget)); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Müşteri adı *" name="fullName" required maxLength={200} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Telefon" name="phone" type="tel" maxLength={60} />
        </div>
        {similar.length > 0 && (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-medium">Benzer kayıtlı müşteriler var (yeni sekmede açılır). Aynı kişiyse yeni kart açmayın:</p>
            <ul className="mt-2 space-y-1">
              {similar.map((c) => (
                <li key={c.id}>
                  <Link href={`/crm/${c.id}`} target="_blank" rel="noopener noreferrer" className="underline">{c.full_name}</Link>
                  {[c.company_name, c.phone].filter(Boolean).length > 0 && <span> · {[c.company_name, c.phone].filter(Boolean).join(' · ')}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <details className="mt-4 rounded-md border border-border/70 px-3 py-2 [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground">Firma, e-posta, vergi ve adres (isteğe bağlı)</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Firma adı" name="companyName" maxLength={200} autoComplete="off" />
            <Field label="E-posta" name="email" type="email" maxLength={320} />
            <Field label="Vergi no" name="taxNumber" maxLength={40} />
            <Field label="Vergi dairesi" name="taxOffice" maxLength={120} />
          </div>
          <label className="mt-4 block text-xs font-medium">Adres<textarea name="address" rows={2} maxLength={1000} className="rf-input mt-2 w-full" /></label>
          <label className="mt-4 block text-xs font-medium">Not<textarea name="notes" rows={2} maxLength={5000} className="rf-input mt-2 w-full" /></label>
        </details>
        <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" className="rf-secondary-button" onClick={onClose} disabled={busy}>Vazgeç</button>
          <button type="submit" className="rf-primary-button" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Müşteriyi kaydet'}</button>
        </div>
      </form>
    </BusinessDialog>
  );
}
