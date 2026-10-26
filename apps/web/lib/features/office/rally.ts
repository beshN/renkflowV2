/**
 * The racing game on the office's games screen, playable when the TV is clicked. Pure: the state
 * moves only through step(), so the component draws it and the tests drive it with the same clock.
 * The road runs from the horizon (depth 1) to the player (depth 0); x is the lateral position,
 * -1 at the left edge of the road and 1 at the right.
 */

export type RallyThing = { kind: 'car' | 'coffee'; x: number; depth: number; color: string };

export type RallyState = {
  phase: 'ready' | 'playing' | 'crashed';
  /** The player's lateral position. */
  x: number;
  /** Road units per second; rises as the run goes on. */
  speed: number;
  /** Metres driven this run. */
  distance: number;
  /** Bonus points from coffee picked up. */
  bonus: number;
  things: RallyThing[];
  /** Seconds until the next car or cup appears. */
  spawnIn: number;
  seed: number;
};

export const START_SPEED = 0.55;
export const MAX_SPEED = 1.6;
/** How fast the player slides sideways (road widths per second). */
export const STEER = 1.9;
export const COFFEE_POINTS = 100;
const CAR_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#e11d48', '#0ea5e9'];
/** Cars and the player are this wide on the road's -1..1 scale. */
const HIT_WIDTH = 0.42;
const HIT_DEPTH = 0.07;

export function newRally(seed = 1): RallyState {
  return { phase: 'ready', x: 0, speed: START_SPEED, distance: 0, bonus: 0, things: [], spawnIn: 0.6, seed };
}

export const score = (state: RallyState) => Math.floor(state.distance) + state.bonus;

function random(state: RallyState) {
  state.seed = (state.seed * 16807) % 2147483647;
  return state.seed / 2147483647;
}

export function start(state: RallyState): RallyState {
  return { ...newRally(state.seed), phase: 'playing' };
}

/**
 * Moves the run on by `seconds`. `steer` is -1 (left), 0 or 1 (right). Returns a new state; a
 * crash ends the run with the score kept.
 */
export function step(previous: RallyState, seconds: number, steer: -1 | 0 | 1): RallyState {
  if (previous.phase !== 'playing' || seconds <= 0) return previous;
  const state: RallyState = { ...previous, things: previous.things.map(t => ({ ...t })) };
  const dt = Math.min(seconds, 0.05);
  state.x = Math.max(-0.85, Math.min(0.85, state.x + steer * STEER * dt));
  state.speed = Math.min(MAX_SPEED, state.speed + dt * 0.02);
  state.distance += state.speed * dt * 120;

  for (const thing of state.things) thing.depth -= state.speed * dt * (thing.kind === 'car' ? 0.75 : 1);
  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    const coffee = random(state) < 0.18;
    const lane = [-0.6, 0, 0.6][Math.floor(random(state) * 3)];
    // Never a car straight in the lane of one just spawned, so there is always a way through.
    const blocked = state.things.some(t => t.kind === 'car' && t.depth > 0.85 && Math.abs(t.x - lane) < 0.3);
    if (!blocked) state.things.push({ kind: coffee ? 'coffee' : 'car', x: lane, depth: 1, color: CAR_COLORS[Math.floor(random(state) * CAR_COLORS.length)] });
    state.spawnIn = Math.max(0.35, 1.1 - state.speed * 0.45) * (0.7 + random(state) * 0.6);
  }

  const kept: RallyThing[] = [];
  for (const thing of state.things) {
    const near = thing.depth < HIT_DEPTH && thing.depth > -0.02 && Math.abs(thing.x - state.x) < HIT_WIDTH;
    if (near && thing.kind === 'car') { state.phase = 'crashed'; kept.push(thing); continue; }
    if (near && thing.kind === 'coffee') { state.bonus += COFFEE_POINTS; continue; }
    if (thing.depth > -0.1) kept.push(thing);
  }
  state.things = kept;
  return state;
}
