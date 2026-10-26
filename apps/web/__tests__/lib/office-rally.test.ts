import { COFFEE_POINTS, MAX_SPEED, newRally, score, start, step, type RallyState } from '@/lib/features/office/rally';

const drive = (state: RallyState, seconds: number, steer: -1 | 0 | 1 = 0) => {
  for (let t = 0; t < seconds; t += 1 / 60) state = step(state, 1 / 60, steer);
  return state;
};

describe('office racing game', () => {
  it('waits for a key, then drives and scores distance', () => {
    const ready = newRally(3);
    expect(step(ready, 1, 0)).toBe(ready);
    const run = drive({ ...start(ready), things: [], spawnIn: 99 }, 2);
    expect(run.phase).toBe('playing');
    expect(score(run)).toBeGreaterThan(100);
  });

  it('ends the run on hitting a car and keeps the score', () => {
    const run = drive({ ...start(newRally(1)), spawnIn: 99, things: [{ kind: 'car', x: 0, depth: 0.2, color: '#000' }] }, 2);
    expect(run.phase).toBe('crashed');
    const after = step(run, 1, 1);
    expect(after).toBe(run);
  });

  it('steers round a car in the other lane and picks up coffee', () => {
    const run = drive({ ...start(newRally(1)), spawnIn: 99, x: 0.6, things: [{ kind: 'car', x: -0.6, depth: 0.2, color: '#000' }, { kind: 'coffee', x: 0.6, depth: 0.25, color: '#fff' }] }, 2);
    expect(run.phase).toBe('playing');
    expect(run.bonus).toBe(COFFEE_POINTS);
    expect(run.things).toHaveLength(0);
  });

  it('keeps the car on the road and the speed under the cap', () => {
    const run = drive({ ...start(newRally(1)), spawnIn: 1e9, speed: MAX_SPEED - 0.001 }, 3, 1);
    expect(run.x).toBeLessThanOrEqual(0.85);
    expect(run.speed).toBeLessThanOrEqual(MAX_SPEED);
  });

  it('always leaves a lane open: never two fresh cars side by side in one lane', () => {
    let run = start(newRally(42));
    for (let t = 0; t < 120 && run.phase === 'playing'; t += 1 / 60) {
      run = step(run, 1 / 60, 0);
      const fresh = run.things.filter(c => c.kind === 'car' && c.depth > 0.85);
      for (const a of fresh) for (const b of fresh) if (a !== b) expect(Math.abs(a.x - b.x) >= 0.3 || Math.abs(a.depth - b.depth) > 0.0001).toBe(true);
    }
  });
});
