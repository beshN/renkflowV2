'use client';

import { useEffect, useState } from 'react';
import { CircleHelp, Sparkles } from 'lucide-react';
import { requestJson } from '@/lib/shared/network';
import { modelUnavailableMessage, type ModelUnavailableReason } from '@/lib/ai/policy';

type Status = { modelEnabled: boolean; modelUnavailableReason?: ModelUnavailableReason; model?: { label: string } };

/** Configuration readiness is not proof that a particular response came from the model. */
export function AssistantStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const r = await requestJson<Status>('/api/ai/insights?path=/assistant', { signal: controller.signal, cache: 'no-store' });
      if (!controller.signal.aborted && r.ok && r.data) setStatus(r.data);
    };
    void load();
    window.addEventListener('assistant-settings-changed', load);
    return () => { controller.abort(); window.removeEventListener('assistant-settings-changed', load); };
  }, []);
  return <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role="status">
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${status?.modelEnabled ? 'border-emerald-600/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400' : 'border-border bg-muted/40'}`}>
      {status?.modelEnabled ? <Sparkles size={12} aria-hidden /> : <CircleHelp size={12} aria-hidden />}
      {status ? status.modelEnabled ? 'AI kullanıma hazır' : 'Kayıt ve kural desteği' : 'Bağlantı kontrol ediliyor'}
    </span>
    {status?.modelEnabled ? <span>{status.model?.label} · Her yanıtın kaynağı ayrıca gösterilir</span> : status && <span>{modelUnavailableMessage(status.modelUnavailableReason)}</span>}
    <button type="button" onClick={() => window.dispatchEvent(new Event('renkflow-assistant-open'))} className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"><Sparkles size={12} aria-hidden />Sohbeti aç</button>
  </div>;
}
