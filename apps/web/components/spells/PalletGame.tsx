'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import { FIELD, drop, newGame, readBest, saveBest, step, type PalletGame as Game, type Span } from '@/lib/features/spells/pallets';

const HEIGHT = 100;
const LAYER = 7;
const FLOOR = HEIGHT - 5;
/** Layers kept on screen before the view starts to climb with the stack. */
const VISIBLE = 9;

type Offcut = Span & { id: number; y: number; side: 1 | -1 };

/** One wooden pallet: a deck of boards on three blocks. `y` is its top edge. */
function Pallet({ span, y, highlight = false }: { span: Span; y: number; highlight?: boolean }) {
  const foot = Math.min(5, span.width / 4);
  const feet = [span.x, span.x + span.width / 2 - foot / 2, span.x + span.width - foot];
  return (
    <g className={highlight ? 'text-[hsl(var(--primary))]' : 'text-[#7a5a36] dark:text-[#d1a873]'}>
      <rect x={span.x} y={y} width={span.width} height={2} rx={0.3} className="fill-[#d6b07a] dark:fill-[#8a6a43]" stroke="currentColor" strokeWidth={0.35} />
      {feet.map((fx, i) => (
        <rect key={i} x={fx} y={y + 2} width={foot} height={3} className="fill-[#b98c55] dark:fill-[#6e5334]" stroke="currentColor" strokeWidth={0.3} />
      ))}
      <rect x={span.x} y={y + 5} width={span.width} height={1.3} rx={0.3} className="fill-[#c9a06a] dark:fill-[#7a5c3a]" stroke="currentColor" strokeWidth={0.3} />
    </g>
  );
}

/**
 * The empty-orders easter egg: stack pallets with the forklift. A pallet slides above
 * the stack; Space, Enter, a click or a tap drops it and whatever hangs over is cut off.
 * Esc closes, R starts again. Reduced motion slows the slide and drops the falling offcuts.
 */
