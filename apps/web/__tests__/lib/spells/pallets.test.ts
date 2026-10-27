import { BASE_SPEED, BEST_KEY, FIELD, MAX_SPEED, PERFECT_TOLERANCE, SPEED_STEP, drop, newGame, readBest, saveBest, speedFor, step, type PalletGame } from '@/lib/features/spells/pallets';

/** A game whose moving pallet sits at `x` above the given top. */
function at(x: number, top = { x: 20, width: 50 }): PalletGame {
  return { stack: [top], current: { x, width: top.width, dir: 1 }, speed: BASE_SPEED, score: 0, over: false };
}

describe('pallet stacking', () => {
  it('snaps a near-perfect drop onto the pallet below, keeping the full width', () => {
    const { game, result } = drop(at(20 + PERFECT_TOLERANCE / 2));
    expect(result.kind).toBe('perfect');
    expect(game.stack[1]).toEqual({ x: 20, width: 50 });
    expect(game.score).toBe(1);
    expect(game.current?.width).toBe(50);
  });

  it('trims the overhang on the right and returns the offcut', () => {
    const { game, result } = drop(at(32));
    expect(result).toEqual({ kind: 'cut', placed: { x: 32, width: 38 }, offcut: { x: 70, width: 12 } });
    expect(game.stack[1]).toEqual({ x: 32, width: 38 });
    expect(game.current?.width).toBe(38);
  });

  it('trims the overhang on the left', () => {
    const { game, result } = drop(at(5));
    expect(result).toEqual({ kind: 'cut', placed: { x: 20, width: 35 }, offcut: { x: 5, width: 15 } });
    expect(game.over).toBe(false);
  });

  it('ends the game when a pallet misses entirely', () => {
    const { game, result } = drop(at(70, { x: 0, width: 30 }));
    expect(result.kind).toBe('miss');
    expect(game.over).toBe(true);
    expect(game.score).toBe(0);
    expect(game.stack).toHaveLength(1);
    expect(drop(game).result.kind).toBe('none');
  });

  it('counts touching edges as a miss', () => {
    expect(drop(at(70, { x: 20, width: 50 })).result.kind).toBe('miss');
  });

  it('speeds up per pallet and caps the speed', () => {
    expect(speedFor(0)).toBe(BASE_SPEED);
    expect(speedFor(3)).toBe(BASE_SPEED + 3 * SPEED_STEP);
    expect(speedFor(1000)).toBe(MAX_SPEED);
    let game = newGame();
    for (let i = 0; i < 40; i += 1) {
      game = drop({ ...game, current: { ...game.current!, x: game.stack[game.stack.length - 1].x } }).game;
    }
    expect(game.score).toBe(40);
    expect(game.speed).toBe(MAX_SPEED);
  });

  it('bounces between the field edges and never leaves the field', () => {
    let game = newGame();
    const width = game.current!.width;
    for (let i = 0; i < 200; i += 1) {
      game = step(game, 0.37);
      expect(game.current!.x).toBeGreaterThanOrEqual(0);
      expect(game.current!.x).toBeLessThanOrEqual(FIELD - width);
    }
    expect(step(at(FIELD - 50 - 1), 1).current!.dir).toBe(-1);
  });

  it('alternates the side the next pallet comes from', () => {
    const first = newGame();
    expect(first.current).toMatchObject({ x: 0, dir: 1 });
    const second = drop({ ...first, current: { ...first.current!, x: first.stack[0].x } }).game;
    expect(second.current!.dir).toBe(-1);
    expect(second.current!.x + second.current!.width).toBe(FIELD);
  });

  it('keeps the best score and survives broken storage', () => {
    // jest.setup replaces localStorage with jest.fn()s; give it a real backing map here.
    const store = new Map<string, string>();
    const storage = window.localStorage as unknown as Record<'getItem' | 'setItem', jest.Mock>;
    storage.getItem.mockImplementation((key: string) => store.get(key) ?? null);
    storage.setItem.mockImplementation((key: string, value: string) => { store.set(key, value); });
    expect(readBest()).toBe(0);
    expect(saveBest(4)).toBe(4);
    expect(saveBest(2)).toBe(4);
    expect(store.get(BEST_KEY)).toBe('4');
    storage.getItem.mockImplementation(() => { throw new Error('blocked'); });
    storage.setItem.mockImplementation(() => { throw new Error('blocked'); });
    expect(readBest()).toBe(0);
    expect(saveBest(3)).toBe(3);
    storage.getItem.mockReset();
    storage.setItem.mockReset();
  });
});
