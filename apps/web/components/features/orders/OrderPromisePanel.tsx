'use client';

import { useEffect, useRef, useState } from 'react';
import { useMemberAccess } from '@/lib/hooks/useMemberAccess';
import { canPromiseOrder, type Access } from '@/lib/security/access-matrix';
import { requestJson } from '@/lib/shared/network';
import type { PromiseResult } from '@/lib/features/manufacturing/promise';

type MaterialGroup = {
  readyDate: string | null;
  fulfilled: { color: string }[];
  missing: { color: string }[];
  undefinedLeadTime: { color: string }[];
  unitMismatch?: { color: string }[];
};
type Suggestion = Pick<PromiseResult, 'earliestFinish' | 'bindingConstraint' | 'explanation' | 'missing'> & {
  material: MaterialGroup[];
  requiresHumanApproval: true;
};
type Result = { state: 'idle' | 'loading' | 'hidden' } | { state: 'error'; message: string } | { state: 'ready'; data: Suggestion };
const date = (value: string) => new Date(value).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });

export function OrderPromisePanel({ orderId }: { orderId: string }) {
  const access = useMemberAccess();
  return access && canPromiseOrder({ ...access, base: access.base as Access['base'] })
    ? <PromisePanel key={`${orderId}:${access.roleKey}:${access.base}`} orderId={orderId} />
    : null;
}

function PromisePanel({ orderId }: { orderId: string }) {
  const [result, setResult] = useState<Result>({ state: 'idle' });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function calculate() {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setResult({ state: 'loading' });
    const response = await requestJson<{ data: Suggestion }>(
      `/api/v1/orders/${encodeURIComponent(orderId)}/promise`,
      { cache: 'no-store', signal: current.signal },
      { fallbackError: 'Termin önerisi alınamadı.' },
    );
    if (current.signal.aborted || controller.current !== current) return;
    if (response.status === 404) setResult({ state: 'hidden' });
    else if (response.ok && response.data?.data?.requiresHumanApproval === true)
      setResult({ state: 'ready', data: response.data.data });
    else setResult({ state: 'error', message: response.error || 'Termin önerisi alınamadı.' });
  }

  if (result.state === 'hidden') return null;
  return (
    <section className="rf-panel border border-border p-5 shadow-sm space-y-3" aria-label="Termin önerisi">
      <h3 className="rf-section-title">Termin önerisi</h3>
      <p className="text-sm text-muted-foreground">Öneridir; termini siz onaylarsınız</p>
      <button type="button" className="rf-secondary-button" onClick={() => void calculate()}>Termini hesapla</button>
      {result.state === 'loading' && <p role="status">Yükleniyor…</p>}
      {result.state === 'error' && <div role="alert">
        <p>{result.message}</p>
        <button type="button" className="rf-secondary-button mt-2" onClick={() => void calculate()}>Tekrar dene</button>
      </div>}
      {result.state === 'ready' && <div className="space-y-3 text-sm">
        {result.data.missing.length > 0 ? <ul className="list-disc pl-5">
          {result.data.missing.map((item, index) => <li key={index}>{item.reason}</li>)}
        </ul> : <>
          {result.data.earliestFinish && <p>Önerilen tarih: {date(result.data.earliestFinish)}</p>}
          {result.data.bindingConstraint && <p>Belirleyici kısıt: {result.data.bindingConstraint.kind === 'material'
            ? 'Malzeme' : `Kapasite (${result.data.bindingConstraint.workCenterCode})`}</p>}
        </>}
        <p>{result.data.explanation}</p>
        {result.data.material.length > 0 && <>
          <h4 className="font-medium">Malzeme hazırlığı</h4>
          <ul className="space-y-2">{result.data.material.map((group, index) => {
            const colors = [...new Set([...group.fulfilled, ...group.missing, ...group.undefinedLeadTime, ...(group.unitMismatch ?? [])].map(line => line.color).filter(Boolean))];
            return <li key={index}>
              <span>{colors.join(', ') || `Grup ${index + 1}`}: </span>
              {group.readyDate === null ? 'Tedarik süresi veya birim eksik'
                : result.data.missing.length > 0 ? 'Eksikler giderilmeden tarih gösterilmez'
                  : date(group.readyDate)}
            </li>;
          })}</ul>
        </>}
      </div>}
    </section>
  );
}
