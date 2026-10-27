/**
 * The racing game on the office's games screen, playable when the TV is clicked: a time attack
 * round the track in rally-track.ts. The state moves only through step(), which changes it in
 * place (no allocations in the game loop), so the page draws it and the tests drive it with the
 * same clock. Physics after the classic OutRun-style racers: the car accelerates on its own, the
 * curves push it outwards, the grass slows it, trees and traffic spin it round but never end the
 * run; only the clock does, and checkpoints add time.
 */

import {
  LANE_X, PLAYER_Z, SEGMENT_LENGTH, SPRITE_INFO, buildTrack, findSegment, overlap, trackDelta, wrapZ,
  type Track,
} from './rally-track';

/** Top speed: one segment per frame at 60 fps. */
export const MAX_SPEED = SEGMENT_LENGTH * 60;
export const ACCEL = MAX_SPEED / 5;
export const BRAKE = -MAX_SPEED;
export const DECEL = -MAX_SPEED / 5;
export const OFF_ROAD_DECEL = -MAX_SPEED / 2;
/** On the grass the car cannot go faster than this. */
export const OFF_ROAD_LIMIT = MAX_SPEED / 4;
/** How hard the curves push the car outwards. */
export const CENTRIFUGAL = 0.3;
/** Nitro: top speed and acceleration while it burns, and how fast it burns (meter per second). */
export const NITRO_SPEED = 1.32;
export const NITRO_ACCEL = 1.8;
export const NITRO_BURN = 0.4;
/** Each coffee fills this much of the nitro meter and gives a small push. */
export const COFFEE_NITRO = 0.2;
export const COFFEE_PUSH = MAX_SPEED * 0.06;
export const COFFEE_POINTS = 250;
export const OVERTAKE_POINTS = 200;
/** Metres scored per segment driven. */
export const METRES_PER_SEGMENT = 4;
export const START_TIME = 32;
export const COUNTDOWN = 3;
/** A spin after a crash lasts this long; afterwards the car is safe from hits for a moment. */
export const SPIN_TIME = 0.9;
export const SAFE_TIME = 1.3;
/** The player's car and the traffic, in offsets. */
export const PLAYER_W = 0.3;
export const CAR_W = 0.3;
/** A hit closing faster than this spins the car; slower, it just bumps and loses speed. */
export const CRASH_CLOSING = MAX_SPEED * 0.3;
export const MAX_X = 2.2;

/** What happened during a step, as bits: the page plays sounds and particles from them. */
export const EVENT = {
  coffee: 1, crash: 2, checkpoint: 4, lap: 8, overtake: 16, bump: 32, go: 64, tick: 128, over: 256, nitro: 512, record: 1024,
} as const;

export const CAR_COLORS = ['#2563eb', '#f59e0b', '#16a34a', '#9333ea', '#0891b2', '#f8fafc', '#facc15', '#db2777'] as const;

export type Car = {
  z: number;
  x: number;
  speed: number;
  color: number;
  /** 0 a saloon, 1 a van, 2 a little sports car. */
  model: number;
  /** Where the car was relative to the player last step (positive: ahead). */
  rel: number;
  /** Already counted as overtaken; cleared once the car is far away. */
  passed: boolean;
};

export type RallyPhase = 'ready' | 'countdown' | 'playing' | 'over';

export type RallyState = {
  phase: RallyPhase;
  track: Track;
  /** The camera's z; the player's car is PLAYER_Z ahead of it. */
  position: number;
  /** The car's place across the road: -1..1 is tarmac. */
  x: number;
  speed: number;
  /** The steering as drawn: eases towards the input, -1..1. */
  steer: number;
  countdown: number;
  timeLeft: number;
  /** Seconds since the green light; seconds since the end while over. */
  elapsed: number;
  lap: number;
  /** World units driven this run. */
  travelled: number;
  coffees: number;
  overtakes: number;
  nitro: number;
  boosting: boolean;
  spin: number;
  safe: number;
  /** The time the last checkpoint gave, and seconds since (for the banner). */
  bonus: number;
  bonusAge: number;
  /** The record to beat, set when the run starts; `beaten` once the score passes it. */
  best: number;
  beaten: boolean;
  cars: Car[];
  /** Per coffee cup, the lap it was drunk on (0: not yet). */
  collected: Int32Array;
  /** Bits of EVENT, for the last step only. */
  events: number;
  seed: number;
};

export type RallyInput = { steer: number; brake: boolean; nitro: boolean };
export const NO_INPUT: RallyInput = { steer: 0, brake: false, nitro: false };

