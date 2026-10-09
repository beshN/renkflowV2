'use client';

import { useEffect, useState } from 'react';
import { Tags, Trash2 } from 'lucide-react';
import { HintTip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { PRODUCT_FAMILIES } from '@/lib/features/products/families';

type Rule = { id: string; family: string | null; discountPercent: number; note: string | null };

/** A customer's standing discounts (general or per product family); new quotes apply them to lines without one. */
export function CustomerPriceRules({ customerId, canEdit }: { customerId: string; canEdit: boolean }) {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [family, setFamily] = useState('');
  const [percent, setPercent] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    requestJson<{ available: boolean; rules: Rule[] }>(`/api/v1/customers/${customerId}/price-rules`).then((r) => {
      if (r.ok && r.data?.available) setRules(r.data.rules);
    });
  }, [customerId]);
  if (!rules) return null;
  async function call(method: 'PUT' | 'DELETE', body?: object, rule?: string) {
    setError('');
    const r = await requestJson<{ rules: Rule[] }>(`/api/v1/customers/${customerId}/price-rules${rule ? `?rule=${rule}` : ''}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (r.ok && r.data) setRules(r.data.rules);
    else setError(r.error || 'Kaydedilemedi');
  }
  const label = (f: string | null) => (f ? PRODUCT_FAMILIES.find((p) => p.key === f)?.label ?? f : 'Tüm ürünler');
  return (
    <section className="rounded-xl border border-border p-5" aria-label="Fiyat listesi">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Tags size={16} className="text-primary" aria-hidden /> Fiyat listesi
        <HintTip text="Bu müşteriye açılan yeni tekliflerde indirimsiz satırlara uygulanır. Ürün ailesine özel kural genel kuralın önüne geçer." />
      </h3>
      {rules.length === 0 && <p className="text-xs text-muted-foreground">Özel indirim yok</p>}
      <ul className="space-y-1.5">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{label(r.family)}</span>
            <span className="font-semibold tabular-nums">%{r.discountPercent}</span>
            {canEdit && <button type="button" className="rf-icon-button" aria-label={`${label(r.family)} indirimini kaldır`} onClick={() => void call('DELETE', undefined, r.id)}><Trash2 size={14} /></button>}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void call('PUT', { family: family || null, discountPercent: Number(percent) }); setPercent(''); }}>
          <select aria-label="Ürün ailesi" className="rf-input min-w-0 flex-1" value={family} onChange={(e) => setFamily(e.target.value)}>
            <option value="">Tüm ürünler</option>
            {PRODUCT_FAMILIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <input type="number" min={0.5} max={100} step="0.5" required aria-label="İndirim yüzdesi" placeholder="%" className="rf-input w-20" value={percent} onChange={(e) => setPercent(e.target.value)} />
          <button className="rf-primary-button">Ekle</button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
    </section>
  );
}
