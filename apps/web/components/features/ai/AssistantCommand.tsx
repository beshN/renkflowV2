'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUp, ArrowUpRight, Check, FileText, Loader2, Mic, MicOff, Package, ShieldCheck, Sparkles, TriangleAlert, X, Clock3 } from 'lucide-react';
import { requestJson } from '@/lib/shared/network';

type Result = (
  | { type: 'preview'; suggestionId: string; version: number; title: string; summary: string; lines: Array<{ label: string; value: string }>; warnings: string[]; source: 'rules' | 'model' }
  | { type: 'choose'; question: string; field: 'customerId'; options: Array<{ value: string; label: string; hint?: string }> }
  | { type: 'list'; title: string; columns: string[]; rows: Array<{ cells: string[]; href?: string }>; empty: string }
  | { type: 'answer'; title: string; lines: Array<{ label: string; value: string }>; note?: string }
  | { type: 'need'; message: string; missing: string[]; examples: string[] }
  | { type: 'denied'; message: string }) & { processing?: { source: 'rules' | 'model'; label: string }; suggestions?: string[] };
export type AssistantCommandCard = { id: number; text: string; result: Result | null; error?: string; done?: { href?: string; label: string } };

/** The browser's own speech recognition, when it has one (no audio leaves through RenkFlow). */
export function speechRecognition(): (new () => any) | null {
  if (typeof window === 'undefined') return null;
  return ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) ?? null;
}

const EXAMPLES = [
  { icon: Clock3, title: 'İşleri takip edin', text: 'Bu hafta geciken işleri göster' },
  { icon: Package, title: 'Stoğu inceleyin', text: 'Kritik stokları ve sonraki adımları açıkla' },
  { icon: FileText, title: 'Teklif hazırlayın', text: 'Bir müşteri için teklif hazırlamak istiyorum' },
];

/**
 * "Asistan": a command box and result cards (not a chat). Questions come back as a card; anything
 * that would change a record comes back as a preview that waits for "Onayla".
 */
