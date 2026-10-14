'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FileText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { requestJson } from '@/lib/shared/network';

type Identity = {
  legalName: string; taxNumber: string; taxOffice: string; addressLine: string; district: string; city: string; postalCode: string;
  mersisNo: string; tradeRegistryNo: string; phone: string; invoiceEmail: string; iban: string; eFaturaPrefix: string; eArsivPrefix: string;
};
type Field = { key: keyof Identity; label: string; required?: boolean; hint?: string; inputMode?: 'numeric' | 'email' | 'tel'; maxLength?: number; wide?: boolean };

const FIELDS: Field[] = [
  { key: 'legalName', label: 'Ticari unvan', required: true, wide: true, hint: 'Vergi levhasındaki tam unvan.' },
  { key: 'taxNumber', label: 'VKN / TCKN', required: true, inputMode: 'numeric', maxLength: 11 },
  { key: 'taxOffice', label: 'Vergi dairesi', required: true },
  { key: 'addressLine', label: 'Açık adres', required: true, wide: true },
  { key: 'district', label: 'İlçe', required: true },
  { key: 'city', label: 'İl', required: true },
  { key: 'postalCode', label: 'Posta kodu', inputMode: 'numeric', maxLength: 5 },
  { key: 'mersisNo', label: 'MERSİS no', inputMode: 'numeric', maxLength: 16 },
  { key: 'tradeRegistryNo', label: 'Ticaret sicil no' },
  { key: 'phone', label: 'Telefon', inputMode: 'tel' },
  { key: 'invoiceEmail', label: 'Fatura e-postası', inputMode: 'email' },
  { key: 'iban', label: 'IBAN', wide: true, hint: 'Faturada ödeme bilgisi olarak yazılır.' },
  { key: 'eFaturaPrefix', label: 'e-Fatura seri öneki', maxLength: 3, hint: 'Üç büyük harf. Numara: önek + yıl + 9 hane.' },
  { key: 'eArsivPrefix', label: 'e-Arşiv seri öneki', maxLength: 3 },
];

/** The firm's legal identity: printed on invoices and required before an e-Belge is issued. */
export function LegalIdentitySettings() {
  const [state, setState] = useState<'loading' | 'unavailable' | 'ready'>('loading');
  const [form, setForm] = useState<Identity | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void requestJson<{ available: boolean; identity?: Identity }>('/api/v1/settings/legal-identity', { cache: 'no-store' }).then((r) => {
      if (!r.ok || !r.data) { setError(r.error || 'Fatura bilgileri alınamadı'); setState('ready'); return; }
      if (!r.data.available || !r.data.identity) { setState('unavailable'); return; }
      setForm(r.data.identity);
      setState('ready');
    });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError('');
    const r = await requestJson<{ identity: Identity }>('/api/v1/settings/legal-identity', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    if (!r.ok || !r.data) { setError(r.error || 'Kaydedilemedi'); return; }
    setForm(r.data.identity);
    toast.success('Fatura bilgileri kaydedildi');
  }

  return (
    <section aria-labelledby="legal-identity-title" className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"><FileText size={24} aria-hidden /></div>
        <div>
          <h2 id="legal-identity-title" className="text-lg font-semibold">Fatura bilgileri</h2>
          <p className="text-sm text-muted-foreground">Her faturada satıcı olarak yazılır; e-Fatura ve e-Arşiv için zorunlu alanlar işaretli.</p>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {state === 'loading' && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
      {state === 'unavailable' && <p className="text-sm text-muted-foreground">Bu kurulumda henüz etkin değil (veritabanı güncellemesi bekleniyor).</p>}
      {form && (
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.wide ? 'sm:col-span-2' : undefined}>
                <Input
                  label={f.label}
                  name={f.key}
                  variant="glass"
                  required={f.required}
                  inputMode={f.inputMode}
                  maxLength={f.maxLength}
                  hint={f.hint}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: f.key.endsWith('Prefix') ? e.target.value.toUpperCase() : e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={saving}><Save size={18} className="mr-2" aria-hidden />{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
