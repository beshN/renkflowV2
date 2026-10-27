/**
 * Pipe (profile line) puzzle for the error screens, as pure functions. Each cell holds a
 * straight, elbow or tee piece that turns a quarter at a time; the line is done when the
 * inlet on the left reaches the outlet on the right. Puzzles come from a seed: a random
 * path is laid first (so a solution always exists), then every piece is turned at random,
 * and a puzzle never starts solved.
 */

/** Openings as bits, clockwise: N, E, S, W. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const DIRS = [N, E, S, W] as const;

export type PieceKind = 'straight' | 'elbow' | 'tee';
/** Openings of each piece at rotation 0. */
export const BASE: Record<PieceKind, number> = { straight: N | S, elbow: N | E, tee: N | E | S };

export type Puzzle = {
  rows: number;
  cols: number;
  /** Row of the inlet on the left edge and of the outlet on the right edge. */
  inRow: number;
  outRow: number;
  kinds: PieceKind[];
  /** Quarter turns clockwise per cell (0..3), row-major. */
  turns: number[];
  /** One set of turns that solves it. */
  solution: number[];
};

/** Small, fast, seedable PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn an opening mask clockwise by `turns` quarters. */
export function rotateMask(mask: number, turns: number) {
  let m = mask & 15;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i += 1) m = ((m << 1) | (m >> 3)) & 15;
  return m;
}

export function openings(kind: PieceKind, turns: number) {
  return rotateMask(BASE[kind], turns);
}

export function opposite(dir: number) {
  return rotateMask(dir, 2);
}

/** The cell one step in `dir`, or -1 off the grid. */
function neighbour(index: number, dir: number, rows: number, cols: number) {
  const r = Math.floor(index / cols);
  const c = index % cols;
  if (dir === N) return r > 0 ? index - cols : -1;
  if (dir === S) return r < rows - 1 ? index + cols : -1;
  if (dir === E) return c < cols - 1 ? index + 1 : -1;
  return c > 0 ? index - 1 : -1;
}

/** One cell turned a quarter clockwise. */
export function rotate(puzzle: Puzzle, index: number): Puzzle {
  const turns = puzzle.turns.slice();
  turns[index] = (turns[index] + 1) % 4;
  return { ...puzzle, turns };
}

/** Cells the inlet reaches through matching openings, and whether the outlet is among them. */
export function flow(puzzle: Pick<Puzzle, 'rows' | 'cols' | 'inRow' | 'outRow' | 'kinds' | 'turns'>) {
  const { rows, cols, kinds, turns } = puzzle;
  const reached = new Set<number>();
  const start = puzzle.inRow * cols;
  if (openings(kinds[start], turns[start]) & W) {
    const queue = [start];
    reached.add(start);
    while (queue.length) {
      const at = queue.shift()!;
      const open = openings(kinds[at], turns[at]);
      for (const dir of DIRS) {
        if (!(open & dir)) continue;
        const next = neighbour(at, dir, rows, cols);
        if (next < 0 || reached.has(next)) continue;
        if (openings(kinds[next], turns[next]) & opposite(dir)) { reached.add(next); queue.push(next); }
      }
    }
  }
  const end = puzzle.outRow * cols + cols - 1;
  const solved = reached.has(end) && Boolean(openings(kinds[end], turns[end]) & E);
  return { reached, solved };
}

export function isSolved(puzzle: Puzzle) {
  return flow(puzzle).solved;
}

/** Straight or elbow, and its turns, with exactly these two openings. */
function pieceFor(mask: number): { kind: PieceKind; turns: number } {
  for (const kind of ['straight', 'elbow'] as const) {
    for (let t = 0; t < 4; t += 1) if (openings(kind, t) === mask) return { kind, turns: t };
  }
  throw new Error(`no piece for ${mask}`);
}

/** A random self-avoiding walk from the inlet cell to the outlet cell (depth first, shuffled). */
function randomPath(rows: number, cols: number, from: number, to: number, random: () => number): number[] {
  const seen = new Set<number>([from]);
  const path = [from];
  const walk = (at: number): boolean => {
    if (at === to) return true;
    const dirs: number[] = DIRS.slice();
    for (let i = dirs.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const dir of dirs) {
      const next = neighbour(at, dir, rows, cols);
      if (next < 0 || seen.has(next)) continue;
      seen.add(next);
      path.push(next);
      if (walk(next)) return true;
      path.pop();
    }
    return false;
  };
  walk(from);
  return path;
}

/** Direction from cell `a` to the adjacent cell `b`. */
function dirBetween(a: number, b: number) {
  if (b === a + 1) return E;
  if (b === a - 1) return W;
  return b > a ? S : N;
}

export function createPuzzle(seed: number, rows = 4, cols = 5): Puzzle {
  const random = rng(seed);
  const pick = (n: number) => Math.floor(random() * n);
  const inRow = pick(rows);
  const outRow = pick(rows);
  const from = inRow * cols;
  const to = outRow * cols + cols - 1;
  const path = randomPath(rows, cols, from, to, random);

  const kinds: PieceKind[] = [];
  const solution: number[] = [];
  const spare: PieceKind[] = ['straight', 'elbow', 'elbow', 'tee'];
  for (let i = 0; i < rows * cols; i += 1) { kinds.push(spare[pick(spare.length)]); solution.push(pick(4)); }

  path.forEach((cell, i) => {
    const entry = i === 0 ? W : opposite(dirBetween(path[i - 1], cell));
    const exit = i === path.length - 1 ? E : dirBetween(cell, path[i + 1]);
    const piece = pieceFor(entry | exit);
    // Now and then a tee stands in for an elbow: it still fits, and makes the puzzle less obvious.
    if (piece.kind === 'elbow' && random() < 0.25) {
      const t = [0, 1, 2, 3].find((turn) => (openings('tee', turn) & (entry | exit)) === (entry | exit))!;
      kinds[cell] = 'tee';
      solution[cell] = t;
    } else {
      kinds[cell] = piece.kind;
      solution[cell] = piece.turns;
    }
  });

  const turns = solution.map(() => pick(4));
  const puzzle: Puzzle = { rows, cols, inRow, outRow, kinds, turns, solution };
  if (isSolved(puzzle)) {
    // Never start solved: turn the inlet cell until it no longer faces the inlet.
    // Every piece has at least one turn without a west opening, so this always ends.
    let t = turns[from];
    while (openings(kinds[from], t) & W) t = (t + 1) % 4;
    turns[from] = t;
  }
  return puzzle;
}
