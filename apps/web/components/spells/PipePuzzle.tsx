'use client';

import { useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { BASE, E, N, S, W, createPuzzle, flow, type PieceKind } from '@/lib/features/spells/pipes';
import { cn } from '@/lib/utils';
import { celebrate } from './celebrate';

const ROWS = 4;
const COLS = 5;
const KIND_LABEL: Record<PieceKind, string> = { straight: 'düz', elbow: 'dirsek', tee: 'T parça' };
/** Cell drawing units: the cell is 48 wide with (0, 0) in its centre, so a turn needs no origin tricks. */
const HALF = 24;
const PIPE = 12;
/** Each arm as the angle it points to: N up, then clockwise. */
const ARMS: Array<[number, number]> = [[N, -90], [E, 0], [S, 90], [W, 180]];

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/*
 * Colours as custom properties so light and dark only swap values:
 * --pipe idle profile, --pipe-on profile carrying the line, --sheen the highlight along a profile.
 */
const PALETTE = cn(
  '[--pipe:#8d969b] [--pipe-on:hsl(var(--primary))] [--sheen:rgb(255_255_255/0.55)] [--sheen-on:rgb(255_255_255/0.32)]',
  'dark:[--pipe:#76838a] dark:[--sheen:rgb(255_255_255/0.2)] dark:[--sheen-on:rgb(255_255_255/0.3)]',
);

/** One arm from the centre to the middle of a cell edge, ending in a flange on that edge. */
function Arm({ angle, on }: { angle: number; on: boolean }) {
  const colour = on ? 'var(--pipe-on)' : 'var(--pipe)';
  return (
    <g transform={`rotate(${angle})`}>
      <line x1={0} y1={0} x2={HALF} y2={0} stroke={colour} strokeWidth={PIPE} strokeLinecap="round" />
      <line x1={4} y1={0} x2={HALF - 7} y2={0} stroke={on ? 'var(--sheen-on)' : 'var(--sheen)'} strokeWidth={2} strokeLinecap="round" />
      {/* Flange: a collar on the edge, set off from the profile by a hairline in the cell colour. */}
      <rect x={HALF - 5} y={-PIPE / 2 - 3.5} width={5} height={PIPE + 7} rx={1} fill={colour} stroke="hsl(var(--card))" strokeWidth={1.2} />
    </g>
  );
}

function Piece({ kind, on }: { kind: PieceKind; on: boolean }) {
  const mask = BASE[kind];
  return (
    <>
      {ARMS.filter(([dir]) => mask & dir).map(([dir, angle]) => <Arm key={dir} angle={angle} on={on} />)}
      {kind !== 'straight' && (
        <>
          <circle r={PIPE / 2 + 2.5} fill={on ? 'var(--pipe-on)' : 'var(--pipe)'} />
          <circle r={2.4} fill="hsl(var(--card))" />
        </>
      )}
    </>
  );
}

/**
 * The inlet or outlet: a short profile out of the frame with an arrow for the flow, and its
 * name above. Plain boxes sized in % of the row, so it scales with the cells and adds no height.
 */
function Port({ label, on, side }: { label: string; on: boolean; side: 'in' | 'out' }) {
  const colour = on ? 'var(--pipe-on)' : 'var(--pipe)';
  return (
    <div className="relative h-full w-full">
      <span className="absolute inset-x-[-6px] bottom-[67%] text-center text-[10.5px] font-semibold leading-none text-muted-foreground">{label}</span>
      {/* Pipe: 12/48 of the row, like the pieces; flange on the side that meets the grid. */}
      <span className={cn('absolute top-1/2 flex h-1/4 -translate-y-1/2 items-center justify-center', side === 'in' ? 'left-0 right-0 rounded-l-[3px]' : 'left-0 right-0 rounded-r-[3px]')} style={{ background: colour }}>
        <svg viewBox="0 0 10 10" aria-hidden className="h-[70%] w-auto">
          <path d="M3.5 1.5L7 5l-3.5 3.5" fill="none" stroke="hsl(var(--card))" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={cn('absolute top-1/2 h-[40%] w-[5px] -translate-y-1/2 rounded-[1px] ring-1 ring-[hsl(var(--card))]', side === 'in' ? 'right-0' : 'left-0')} style={{ background: colour }} />
    </div>
  );
}

/**
 * Error-screen pastime: turn the profile pieces so the line runs from the inlet on the
 * left to the outlet on the right. Click, tap, Enter or Space turns a piece; arrow keys
 * move between pieces. Every puzzle is laid from a solvable path and never starts solved.
 */
export default function PipePuzzle({ seed: initialSeed }: { seed?: number }) {
  const reduce = useReducedMotion();
  const [seed, setSeed] = useState(() => initialSeed ?? newSeed());
  const base = useMemo(() => createPuzzle(seed, ROWS, COLS), [seed]);
  // Quarter turns counted up (not wrapped) so a piece always turns clockwise on screen.
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

  const onKeyDown = (event: React.KeyboardEvent) => {
    const r = Math.floor(focus / COLS);
    const c = focus % COLS;
    const target = { ArrowUp: r > 0 ? focus - COLS : focus, ArrowDown: r < ROWS - 1 ? focus + COLS : focus, ArrowLeft: c > 0 ? focus - 1 : focus, ArrowRight: c < COLS - 1 ? focus + 1 : focus, Home: r * COLS, End: r * COLS + COLS - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    setFocus(target);
    cells.current[target]?.focus();
  };

  const fresh = () => { setSeed(newSeed()); setFocus(0); };
  const inletOn = solved || reached.has(base.inRow * COLS);
  // The side columns share the grid's rows (same 1px frame and gaps) so the ports line up.
  const portColumn = (row: number, port: React.ReactNode) => (
    <div className="grid w-8 shrink-0 gap-px py-px" style={{ gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))` }}>
      {Array.from({ length: ROWS }, (_, r) => <div key={r} className="relative min-h-0">{r === row ? port : null}</div>)}
    </div>
  );

  return (
    <div className={cn('text-left', PALETTE)}>
      <p className="text-[13px] font-medium" id="pipe-title">Beklerken: hattı birleştirin</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">Parçaları çevirerek soldaki girişi sağdaki çıkışa bağlayın.</p>
      <div className="mx-auto mt-4 flex max-w-[364px] items-stretch justify-center">
        {portColumn(base.inRow, <Port label="Giriş" side="in" on={inletOn} />)}
        <div
          ref={grid}
          role="grid"
          aria-labelledby="pipe-title"
          onKeyDown={onKeyDown}
          className={cn('grid min-w-0 flex-1 gap-px overflow-hidden rounded-md border border-border bg-border transition-colors', solved && 'border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--primary)/0.35)]')}
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: ROWS }, (_, r) => (
            <div role="row" key={r} className="contents">
              {Array.from({ length: COLS }, (_, c) => {
                const i = r * COLS + c;
                const on = solved || reached.has(i);
                return (
                  <div role="gridcell" key={c} className="contents">
                    <button
                      ref={(el) => { cells.current[i] = el; }}
                      type="button"
                      tabIndex={i === focus ? 0 : -1}
                      onFocus={() => setFocus(i)}
                      onClick={() => turn(i)}
                      aria-disabled={solved || undefined}
                      aria-label={`Satır ${r + 1}, sütun ${c + 1}: ${KIND_LABEL[base.kinds[i]]}, ${reached.has(i) ? 'hatta bağlı' : 'bağlı değil'}`}
                      className={cn(
                        'relative aspect-square min-w-0 touch-manipulation overflow-hidden bg-card outline-none transition-colors hover:bg-muted focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--ring))] aria-disabled:cursor-default',
                        // Opaque tint (the frame behind is bronze too, a translucent one would muddy it).
                        solved && 'bg-[color-mix(in_srgb,hsl(var(--primary))_9%,hsl(var(--card)))] hover:bg-[color-mix(in_srgb,hsl(var(--primary))_9%,hsl(var(--card)))]',
                      )}
                    >
                      <svg viewBox={`${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}`} aria-hidden className="absolute inset-0 h-full w-full">
                        {/* (0, 0) is the cell centre, so a plain rotate() turns the piece in place. */}
                        <g style={{ transform: `rotate(${turns[i] * 90}deg)`, transformBox: 'view-box', transformOrigin: '0 0', transition: reduce ? undefined : 'transform 200ms cubic-bezier(.2,.8,.2,1)' }}>
                          <Piece kind={base.kinds[i]} on={on} />
                        </g>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {portColumn(base.outRow, <Port label="Çıkış" side="out" on={solved} />)}
      </div>
      <div className="mt-3 flex min-h-9 items-center justify-center gap-3" aria-live="polite">
        {solved ? (
          <>
            <span className="text-[13px] font-semibold text-[hsl(var(--rf-primary-text))]">Hat tamam!</span>
            <button type="button" onClick={fresh} className="rf-secondary-button h-8 px-3 text-[12.5px]">
              <RefreshCw size={13} aria-hidden /> Yeni bulmaca
            </button>
          </>
        ) : (
          <span className="text-center text-[11.5px] text-muted-foreground">Tıklayın veya Enter ile çevirin · ok tuşlarıyla gezinin</span>
        )}
      </div>
    </div>
  );
}