/** The time a checkpoint gives on `lap`: less every lap, never under eight seconds. */
export const checkpointBonus = (lap: number) => Math.max(8, 14 - 2 * (lap - 1));
/** Traffic on `lap`: more cars every lap. */
export const trafficCount = (lap: number) => Math.min(40, 16 + 6 * (lap - 1));

let sharedTrack: Track | null = null;
/** The one track every run uses; built once. */
export const defaultTrack = () => (sharedTrack ??= buildTrack());

export function newRally(seed = 1, best = 0, track: Track = defaultTrack()): RallyState {
  const state: RallyState = {
    phase: 'ready', track, position: 0, x: 0, speed: 0, steer: 0, countdown: COUNTDOWN, timeLeft: START_TIME, elapsed: 0,
    lap: 1, travelled: 0, coffees: 0, overtakes: 0, nitro: 0, boosting: false, spin: 0, safe: 0, bonus: 0, bonusAge: 99,
    best, beaten: false, cars: [], collected: new Int32Array(track.coffees), events: 0, seed: Math.abs(Math.floor(seed)) || 1,
  };
  addTraffic(state, trafficCount(1));
  return state;
}

export const playerZ = (state: RallyState) => wrapZ(state.track, state.position + PLAYER_Z);
export const metres = (state: RallyState) => Math.floor((state.travelled / SEGMENT_LENGTH) * METRES_PER_SEGMENT);
export const score = (state: RallyState) => Math.max(0, metres(state)) + state.coffees * COFFEE_POINTS + state.overtakes * OVERTAKE_POINTS;
export const isOffRoad = (state: RallyState) => Math.abs(state.x) > 1;
/** km/h on the speedometer. */
export const kmh = (state: RallyState) => Math.round((state.speed / MAX_SPEED) * 240);

function random(state: RallyState) {
  state.seed = (state.seed * 16807) % 2147483647;
  return (state.seed - 1) / 2147483646;
}

/** Traffic speed on `lap`: from a crawl to near top speed, a bit quicker every lap. */
const carSpeed = (state: RallyState) => MAX_SPEED * Math.min(0.85, (0.3 + random(state) * 0.35) * (1 + 0.1 * (state.lap - 1)));

/** Cars spread round the track, never right on top of the player. */
function addTraffic(state: RallyState, count: number) {
  const { track } = state;
  const me = playerZ(state);
  while (state.cars.length < count) {
    let z = 0;
    for (let tries = 0; tries < 20; tries++) {
      z = Math.floor(random(state) * track.length);
      const d = trackDelta(track, me, z);
      if (d > SEGMENT_LENGTH * 40 || d < -SEGMENT_LENGTH * 20) break;
    }
    state.cars.push({
      z, x: LANE_X[Math.floor(random(state) * 3)] + (random(state) - 0.5) * 0.2, speed: carSpeed(state),
      color: Math.floor(random(state) * CAR_COLORS.length), model: Math.floor(random(state) * 3), rel: trackDelta(track, me, z), passed: false,
    });
  }
}

/** Starts the countdown (from ready, or a new run after the end). */
export function start(state: RallyState): RallyState {
  const next = newRally(state.seed, Math.max(state.best, state.phase === 'over' ? score(state) : 0), state.track);
  next.phase = 'countdown';
  return next;
}

const accelerate = (v: number, a: number, dt: number) => v + a * dt;

/**
 * Moves the run on by `dt` seconds (the page calls it at a fixed 1/60 s). Changes `state` in
 * place and returns it; `state.events` says what happened.
 */