export function AssistantCommand() {
  const params = useSearchParams();
  const [text, setText] = useState('');
  const [cards, setCards] = useState<AssistantCommandCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recognizer = useRef<any>(null);
  const seq = useRef(0);
  const runLock = useRef(false);
  const [decisionBusy, setDecisionBusy] = useState<number | null>(null);
  const voice = typeof window !== 'undefined' && speechRecognition() !== null;

  const run = useCallback(async (command: string, extra: Record<string, string> = {}, replace?: number) => {
    const t = command.trim();
    if (t.length < 2 || runLock.current) return;
    runLock.current = true;
    setBusy(true);
    const id = replace ?? ++seq.current;
    if (replace === undefined) setCards((c) => [{ id, text: t, result: null }, ...c].slice(0, 12));
    const r = await requestJson<Result>('/api/v1/ai/commands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t, ...extra }) }, { timeoutMs: 60_000 });
    setCards((c) => c.map((x) => (x.id === id ? { ...x, result: r.ok && r.data ? r.data : null, error: r.ok ? undefined : r.error || 'Komut çalıştırılamadı' } : x)));
    setBusy(false);
    runLock.current = false;
  }, []);

  // A link (Cmd+K, a shared URL) only fills the box: the person runs it, so no preview is filed by opening a page.
  useEffect(() => { const q = params.get('q'); if (q) setText(q.slice(0, 500)); }, [params]);

  async function decide(card: AssistantCommandCard, action: 'approve' | 'reject') {
    if (card.result?.type !== 'preview' || decisionBusy !== null) return;
    setDecisionBusy(card.id);
    const r = await requestJson<{ status: string; result?: { href?: string } }>(`/api/v1/ai/suggestions/${card.result.suggestionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, expectedVersion: card.result.version }) });
    setCards((c) => c.map((x) => (x.id === card.id ? (r.ok ? { ...x, done: { href: r.data?.result?.href, label: action === 'approve' ? 'Uygulandı' : 'Vazgeçildi' } } : { ...x, error: r.error || 'Karar kaydedilemedi' }) : x)));
    setDecisionBusy(null);
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
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="px-5 pt-6 sm:px-7">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary"><Sparkles size={19} aria-hidden /></div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Nasıl yardımcı olabilirim?</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Bir siparişi bulun, işlerinizi değerlendirin veya yeni bir teklif hazırlayın.</p>
        </div>
        <form className="m-5 overflow-hidden rounded-xl border border-border bg-background transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 sm:m-7" onSubmit={(e) => { e.preventDefault(); if (!busy && text.trim().length > 1) { void run(text); setText(''); } }} aria-label="Asistan komutu">
          <textarea className="min-h-[100px] w-full resize-y bg-transparent px-4 py-4 text-sm leading-6 outline-none placeholder:text-muted-foreground/70 sm:text-base" placeholder="Örneğin: Bu hafta hangi siparişlere öncelik vermeliyim?" aria-label="Komut" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
          <div className="flex items-center justify-between gap-3 border-t border-border/60 px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck size={13} aria-hidden />Değişiklikler onayınızı bekler</span>
            <div className="flex items-center gap-2">
              {voice && <button type="button" className="rf-icon-button" aria-label={listening ? 'Dinlemeyi durdur' : 'Sesle söyle'} aria-pressed={listening} onClick={listen}>{listening ? <MicOff size={16} /> : <Mic size={16} />}</button>}
              <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40" disabled={busy || text.trim().length < 2}>{busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ArrowUp size={16} aria-hidden />}{busy ? 'İnceleniyor' : 'Gönder'}</button>
            </div>
          </div>
        </form>
      </section>
      {!cards.length && <div className="grid gap-3 sm:grid-cols-3" aria-label="Örnek komutlar">{EXAMPLES.map((e) => <button key={e.title} type="button" className="group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/40" onClick={() => setText(e.text)}><e.icon size={17} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{e.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{e.text}</span></span><ArrowUpRight size={14} className="text-muted-foreground/50 group-hover:text-primary" aria-hidden /></button>)}</div>}
      <ul className="space-y-3" aria-label="Sonuçlar">
        {cards.map((card) => (
          <li key={card.id} className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><p className="text-sm font-medium">{card.text}</p>{card.result && <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground">{card.result.processing?.label ?? (card.result.type === 'preview' && card.result.source === 'model' ? 'AI ile yorumlandı' : 'Kayıtlardan hesaplandı')}</span>}</div>
            {!card.result && !card.error && <p className="text-sm text-muted-foreground" role="status">Bakıyorum…</p>}
            {card.error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{card.error}</p>}
            {card.result && <CommandResultView busy={decisionBusy === card.id} card={card} onChoose={(v) => void run(card.text, { customerId: v }, card.id)} onDecide={(a) => void decide(card, a)} onExample={(e) => void run(e)} /> }
            {!!card.result?.suggestions?.length && <div className="flex flex-wrap gap-2">{card.result.suggestions.map((suggestion) => <button key={suggestion} type="button" className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted" disabled={busy} onClick={() => setText(suggestion)}>{suggestion}</button>)}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CommandResultView({ card, busy, onChoose, onDecide, onExample }: { card: AssistantCommandCard; busy: boolean; onChoose: (v: string) => void; onDecide: (a: 'approve' | 'reject') => void; onExample: (e: string) => void }) {
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
      {r.note && <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/85">{r.note}</p>}</div>
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
          <button type="button" className="rf-primary-button text-sm" disabled={busy} onClick={() => onDecide('approve')}><Check size={14} aria-hidden /> Onayla</button>
          <button type="button" className="rf-secondary-button text-sm" disabled={busy} onClick={() => onDecide('reject')}><X size={14} aria-hidden /> Vazgeç</button>
        </div>
      )}
    </div>
  );
}
