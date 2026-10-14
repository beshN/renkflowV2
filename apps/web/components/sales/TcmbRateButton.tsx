'use client';

import { useState } from 'react';
import { requestJson } from '@/lib/shared/network';

type Rate = { rate: number; bulletinDate: string; forDate: string };
const dmy = (d: string) => d.split('-').reverse().join('.');

/**
 * Fills a quote's exchange rate with the TCMB forex buying rate in force today (the bulletin
 * announced on the previous business day). The rate stays editable.
 */
export function TcmbRateButton({ currency, disabled, onRate }: { currency: string; disabled?: boolean; onRate: (rate: number) => void }) {
  const [state, setState] = useState<{ busy: boolean; note: string; error: boolean }>({ busy: false, note: '', error: false });

  async function load() {
    setState({ busy: true, note: '', error: false });
    const r = await requestJson<Rate>(`/api/v1/fx/rate?currency=${encodeURIComponent(currency)}`, { cache: 'no-store' });
    if (!r.ok || !r.data) { setState({ busy: false, note: r.error || 'Kur alınamadı', error: true }); return; }
    onRate(r.data.rate);
    setState({ busy: false, note: `TCMB döviz alış, ${dmy(r.data.bulletinDate)} bülteni (${dmy(r.data.forDate)} için geçerli)`, error: false });
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" className="rf-secondary-button text-[11px]" disabled={disabled || state.busy} onClick={() => void load()}>
        {state.busy ? 'Alınıyor…' : "TCMB'den al"}
      </button>
      {state.note && <span role={state.error ? 'alert' : 'status'} className={state.error ? 'text-rose-700 dark:text-rose-300' : undefined}>{state.note}</span>}
    </span>
  );
}
