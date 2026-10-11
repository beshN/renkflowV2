'use client';

import { useEffect, useState } from 'react';
import { HintTip } from '@/components/kit';
import { requestJson } from '@/lib/shared/network';
import { VAT_RATES } from '@/lib/features/sales/engine';

type Settings = { discountApprovalPercent: number; defaultValidDays: number; defaultVatPercent: number };

/** The firm's quote rules: above this discount a manager approves; default validity; default VAT. */
export function QuoteRulesSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [available, setAvailable] = useState(true);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    requestJson<{ available: boolean; settings: Settings }>('/api/v1/sales/settings').then((r) => {
      if (r.ok && r.data) { setS(r.data.settings); setAvailable(r.data.available); }
    });
  }, []);
  if (!s) return null;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await requestJson<{ settings: Settings }>('/api/v1/sales/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    setBusy(false);
    setMsg(r.ok ? 'Kaydedildi' : r.error || 'Kaydedilemedi');
  }
  return (
    <form className="space-y-4" onSubmit={save}>
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">Teklif kuralları</h2>
        <HintTip text="İndirim eşiğini aşan teklifi yalnız yönetici gönderebilir ya da onaylayabilir. Geçerlilik günü, tarihi boş bırakılan teklif gönderilince işler; süresi dolan teklif kendiliğinden 'süresi doldu' olur." />
      </div>
      {!available && <p className="text-xs text-amber-800 dark:text-amber-300">Veritabanı güncellemesi (041) bekleniyor; ayar kaydedilemez.</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs">İndirim onay eşiği (%)
          <input type="number" min={0} max={100} step="0.5" className="rf-input mt-1 w-full" value={s.discountApprovalPercent} onChange={(e) => setS({ ...s, discountApprovalPercent: +e.target.value })} />
        </label>
        <label className="text-xs">Geçerlilik (gün)
          <input type="number" min={1} max={365} className="rf-input mt-1 w-full" value={s.defaultValidDays} onChange={(e) => setS({ ...s, defaultValidDays: +e.target.value })} />
        </label>
        <label className="text-xs">Varsayılan KDV
          <select className="rf-input mt-1 w-full" value={s.defaultVatPercent} onChange={(e) => setS({ ...s, defaultVatPercent: +e.target.value })}>
            {VAT_RATES.map((r) => <option key={r} value={r}>%{r}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={busy || !available} className="rf-primary-button">Kaydet</button>
        {msg && <span role="status" className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </form>
  );
}
