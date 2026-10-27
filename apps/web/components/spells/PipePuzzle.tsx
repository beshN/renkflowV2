'use client';

import { useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { BASE, E, N, S, W, createPuzzle, flow, type PieceKind } from '@/lib/features/spells/pipes';
import { celebrate } from './celebrate';

const ROWS = 4;
const COLS = 5;
const KIND_LABEL: Record<PieceKind, string> = { straight: 'düz', elbow: 'dirsek', tee: 'T parça' };
const ARMS: Array<[number, string]> = [[N, 'M20 20V0'], [E, 'M20 20H40'], [S, 'M20 20V40'], [W, 'M20 20H0']];

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** One piece at rotation 0; the cell turns it. Lit pieces carry the line from the inlet. */
function Piece({ kind, lit }: { kind: PieceKind; lit: boolean }) {
  const mask = BASE[kind];
  const d = ARMS.filter(([dir]) => mask & dir).map(([, path]) => path).join(' ');
  return (
    <>
      <path d={d} fill="none" strokeWidth={11} strokeLinecap="butt" className={lit ? 'stroke-[hsl(var(--primary))]' : 'stroke-muted-foreground/40'} />
      <path d={d} fill="none" strokeWidth={3} strokeLinecap="butt" className={lit ? 'stroke-[hsl(var(--primary-foreground)/0.55)]' : 'stroke-card'} />
      <rect x={14.5} y={14.5} width={11} height={11} rx={1.5} className={lit ? 'fill-[hsl(var(--primary))]' : 'fill-muted-foreground/40'} />
    </>
  );
}

/**
 * Error-screen pastime: turn the profile pieces so the line runs from the inlet on the
 * left to the outlet on the right. Click, tap, Enter or Space turns a piece; arrow keys
 * move between pieces. Every puzzle is laid from a solvable path and never starts solved.
 */
export default function PipePuzzle() {
  const reduce = useReducedMotion();
  const [seed, setSeed] = useState(newSeed);
  const base = useMemo(() => createPuzzle(seed, ROWS, COLS), [seed]);
  // Quarter turns counted up (not wrapped) so a piece always animates clockwise.
  const [spins, setSpins] = useState<{ seed: number; turns: number[] }>({ seed, turns: base.turns });
  const turns = spins.seed === seed ? spins.turns : base.turns;
  const puzzle = useMemo(() => ({ ...base, turns: turns.map((t) => t % 4) }), [base, turns]);
  const { reached, solved } = useMemo(() => flow(puzzle), [puzzle]);
  const [focus, setFocus] = useState(0);
  const cells = useRef<Array<HTMLButtonElement | null>>([]);
  const grid = useRef<HTMLDivElement>(null);

  const turn = (index: number) => {
    if (solved) return;
    const next = turns.slice();
    next[index] += 1;
    setSpins({ seed, turns: next });
    if (flow({ ...base, turns: next.map((t) => t % 4) }).solved) {
      const box = grid.current?.getBoundingClientRect();
      celebrate(box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : undefined);
    }
  };

  const move = (index: number) => {
    setFocus(index);
    cells.current[index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const r = Math.floor(focus / COLS);
    const c = focus % COLS;
    const target = { ArrowUp: r > 0 ? focus - COLS : focus, ArrowDown: r < ROWS - 1 ? focus + COLS : focus, ArrowLeft: c > 0 ? focus - 1 : focus, ArrowRight: c < COLS - 1 ? focus + 1 : focus, Home: r * COLS, End: r * COLS + COLS - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    move(target);
  };

  const fresh = () => { setSeed(newSeed()); setFocus(0); };
  const stub = (lit: boolean) => <span aria-hidden className={`block h-[11px] w-3 ${lit ? 'bg-[hsl(var(--primary))]' : 'bg-muted-foreground/40'}`} />;
  const inlet = base.inRow * COLS;

  return (
    <div className="text-left">
      <p className="text-[13px] font-medium" id="pipe-title">Beklerken: hattı birleştirin</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">Parçaları çevirerek soldaki girişi sağdaki çıkışa bağlayın.</p>
      <div className="mt-3 flex items-center justify-center" style={{ ['--pipe-cell' as string]: 'clamp(40px, 13vw, 48px)' }}>
        <div className="grid items-center" style={{ height: `calc(${ROWS} * var(--pipe-cell) + ${ROWS + 1}px)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
          {Array.from({ length: ROWS }, (_, r) => <div key={r} className="flex justify-end">{r === base.inRow ? stub(reached.has(inlet)) : null}</div>)}
        </div>
        <div
          ref={grid}
          role="grid"
          aria-labelledby="pipe-title"
          onKeyDown={onKeyDown}
          className="grid gap-px overflow-hidden rounded-md border border-border bg-border"
          style={{ gridTemplateColumns: `repeat(${COLS}, var(--pipe-cell))` }}
        >
          {Array.from({ length: ROWS }, (_, r) => (
            <div role="row" key={r} className="contents">
              {Array.from({ length: COLS }, (_, c) => {
                const i = r * COLS + c;
                const lit = reached.has(i);
                return (
                  <div role="gridcell" key={c} className="contents">
                    <button
                      ref={(el) => { cells.current[i] = el; }}
                      type="button"
                      tabIndex={i === focus ? 0 : -1}
                      onFocus={() => setFocus(i)}
                      onClick={() => turn(i)}
                      aria-disabled={solved || undefined}
                      aria-label={`Satır ${r + 1}, sütun ${c + 1}: ${KIND_LABEL[base.kinds[i]]}, ${lit ? 'hatta bağlı' : 'bağlı değil'}`}
                      className="relative aspect-square w-[var(--pipe-cell)] touch-manipulation bg-card outline-none hover:bg-muted focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))] aria-disabled:cursor-default aria-disabled:hover:bg-card"
                    >
                      <svg viewBox="0 0 40 40" aria-hidden className="absolute inset-0 h-full w-full">
                        {/* Plain CSS rotation about the cell centre (framer would turn about the bounding box). */}
                        <g style={{ transform: `rotate(${turns[i] * 90}deg)`, transformOrigin: '20px 20px', transformBox: 'view-box', transition: reduce ? undefined : 'transform 220ms cubic-bezier(.2,.8,.2,1)' }}>
                          <Piece kind={base.kinds[i]} lit={lit} />
                        </g>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="grid items-center" style={{ height: `calc(${ROWS} * var(--pipe-cell) + ${ROWS + 1}px)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
          {Array.from({ length: ROWS }, (_, r) => <div key={r}>{r === base.outRow ? stub(solved) : null}</div>)}
        </div>
      </div>
      <div className="mt-3 flex min-h-9 items-center justify-center gap-3" aria-live="polite">
        {solved ? (
          <>
            <span className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">Hat tamam!</span>
            <button type="button" onClick={fresh} className="rf-secondary-button h-8 px-3 text-[12.5px]">
              <RefreshCw size={13} aria-hidden /> Yeni bulmaca
            </button>
          </>
        ) : (
          <span className="text-[11.5px] text-muted-foreground">Tıklayın veya Enter ile çevirin · ok tuşlarıyla gezinin</span>
        )}
      </div>
    </div>
  );
}

