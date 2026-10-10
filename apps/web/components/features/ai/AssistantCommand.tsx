'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, CornerDownLeft, Mic, MicOff, Sparkles, TriangleAlert, X } from 'lucide-react';
import { requestJson } from '@/lib/shared/network';

type Result =
  | { type: 'preview'; suggestionId: string; version: number; title: string; summary: string; lines: Array<{ label: string; value: string }>; warnings: string[]; source: 'rules' | 'model' }
  | { type: 'choose'; question: string; field: 'customerId'; options: Array<{ value: string; label: string; hint?: string }> }
  | { type: 'list'; title: string; columns: string[]; rows: Array<{ cells: string[]; href?: string }>; empty: string }
  | { type: 'answer'; title: string; lines: Array<{ label: string; value: string }>; note?: string }
  | { type: 'need'; message: string; missing: string[]; examples: string[] }
  | { type: 'denied'; message: string };
type Card = { id: number; text: string; result: Result | null; error?: string; done?: { href?: string; label: string } };

/** The browser's own speech recognition, when it has one (no audio leaves through RenkFlow). */
export function speechRecognition(): (new () => any) | null {
  if (typeof window === 'undefined') return null;
  return ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) ?? null;
}

const EXAMPLES = ["Ahmet Bey'e 3x4 pergola teklif hazırla antrasit", 'bu hafta geciken işler', '7016 mat kaç çubuk var', "ORD-12'ye 2 gün ekle"];

/**
 * "Asistan": a command box and result cards (not a chat). Questions come back as a card; anything
 * that would change a record comes back as a preview that waits for "Onayla".
 */
