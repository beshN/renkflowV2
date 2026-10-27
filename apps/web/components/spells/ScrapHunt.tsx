'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RotateCcw, Shuffle, Undo2, X } from 'lucide-react';
import { celebrate } from './celebrate';
import {
  SCRAP_BEST_KEY, canPlace, message, nextBest, randomParts, remainingMm, roundPercent, scoreLayout,
  systemScore, verdict, type ScrapParams, type ScrapPart, type ScrapScore, type ScrapVerdict,
} from '@/lib/features/spells/scrap-hunt';

const fmt = (mm: number) => Math.round(mm).toLocaleString('tr-TR');
const pct = (n: number) => `%${roundPercent(n).toLocaleString('tr-TR')}`;

function readBest(): number | null {
  try { const raw = localStorage.getItem(SCRAP_BEST_KEY); const n = raw === null ? NaN : Number(raw); return Number.isFinite(n) ? n : null; } catch { return null; }
}
function writeBest(value: number | null) {
  if (value === null) return;
  try { localStorage.setItem(SCRAP_BEST_KEY, String(value)); } catch { /* private window: the best just is not kept */ }
}

type Result = { player: ScrapScore; system: ScrapScore; verdict: ScrapVerdict };
type Drag = { id: string; pointerId: number; x0: number; y0: number; x: number; y: number; moved: boolean; over: number | null };

/**
 * "Fire avı": pack the cut list's pieces onto 6 m bars by hand, then see how the firm's cutting
 * engine does on the same pieces. Drag a piece onto a bar (mouse or touch), or pick it with Enter
 * and choose a bar with the arrow keys and Enter. A placed piece is taken back by clicking it.
 * Only local state; the real plan is never touched.
 */