export function step(state: RallyState, dt: number, input: RallyInput = NO_INPUT): RallyState {
  state.events = 0;
  if (state.phase === 'ready' || dt <= 0) return state;
  dt = Math.min(dt, 0.05);
  const { track } = state;

  if (state.phase === 'countdown') {
    const before = Math.ceil(state.countdown);
    state.countdown -= dt;
    if (Math.ceil(state.countdown) !== before && state.countdown > 0) state.events |= EVENT.tick;
    if (state.countdown <= 0) { state.phase = 'playing'; state.elapsed = 0; state.events |= EVENT.go; }
    updateCars(state, dt);
    return state;
  }

  const over = state.phase === 'over';
  state.elapsed += dt;
  state.bonusAge += dt;
  const startZ = playerZ(state);
  const segment = findSegment(track, startZ);
  const percent = state.speed / MAX_SPEED;
  const steer = over || state.spin > 0 ? 0 : Math.max(-1, Math.min(1, input.steer));
  state.steer += (steer - state.steer) * Math.min(1, dt * 8);

  // Steering, and the curve pushing the car outwards the faster it goes.
  const dx = dt * 2 * Math.min(1, percent);
  state.x += steer * dx;
  state.x -= dx * Math.min(1, percent) * segment.curve * CENTRIFUGAL;

  // Nitro burns while held and there is some left.
  const wasBoosting = state.boosting;
  state.boosting = !over && state.spin <= 0 && input.nitro && state.nitro > 0;
  if (state.boosting) {
    state.nitro = Math.max(0, state.nitro - NITRO_BURN * dt);
    if (!wasBoosting) state.events |= EVENT.nitro;
  }
  const top = state.boosting ? MAX_SPEED * NITRO_SPEED : MAX_SPEED;

  if (over || state.spin > 0) state.speed = accelerate(state.speed, DECEL * (state.spin > 0 ? 1 : 1.5), dt);
  else if (input.brake) state.speed = accelerate(state.speed, BRAKE, dt);
  else if (state.speed < top) state.speed = Math.min(top, accelerate(state.speed, ACCEL * (state.boosting ? NITRO_ACCEL : 1), dt));
  else state.speed = Math.max(top, accelerate(state.speed, DECEL, dt));
  if (isOffRoad(state) && state.speed > OFF_ROAD_LIMIT) state.speed = Math.max(OFF_ROAD_LIMIT, accelerate(state.speed, OFF_ROAD_DECEL, dt));
  state.spin = Math.max(0, state.spin - dt);
  state.safe = Math.max(0, state.safe - dt);

  // Roadside things: a tree or a lamp post spins the car (never at the start of a safe spell).
  if (!over && state.safe <= 0 && Math.abs(state.x) > 0.8) {
    for (const sprite of segment.sprites) {
      const info = SPRITE_INFO[sprite.kind];
      if (!info.solid) continue;
      if (overlap(state.x, PLAYER_W, sprite.offset + (sprite.align * info.width) / 2, info.hit)) {
        crash(state, state.speed * 0.3);
        state.x = Math.sign(state.x) * Math.max(0.6, Math.abs(state.x) - 0.25);
        break;
      }
    }
  }

  updateCars(state, dt);

  // Traffic: running into the back of a car bumps (or, fast, spins) the player behind it.
  const me = wrapZ(track, state.position + PLAYER_Z);
  if (!over && state.safe <= 0) {
    for (const car of state.cars) {
      const d = trackDelta(track, me, car.z);
      if (d < 0 || d > SEGMENT_LENGTH || state.speed <= car.speed || !overlap(state.x, PLAYER_W, car.x, CAR_W, 0.9)) continue;
      const closing = state.speed - car.speed;
      if (closing > CRASH_CLOSING) crash(state, car.speed * 0.6);
      else { state.speed = car.speed * 0.85; state.events |= EVENT.bump; }
      state.position = wrapZ(track, car.z - PLAYER_Z - 2 - (state.speed * dt));
      break;
    }
  }

  // Coffee cups on this segment: drunk on the way through, once a lap.
  if (!over) {
    for (const sprite of segment.sprites) {
      if (sprite.kind !== 'coffee' || state.collected[sprite.id] === state.lap) continue;
      if (!overlap(state.x, PLAYER_W, sprite.offset, SPRITE_INFO.coffee.hit)) continue;
      state.collected[sprite.id] = state.lap;
      state.coffees++;
      state.nitro = Math.min(1, state.nitro + COFFEE_NITRO);
      state.speed = Math.min(MAX_SPEED * NITRO_SPEED, state.speed + COFFEE_PUSH);
      state.events |= EVENT.coffee;
    }
  }

  state.x = Math.max(-MAX_X, Math.min(MAX_X, state.x));
  state.speed = Math.max(0, Math.min(MAX_SPEED * NITRO_SPEED, state.speed));
  state.position = wrapZ(track, state.position + dt * state.speed);
  const endZ = playerZ(state);
  if (!over) state.travelled += trackDelta(track, startZ, endZ);

  // Overtakes: a car that goes from ahead to just behind the player.
  for (const car of state.cars) {
    const rel = trackDelta(track, endZ, car.z);
    if (car.rel > 0 && rel <= 0 && rel > -SEGMENT_LENGTH * 10 && !car.passed && !over) {
      car.passed = true;
      state.overtakes++;
      state.events |= EVENT.overtake;
    }
    if (Math.abs(rel) > track.length / 4) car.passed = false;
    car.rel = rel;
  }

  if (!over) {
    // Checkpoints, and the start line (a new lap, more traffic) when the z wraps round.
    for (const z of track.checkpoints) if (startZ < z && endZ >= z) checkpoint(state);
    if (endZ < startZ && state.travelled > track.length / 2) {
      state.lap++;
      checkpoint(state);
      state.events |= EVENT.lap;
      addTraffic(state, trafficCount(state.lap));
    }
    if (!state.beaten && state.best > 0 && score(state) > state.best) { state.beaten = true; state.events |= EVENT.record; }
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) { state.phase = 'over'; state.elapsed = 0; state.boosting = false; state.events |= EVENT.over; }
  }
  return state;
}

