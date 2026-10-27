/**
 * The racing game's track: an OutRun-style road made of short straight segments, each one a
 * little curved (it shifts the road sideways for the segments after it) and at its own height,
 * so a projection segment by segment gives curves and hills. Pure and deterministic for a seed:
 * the page draws it, the tests drive it.
 *
 * Units: z runs along the track (SEGMENT_LENGTH per segment), x across it in "offsets" where
 * -1 and 1 are the road's edges, y up in the same units as z.
 */

export const SEGMENT_LENGTH = 200;
/** Segments per rumble strip / lane mark: they alternate light and dark every this many. */
export const RUMBLE_LENGTH = 3;
/** Half the road's width in world units; offsets are in multiples of it. */
export const ROAD_WIDTH = 2000;
export const LANES = 3;
export const CAMERA_HEIGHT = 1000;
export const FIELD_OF_VIEW = 100;
/** Distance from the eye to the projection plane. */
export const CAMERA_DEPTH = 1 / Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180);
/** How far ahead of the camera the player's car sits. */
export const PLAYER_Z = CAMERA_HEIGHT * CAMERA_DEPTH;
/** Lane centres as offsets. */
export const LANE_X = [-2 / 3, 0, 2 / 3] as const;

export type SpriteKind = 'tree' | 'pine' | 'bush' | 'lamp' | 'billboard' | 'building' | 'gate' | 'post' | 'coffee' | 'cone';

/** What each kind of roadside thing is, in offsets: drawn width, which way it extends from its
 * offset (-1 left, 0 centred, 1 right; set per sprite for roadside things), its solid width. */
export const SPRITE_INFO: Record<SpriteKind, { width: number; hit: number; solid: boolean }> = {
  tree: { width: 1.3, hit: 0.35, solid: true },
  pine: { width: 0.9, hit: 0.3, solid: true },
  bush: { width: 0.7, hit: 0, solid: false },
  lamp: { width: 0.36, hit: 0.14, solid: true },
  billboard: { width: 1.9, hit: 1.5, solid: true },
  building: { width: 2.6, hit: 2.4, solid: true },
  gate: { width: 2.9, hit: 0, solid: false },
  /** The checkpoint gate's legs: never drawn (the gate draws them), only hit. */
  post: { width: 0.2, hit: 0.2, solid: true },
  coffee: { width: 0.24, hit: 0.24, solid: false },
  cone: { width: 0.16, hit: 0.14, solid: true },
};

export type TrackSprite = {
  kind: SpriteKind;
  /** The near edge for roadside things (they extend away from the road), the centre otherwise. */
  offset: number;
  /** -1 extends left of offset, 1 right, 0 centred. */
  align: -1 | 0 | 1;
  /** Which picture of its kind (billboard text, building, tree colour). */
  variant: number;
  /** Coffee cups' index into the run's collected list; -1 for everything else. */
  id: number;
};

/** The part of the course a segment belongs to: what lines the road there. */
export const ZONES = ['city', 'industry', 'forest', 'coast'] as const;
export type Zone = (typeof ZONES)[number];

export type Segment = {
  index: number;
  /** World z where the segment starts. */
  z: number;
  /** World heights at the segment's start and end. */
  y1: number;
  y2: number;
  /** How much the road bends from here on (positive bends right). */
  curve: number;
  /** Light or dark band for the rumble strips, lane marks and grass. */
  light: boolean;
  zone: Zone;
  /** 'start' for the start/finish line, 'checkpoint' under a checkpoint gate. */
  mark: 'start' | 'checkpoint' | null;
  sprites: TrackSprite[];
};

export type Track = {
  segments: Segment[];
  /** Total length in world units; z wraps round it. */
  length: number;
  /** World z of the checkpoints after the start line, in order. */
  checkpoints: number[];
  /** Coffee cups on the track; their ids run 0..coffees-1. */
  coffees: number;
};

export const CURVE = { none: 0, easy: 2, medium: 4, hard: 6 } as const;
export const HILL = { none: 0, low: 20, medium: 40, high: 60 } as const;
export const LENGTH = { short: 15, medium: 30, long: 60 } as const;

/** Billboards along the road; the page draws these texts. */
export const BILLBOARDS = [
  ['RenkFlow', 'Profil kesimi 0 fire'],
  ['Kahve molası', '2 km'],
  ['Mesai bitti mi?', 'Bir tur daha!'],
  ['RenkFlow', 'Sipariş → Üretim → Teslim'],
  ['Dikkat', 'Müdür yolda'],
  ['Boya fırını', 'Sağdan 3. çıkış'],
] as const;