export function ScrapHunt({ parts: initial, params, fromPlan, onClose }: { parts: ScrapPart[]; params: ScrapParams; fromPlan: boolean; onClose: () => void }) {
  const reduce = useReducedMotion();
  const [parts, setParts] = useState(initial);
  const [source, setSource] = useState(fromPlan);
  const [bars, setBars] = useState<string[][]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const partRefs = useRef(new Map<string, HTMLButtonElement>());
  const barRefs = useRef(new Map<number, HTMLButtonElement>());
  const resultRef = useRef<HTMLDivElement>(null);
  const dragEnd = useRef(-Infinity);
  const justDragged = () => performance.now() - dragEnd.current < 400;

  useEffect(() => { setBest(readBest()); }, []);

  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const lengths = useCallback((bar: string[]) => bar.map((id) => byId.get(id)?.lengthMm ?? 0), [byId]);
  const placed = useMemo(() => new Set(bars.flat()), [bars]);
  const waiting = parts.filter((p) => !placed.has(p.id));
  // Opened bars plus one fresh bar while something is still waiting.
  const shown = waiting.length && bars.length < parts.length ? [...bars, []] : bars;
  const usable = params.barMm - params.trimStartMm - params.trimEndMm;

  const fits = (bar: number, id: string) => canPlace(lengths(shown[bar] ?? []), byId.get(id)?.lengthMm ?? Infinity, params);

  const focusPart = (id: string | undefined) => { if (id) requestAnimationFrame(() => partRefs.current.get(id)?.focus()); };
  const focusBar = (i: number) => requestAnimationFrame(() => barRefs.current.get(i)?.focus());

  const place = (id: string, bar: number) => {
    const part = byId.get(id);
    if (!part || placed.has(id) || result) return false;
    if (!fits(bar, id)) {
      setNote(`${fmt(part.lengthMm)} mm bu çubuğa sığmıyor (testere payı ${params.kerfMm.toLocaleString('tr-TR')} mm dahil).`);
      return false;
    }
    setBars((list) => { const next = list.map((b) => [...b]); if (bar >= next.length) next.push([]); next[bar].push(id); return next; });
    setHistory((h) => [...h, id]);
    setPicked(null);
    setNote(`${fmt(part.lengthMm)} mm yerleştirildi (çubuk ${bar + 1}).`);
    return true;
  };

  // A bar left empty closes; the bars after it move up, so pieces are found by id, not position.
  const remove = (id: string) => {
    if (result) return;
    setBars((list) => list.map((b) => b.filter((x) => x !== id)).filter((b) => b.length));
    setHistory((h) => h.filter((x) => x !== id));
    setNote(`${fmt(byId.get(id)?.lengthMm ?? 0)} mm geri alındı.`);
    focusPart(id);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last || result) return;
    remove(last);
  };

  const reset = (next?: ScrapPart[]) => {
    setBars([]); setHistory([]); setPicked(null); setResult(null); setNote('');
    if (next) { setParts(next); setSource(false); }
    focusPart((next ?? parts)[0]?.id);
  };

  const finish = () => {
    if (waiting.length) { setNote(`Önce kalan ${waiting.length} parçayı yerleştirin.`); return; }
    const player = scoreLayout(bars.map(lengths), params);
    const system = systemScore(parts, params);
    const v = verdict(player, system);
    setResult({ player, system, verdict: v });
    setNote('');
    const updated = nextBest(best, player, system);
    if (updated !== best) { setBest(updated); writeBest(updated); }
    requestAnimationFrame(() => {
      resultRef.current?.focus();
      if (v !== 'behind') {
        const box = resultRef.current?.getBoundingClientRect();
        celebrate(box ? { x: box.left + box.width / 2, y: box.top + 20 } : undefined);
      }
    });
  };

  // Esc closes from anywhere in the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Drag with pointer events: the same code for mouse, pen and touch.
  useEffect(() => {
    if (!drag) return;
    const barAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-scrap-bar]');
      return el ? Number(el.dataset.scrapBar) : null;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const moved = drag.moved || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6;
      setDrag({ ...drag, x: e.clientX, y: e.clientY, moved, over: moved ? barAt(e.clientX, e.clientY) : null });
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      if (drag.moved) {
        dragEnd.current = performance.now();
        const bar = barAt(e.clientX, e.clientY);
        if (bar !== null) place(drag.id, bar);
      }
      setDrag(null);
    };
    const cancel = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
  });

  const pick = (id: string) => {
    if (justDragged() || result) return;
    if (picked === id) { setPicked(null); return; }
    setPicked(id);
    const first = shown.findIndex((_, i) => fits(i, id));
    setNote(`${fmt(byId.get(id)?.lengthMm ?? 0)} mm seçildi. Çubuğu ok tuşlarıyla seçip Enter'a basın.`);
    focusBar(first < 0 ? 0 : first);
  };

  const onPartKey = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    focusPart(waiting[(index + delta + waiting.length) % waiting.length]?.id);
  };

  const onBarKey = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (delta) { e.preventDefault(); focusBar((index + delta + shown.length) % shown.length); }
  };

  const onBarClick = (bar: number) => {
    if (!picked) { setNote('Önce bir parça seçin.'); focusPart(waiting[0]?.id); return; }
    const id = picked;
    if (place(id, bar)) {
      const rest = waiting.filter((p) => p.id !== id);
      if (rest.length) focusPart(rest[Math.min(waiting.findIndex((p) => p.id === id), rest.length - 1)]?.id);
      else requestAnimationFrame(() => document.getElementById('scrap-finish')?.focus());
    }
  };

  const active = drag?.moved ? drag.id : picked;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="scrap-title" aria-describedby="scrap-help" onClick={() => { if (!justDragged()) onClose(); }}>
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-[var(--rf-shadow)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="scrap-title" className="text-[15px] font-semibold tracking-[-0.01em]">Fire avı</h2>
            <p id="scrap-help" className="mt-0.5 text-[12.5px] text-muted-foreground">
              Parçaları {fmt(params.barMm)} mm çubuklara yerleştirin, sistemle yarışın. Testere payı {params.kerfMm.toLocaleString('tr-TR')} mm{params.trimStartMm + params.trimEndMm ? `, tıraş ${fmt(params.trimStartMm + params.trimEndMm)} mm` : ''}; {fmt(params.minimumRemnantMm)} mm ve üstü kalan artık sayılır.
            </p>
          </div>
          <button type="button" onClick={onClose} className="-mr-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Oyunu kapat"><X className="h-4 w-4" aria-hidden /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span>{source ? 'Bu kesim paketinden parçalar' : 'Rastgele parçalar'} · {parts.length} parça</span>
            <span>En iyi: <span className="font-medium tabular-nums text-foreground">{best === null ? '—' : `%${best.toLocaleString('tr-TR')}`}</span></span>
          </div>

          <section aria-label="Yerleştirilecek parçalar">
            <p className="mb-2 text-[12px] font-medium text-muted-foreground">Parçalar · {waiting.length} kaldı</p>
            {waiting.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {waiting.map((p, i) => (
                  <li key={p.id}>
                    <button
                      ref={(el) => { if (el) partRefs.current.set(p.id, el); else partRefs.current.delete(p.id); }}
                      type="button"
                      autoFocus={i === 0 && !bars.length}
                      aria-pressed={picked === p.id}
                      aria-label={`${fmt(p.lengthMm)} mm parça`}
                      onClick={() => pick(p.id)}
                      onKeyDown={(e) => onPartKey(e, i)}
                      onPointerDown={(e) => { if (e.button !== 0 || result) return; setDrag({ id: p.id, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false, over: null }); }}
                      className={`group touch-none select-none rounded-md border px-2.5 pb-1.5 pt-1 text-left text-[13px] font-medium tabular-nums transition-colors ${active === p.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] text-foreground' : 'border-border bg-background hover:bg-accent'} ${drag?.moved && drag.id === p.id ? 'opacity-40' : ''} cursor-grab active:cursor-grabbing`}
                    >
                      {fmt(p.lengthMm)}
                      <span aria-hidden className="mt-1 block h-1 rounded-full bg-muted">
                        <span className="block h-1 rounded-full bg-foreground/40" style={{ width: `${Math.max(6, (p.lengthMm / usable) * 100)}%` }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13px] text-muted-foreground">Hepsi yerleşti. Bitir'e basın.</p>}
          </section>

          <section aria-label="Çubuklar" className="space-y-2.5">
            {shown.map((bar, i) => {
              const left = remainingMm(lengths(bar), params);
              const over = drag?.moved && drag.over === i;
              const ok = active ? fits(i, active) : false;
              const keep = bar.length > 0 && left > 0 && left >= params.minimumRemnantMm;
              const ring = over ? (ok ? 'ring-2 ring-emerald-500' : 'ring-2 ring-rose-500') : active && ok ? 'ring-1 ring-[hsl(var(--primary)/0.6)]' : 'ring-1 ring-border';
              return (
                <div key={i} data-scrap-bar={i} className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-[11px] tabular-nums text-muted-foreground" aria-hidden>Ç{i + 1}</span>
                  <div className={`relative flex h-9 min-w-0 flex-1 overflow-hidden rounded-md bg-muted ring-inset ${ring}`}>
                    {params.trimStartMm > 0 && <span aria-hidden className="h-full bg-foreground/25" style={{ width: `${(params.trimStartMm / params.barMm) * 100}%` }} />}
                    {bar.map((id) => {
                      const len = byId.get(id)?.lengthMm ?? 0;
                      return (
                        <motion.button
                          key={id}
                          type="button"
                          disabled={!!result}
                          initial={reduce ? false : { opacity: 0, scaleX: 0.6 }}
                          animate={{ opacity: 1, scaleX: 1 }}
                          transition={{ duration: 0.18 }}
                          onClick={() => remove(id)}
                          aria-label={`Çubuk ${i + 1}: ${fmt(len)} mm parçayı çıkar`}
                          title="Çıkar"
                          className="relative h-full shrink-0 origin-left overflow-hidden border-r-2 border-foreground/70 bg-[hsl(var(--primary)/0.22)] text-[10.5px] font-medium tabular-nums text-foreground hover:bg-[hsl(var(--primary)/0.32)] disabled:cursor-default"
                          style={{ width: `${((len + params.kerfMm) / params.barMm) * 100}%` }}
                        >
                          <span className="block truncate px-0.5">{fmt(len)}</span>
                        </motion.button>
                      );
                    })}
                    <span aria-hidden onClick={() => onBarClick(i)} className={`h-full flex-1 ${bar.length ? (keep ? 'bg-emerald-500/10' : 'bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgb(245_158_11/0.25)_5px_7px)]') : ''} ${picked ? 'cursor-pointer' : ''}`} />
                  </div>
                  <button
                    ref={(el) => { if (el) barRefs.current.set(i, el); else barRefs.current.delete(i); }}
                    type="button"
                    disabled={!!result}
                    onClick={() => onBarClick(i)}
                    onKeyDown={(e) => onBarKey(e, i)}
                    aria-label={`Çubuk ${i + 1}: kalan ${fmt(left)} mm${bar.length ? (keep ? ', artık olarak kalır' : ', fire') : ', boş'}${picked ? (fits(i, picked) ? '. Seçili parçayı buraya koyun' : '. Seçili parça sığmıyor') : ''}`}
                    className={`w-[84px] shrink-0 rounded-md border px-1.5 py-1 text-right text-[11px] leading-tight tabular-nums transition-colors sm:w-[104px] ${picked && fits(i, picked) ? 'border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--primary)/0.08)] hover:bg-[hsl(var(--primary)/0.16)]' : 'border-border hover:bg-accent'} disabled:hover:bg-transparent`}
                  >
                    <span className="block font-medium text-foreground">{fmt(left)} mm</span>
                    <span className={`block ${!bar.length ? 'text-muted-foreground' : keep ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>{!bar.length ? 'boş çubuk' : keep ? 'artık' : 'fire'}</span>
                  </button>
                </div>
              );
            })}
          </section>

          <p className="min-h-[1.25rem] text-[12px] text-muted-foreground" role="status" aria-live="polite">{note}</p>

          {result && (
            <motion.div
              ref={resultRef}
              tabIndex={-1}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-lg border p-3 outline-none ${result.verdict === 'behind' ? 'border-border bg-muted/40' : 'border-emerald-600/30 bg-emerald-500/10'}`}
              role="status"
            >
              <p className="text-[14px] font-medium tabular-nums">
                Siz: {result.player.bars} çubuk, {pct(result.player.wastePercent)} fire <span className="text-muted-foreground">—</span> Sistem: {result.system.bars} çubuk, {pct(result.system.wastePercent)} fire
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">{message(result.verdict)}</p>
              {result.player.bars > result.system.bars && <p className="mt-1 text-[12px] text-muted-foreground">Bir çubuk fazlası her zaman geride sayılır; uzun artık bırakmak yetmez.</p>}
            </motion.div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={undo} disabled={!history.length || !!result} className="rf-secondary-button h-8 px-2.5 text-[12.5px]"><Undo2 className="h-3.5 w-3.5" aria-hidden /><span className="max-sm:sr-only">Geri al</span></button>
          <button type="button" onClick={() => reset()} disabled={!history.length && !result} className="rf-secondary-button h-8 px-2.5 text-[12.5px]"><RotateCcw className="h-3.5 w-3.5" aria-hidden /><span className="max-sm:sr-only">Baştan</span></button>
          <button type="button" onClick={() => reset(randomParts())} className="rf-secondary-button h-8 px-2.5 text-[12.5px]"><Shuffle className="h-3.5 w-3.5" aria-hidden /><span className="max-sm:sr-only">Yeni parçalar</span></button>
          <span className="flex-1" />
          {result
            ? <button type="button" onClick={() => reset()} className="rf-primary-button h-8 px-3 text-[12.5px]">Tekrar dene</button>
            : <button id="scrap-finish" type="button" onClick={finish} aria-disabled={waiting.length > 0} className={`rf-primary-button h-8 px-3 text-[12.5px] ${waiting.length ? 'opacity-60' : ''}`}>Bitir</button>}
        </div>
      </div>

      {drag?.moved && (
        <span aria-hidden className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-[130%] rounded-md border border-[hsl(var(--primary))] bg-card px-2.5 py-1 text-[13px] font-medium tabular-nums shadow-[var(--rf-shadow)]" style={{ left: drag.x, top: drag.y }}>
          {fmt(byId.get(drag.id)?.lengthMm ?? 0)}
        </span>
      )}
    </div>
  );
}
