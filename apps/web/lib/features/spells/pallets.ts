/**
 * Pallet stacking (the empty-orders easter egg), as pure state so it can be tested
 * without a screen. Positions are in field units: the field is FIELD wide, a pallet
 * is a span [x, x + width]. The moving pallet bounces between the field edges; on a
 * drop the part that hangs over the pallet below is cut off and the rest stays.
 */

export const FIELD = 100;
export const START_WIDTH = 56;
/** Field units per second. */
export const BASE_SPEED = 38;
export const SPEED_STEP = 4;
export const MAX_SPEED = 96;
/** A drop this close to the pallet below counts as perfect and snaps into line. */
export const PERFECT_TOLERANCE = 1.5;

export type Span = { x: number; width: number };
export type Moving = Span & { dir: 1 | -1 };

export type PalletGame = {
  /** Bottom first; stack[0] is the pallet on the floor and is not scored. */
  stack: Span[];
  current: Moving | null;
  speed: number;
  score: number;
  over: boolean;
};

export type DropResult =
  | { kind: 'perfect'; placed: Span }
  | { kind: 'cut'; placed: Span; offcut: Span }
  | { kind: 'miss'; fallen: Span }
  | { kind: 'none' };

/** Speed after `score` pallets: grows by a step per pallet, capped. */
export function speedFor(score: number) {
  return Math.min(MAX_SPEED, BASE_SPEED + Math.max(0, score) * SPEED_STEP);
}

/** The next pallet comes in from alternating sides, as wide as the top of the stack. */
export function spawn(top: Span, score: number): Moving {
  return score % 2 === 0
    ? { x: 0, width: top.width, dir: 1 }
    : { x: FIELD - top.width, width: top.width, dir: -1 };
}

export function newGame(): PalletGame {
  const base = { x: (FIELD - START_WIDTH) / 2, width: START_WIDTH };
  return { stack: [base], current: spawn(base, 0), speed: speedFor(0), score: 0, over: false };
}

/** Slide the moving pallet for `dt` seconds, bouncing off both edges. */
export function step(game: PalletGame, dt: number): PalletGame {
  if (game.over || !game.current || dt <= 0) return game;
  const max = FIELD - game.current.width;
  let x = game.current.x + game.current.dir * game.speed * dt;
  let dir = game.current.dir;
  // A long frame (tab in the background) can cross the field more than once.
  for (let i = 0; i < 8 && (x < 0 || x > max); i += 1) {
    if (x > max) { x = 2 * max - x; dir = -1; }
    if (x < 0) { x = -x; dir = 1; }
  }
  x = Math.min(max, Math.max(0, x));
  return { ...game, current: { ...game.current, x, dir } };
}

/** Where a drop would land on `below`: the overlap, or nothing when it misses. */
export function overlap(moving: Span, below: Span): Span | null {
  const left = Math.max(moving.x, below.x);
  const right = Math.min(moving.x + moving.width, below.x + below.width);
  return right - left > 1e-6 ? { x: left, width: right - left } : null;
}

/** Drop the moving pallet: trim the overhang, grow the stack, or end the game on a miss. */
export function drop(game: PalletGame): { game: PalletGame; result: DropResult } {
  if (game.over || !game.current) return { game, result: { kind: 'none' } };
  const below = game.stack[game.stack.length - 1];
  const moving = game.current;
  const span = { x: moving.x, width: moving.width };

  let placed: Span;
  let result: DropResult;
  if (Math.abs(moving.x - below.x) <= PERFECT_TOLERANCE && Math.abs(moving.width - below.width) < 1e-6) {
    placed = { x: below.x, width: below.width };
    result = { kind: 'perfect', placed };
  } else {
    const hit = overlap(moving, below);
    if (!hit) {
      return { game: { ...game, current: null, over: true }, result: { kind: 'miss', fallen: span } };
    }
    placed = hit;
    const offcut = moving.x < below.x
      ? { x: moving.x, width: moving.width - hit.width }
      : { x: hit.x + hit.width, width: moving.width - hit.width };
    result = { kind: 'cut', placed, offcut };
  }

  const score = game.score + 1;
  return {
    game: { stack: [...game.stack, placed], current: spawn(placed, score), speed: speedFor(score), score, over: false },
    result,
  };
}

export const BEST_KEY = 'renkflow.pallets.best';

export function readBest(): number {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const value = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveBest(score: number): number {
  const best = Math.max(readBest(), score);
  try { window.localStorage.setItem(BEST_KEY, String(best)); } catch { /* private mode: keep it in memory only */ }
  return best;
}