/** A small seeded generator (Park–Miller), so a seed always builds the same track. */
export function makeRandom(seed: number) {
  let s = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const easeIn = (a: number, b: number, p: number) => a + (b - a) * p ** 2;
const easeInOut = (a: number, b: number, p: number) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

export function buildTrack(seed = 7): Track {
  const random = makeRandom(seed);
  const segments: Segment[] = [];
  const lastY = () => (segments.length ? segments[segments.length - 1].y2 : 0);
  const add = (curve: number, y: number) => {
    const n = segments.length;
    segments.push({
      index: n, z: n * SEGMENT_LENGTH, y1: lastY(), y2: y, curve,
      light: Math.floor(n / RUMBLE_LENGTH) % 2 === 0, zone: 'city', mark: null, sprites: [],
    });
  };
  const road = (enter: number, hold: number, leave: number, curve: number, hill: number) => {
    const startY = lastY(), endY = startY + hill * SEGMENT_LENGTH, total = enter + hold + leave;
    for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(startY, endY, (n + 1) / total));
    for (let n = 0; n < hold; n++) add(curve, easeInOut(startY, endY, (enter + n + 1) / total));
    for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n + 1) / total));
  };
  const straight = (n: number) => road(n, n, n, 0, 0);
  const hill = (n: number, height: number) => road(n, n, n, 0, height);
  const curve = (n: number, bend: number, height = 0) => road(n, n, n, bend, height);
  const rolling = (height: number) => {
    road(LENGTH.short, LENGTH.short, LENGTH.short, 0, height / 2);
    road(LENGTH.short, LENGTH.short, LENGTH.short, 0, -height);
    road(LENGTH.short, LENGTH.short, LENGTH.short, CURVE.easy, height);
    road(LENGTH.short, LENGTH.short, LENGTH.short, 0, 0);
    road(LENGTH.short, LENGTH.short, LENGTH.short, -CURVE.easy, height / 2);
    road(LENGTH.short, LENGTH.short, LENGTH.short, 0, 0);
  };
  const sCurves = () => {
    road(LENGTH.medium, LENGTH.medium, LENGTH.medium, -CURVE.easy, HILL.none);
    road(LENGTH.medium, LENGTH.medium, LENGTH.medium, CURVE.medium, HILL.medium);
    road(LENGTH.medium, LENGTH.medium, LENGTH.medium, CURVE.easy, -HILL.low);
    road(LENGTH.medium, LENGTH.medium, LENGTH.medium, -CURVE.easy, HILL.medium);
    road(LENGTH.medium, LENGTH.medium, LENGTH.medium, -CURVE.medium, -HILL.medium);
  };
  const bumps = () => {
    for (const h of [5, -2, -5, 8, 5, -7, 5, -2]) road(10, 10, 10, 0, h);
  };

  // The course: out of the city on a long straight, through the factory district, up into the
  // hills and the forest, along the coast and back down into town.
  straight(LENGTH.short);
  rolling(HILL.low);
  curve(LENGTH.medium, CURVE.medium, HILL.low);
  const city = segments.length;
  curve(LENGTH.long, -CURVE.medium, HILL.medium);
  hill(LENGTH.medium, HILL.high);
  sCurves();
  const industry = segments.length;
  curve(LENGTH.long, CURVE.medium, HILL.none);
  hill(LENGTH.long, HILL.high);
  curve(LENGTH.long, CURVE.hard, -HILL.low);
  const forest = segments.length;
  straight(LENGTH.medium);
  curve(LENGTH.long, -CURVE.hard, HILL.low);
  bumps();
  const coast = segments.length;
  curve(LENGTH.medium, CURVE.easy, -HILL.low);
  // Back down to the start's height, so the lap closes.
  road(LENGTH.medium, LENGTH.medium, LENGTH.medium, -CURVE.easy, -lastY() / SEGMENT_LENGTH);

  const total = segments.length;
  for (const s of segments) {
    s.zone = s.index < city ? 'city' : s.index < industry ? 'industry' : s.index < forest ? 'forest' : s.index < coast ? 'coast' : 'city';
  }

  const put = (index: number, kind: SpriteKind, offset: number, variant = 0, id = -1) => {
    const align: -1 | 0 | 1 = kind === 'coffee' || kind === 'gate' || kind === 'cone' || kind === 'post' ? 0 : offset < 0 ? -1 : 1;
    segments[((index % total) + total) % total].sprites.push({ kind, offset, align, variant, id });
  };
  const pick = (n: number) => Math.floor(random() * n);

  // Start/finish line and two checkpoints, a third and two thirds of the way round.
  for (let i = 0; i < RUMBLE_LENGTH * 2; i++) segments[i].mark = 'start';
  const checkpointAt = [Math.round(total / 3), Math.round((total * 2) / 3)];
  for (const at of checkpointAt) {
    for (let i = 0; i < RUMBLE_LENGTH; i++) segments[at + i].mark = 'checkpoint';
    put(at, 'gate', 0, 1);
    put(at, 'post', -1.32);
    put(at, 'post', 1.32);
  }
  put(RUMBLE_LENGTH * 2, 'gate', 0, 0);
  put(RUMBLE_LENGTH * 2, 'post', -1.32);
  put(RUMBLE_LENGTH * 2, 'post', 1.32);

  // What lines the road, zone by zone. Never on the first segments, so the start is clear.
  for (let i = 12; i < total; i++) {
    const s = segments[i];
    if (s.mark) continue;
    const near = (a: number, b: number) => a + random() * (b - a);
    if (s.zone === 'city') {
      if (i % 14 === 0) { put(i, 'lamp', -1.12); put(i, 'lamp', 1.12); }
      if (i % 9 === 0) put(i, 'building', (random() < 0.5 ? -1 : 1) * near(1.9, 2.6), pick(6));
      if (i % 9 === 4) put(i, 'building', (random() < 0.5 ? -1 : 1) * near(3, 4), pick(6));
      if (i % 120 === 60) put(i, 'billboard', (random() < 0.5 ? -1 : 1) * 1.25, pick(BILLBOARDS.length));
    } else if (s.zone === 'industry') {
      if (i % 20 === 0) { put(i, 'lamp', -1.12); put(i, 'lamp', 1.12); }
      if (i % 60 === 30) put(i, 'billboard', (random() < 0.5 ? -1 : 1) * 1.25, pick(BILLBOARDS.length));
      if (i % 16 === 8) put(i, 'building', (random() < 0.5 ? -1 : 1) * near(2.0, 3.2), 6 + pick(3));
      if (i % 5 === 0 && random() < 0.5) put(i, 'bush', (random() < 0.5 ? -1 : 1) * near(1.2, 2.2), pick(3));
    } else if (s.zone === 'forest') {
      if (i % 3 === 0) put(i, random() < 0.5 ? 'pine' : 'tree', -near(1.25, 4), pick(3));
      if (i % 3 === 1) put(i, random() < 0.5 ? 'pine' : 'tree', near(1.25, 4), pick(3));
      if (i % 7 === 0) put(i, 'bush', (random() < 0.5 ? -1 : 1) * near(1.15, 1.6), pick(3));
      if (i % 150 === 75) put(i, 'billboard', (random() < 0.5 ? -1 : 1) * 1.3, pick(BILLBOARDS.length));
    } else {
      if (i % 6 === 0) put(i, 'tree', -near(1.4, 3), 3);
      if (i % 10 === 0) put(i, 'lamp', 1.12);
      if (i % 4 === 2) put(i, 'bush', near(1.2, 2.4), pick(3));
      if (i % 90 === 45) put(i, 'billboard', -1.3, pick(BILLBOARDS.length));
    }
  }

  // Coffee cups: rows of three down one lane, then a few on their own, never at the start line.
  let coffees = 0;
  for (let i = 120; i < total - 60; i += 160 + pick(80)) {
    const lane = LANE_X[pick(3)];
    for (let k = 0; k < 3; k++) put(i + k * 6, 'coffee', lane, 0, coffees++);
  }
  // Traffic cones around a "roadworks" stretch in the industrial zone, a lane closed off.
  const works = industry + 40;
  for (let k = 0; k < 6; k++) put(works + k * 4, 'cone', -0.9 + k * 0.06);

  return { segments, length: total * SEGMENT_LENGTH, checkpoints: checkpointAt.map(i => i * SEGMENT_LENGTH), coffees };
}