export function AssistantCommand() {
  const params = useSearchParams();
  const [text, setText] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recognizer = useRef<any>(null);
  const seq = useRef(0);
  const voice = typeof window !== 'undefined' && speechRecognition() !== null;

  const run = useCallback(async (command: string, extra: Record<string, string> = {}, replace?: number) => {
    const t = command.trim();
    if (t.length < 2) return;
    setBusy(true);
    const id = replace ?? ++seq.current;
    if (replace === undefined) setCards((c) => [{ id, text: t, result: null }, ...c].slice(0, 12));
    const r = await requestJson<Result>('/api/v1/ai/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t, ...extra }) });
    setCards((c) => c.map((x) => (x.id === id ? { ...x, result: r.ok && r.data ? r.data : null, error: r.ok ? undefined : r.error || 'Komut çalıştırılamadı' } : x)));
    setBusy(false);
  }, []);

  // A link (Cmd+K, a shared URL) only fills the box: the person runs it, so no preview is filed by opening a page.
  useEffect(() => { const q = params.get('q'); if (q) setText(q.slice(0, 500)); }, [params]);

  async function decide(card: Card, action: 'approve' | 'reject') {
    if (card.result?.type !== 'preview') return;
    const r = await requestJson<{ status: string; result?: { href?: string } }>(`/api/v1/ai/suggestions/${card.result.suggestionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, expectedVersion: card.result.version }) });
    setCards((c) => c.map((x) => (x.id === card.id ? (r.ok ? { ...x, done: { href: r.data?.result?.href, label: action === 'approve' ? 'Uygulandı' : 'Vazgeçildi' } } : { ...x, error: r.error || 'Karar kaydedilemedi' }) : x)));
  }

  function listen() {
    const Rec = speechRecognition();
    if (!Rec) return;
    if (listening) { recognizer.current?.stop(); return; }
    const r = new Rec();
    r.lang = 'tr-TR'; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e: any) => { const said = String(e.results?.[0]?.[0]?.transcript ?? ''); setText(said); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognizer.current = r;
    setListening(true);
    r.start();
  }

  return (
    <div className="space-y-4">
      <form className="rf-panel flex items-center gap-2 p-2" onSubmit={(e) => { e.preventDefault(); void run(text); setText(''); }} aria-label="Asistan komutu">
        <Sparkles size={18} className="ml-1 shrink-0 text-primary" aria-hidden />
        <input className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base outline-none" placeholder="Ne yapalım? ör. “bu hafta geciken işler”" aria-label="Komut" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
        {voice && <button type="button" className="rf-icon-button" aria-label={listening ? 'Dinlemeyi durdur' : 'Sesle söyle'} aria-pressed={listening} onClick={listen}>{listening ? <MicOff size={16} /> : <Mic size={16} />}</button>}
        <button type="submit" className="rf-primary-button text-sm" disabled={busy || text.trim().length < 2}><CornerDownLeft size={14} aria-hidden /> Çalıştır</button>
      </form>
      {!cards.length && (
        <div className="flex flex-wrap gap-2" aria-label="Örnek komutlar">
          {EXAMPLES.map((e) => <button key={e} type="button" className="rf-secondary-button text-xs" onClick={() => void run(e)}>{e}</button>)}
        </div>
      )}
      <ul className="space-y-3" aria-label="Sonuçlar">
        {cards.map((card) => (
          <li key={card.id} className="rf-panel space-y-2 p-3">
            <p className="text-xs text-muted-foreground">› {card.text}</p>
            {!card.result && !card.error && <p className="text-sm text-muted-foreground" role="status">Bakıyorum…</p>}
            {card.error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{card.error}</p>}
            {card.result && <ResultView card={card} onChoose={(v) => void run(card.text, { customerId: v }, card.id)} onDecide={(a) => void decide(card, a)} onExample={(e) => void run(e)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultView({ card, onChoose, onDecide, onExample }: { card: Card; onChoose: (v: string) => void; onDecide: (a: 'approve' | 'reject') => void; onExample: (e: string) => void }) {
  const r = card.result!;
  if (r.type === 'denied') return <p className="text-sm" role="note">{r.message}</p>;
  if (r.type === 'need') return (
    <div className="space-y-2 text-sm"><p>{r.message}</p>
      {r.examples.length > 0 && <div className="flex flex-wrap gap-1.5">{r.examples.map((e) => <button key={e} type="button" className="rf-secondary-button text-xs" onClick={() => onExample(e)}>{e}</button>)}</div>}</div>
  );
  if (r.type === 'choose') return (
    <div className="space-y-2 text-sm"><p className="font-medium">{r.question}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={r.question}>{r.options.map((o) => <button key={o.value} type="button" className="rf-secondary-button text-xs" onClick={() => onChoose(o.value)}>{o.label}{o.hint ? ` · ${o.hint}` : ''}</button>)}</div></div>
  );
  if (r.type === 'list') return (
    <div className="space-y-1"><p className="text-sm font-semibold">{r.title} · {r.rows.length}</p>
      {r.rows.length === 0 ? <p className="text-sm text-muted-foreground">{r.empty}</p> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground">{r.columns.map((c) => <th key={c} className="py-1 pr-2">{c}</th>)}</tr></thead>
          <tbody>{r.rows.map((row, i) => <tr key={i} className="border-t border-border">{row.cells.map((c, j) => <td key={j} className="py-1 pr-2">{j === 0 && row.href ? <Link href={row.href} className="font-medium hover:underline">{c}</Link> : c}</td>)}</tr>)}</tbody>
        </table></div>
      )}</div>
  );
  if (r.type === 'answer') return (
    <div className="space-y-1 text-sm"><p className="font-semibold">{r.title}</p>
      {r.lines.length > 0 && <dl className="space-y-0.5">{r.lines.map((l, i) => <div key={i} className="flex flex-wrap gap-2"><dt className="text-muted-foreground">{l.label}</dt><dd className="tabular-nums">{l.value}</dd></div>)}</dl>}
      {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}</div>
  );
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold">{r.title}</p>
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5">{r.lines.map((l, i) => <Fragment key={i}><dt className="text-muted-foreground">{l.label}</dt><dd>{l.value}</dd></Fragment>)}</dl>
      {r.warnings.map((w) => <p key={w} className="flex items-start gap-1 text-xs text-amber-800 dark:text-amber-300"><TriangleAlert size={12} className="mt-0.5 shrink-0" aria-hidden /> {w}</p>)}
      <p className="text-xs text-muted-foreground">{r.summary}{r.source === 'model' ? ' · Komutu model okudu; hesap motordadır.' : ''}</p>
      {card.done ? (
        <p role="status" className="text-sm font-medium">{card.done.label}{card.done.href ? <> · <Link href={card.done.href} className="text-primary hover:underline">Aç</Link></> : null}</p>
      ) : (
        <div className="flex gap-2">
          <button type="button" className="rf-primary-button text-sm" onClick={() => onDecide('approve')}><Check size={14} aria-hidden /> Onayla</button>
          <button type="button" className="rf-secondary-button text-sm" onClick={() => onDecide('reject')}><X size={14} aria-hidden /> Vazgeç</button>
        </div>
      )}
    </div>
  );
}
