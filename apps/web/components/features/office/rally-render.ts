/**
 * Draws the racing game: the road projected segment by segment (curves, hills, clipping behind
 * crests), fog, parallax skylines, roadside sprites and traffic back to front, the player's car,
 * particles and the HUD. Everything per frame lives in preallocated arrays and pools.
 */

import {
  CAMERA_DEPTH, CAMERA_HEIGHT, LANES, PLAYER_Z, ROAD_WIDTH, SEGMENT_LENGTH, SPRITE_INFO, findSegment, wrapZ,
  type Segment, type Zone,
} from '@/lib/features/office/rally-track';
import {
  CAR_W, COFFEE_POINTS, MAX_SPEED, NITRO_SPEED, OVERTAKE_POINTS, PLAYER_W, kmh, metres, score, type RallyState,
} from '@/lib/features/office/rally';
import { formatScore } from '@/lib/features/office/cheer';
import type { Art, Picture, Theme } from './rally-art';

export const DRAW_DISTANCE = 200;
const FOG_DENSITY = 5;
const MAX_PARTICLES = 160;

type Palette = {
  sky: [string, string, string];
  fog: string;
  road: [string, string];
  rumble: [string, string];
  lane: string;
  ground: Record<Zone, [string, string]>;
  water: string;
  hud: string;
};

const PALETTES: Record<Theme, Palette> = {
  night: {
    sky: ['#03050f', '#151040', '#3a1d5e'],
    fog: '#24173f',
    road: ['#34374a', '#2f3243'],
    rumble: ['#e2e8f0', '#be123c'],
    lane: '#e2e8f0',
    ground: { city: ['#22263a', '#1d2133'], industry: ['#1f2a24', '#1a241f'], forest: ['#0f3320', '#0c2b1b'], coast: ['#3b3426', '#342e21'] },
    water: '#0c2a52',
    hud: '#22d3ee',
  },
  dusk: {
    sky: ['#1e1b4b', '#9d3b78', '#fb923c'],
    fog: '#c26a72',
    road: ['#4d4659', '#463f52'],
    rumble: ['#f8fafc', '#dc2626'],
    lane: '#f8fafc',
    ground: { city: ['#5b4a5e', '#524255'], industry: ['#585236', '#4f4930'], forest: ['#3e6b34', '#36602d'], coast: ['#c49a6c', '#b88e61'] },
    water: '#3b5fb0',
    hud: '#fbbf24',
  },
};

export const themeFor = (lap: number): Theme => ((lap - 1) % 2 === 0 ? 'night' : 'dusk');
export const THEME_NAME: Record<Theme, string> = { night: 'GECE · ŞEHİR', dusk: 'GÜN BATIMI' };

/** World-to-screen scale: the road under the car is 4f wide, the car 0.66f. */
const scaleFor = (w: number, h: number) => Math.min(w * 0.75, h * 0.56);
/** The horizon's screen y on flat road. */
const horizonFor = (w: number, h: number) => Math.min(h * 0.97 - scaleFor(w, h), h * 0.42);
/** Where the bottom of the player's car is on screen, for effects. */
export const carBottom = (w: number, h: number) => horizonFor(w, h) + scaleFor(w, h);

export type Overlay = 'none' | 'title' | 'paused' | 'over';

/** Effects the page sets from game events; the renderer animates them down. */
export class Effects {
  shake = 0;
  flash = 0;
  flashColor = '#ffffff';
  record = 0;
  banner = 0;
  bannerText = '';
  reduced = false;
  // Particle pool.
  px = new Float32Array(MAX_PARTICLES);
  py = new Float32Array(MAX_PARTICLES);
  vx = new Float32Array(MAX_PARTICLES);
  vy = new Float32Array(MAX_PARTICLES);
  life = new Float32Array(MAX_PARTICLES);
  max = new Float32Array(MAX_PARTICLES);
  size = new Float32Array(MAX_PARTICLES);
  color = new Uint8Array(MAX_PARTICLES);
  next = 0;
  // Floating "+250" texts.
  textLife = new Float32Array(4);
  textY = new Float32Array(4);
  textValue: string[] = ['', '', '', ''];
  nextText = 0;

