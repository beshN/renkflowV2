import {
  CRASH_CLOSING, EVENT, MAX_SPEED, NITRO_SPEED, OFF_ROAD_LIMIT, START_TIME, COFFEE_POINTS, OVERTAKE_POINTS, BEST_KEY,
  autopilot, checkpointBonus, isOffRoad, metres, newRally, placeAt, playerZ, readRallyBest, saveRallyBest, score, start, step,
  trafficCount, type RallyInput, type RallyState,
} from '@/lib/features/office/rally';
import {
  PLAYER_Z, SEGMENT_LENGTH, SPRITE_INFO, buildTrack, findSegment, findWhere, heightAt, overlap, trackDelta, wrapZ,
} from '@/lib/features/office/rally-track';

const STEP = 1 / 60;
const track = buildTrack();
const input = (steer = 0, brake = false, nitro = false): RallyInput => ({ steer, brake, nitro });

/** A run past the countdown, with no traffic unless a test adds some. */
function racing(seed = 1, empty = true): RallyState {
  const s = start(newRally(seed, 0, track));
  for (let t = 0; t < 3.1; t += STEP) step(s, STEP);
  if (empty) s.cars.length = 0;
  return s;
}

function drive(s: RallyState, seconds: number, how: RallyInput | ((s: RallyState) => RallyInput) = input()) {
  let events = 0;
  for (let t = 0; t < seconds; t += STEP) {
    step(s, STEP, typeof how === 'function' ? how(s) : how);
    events |= s.events;
  }
  return events;
}

/** Puts the car on a straight, flat bit of road with nothing beside it. */
function onStraight(s: RallyState, speed = MAX_SPEED * 0.8) {
  const at = findWhere(track, x => x.curve === 0 && x.y1 === x.y2 && x.sprites.length === 0 && !x.mark, 60);
  return placeAt(s, at, speed);
}

describe('rally track', () => {
  it('builds the same track for the same seed, with curves both ways and hills', () => {
    const again = buildTrack();
    expect(again.segments.length).toBe(track.segments.length);
    expect(again.segments.map(s => s.curve)).toEqual(track.segments.map(s => s.curve));
    expect(again.segments.flatMap(s => s.sprites.map(p => `${p.kind}${p.offset.toFixed(3)}`))).toEqual(track.segments.flatMap(s => s.sprites.map(p => `${p.kind}${p.offset.toFixed(3)}`)));
    expect(track.length).toBe(track.segments.length * SEGMENT_LENGTH);
    expect(track.segments.some(s => s.curve > 3)).toBe(true);
    expect(track.segments.some(s => s.curve < -3)).toBe(true);
    const heights = track.segments.map(s => s.y1);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(5000);
  });

  it('is a closed loop: heights join up and segments chain', () => {
    const last = track.segments[track.segments.length - 1];
    expect(Math.abs(last.y2 - track.segments[0].y1)).toBeLessThan(1);
    for (let i = 1; i < track.segments.length; i++) expect(track.segments[i].y1).toBe(track.segments[i - 1].y2);
  });

  it('has a start line, two checkpoints evenly round, every zone, and coffee', () => {
    expect(track.segments[0].mark).toBe('start');
    expect(track.checkpoints).toHaveLength(2);
    expect(track.checkpoints[0]).toBeCloseTo(track.length / 3, -3);
    expect(track.checkpoints[1]).toBeCloseTo((track.length * 2) / 3, -3);
    const zones = new Set(track.segments.map(s => s.zone));
    expect([...zones].sort()).toEqual(['city', 'coast', 'forest', 'industry']);
    expect(track.coffees).toBeGreaterThan(20);
    const ids = track.segments.flatMap(s => s.sprites.filter(p => p.kind === 'coffee').map(p => p.id));
    expect(ids.sort((a, b) => a - b)).toEqual(Array.from({ length: track.coffees }, (_, i) => i));
  });

  it('keeps roadside things off the road and coffee on it', () => {
    for (const s of track.segments) for (const p of s.sprites) {
      if (p.kind === 'coffee' || p.kind === 'gate' || p.kind === 'cone') expect(Math.abs(p.offset)).toBeLessThanOrEqual(1);
      else expect(Math.abs(p.offset)).toBeGreaterThan(1);
    }
  });

  it('looks segments up with wrapping, measures the short way round', () => {
    expect(findSegment(track, 0).index).toBe(0);
    expect(findSegment(track, SEGMENT_LENGTH * 3.5).index).toBe(3);
    expect(findSegment(track, track.length + SEGMENT_LENGTH).index).toBe(1);
    expect(findSegment(track, -1).index).toBe(track.segments.length - 1);
    expect(wrapZ(track, -10)).toBe(track.length - 10);
    expect(trackDelta(track, track.length - 100, 100)).toBe(200);
    expect(trackDelta(track, 100, track.length - 100)).toBe(-200);
    const s = track.segments[500];
    expect(heightAt(track, s.z + SEGMENT_LENGTH / 2)).toBeCloseTo((s.y1 + s.y2) / 2);
  });

  it('checks overlap by half widths', () => {
    expect(overlap(0, 0.3, 0.29, 0.3)).toBe(true);
    expect(overlap(0, 0.3, 0.31, 0.3)).toBe(false);
    expect(overlap(0, 0.3, 0.2, 0.3, 0.5)).toBe(false);
  });
});