function crash(state: RallyState, speed: number) {
  state.spin = SPIN_TIME;
  state.safe = SPIN_TIME + SAFE_TIME;
  state.speed = Math.min(state.speed, speed);
  state.boosting = false;
  state.events |= EVENT.crash;
}

function checkpoint(state: RallyState) {
  state.bonus = checkpointBonus(state.lap);
  state.timeLeft += state.bonus;
  state.bonusAge = 0;
  state.events |= EVENT.checkpoint;
}

/** Traffic drives on, steering round slower cars and the player when catching up with them. */
function updateCars(state: RallyState, dt: number) {
  const { track, cars } = state;
  const me = playerZ(state);
  for (const car of cars) {
    let dir = 0, nearest = 21;
    const near = Math.abs(trackDelta(track, me, car.z)) < SEGMENT_LENGTH * 250;
    if (near) {
      // The player counts as a car in the way when the car is the faster one.
      const dp = trackDelta(track, car.z, me);
      if (dp > 0 && dp < SEGMENT_LENGTH * 20 && car.speed > state.speed && overlap(state.x, PLAYER_W, car.x, CAR_W, 1.2)) {
        nearest = Math.ceil(dp / SEGMENT_LENGTH);
        dir = state.x > 0.5 ? -1 : state.x < -0.5 ? 1 : car.x > state.x ? 1 : -1;
      }
      for (const other of cars) {
        if (other === car || other.speed >= car.speed) continue;
        const d = trackDelta(track, car.z, other.z);
        if (d <= 0 || d >= SEGMENT_LENGTH * 20 || !overlap(car.x, CAR_W, other.x, CAR_W, 1.2)) continue;
        const i = Math.ceil(d / SEGMENT_LENGTH);
        if (i < nearest) { nearest = i; dir = other.x > 0.5 ? -1 : other.x < -0.5 ? 1 : car.x > other.x ? 1 : -1; }
      }
    }
    if (dir !== 0) car.x += (dir / nearest) * ((car.speed - Math.min(car.speed, state.speed)) / MAX_SPEED + 0.25) * dt * 6;
    else if (car.x < -0.85) car.x += dt * 0.3;
    else if (car.x > 0.85) car.x -= dt * 0.3;
    car.x = Math.max(-0.9, Math.min(0.9, car.x));
    car.z = wrapZ(track, car.z + car.speed * dt);
  }
}

/**
 * A simple driver: keeps to the lane with the most room ahead and leans into the curves. Drives
 * the demo behind the start screen; the tests use it to play whole runs.
 */
export function autopilot(state: RallyState, out: RallyInput = { steer: 0, brake: false, nitro: false }): RallyInput {
  const { track } = state;
  const me = playerZ(state);
  let target = 0, room = -1;
  for (const lane of LANE_X) {
    let free = SEGMENT_LENGTH * 40;
    for (const car of state.cars) {
      const d = trackDelta(track, me, car.z);
      if (d > -SEGMENT_LENGTH && d < free && overlap(lane, PLAYER_W, car.x, CAR_W, 1.6)) free = d;
    }
    // Staying put wins a tie, so the car does not weave for nothing.
    const value = free + (Math.abs(lane - state.x) < 0.3 ? SEGMENT_LENGTH * 3 : 0);
    if (value > room) { room = value; target = lane; }
  }
  const curve = findSegment(track, me + SEGMENT_LENGTH * 3).curve;
  const want = (target - state.x) * 5 + curve * CENTRIFUGAL * 0.9;
  out.steer = Math.abs(want) < 0.15 ? 0 : Math.max(-1, Math.min(1, want));
  out.brake = room < SEGMENT_LENGTH * 4 && state.speed > MAX_SPEED * 0.5;
  out.nitro = state.nitro > 0.6 && Math.abs(curve) < 1;
  return out;
}

// ---- The record kept on this device ---------------------------------------------------------

export const BEST_KEY = 'renkflow.rally.best';

export function readRallyBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

export function saveRallyBest(best: number) {
  try { localStorage.setItem(BEST_KEY, String(Math.floor(best))); } catch { /* the record just is not kept */ }
}

/** Debug helper for screenshots and tests: puts the car at segment `index`, at speed. */
export function placeAt(state: RallyState, index: number, speed = MAX_SPEED * 0.9) {
  state.position = wrapZ(state.track, index * SEGMENT_LENGTH - PLAYER_Z);
  state.speed = speed;
  const me = playerZ(state);
  for (const car of state.cars) { car.rel = trackDelta(state.track, me, car.z); car.passed = false; }
  return state;
}

