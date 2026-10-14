'use client';

import { FormEvent, useState } from 'react';
import { FileText } from 'lucide-react';
import { requestJson } from '@/lib/shared/network';

type Customer = { company_name?: string | null; tax_number?: string | null; tax_office?: string | null; billing_address?: string | null; district?: string | null; city?: string | null };
const FIELDS = [
  { key: 'companyName', column: 'company_name', label: 'Ünvan (şirketse)', wide: true },
  { key: 'taxNumber', column: 'tax_number', label: 'VKN / TCKN', inputMode: 'numeric' as const },
  { key: 'taxOffice', column: 'tax_office', label: 'Vergi dairesi' },
  { key: 'billingAddress', column: 'billing_address', label: 'Fatura adresi', wide: true },
  { key: 'district', column: 'district', label: 'İlçe' },
  { key: 'city', column: 'city', label: 'İl' },
] as const;

/**
 * What goes on this customer's invoices. e-Fatura needs the tax number and tax office, e-Arşiv at
 * least the city; a new draft copies these, an issued invoice keeps what it had.
 */
export function CustomerBillingDetails({ customerId, customer, canEdit, onSaved }: { customerId: string; customer: Customer; canEdit: boolean; onSaved: () => void }) {
  const initial = Object.fromEntries(FIELDS.map((f) => [f.key, (customer[f.column] as string | null | undefined) ?? ''])) as Record<(typeof FIELDS)[number]['key'], string>;
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const missing = !initial.city || !(initial.taxNumber || initial.billingAddress);

  async function save(e: FormEvent) {
    e.preventDefault();
    const changed = Object.fromEntries(FIELDS.filter((f) => form[f.key] !== initial[f.key]).map((f) => [f.key, form[f.key]]));
    if (!Object.keys(changed).length) { setEditing(false); return; }
    setBusy(true);
    const r = await requestJson(`/api/v1/customers/${customerId}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(changed) });
    setBusy(false);
    if (!r.ok) { setError(r.error || 'Kaydedilemedi'); return; }
    setError('');
    setEditing(false);
    onSaved();
  }

  return (
    <section className="rf-panel space-y-3 p-4" aria-labelledby="billing-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="billing-title" className="rf-section-title flex items-center gap-2"><FileText size={16} aria-hidden /> Fatura bilgileri</h2>
        {canEdit && !editing && <button type="button" className="rf-secondary-button text-xs" onClick={() => setEditing(true)}>Düzenle</button>}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {editing ? (
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={`text-sm ${'wide' in f && f.wide ? 'sm:col-span-2' : ''}`}>
              <label htmlFor={`billing-${f.key}`} className="mb-1 block font-medium">{f.label}</label>
              <input id={`billing-${f.key}`} className="rf-input w-full" name={f.key} inputMode={'inputMode' in f ? f.inputMode : undefined} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            </div>
          ))}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="rf-primary-button text-sm" disabled={busy}>Kaydet</button>
            <button type="button" className="rf-secondary-button text-sm" onClick={() => { setForm(initial); setEditing(false); }}>Vazgeç</button>
          </div>
        </form>
      ) : (
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={'wide' in f && f.wide ? 'sm:col-span-2' : undefined}>
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd>{initial[f.key] || '—'}</dd>
            </div>
          ))}
        </dl>
      )}
      {missing && !editing && <p className="text-xs text-amber-700 dark:text-amber-300">e-Belge için il ve vergi numarası ya da adres gerekli.</p>}
    </section>
  );
}