export default function PalletGame({ onClose }: { onClose: () => void }) {
  const reduce = useReducedMotion();
  const [game, setGame] = useState<Game>(newGame);
  const [best, setBest] = useState(readBest);
  const [offcuts, setOffcuts] = useState<Offcut[]>([]);
  const [flash, setFlash] = useState<string>('');
  const [record, setRecord] = useState(false);
  const gameRef = useRef(game);
  const field = useRef<HTMLDivElement>(null);
  const ids = useRef(0);
  gameRef.current = game;

  useEffect(() => {
    if (game.over) return;
    let frame = 0;
    let last = 0;
    const slow = reduce ? 0.55 : 1;
    const tick = (now: number) => {
      // Cap a frame so a tab coming back from the background does not jump the pallet.
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      setGame((g) => step(g, dt * slow));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [game.over, reduce]);

  const restart = useCallback(() => {
    setGame(newGame()); setOffcuts([]); setFlash(''); setRecord(false);
    field.current?.focus();
  }, []);

  const release = useCallback(() => {
    const current = gameRef.current;
    if (current.over) { restart(); return; }
    const { game: next, result } = drop(current);
    setGame(next);
    if (result.kind === 'perfect') setFlash('Tam üstüne!');
    else if (result.kind === 'cut') setFlash('');
    if (result.kind === 'cut' && !reduce) {
      const y = FLOOR - next.stack.length * LAYER;
      const piece: Offcut = { ...result.offcut, y, id: (ids.current += 1), side: result.offcut.x < result.placed.x ? -1 : 1 };
      setOffcuts((list) => [...list.slice(-4), piece]);
    }
    if (result.kind === 'miss') { setRecord(next.score > best); setBest(saveBest(next.score)); }
  }, [reduce, restart, best]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); release(); }
    else if (event.key === 'r' || event.key === 'R') { event.preventDefault(); restart(); }
  };

  const climb = Math.max(0, game.stack.length - VISIBLE) * LAYER;
  const layerY = (i: number) => FLOOR - (i + 1) * LAYER;
  const movingY = layerY(game.stack.length) - 3;

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/45" />
        <Dialog.Content
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(event) => { event.preventDefault(); field.current?.focus(); }}
          className="rf-command-dialog fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xl sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-[15px] font-semibold">Palet istifi</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[12px] text-muted-foreground">Boşluk, Enter veya dokunma ile bırakın. Taşan kısım kesilir.</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Kapat" className="rf-icon-button h-8 w-8 shrink-0"><X size={16} aria-hidden /></Dialog.Close>
          </div>

          <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted-foreground">
            <span>Palet <span className="font-semibold tabular-nums text-foreground">{game.score}</span></span>
            <span className="text-[hsl(var(--rf-primary-text))]" aria-hidden>{flash}</span>
            <span>En iyi <span className="font-semibold tabular-nums text-foreground">{Math.max(best, game.score)}</span></span>
          </div>

          <div
            ref={field}
            role="button"
            tabIndex={0}
            aria-label={game.over ? 'Yeniden başlat' : 'Paleti bırak'}
            onPointerDown={(event) => { event.preventDefault(); field.current?.focus(); release(); }}
            className="relative mt-2 cursor-pointer touch-manipulation select-none overflow-hidden rounded-md border border-border bg-muted/40"
          >
            <svg viewBox={`0 0 ${FIELD} ${HEIGHT}`} className="block aspect-square max-h-[56vh] w-full" aria-hidden>
              <g style={{ transform: `translateY(${climb}px)`, transition: reduce ? undefined : 'transform 280ms cubic-bezier(.2,.8,.2,1)' }}>
                <line x1={0} x2={FIELD} y1={FLOOR + 0.3} y2={FLOOR + 0.3} className="stroke-border" strokeWidth={0.8} />
                {Array.from({ length: 12 }, (_, i) => (
                  <line key={i} x1={i * 9} x2={i * 9 + 4} y1={FLOOR + 2} y2={FLOOR + 2} className="stroke-muted-foreground/30" strokeWidth={0.5} />
                ))}
                {game.stack.map((span, i) => {
                  // Only draw what can be on screen.
                  if (i < game.stack.length - VISIBLE - 2) return null;
                  return <Pallet key={i} span={span} y={layerY(i)} highlight={i === game.stack.length - 1 && flash !== '' && i > 0} />;
                })}
                {game.current && (
                  <g>
                    <Pallet span={game.current} y={movingY} />
                    <line x1={game.current.x + game.current.width / 2} x2={game.current.x + game.current.width / 2} y1={movingY + 6.6} y2={layerY(game.stack.length - 1)} className="stroke-muted-foreground/30" strokeWidth={0.3} strokeDasharray="1 1" />
                  </g>
                )}
                <AnimatePresence>
                  {offcuts.map((piece) => (
                    <motion.g
                      key={piece.id}
                      initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
                      animate={{ opacity: 0, x: piece.side * 8, y: 40, rotate: piece.side * 35 }}
                      transition={{ duration: 0.8, ease: [0.4, 0, 1, 1] }}
                      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                      onAnimationComplete={() => setOffcuts((list) => list.filter((p) => p.id !== piece.id))}
                    >
                      <Pallet span={piece} y={piece.y} />
                    </motion.g>
                  ))}
                </AnimatePresence>
              </g>
            </svg>

            {game.over && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/85 px-4 text-center backdrop-blur-[2px]">
                <p className="text-[18px] font-semibold tracking-[-0.02em]">Palet düştü!</p>
                <p className="text-[13px] text-muted-foreground">
                  {game.score} palet istiflendi{record ? ' · yeni rekor' : ''}
                </p>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={restart}
                  className="rf-secondary-button mt-1 h-9 px-3.5 text-[13px]"
                >
                  <RotateCcw size={14} aria-hidden /> Yeniden (R)
                </button>
              </div>
            )}
          </div>

          <p className="sr-only" aria-live="polite">
            {game.over ? `Oyun bitti. ${game.score} palet. En iyi ${Math.max(best, game.score)}.` : `${game.score} palet`}
          </p>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Esc ile kapatın · R ile yeniden başlayın</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
