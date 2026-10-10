'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Mic, MicOff, X } from 'lucide-react';
import { requestJson } from '@/lib/shared/network';
import { parseVoice, type VoiceAction } from '@/lib/ai/voice';
import { speechRecognition } from './AssistantCommand';

type Target = { operationId: string; workOrderId: string; name: string; status: string } | null;

/**
 * "Başla", "Bitti", "3 adet fire, kesim hatası" for the job in front of the worker. The browser's own
 * speech recognition is used: no audio goes through RenkFlow, but the browser's speech service (e.g.
 * Chrome → Google) receives it, so it is on only in assistant mode with the firm's KVKK confirmation.
 * Without browser support the button is not shown.
 * What was heard is shown first and applied only with "Uygula".
 */
export function VoiceCommand({ target, onStart, onComplete, actionBlocked }: { target: Target; onStart: () => Promise<void> | void; onComplete: () => Promise<void> | void; actionBlocked?: string | null }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<{ text: string; action: VoiceAction | null } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reasons = useRef<Array<{ code: string; label: string }>>([]);
  const rec = useRef<any>(null);

  useEffect(() => {
    setSupported(speechRecognition() !== null);
    void requestJson<{ features: Record<string, boolean> }>('/api/v1/ai/features').then((r) => setEnabled(Boolean(r.ok && r.data?.features.voice)));
  }, []);
  const jobId = target?.workOrderId ?? null;
  useEffect(() => {
    reasons.current = [];
    if (!jobId) return;
    void requestJson<{ reasons?: { scrap: Array<{ code: string; label: string }> } }>(`/api/v1/production/jobs/${jobId}/depth`).then((r) => { reasons.current = r.data?.reasons?.scrap ?? []; });
  }, [jobId]);
  if (!supported || !enabled) return null;

  function listen() {
    const Rec = speechRecognition();
    if (!Rec) return;
    if (listening) { rec.current?.stop(); return; }
    setMessage(null);
    const r = new Rec();
    r.lang = 'tr-TR'; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e: any) => { const text = String(e.results?.[0]?.[0]?.transcript ?? ''); setHeard({ text, action: parseVoice(text, reasons.current) }); };
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); setMessage('Ses alınamadı; yeniden deneyin.'); };
    rec.current = r;
    setListening(true);
    r.start();
  }

  async function apply() {
    const a = heard?.action;
    if (!a || !target || busy) return;
    setBusy(true);
    try {
    if (a.action === 'start') await onStart();
    else if (a.action === 'complete') await onComplete();
    else {
      const r = await requestJson(`/api/v1/production/jobs/${target.workOrderId}/depth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scrap', reasonCode: a.reasonCode, quantity: a.quantity, operationId: target.operationId, note: `Sesle: “${heard!.text}”` }) });
      setMessage(r.ok ? `${a.quantity} adet fire kaydedildi (${a.reasonLabel}).` : r.error || 'Fire kaydedilemedi');
    }
    setHeard(null);
    } finally {
      setBusy(false);
    }
  }

  const describe = (a: VoiceAction | null) => !a ? 'Anlaşılmadı. “Başla”, “Bitti” ya da “3 adet fire, kesim hatası” deyin.'
    : a.action === 'start' ? `${target?.name ?? 'İş'}: başlat` : a.action === 'complete' ? `${target?.name ?? 'İş'}: bitir`
    : a.reasonCode ? `${a.quantity} adet fire · ${a.reasonLabel}` : `${a.quantity} adet fire · neden anlaşılmadı (firmanın fire nedenlerinden birini söyleyin)`;
  // "Başla" only for a step not yet running, "Bitti" only for a running one (never the other way round).
  const blocked = !heard?.action || !target ? null
    : heard.action.action === 'start' && (target.status === 'running' || target.status === 'done') ? 'Bu adım zaten başlamış ya da bitmiş.'
    : heard.action.action === 'complete' && target.status !== 'running' ? 'Bu adım çalışmıyor; önce “Başla” deyin.'
    : heard.action.action !== 'scrap' && actionBlocked ? actionBlocked : null;
  const ready = heard?.action && target && !blocked && (heard.action.action !== 'scrap' || heard.action.reasonCode);

  return (
    <div className="space-y-2" aria-label="Sesli komut">
      <button type="button" onClick={listen} aria-pressed={listening} disabled={!target} className="rf-secondary-button h-12 px-4" aria-label={listening ? 'Dinlemeyi durdur' : 'Sesle söyle'}>
        {listening ? <MicOff size={18} /> : <Mic size={18} />} {target ? (listening ? 'Dinliyorum…' : 'Sesle söyle') : 'Önce bir iş seçin'}
      </button>
      {heard && (
        <div className="rf-panel space-y-2 p-3 text-sm" role="status">
          <p className="text-xs text-muted-foreground">Duyduğum: “{heard.text}”</p>
          <p className="font-medium">{describe(heard.action)}</p>
          {blocked && <p className="text-xs text-amber-800 dark:text-amber-300">{blocked}</p>}
          <div className="flex gap-2">
            {ready && <button type="button" className="rf-primary-button h-11 px-4" disabled={busy} onClick={() => void apply()}><Check size={16} aria-hidden /> Uygula</button>}
            <button type="button" className="rf-secondary-button h-11 px-4" onClick={() => setHeard(null)}><X size={16} aria-hidden /> Vazgeç</button>
          </div>
        </div>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  );
}