/** z wrapped onto the track. */
export const wrapZ = (track: Track, z: number) => ((z % track.length) + track.length) % track.length;

export function findSegment(track: Track, z: number): Segment {
  return track.segments[Math.floor(wrapZ(track, z) / SEGMENT_LENGTH) % track.segments.length];
}

/** Signed distance from `from` to `to` along the track, the short way round. */
export function trackDelta(track: Track, from: number, to: number) {
  let d = wrapZ(track, to) - wrapZ(track, from);
  if (d > track.length / 2) d -= track.length;
  else if (d <= -track.length / 2) d += track.length;
  return d;
}

/** Whether two things of widths w1, w2 (offsets) centred on x1, x2 touch. */
export const overlap = (x1: number, w1: number, x2: number, w2: number, percent = 1) => {
  const half = (percent * (w1 + w2)) / 2;
  return Math.abs(x1 - x2) < half;
};

/** The road's height at `z`, between its segment's two ends. */
export function heightAt(track: Track, z: number) {
  const s = findSegment(track, z);
  const p = (wrapZ(track, z) % SEGMENT_LENGTH) / SEGMENT_LENGTH;
  return s.y1 + (s.y2 - s.y1) * p;
}

/** The first segment (index) at or after `from` whose shape matches, for jumping straight to one. */
export function findWhere(track: Track, test: (s: Segment) => boolean, from = 0) {
  for (let i = 0; i < track.segments.length; i++) {
    const s = track.segments[(from + i) % track.segments.length];
    if (test(s)) return s.index;
  }
  return -1;
}
