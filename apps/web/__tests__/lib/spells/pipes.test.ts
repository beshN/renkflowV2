import { E, N, S, W, createPuzzle, flow, isSolved, openings, rotate, rotateMask, type Puzzle } from '@/lib/features/spells/pipes';

describe('pipe puzzle', () => {
  it('rotates openings clockwise', () => {
    expect(rotateMask(N | S, 1)).toBe(E | W);
    expect(rotateMask(N | E, 1)).toBe(E | S);
    expect(rotateMask(N | E, 3)).toBe(W | N);
    expect(rotateMask(N | E | S, 4)).toBe(N | E | S);
    expect(openings('tee', 2)).toBe(S | W | N);
  });

  it('turns one cell a quarter and wraps after four', () => {
    let p = createPuzzle(7);
    const before = p.turns[3];
    p = rotate(p, 3);
    expect(p.turns[3]).toBe((before + 1) % 4);
    p = rotate(rotate(rotate(p, 3), 3), 3);
    expect(p.turns[3]).toBe(before);
  });

  it('checks connectivity through matching openings only', () => {
    // One row of straights turned east-west: a line straight through.
    const line: Puzzle = { rows: 1, cols: 3, inRow: 0, outRow: 0, kinds: ['straight', 'straight', 'straight'], turns: [1, 1, 1], solution: [1, 1, 1] };
    expect(isSolved(line)).toBe(true);
    expect(flow(line).reached.size).toBe(3);
    const broken = rotate(line, 1);
    expect(isSolved(broken)).toBe(false);
    expect([...flow(broken).reached]).toEqual([0]);
    expect(flow(rotate(line, 0)).reached.size).toBe(0);
  });

  it('needs the outlet cell to face the outlet', () => {
    // Straight, then an elbow W-N: everything joins but the line never leaves on the right.
    const p: Puzzle = { rows: 1, cols: 2, inRow: 0, outRow: 0, kinds: ['straight', 'elbow'], turns: [1, 3], solution: [1, 3] };
    expect(flow(p).reached.size).toBe(2);
    expect(isSolved(p)).toBe(false);
  });

  it('always generates a solvable puzzle that does not start solved', () => {
    for (let seed = 1; seed <= 500; seed += 1) {
      for (const [rows, cols] of [[4, 4], [4, 5], [5, 5]] as const) {
        const p = createPuzzle(seed, rows, cols);
        expect(p.kinds).toHaveLength(rows * cols);
        expect(p.turns.every((t) => t >= 0 && t < 4)).toBe(true);
        expect(isSolved(p)).toBe(false);
        expect(isSolved({ ...p, turns: p.solution })).toBe(true);
      }
    }
  });

  it('is reproducible from its seed', () => {
    expect(createPuzzle(42)).toEqual(createPuzzle(42));
    expect(createPuzzle(42)).not.toEqual(createPuzzle(43));
  });
});
