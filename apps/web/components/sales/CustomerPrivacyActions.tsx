'use client';

import { FormEvent, useState } from 'react';
import { Download, ShieldAlert } from 'lucide-react';
import { requestJson } from '@/lib/shared/network';

/**
 * KVKK for one customer (owner/admin): download everything held about them, or erase their
 * personal data. Erasure is irreversible and keeps invoices and payments (legal retention).
 */
export function CustomerPrivacyActions({ customerId, customerName, anonymized, onErased }: { customerId: string; customerName: string; anonymized: boolean; onErased: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function erase(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await requestJson(`/api/v1/privacy/customers/${customerId}/erase`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmName: name }) });
    setBusy(false);
    if (!r.ok) { setError(r.error || 'Silinemedi'); return; }
    setConfirming(false);
    onErased();
  }

  return (
    <section className="rf-panel space-y-2 p-4" aria-labelledby="privacy-title">
      <h2 id="privacy-title" className="rf-section-title">KVKK</h2>
      {anonymized ? (
        <p className="text-sm text-muted-foreground">Bu müşterinin kişisel verileri silindi (anonimleştirildi). Faturalar yasal saklama süresince korunur.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/v1/privacy/customers/${customerId}/export`} className="rf-secondary-button inline-flex items-center gap-1 text-xs"><Download size={12} aria-hidden /> Veri dökümü (JSON)</a>
            {!confirming && <button type="button" className="rf-secondary-button inline-flex items-center gap-1 text-xs text-rose-700 dark:text-rose-300" onClick={() => setConfirming(true)}><ShieldAlert size={12} aria-hidden /> Kişisel verileri sil</button>}
          </div>
          {confirming && (
            <form onSubmit={erase} className="space-y-2 rounded-md border border-rose-300 p-3 text-xs dark:border-rose-900">
              <p>Ad, iletişim bilgileri, adresler ve notlar bu müşterinin kartından, siparişlerinden, tekliflerinden, adaylarından, montajlarından ve mesajlarından <strong>geri alınamaz biçimde</strong> silinir. Fatura ve tahsilat kayıtları TTK m.82 ve VUK m.253 gereği değiştirilmez.</p>
              <label htmlFor="erase-confirm" className="block font-medium">Onaylamak için müşterinin adını yazın: <span className="font-mono">{customerName}</span></label>
              <input id="erase-confirm" className="rf-input w-full" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
              {error && <p role="alert" className="text-rose-700 dark:text-rose-300">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" className="rf-primary-button text-xs" disabled={busy || !name.trim()}>Kalıcı olarak sil</button>
                <button type="button" className="rf-secondary-button text-xs" onClick={() => { setConfirming(false); setName(''); setError(''); }}>Vazgeç</button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