describe('rally run', () => {
  it('waits on the title, counts down 3-2-1 and goes', () => {
    const ready = newRally(3, 0, track);
    expect(step(ready, 1).phase).toBe('ready');
    const s = start(ready);
    expect(s.phase).toBe('countdown');
    const events = drive(s, 3.05);
    expect(events & EVENT.tick).toBeTruthy();
    expect(events & EVENT.go).toBeTruthy();
    expect(s.phase).toBe('playing');
    expect(s.timeLeft).toBeGreaterThan(START_TIME - 0.2);
    expect(s.travelled).toBeLessThan(SEGMENT_LENGTH);
  });

  it('accelerates on its own up to top speed and scores the distance', () => {
    const s = onStraight(racing(), 0);
    drive(s, 6, x => { x.x = 0; return input(); });
    expect(s.speed).toBeCloseTo(MAX_SPEED, -2);
    expect(metres(s)).toBeGreaterThan(500);
    expect(score(s)).toBe(metres(s));
  });

  it('brakes', () => {
    const s = onStraight(racing(), MAX_SPEED);
    drive(s, 0.5, input(0, true));
    expect(s.speed).toBeLessThan(MAX_SPEED * 0.55);
  });

  it('steers, and the curves push the car outwards', () => {
    const s = onStraight(racing());
    drive(s, 0.3, input(1));
    expect(s.x).toBeGreaterThan(0.2);
    const bend = racing();
    placeAt(bend, findWhere(track, x => x.curve >= 4), MAX_SPEED);
    drive(bend, 0.4);
    expect(bend.x).toBeLessThan(-0.2);
  });

  it('slows down on the grass but keeps going', () => {
    const s = onStraight(racing(), MAX_SPEED);
    s.x = 1.6;
    drive(s, 4, x => { x.x = 1.6; return input(); });
    expect(isOffRoad(s)).toBe(true);
    expect(s.speed).toBeCloseTo(OFF_ROAD_LIMIT, -2);
  });

  it('spins after hitting a tree, then carries on with lost speed; never ends the run', () => {
    const s = racing();
    const at = findWhere(track, x => x.sprites.some(p => SPRITE_INFO[p.kind].solid && p.offset < -1.1 && p.offset > -1.4), 100);
    const sprite = track.segments[at].sprites.find(p => SPRITE_INFO[p.kind].solid && p.offset < -1.1)!;
    placeAt(s, at, MAX_SPEED);
    s.position = wrapZ(track, track.segments[at].z + 10 - PLAYER_Z);
    s.x = sprite.offset - SPRITE_INFO[sprite.kind].width / 2;
    step(s, STEP);
    expect(s.events & EVENT.crash).toBeTruthy();
    expect(s.spin).toBeGreaterThan(0);
    expect(s.speed).toBeLessThan(MAX_SPEED * 0.35);
    expect(s.phase).toBe('playing');
    drive(s, 3, input(1));
    expect(s.spin).toBe(0);
    expect(s.speed).toBeGreaterThan(MAX_SPEED * 0.3);
  });

  it('bumps a slower car gently, crashes into it fast, and is safe for a moment after', () => {
    const s = onStraight(racing());
    const car = { z: wrapZ(track, playerZ(s) + 40), x: 0, speed: MAX_SPEED * 0.65, color: 0, model: 0, rel: 40, passed: false };
    s.cars.push(car);
    s.speed = MAX_SPEED * 0.75;
    step(s, STEP);
    expect(s.events & EVENT.bump).toBeTruthy();
    expect(s.speed).toBeLessThan(car.speed);
    expect(trackDelta(track, playerZ(s), car.z)).toBeGreaterThan(0);

    const fast = onStraight(racing());
    const slow = { ...car, z: wrapZ(track, playerZ(fast) + 40), speed: MAX_SPEED * 0.3 };
    fast.cars.push(slow);
    fast.speed = slow.speed + CRASH_CLOSING + 1000;
    step(fast, STEP);
    expect(fast.events & EVENT.crash).toBeTruthy();
    expect(fast.safe).toBeGreaterThan(1);
    // Ghosting through the traffic while safe: no second hit.
    slow.z = wrapZ(track, playerZ(fast) + 100);
    step(fast, STEP);
    expect(fast.events & (EVENT.crash | EVENT.bump)).toBe(0);
  });

  it('counts overtakes once per car', () => {
    const s = onStraight(racing(), MAX_SPEED);
    s.cars.push({ z: wrapZ(track, playerZ(s) + 400), x: 0.66, speed: MAX_SPEED * 0.3, color: 0, model: 0, rel: 400, passed: false });
    const events = drive(s, 1, x => { x.x = -0.6; return input(); });
    expect(events & EVENT.overtake).toBeTruthy();
    expect(s.overtakes).toBe(1);
    expect(score(s)).toBe(metres(s) + OVERTAKE_POINTS);
  });

  it('drinks coffee once a lap: points, nitro and a push', () => {
    const s = racing();
    const at = findWhere(track, x => x.sprites.some(p => p.kind === 'coffee'));
    const cup = track.segments[at].sprites.find(p => p.kind === 'coffee')!;
    placeAt(s, at - 2, MAX_SPEED * 0.5);
    s.x = cup.offset;
    const events = drive(s, 0.2, x => { x.x = cup.offset; return input(); });
    expect(events & EVENT.coffee).toBeTruthy();
    expect(s.coffees).toBeGreaterThanOrEqual(1);
    expect(s.nitro).toBeGreaterThan(0);
    expect(s.collected[cup.id]).toBe(1);
    const coffees = s.coffees;
    placeAt(s, at - 2, MAX_SPEED * 0.5);
    drive(s, 0.2, x => { x.x = cup.offset; return input(); });
    expect(s.coffees).toBe(coffees);
    expect(score(s)).toBeGreaterThanOrEqual(coffees * COFFEE_POINTS);
  });

  it('burns nitro for more top speed while there is some', () => {
    const s = onStraight(racing(), MAX_SPEED);
    s.nitro = 0.5;
    const events = drive(s, 1, x => { x.x = 0; return input(0, false, true); });
    expect(events & EVENT.nitro).toBeTruthy();
    expect(s.speed).toBeGreaterThan(MAX_SPEED * 1.1);
    expect(s.speed).toBeLessThanOrEqual(MAX_SPEED * NITRO_SPEED);
    expect(s.nitro).toBeLessThan(0.2);
    drive(s, 3, x => { x.x = 0; return input(0, false, true); });
    expect(s.nitro).toBe(0);
    expect(s.boosting).toBe(false);
    expect(s.speed).toBeLessThan(MAX_SPEED * 1.05);
  });

  it('adds time at checkpoints and at the start line, a new lap with more traffic and less time', () => {
    const s = racing(1, false);
    placeAt(s, track.checkpoints[0] / SEGMENT_LENGTH - 2, MAX_SPEED);
    const before = s.timeLeft;
    const events = drive(s, 0.1);
    expect(events & EVENT.checkpoint).toBeTruthy();
    expect(s.timeLeft).toBeGreaterThan(before + checkpointBonus(1) - 1);

    const cars = s.cars.length;
    s.travelled = track.length * 0.9;
    placeAt(s, track.segments.length - 6, MAX_SPEED);
    const lapEvents = drive(s, 0.2);
    expect(lapEvents & EVENT.lap).toBeTruthy();
    expect(s.lap).toBe(2);
    expect(s.cars.length).toBe(trafficCount(2));
    expect(s.cars.length).toBeGreaterThan(cars);
    expect(checkpointBonus(2)).toBeLessThan(checkpointBonus(1));
    expect(checkpointBonus(10)).toBe(8);
  });

  it('ends when the time runs out, keeps the score, and the car rolls to a stop', () => {
    const s = onStraight(racing(), MAX_SPEED);
    s.timeLeft = 0.5;
    const events = drive(s, 1);
    expect(events & EVENT.over).toBeTruthy();
    expect(s.phase).toBe('over');
    const final = score(s);
    drive(s, 10, input(1, false, true));
    expect(score(s)).toBe(final);
    expect(s.speed).toBe(0);
  });

  it('flags a new record once during the run when the score passes the old best', () => {
    const s = start(newRally(2, 300, track));
    let records = 0;
    for (let t = 0; t < 10; t += STEP) { step(s, STEP, autopilot(s)); if (s.events & EVENT.record) records++; }
    expect(records).toBe(1);
    expect(s.beaten).toBe(true);
  });

  it('plays the same for the same seed: an autopilot run is deterministic and lasts a few laps', () => {
    const play = (seed: number) => {
      const s = start(newRally(seed, 0, track));
      const how = input();
      for (let i = 0; i < 60 * 400 && s.phase !== 'over'; i++) step(s, STEP, autopilot(s, how));
      return s;
    };
    const a = play(7), b = play(7);
    expect(score(a)).toBe(score(b));
    expect(a.phase).toBe('over');
    expect(a.lap).toBeGreaterThanOrEqual(2);
    expect(a.overtakes).toBeGreaterThan(3);
    expect(a.coffees).toBeGreaterThan(3);
  });

  it('a new run keeps the record to beat', () => {
    const s = racing();
    s.timeLeft = 0.01;
    drive(s, 2);
    const next = start(s);
    expect(next.phase).toBe('countdown');
    expect(next.best).toBe(score(s));
    expect(next.coffees).toBe(0);
  });
});

describe('rally record on this device', () => {
  it('reads and saves the best under the same key as before', () => {
    const storage = localStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock };
    storage.getItem.mockReturnValueOnce(null);
    expect(readRallyBest()).toBe(0);
    saveRallyBest(4250.7);
    expect(BEST_KEY).toBe('renkflow.rally.best');
    expect(storage.setItem).toHaveBeenCalledWith(BEST_KEY, '4250');
    storage.getItem.mockReturnValueOnce('4250');
    expect(readRallyBest()).toBe(4250);
    storage.getItem.mockImplementationOnce(() => { throw new Error('blocked'); });
    expect(readRallyBest()).toBe(0);
  });
});