  /** `count` particles from (x, y) in the logical frame, flying `spread` fast upwards-ish. */
  burst(x: number, y: number, count: number, palette: number, spread: number, up = 1) {
    const n = this.reduced ? Math.ceil(count / 3) : count;
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_PARTICLES;
      const a = Math.random() * Math.PI * 2;
      const v = spread * (0.3 + Math.random() * 0.7);
      this.px[i] = x; this.py[i] = y;
      this.vx[i] = Math.cos(a) * v;
      this.vy[i] = Math.sin(a) * v * 0.6 - spread * 0.6 * up;
      this.max[i] = this.life[i] = 0.5 + Math.random() * 0.6;
      this.size[i] = 2 + Math.random() * 4;
      this.color[i] = palette * 4 + Math.floor(Math.random() * 4);
    }
  }

  float(text: string) {
    const i = this.nextText;
    this.nextText = (this.nextText + 1) % 4;
    this.textValue[i] = text;
    this.textLife[i] = 1;
    this.textY[i] = 0;
  }

  hit(strength: number) {
    if (!this.reduced) this.shake = Math.max(this.shake, strength);
  }

  update(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.record = Math.max(0, this.record - dt);
    this.banner = Math.max(0, this.banner - dt);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.vy[i] += 600 * dt;
    }
    for (let i = 0; i < 4; i++) if (this.textLife[i] > 0) { this.textLife[i] -= dt * 0.9; this.textY[i] += dt * 60; }
  }
}

/** Particle colours: coffee, sparks, dust, confetti, nitro flame. */
const PARTICLE_COLORS = [
  '#fef3c7', '#d97706', '#78350f', '#fde047',
  '#fff7ed', '#fde047', '#fb923c', '#f97316',
  '#a3a38c', '#6b7f4f', '#8b7355', '#cbd5e1',
  '#f472b6', '#22d3ee', '#fde047', '#a78bfa',
  '#fef08a', '#fb923c', '#60a5fa', '#e0f2fe',
];
export const PARTICLE = { coffee: 0, sparks: 1, dust: 2, confetti: 3, flame: 4 } as const;

export type View = {
  /** Logical size (CSS pixels) of the canvas. */
  w: number;
  h: number;
};

export class RallyRenderer {
  // Projection of each drawn segment's near edge (index n: n segments ahead of the camera), plus
  // the far edge of the last one.
  private sx = new Float32Array(DRAW_DISTANCE + 1);
  private sy = new Float32Array(DRAW_DISTANCE + 1);
  private sw = new Float32Array(DRAW_DISTANCE + 1);
  private ss = new Float32Array(DRAW_DISTANCE + 1);
  private clip = new Float32Array(DRAW_DISTANCE);
  private fog = new Float32Array(DRAW_DISTANCE);
  private segs: (Segment | null)[] = new Array(DRAW_DISTANCE).fill(null);
  private skyOffset = [0, 0, 0];
  private lineSeed = new Float32Array(28);
  private gradients: { key: string; sky: CanvasGradient | null; sun: CanvasGradient | null; vignette: CanvasGradient | null; head: CanvasGradient | null } =
    { key: '', sky: null, sun: null, vignette: null, head: null };
  private cache = { score: -1, scoreText: '', best: -1, bestText: '', time: -1, timeText: '' };

  constructor(private art: Art) {
    for (let i = 0; i < this.lineSeed.length; i++) this.lineSeed[i] = Math.random();
  }

  render(g: CanvasRenderingContext2D, state: RallyState, view: View, fx: Effects, overlay: Overlay, time: number, braking: boolean) {
    const { w, h } = view;
    const theme = themeFor(state.lap);
    const pal = PALETTES[theme];
    // Uniform scale: f world units at the projection plane map to screen pixels; the road under
    // the car sits near the bottom, the horizon a bit above the middle.
    const f = scaleFor(w, h), cy = horizonFor(w, h);
    this.ensureGradients(g, w, h, cy, theme);

    g.save();
    if (fx.shake > 0) g.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);

    const track = state.track;
    const base = findSegment(track, state.position);
    const basePercent = (wrapZ(track, state.position) % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const pz = state.position + PLAYER_Z;
    const playerSeg = findSegment(track, pz);
    const playerPercent = (wrapZ(track, pz) % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const playerY = playerSeg.y1 + (playerSeg.y2 - playerSeg.y1) * playerPercent;
    const speedPct = state.speed / MAX_SPEED;

    // Sky and skylines, scrolling with the curves.
    const bend = playerSeg.curve * speedPct * 0.0004;
    this.skyOffset[0] = (this.skyOffset[0] + bend * 0.25 + 1) % 1;
    this.skyOffset[1] = (this.skyOffset[1] + bend * 0.5 + 1) % 1;
    this.skyOffset[2] = (this.skyOffset[2] + bend + 1) % 1;
    g.fillStyle = this.gradients.sky!;
    g.fillRect(-20, -20, w + 40, cy + 40);
    const lift = Math.max(-h * 0.08, Math.min(h * 0.08, -playerY / 600));
    if (theme === 'night') {
      this.layer(g, this.art.stars, this.skyOffset[0], cy * 0.9, w, cy * 0.9);
      const mr = Math.max(8, h * 0.04);
      g.fillStyle = 'rgba(241,245,249,0.07)';
      g.beginPath(); g.arc(w * 0.8, cy * 0.3, mr * 1.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f1f5f9';
      g.beginPath(); g.arc(w * 0.8, cy * 0.3, mr, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#cbd5e1';
      g.beginPath(); g.arc(w * 0.8 - mr * 0.3, cy * 0.3 - mr * 0.2, mr * 0.22, 0, Math.PI * 2); g.arc(w * 0.8 + mr * 0.35, cy * 0.3 + mr * 0.3, mr * 0.15, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    } else {
      g.fillStyle = this.gradients.sun!;
      g.beginPath(); g.arc(w * 0.5, cy - h * 0.02 + lift, h * 0.2, Math.PI, 0); g.fill();
      g.fillStyle = pal.sky[2];
      for (let k = 0; k < 5; k++) g.fillRect(w * 0.5 - h * 0.21, cy - h * 0.02 + lift - k * h * 0.03 - h * 0.012, h * 0.42, h * 0.006 + k * 0.6);
    }
    const [farLayer, nearLayer] = this.art.layers[theme];
    this.layer(g, farLayer, this.skyOffset[1], cy + lift * 0.5, w, h * 0.3);
    this.layer(g, nearLayer, this.skyOffset[2], cy + lift + 2, w, h * 0.36);
    g.fillStyle = pal.fog;
    g.fillRect(-20, cy + lift + 1, w + 40, h - cy - lift + 20);

    // Project the road ahead, nearest first.
    const camX = state.x * ROAD_WIDTH, camY = playerY + CAMERA_HEIGHT;
    let maxy = h, x = 0, dx = -(base.curve * basePercent);
    const n = track.segments.length;
    for (let i = 0; i <= DRAW_DISTANCE; i++) {
      const seg = track.segments[(base.index + i) % n];
      const looped = seg.index < base.index;
      const z = seg.z + (looped ? track.length : 0) - state.position;
      const scale = CAMERA_DEPTH / Math.max(1, z);
      this.sx[i] = w / 2 + scale * (x - camX) * f;
      this.sy[i] = cy - scale * (seg.y1 - camY) * f;
      this.sw[i] = scale * ROAD_WIDTH * f;
      this.ss[i] = z <= CAMERA_DEPTH ? -1 : scale;
      if (i === DRAW_DISTANCE) break;
      this.segs[i] = seg;
      x += dx;
      dx += seg.curve;
    }
    for (let i = 0; i < DRAW_DISTANCE; i++) {
      const seg = this.segs[i]!;
      this.fog[i] = 1 / Math.exp((i / DRAW_DISTANCE) ** 2 * FOG_DENSITY);
      this.clip[i] = maxy;
      const y1 = this.sy[i], y2 = this.sy[i + 1];
      if (this.ss[i] < 0 || y2 >= y1 || y2 >= maxy) continue;
      this.segment(g, w, seg, pal, this.sx[i], y1, this.sw[i], this.sx[i + 1], y2, this.sw[i + 1], this.fog[i]);
      maxy = y1;
    }

    // Sprites, traffic and the player, farthest first. Nothing is drawn between the camera and the
    // car: it would only be a blur in front of it.
    const playerIndex = (playerSeg.index - base.index + n) % n;
    for (let i = DRAW_DISTANCE - 1; i >= playerIndex; i--) {
      const seg = this.segs[i]!;
      if (this.ss[i] < 0) continue;
      const fogAlpha = Math.min(1, this.fog[i] * 1.6);
      for (const sprite of seg.sprites) {
        if (sprite.kind === 'post') continue;
        if (sprite.kind === 'coffee' && state.collected[sprite.id] === state.lap) continue;
        const scale = this.ss[i];
        const info = SPRITE_INFO[sprite.kind];
        let pic: Picture = sprite.kind === 'lamp' && sprite.offset > 0 ? this.art.lampRight : this.art.sprites[sprite.kind][sprite.variant % this.art.sprites[sprite.kind].length];
        if (sprite.kind === 'tree' && seg.zone === 'coast') pic = this.art.sprites.tree[3];
        const dw = scale * info.width * ROAD_WIDTH * f;
        const dh = dw * (pic.height / pic.width);
        const sx = this.sx[i] + scale * sprite.offset * ROAD_WIDTH * f;
        const left = sprite.align < 0 ? sx - dw : sprite.align > 0 ? sx : sx - dw / 2;
        const bob = sprite.kind === 'coffee' ? Math.sin(time * 5 + sprite.id) * dh * 0.12 + dh * 0.15 : 0;
        this.sprite(g, pic, left, this.sy[i] - dh - bob, dw, dh, this.clip[i], fogAlpha, w);
      }
      for (const car of state.cars) {
        const d = wrapZ(track, car.z - seg.z);
        if (d >= SEGMENT_LENGTH) continue;
        const p = d / SEGMENT_LENGTH;
        const scale = this.ss[i] + (Math.max(0, this.ss[i + 1]) - this.ss[i]) * p;
        const pic = this.art.cars[car.color][car.model];
        const dw = scale * CAR_W * 1.1 * ROAD_WIDTH * f;
        const dh = dw * (pic.height / pic.width);
        const cx = this.sx[i] + (this.sx[i + 1] - this.sx[i]) * p + scale * car.x * ROAD_WIDTH * f;
        const cyy = this.sy[i] + (this.sy[i + 1] - this.sy[i]) * p;
        this.sprite(g, pic, cx - dw / 2, cyy - dh, dw, dh, this.clip[i], fogAlpha, w);
      }
      if (i === playerIndex) this.player(g, state, w, cy, f, fx, time, speedPct, braking);
    }

    // Headlights at night, speed lines, particles.
    if (theme === 'night') { g.fillStyle = this.gradients.head!; g.fillRect(0, cy, w, h - cy); }
    if (!fx.reduced && (speedPct > 0.92 || state.boosting) && overlay === 'none') this.speedLines(g, w, h, cy, time, state.boosting ? 1 : (speedPct - 0.92) * 8);
    this.particles(g, fx);
    g.restore();

    if (fx.flash > 0) { g.globalAlpha = Math.min(0.7, fx.flash); g.fillStyle = fx.flashColor; g.fillRect(0, 0, w, h); g.globalAlpha = 1; }
    if (state.phase === 'playing' && state.timeLeft < 6 && !fx.reduced) {
      g.globalAlpha = 0.35 + 0.25 * Math.sin(time * 10);
      g.fillStyle = this.gradients.vignette!; g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
    }
    if (overlay !== 'title') this.hud(g, state, view, fx, pal, theme, time);
  }

  /** A skyline strip, tiled across the width, its bottom at `bottom`. */
  private layer(g: CanvasRenderingContext2D, pic: Picture, offset: number, bottom: number, w: number, height: number) {
    const scale = height / pic.height;
    const tile = pic.width * scale;
    let x = -offset * tile;
    const top = bottom - height;
    while (x < w) { g.drawImage(pic, x, top, tile + 1, height); x += tile; }
  }

  private segment(g: CanvasRenderingContext2D, w: number, seg: Segment, pal: Palette, x1: number, y1: number, w1: number, x2: number, y2: number, w2: number, fog: number) {
    const light = seg.light ? 0 : 1;
    const top = y2 - 0.5;
    g.fillStyle = pal.ground[seg.zone][light];
    g.fillRect(0, top, w, y1 - top);
    if (seg.zone === 'coast') {
      g.fillStyle = pal.water;
      quad(g, 0, y1, x1 - w1 * 2.4, y1, x2 - w2 * 2.4, top, 0, top);
    }
    const r1 = w1 / 6, r2 = w2 / 6;
    g.fillStyle = pal.rumble[light];
    quad(g, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, top, x2 - w2 - r2, top);
    quad(g, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, top, x2 + w2 + r2, top);
    g.fillStyle = pal.road[light];
    quad(g, x1 - w1, y1, x1 + w1, y1, x2 + w2, top, x2 - w2, top);
    if (seg.mark === 'start') {
      const cells = 10;
      for (let k = 0; k < cells; k++) {
        if ((k + seg.index) % 2) continue;
        const a = -1 + (2 * k) / cells, b = a + 2 / cells;
        g.fillStyle = '#f8fafc';
        quad(g, x1 + w1 * a, y1, x1 + w1 * b, y1, x2 + w2 * b, top, x2 + w2 * a, top);
      }
    } else if (seg.mark === 'checkpoint') {
      g.fillStyle = light ? '#f97316' : '#facc15';
      quad(g, x1 - w1, y1, x1 + w1, y1, x2 + w2, top, x2 - w2, top);
    } else if (seg.light) {
      const l1 = w1 / 40, l2 = w2 / 40;
      g.fillStyle = pal.lane;
      for (let lane = 1; lane < LANES; lane++) {
        const a = -1 + (2 * lane) / LANES;
        quad(g, x1 + w1 * a - l1 / 2, y1, x1 + w1 * a + l1 / 2, y1, x2 + w2 * a + l2 / 2, top, x2 + w2 * a - l2 / 2, top);
      }
    }
    // Edge lines, always on.
    g.fillStyle = 'rgba(248,250,252,0.55)';
    const e1 = w1 / 60, e2 = w2 / 60;
    quad(g, x1 - w1 * 0.94 - e1, y1, x1 - w1 * 0.94, y1, x2 - w2 * 0.94, top, x2 - w2 * 0.94 - e2, top);
    quad(g, x1 + w1 * 0.94 + e1, y1, x1 + w1 * 0.94, y1, x2 + w2 * 0.94, top, x2 + w2 * 0.94 + e2, top);
    if (fog < 1) {
      g.globalAlpha = 1 - fog;
      g.fillStyle = pal.fog;
      g.fillRect(0, top, w, y1 - top);
      g.globalAlpha = 1;
    }
  }

  /** A picture with its bottom cut off below `clip` (a hill crest in front of it). */
  private sprite(g: CanvasRenderingContext2D, pic: Picture, x: number, y: number, dw: number, dh: number, clip: number, alpha: number, w: number) {
    if (dw < 1 || x > w || x + dw < 0) return;
    const hidden = Math.max(0, y + dh - clip);
    if (hidden >= dh) return;
    const visible = 1 - hidden / dh;
    g.globalAlpha = alpha;
    g.drawImage(pic, 0, 0, pic.width, pic.height * visible, x, y, dw, dh * visible);
    g.globalAlpha = 1;
  }

  private player(g: CanvasRenderingContext2D, state: RallyState, w: number, cy: number, f: number, fx: Effects, time: number, speedPct: number, braking: boolean) {
    const frame = state.steer < -0.3 ? 0 : state.steer > 0.3 ? 2 : 1;
    const pic = this.art.player[frame];
    const scale = CAMERA_DEPTH / PLAYER_Z;
    const dw = scale * PLAYER_W * 1.1 * ROAD_WIDTH * f;
    const dh = dw * (pic.height / pic.width);
    const offRoad = Math.abs(state.x) > 1;
    const bounce = state.phase === 'over' && state.speed < 1 ? 0
      : Math.sin(time * 37) * speedPct * dh * (offRoad ? 0.03 : 0.008) + (offRoad ? Math.sin(time * 61) * speedPct * dh * 0.02 : 0);
    const bottom = cy + f + bounce;
    const blink = state.safe > 0 && state.spin <= 0 && Math.floor(time * 12) % 2 === 0;
    if (blink) g.globalAlpha = 0.45;
    g.save();
    g.translate(w / 2, bottom - dh / 2);
    if (state.spin > 0) {
      // The crash: the car spins round once and a half, wobbling.
      const t = 1 - state.spin / 0.9;
      g.rotate(Math.sin(t * Math.PI * 3) * 0.5 * (1 - t));
      g.scale(Math.cos(t * Math.PI * 3) * 0.35 + 0.65, 1);
    } else g.rotate(state.steer * 0.04);
    g.drawImage(pic, -dw / 2, -dh / 2, dw, dh);
    if (braking || state.spin > 0) {
      g.globalAlpha = 0.6;
      g.fillStyle = '#ff2020';
      g.fillRect(-dw * 0.44, -dh * 0.02, dw * 0.28, dh * 0.08);
      g.fillRect(dw * 0.16, -dh * 0.02, dw * 0.28, dh * 0.08);
    }
    g.restore();
    g.globalAlpha = 1;
    // Nitro flames and off-road dust come out at the back.
    if (state.boosting && !fx.reduced) {
      for (const side of [-0.2, 0.2]) {
        const len = dh * (0.25 + Math.random() * 0.2);
        g.fillStyle = '#60a5fa';
        g.beginPath(); g.moveTo(w / 2 + side * dw - dw * 0.04, bottom - dh * 0.18); g.lineTo(w / 2 + side * dw + dw * 0.04, bottom - dh * 0.18); g.lineTo(w / 2 + side * dw, bottom - dh * 0.18 + len); g.fill();
        g.fillStyle = '#e0f2fe';
        g.beginPath(); g.moveTo(w / 2 + side * dw - dw * 0.02, bottom - dh * 0.18); g.lineTo(w / 2 + side * dw + dw * 0.02, bottom - dh * 0.18); g.lineTo(w / 2 + side * dw, bottom - dh * 0.18 + len * 0.5); g.fill();
      }
    }
    if (offRoad && state.speed > MAX_SPEED * 0.1 && Math.random() < 0.6) fx.burst(w / 2 + (Math.random() - 0.5) * dw, bottom - dh * 0.1, 1, PARTICLE.dust, 120, 0.8);
  }

  private speedLines(g: CanvasRenderingContext2D, w: number, h: number, cy: number, time: number, strength: number) {
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.globalAlpha = Math.min(1, strength) * 0.45;
    g.lineWidth = Math.max(1, h / 300);
    g.beginPath();
    for (let i = 0; i < this.lineSeed.length; i++) {
      const a = (i / this.lineSeed.length) * Math.PI * 2 + this.lineSeed[i] * 0.3;
      const t = (time * (1.6 + this.lineSeed[i]) + this.lineSeed[i]) % 1;
      const r0 = (0.7 + t * 0.8) * w * 0.5, r1 = r0 + w * 0.08 * (0.5 + t);
      const c = Math.cos(a), s = Math.sin(a);
      g.moveTo(w / 2 + c * r0, cy + s * r0 * 0.6);
      g.lineTo(w / 2 + c * r1, cy + s * r1 * 0.6);
    }
    g.stroke();
    g.globalAlpha = 1;
  }

  private particles(g: CanvasRenderingContext2D, fx: Effects) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (fx.life[i] <= 0) continue;
      g.globalAlpha = Math.max(0, fx.life[i] / fx.max[i]);
      g.fillStyle = PARTICLE_COLORS[fx.color[i]];
      const s = fx.size[i];
      g.fillRect(fx.px[i] - s / 2, fx.py[i] - s / 2, s, s);
    }
    g.globalAlpha = 1;
  }

  private ensureGradients(g: CanvasRenderingContext2D, w: number, h: number, cy: number, theme: Theme) {
    const key = `${w}|${h}|${theme}`;
    if (this.gradients.key === key) return;
    const pal = PALETTES[theme];
    const sky = g.createLinearGradient(0, 0, 0, cy);
    sky.addColorStop(0, pal.sky[0]); sky.addColorStop(0.6, pal.sky[1]); sky.addColorStop(1, pal.sky[2]);
    const sun = g.createLinearGradient(0, cy - h * 0.22, 0, cy);
    sun.addColorStop(0, '#fde047'); sun.addColorStop(1, '#f472b6');
    const vignette = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, 'rgba(220,38,38,0)'); vignette.addColorStop(1, 'rgba(220,38,38,0.8)');
    const head = g.createRadialGradient(w / 2, h * 0.92, 0, w / 2, h * 0.8, Math.max(w, h) * 0.45);
    head.addColorStop(0, 'rgba(255,248,220,0.16)'); head.addColorStop(1, 'rgba(255,248,220,0)');
    this.gradients = { key, sky, sun, vignette, head };
  }

  // ---- HUD -------------------------------------------------------------------------------

  private text(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', weight = '800') {
    g.font = `italic ${weight} ${Math.round(size)}px ui-sans-serif, system-ui, sans-serif`;
    g.textAlign = align;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillText(text, x + size * 0.06, y + size * 0.08);
    g.fillStyle = color;
    g.fillText(text, x, y);
  }

  private hud(g: CanvasRenderingContext2D, state: RallyState, view: View, fx: Effects, pal: Palette, theme: Theme, time: number) {
    const { w, h } = view;
    const u = Math.min(w, h * 1.4) / (w < 600 ? 480 : 640);
    const pad = 12 * u + 4;
    const c = this.cache;
    const s = score(state);
    if (s !== c.score) { c.score = s; c.scoreText = formatScore(s); }
    const best = Math.max(state.best, state.beaten ? s : 0);
    if (best !== c.best) { c.best = best; c.bestText = `REKOR ${formatScore(best)}`; }
    const tenths = Math.ceil(state.timeLeft * 10);
    if (tenths !== c.time) { c.time = tenths; c.timeText = String(Math.ceil(state.timeLeft)); }

    // Score and record, top left.
    g.fillStyle = 'rgba(2,6,23,0.55)';
    roundRect(g, pad - 6 * u, pad - 4 * u, 150 * u, 54 * u, 8 * u); g.fill();
    this.text(g, 'SKOR', pad, pad + 10 * u, 11 * u, '#94a3b8');
    this.text(g, c.scoreText, pad, pad + 32 * u, 22 * u, '#fde047');
    if (best > 0) this.text(g, c.bestText, pad, pad + 46 * u, 10 * u, state.beaten ? '#fde047' : '#cbd5e1', 'left', '700');

    // Time, top centre.
    const low = state.timeLeft < 6 && state.phase === 'playing';
    const pulse = low ? 1 + 0.12 * Math.max(0, Math.sin(time * 10)) : 1;
    this.text(g, 'ZAMAN', w / 2, pad + 10 * u, 11 * u, '#94a3b8', 'center');
    this.text(g, c.timeText, w / 2, pad + 48 * u, 40 * u * pulse, low ? '#f87171' : '#f8fafc', 'center', '900');
    if (state.bonusAge < 1.6) {
      g.globalAlpha = Math.min(1, (1.6 - state.bonusAge) * 2);
      this.text(g, `+${state.bonus} sn`, w / 2, pad + 72 * u - state.bonusAge * 8 * u, 18 * u, '#4ade80', 'center', '900');
      g.globalAlpha = 1;
    }

    // Lap and stage, top right.
    g.fillStyle = 'rgba(2,6,23,0.55)';
    roundRect(g, w - pad - 112 * u, pad - 4 * u, 118 * u, 40 * u, 8 * u); g.fill();
    this.text(g, `TUR ${state.lap}`, w - pad, pad + 16 * u, 18 * u, '#f8fafc', 'right', '900');
    this.text(g, THEME_NAME[theme], w - pad, pad + 30 * u, 9 * u, pal.hud, 'right', '700');

    // Speedometer and nitro: bottom corners, or under the lap box when buttons cover the bottom.
    const r = 40 * u;
    const gx = pad + 46 * u, gy = h - pad - 30 * u;
    g.fillStyle = 'rgba(2,6,23,0.6)';
    g.beginPath(); g.arc(gx, gy, r + 6 * u, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(gx, gy + 14 * u); g.fill();
    g.lineWidth = 6 * u; g.lineCap = 'round';
    g.strokeStyle = 'rgba(148,163,184,0.35)';
    g.beginPath(); g.arc(gx, gy, r, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
    const pct = Math.min(1, state.speed / (MAX_SPEED * NITRO_SPEED));
    g.strokeStyle = state.boosting ? '#60a5fa' : pct > 0.7 ? '#f97316' : '#22d3ee';
    g.beginPath(); g.arc(gx, gy, r, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * pct)); g.stroke();
    g.lineCap = 'butt';
    this.text(g, String(kmh(state)), gx, gy + 6 * u, 20 * u, '#f8fafc', 'center', '900');
    this.text(g, 'km/sa', gx, gy + 18 * u, 8 * u, '#94a3b8', 'center', '700');

    const nx = w - pad - 120 * u, ny = h - pad - 16 * u;
    g.fillStyle = 'rgba(2,6,23,0.6)';
    roundRect(g, nx - 4 * u, ny - 18 * u, 128 * u, 30 * u, 6 * u); g.fill();
    this.text(g, state.nitro > 0.05 ? 'NİTRO ☕' : 'NİTRO', nx, ny - 6 * u, 9 * u, state.boosting ? '#93c5fd' : '#cbd5e1', 'left', '800');
    g.fillStyle = 'rgba(148,163,184,0.3)';
    roundRect(g, nx, ny - 2 * u, 120 * u, 9 * u, 4 * u); g.fill();
    if (state.nitro > 0) {
      g.fillStyle = state.boosting ? '#93c5fd' : state.nitro >= 0.999 ? (Math.floor(time * 4) % 2 ? '#60a5fa' : '#a5b4fc') : '#3b82f6';
      roundRect(g, nx, ny - 2 * u, Math.max(8 * u, 120 * u * state.nitro), 9 * u, 4 * u); g.fill();
    }

    // Floating points, banners.
    for (let i = 0; i < 4; i++) {
      if (fx.textLife[i] <= 0) continue;
      g.globalAlpha = Math.min(1, fx.textLife[i] * 2);
      this.text(g, fx.textValue[i], w / 2, h * 0.62 - fx.textY[i] * u, 22 * u, '#fde047', 'center', '900');
    }
    g.globalAlpha = 1;
    if (fx.banner > 0) {
      g.globalAlpha = Math.min(1, fx.banner * 2);
      g.fillStyle = 'rgba(2,6,23,0.55)';
      g.fillRect(0, h * 0.36 - 30 * u, w, 42 * u);
      this.text(g, fx.bannerText, w / 2, h * 0.36, 26 * u, '#f8fafc', 'center', '900');
      g.globalAlpha = 1;
    }
    if (fx.record > 0 && state.phase === 'playing') {
      const k = Math.min(1, (3 - fx.record) * 4);
      g.globalAlpha = Math.min(1, fx.record);
      this.text(g, 'YENİ REKOR!', w / 2, h * 0.3, 34 * u * (0.6 + 0.4 * k), Math.floor(time * 8) % 2 ? '#fde047' : '#f472b6', 'center', '900');
      g.globalAlpha = 1;
    }

    // Countdown.
    if (state.phase === 'countdown' || (state.phase === 'playing' && state.elapsed < 0.8)) {
      const go = state.phase === 'playing';
      const frac = go ? state.elapsed / 0.8 : 1 - (state.countdown % 1);
      const size = (go ? 70 : 90) * u * (1.4 - Math.min(1, frac * 3) * 0.4);
      g.globalAlpha = go ? 1 - frac : 1;
      this.text(g, go ? 'BAŞLA!' : String(Math.ceil(state.countdown)), w / 2, h * 0.45, size, go ? '#4ade80' : '#fde047', 'center', '900');
      g.globalAlpha = 1;
    }
  }

  /** The title, pause and game-over screens drawn over the game. */
  overlay(g: CanvasRenderingContext2D, state: RallyState, view: View, overlay: Overlay, time: number, best: number, touch: boolean, record: boolean) {
    if (overlay === 'none') return;
    const { w, h } = view;
    const u = Math.min(w, h * 1.4) / (w < 600 ? 480 : 640);
    g.fillStyle = overlay === 'title' ? 'rgba(2,6,23,0.45)' : 'rgba(2,6,23,0.7)';
    g.fillRect(0, 0, w, h);
    const portrait = h > w;
    if (overlay === 'title') {
      const ty = h * (portrait ? 0.24 : 0.28);
      this.text(g, 'RENKFLOW', w / 2, ty - 34 * u, 26 * u, '#22d3ee', 'center', '900');
      this.text(g, 'RALLİ', w / 2, ty + 30 * u, 72 * u, '#f472b6', 'center', '900');
      this.text(g, 'Zamana karşı · gece turu', w / 2, ty + 58 * u, 15 * u, '#e2e8f0', 'center', '700');
      const lines = touch
        ? ['◀ ▶ düğmeleriyle direksiyon', 'Araba kendiliğinden hızlanır', 'Kahve topla, NİTRO ile uç', 'Kontrol noktaları süre ekler']
        : ['← → / A D  direksiyon   ·   ↓ / S  fren', 'Boşluk / Shift  nitro (kahveyle dolar)', 'P duraklat  ·  M ses  ·  Esc çıkış', 'Kontrol noktaları süre ekler'];
      g.fillStyle = 'rgba(2,6,23,0.6)';
      const bw = Math.min(w - 24, 420 * u), by = ty + 76 * u;
      roundRect(g, w / 2 - bw / 2, by, bw, 92 * u, 10 * u); g.fill();
      for (let i = 0; i < lines.length; i++) this.text(g, lines[i], w / 2, by + 22 * u + i * 20 * u, 13 * u, '#cbd5e1', 'center', '600');
      if (Math.floor(time * 2) % 2 === 0) this.text(g, touch ? 'BAŞLAMAK İÇİN DOKUNUN' : 'BAŞLAMAK İÇİN BİR TUŞA BASIN', w / 2, by + 126 * u, 18 * u, '#fde047', 'center', '900');
      if (best > 0) this.text(g, `REKOR ${formatScore(best)}`, w / 2, by + 152 * u, 14 * u, '#fde047', 'center', '800');
      return;
    }
    if (overlay === 'paused') {
      this.text(g, 'DURAKLATILDI', w / 2, h * 0.45, 40 * u, '#f8fafc', 'center', '900');
      this.text(g, touch ? 'Devam etmek için dokunun' : 'Devam: P / Enter  ·  Çıkış: Esc', w / 2, h * 0.45 + 34 * u, 15 * u, '#cbd5e1', 'center', '700');
      return;
    }
    // Game over.
    const top = h * (portrait ? 0.2 : 0.16);
    this.text(g, 'SÜRE DOLDU', w / 2, top + 20 * u, 40 * u, '#f87171', 'center', '900');
    const s = score(state);
    this.text(g, formatScore(s), w / 2, top + 84 * u, 56 * u, '#fde047', 'center', '900');
    this.text(g, 'PUAN', w / 2, top + 102 * u, 12 * u, '#94a3b8', 'center', '800');
    const rows = [
      `Mesafe  ${formatScore(metres(state))} m`,
      `Kahve  ${state.coffees} × ${COFFEE_POINTS}`,
      `Sollama  ${state.overtakes} × ${OVERTAKE_POINTS}`,
      `${state.lap}. tur`,
    ];
    for (let i = 0; i < rows.length; i++) this.text(g, rows[i], w / 2, top + 130 * u + i * 19 * u, 14 * u, '#e2e8f0', 'center', '700');
    if (record) {
      const k = 1 + 0.08 * Math.sin(time * 8);
      this.text(g, 'YENİ REKOR!', w / 2, top + 228 * u, 40 * u * k, Math.floor(time * 6) % 2 ? '#fde047' : '#f472b6', 'center', '900');
    } else if (best > 0) this.text(g, `Rekor ${formatScore(best)}`, w / 2, top + 222 * u, 16 * u, '#cbd5e1', 'center', '800');
    if (state.elapsed > 1 && Math.floor(time * 2) % 2 === 0) {
      this.text(g, touch ? 'TEKRAR İÇİN DOKUNUN' : 'TEKRAR: ENTER', w / 2, top + 268 * u, 18 * u, '#f8fafc', 'center', '900');
    }
  }
}

function quad(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
  g.beginPath();
  g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.lineTo(x4, y4);
  g.closePath();
  g.fill();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
