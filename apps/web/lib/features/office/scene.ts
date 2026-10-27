import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Look, TaskCategoryId } from './catalog';
import { BOARD_X, BOOKSHELF, CAFE_TABLE, DESKS, FLOOR, GAMING, KITCHEN, LOUNGE, LOUNGE_SEATS, MANAGER_DESK, TV, type Desk } from './layout';
import { DELIVER_SECONDS, type Agent, type OfficeSimulation, type TaskStatus } from './simulation';
import { formatScore } from './cheer';

/**
 * The 3D office drawn from the simulation: an open-plan floor seen from above at an angle, desks
 * whose screens show the work in progress, a lounge, a kitchen with a café table, a TV corner, a
 * games console corner, a bookshelf and simple low-poly people who sit down and stand up instead
 * of snapping between poses, and hold what they are busy with (a mug, a phone, a controller…). The scene owns the clock: each frame it advances
 * the simulation, moves the people and places the name labels the page renders over the canvas.
 */

/** Quality: shadows, smoothing, sharper picture. Performance: none of those, 30 frames a second. */
export type StageQuality = 'quality' | 'performance';
export type CameraView = { theta: number; phi: number; distance: number };
/** Something in the office the person clicked: the games screen, the coffee machine, a member of staff. */
export type StagePick = { kind: 'tv' } | { kind: 'coffee' } | { kind: 'agent'; id: string };

/** How the device copes: struggling in quality mode, or with room to spare in performance mode. */
export type StageHint = 'slow' | 'smooth';

export type OfficeStage = {
  setSpeed(speed: number): void;
  /** Someone at the keyboard is playing the racing game: the games screen shows it too. */
  setVisitorPlaying(playing: boolean): void;
  /** The racing record on this device, shown small on the games screen (0: none yet). */
  setRecord(best: number): void;
  /** A member of staff waves back for a moment. */
  wave(agentId: string): void;
  /** The coffee machine brews a cup. */
  brew(): void;
  setPaused(paused: boolean): void;
  setNight(night: boolean): void;
  resetView(): void;
  /** Where the camera is aimed, to keep it when the stage is rebuilt (another quality mode). */
  cameraView(): CameraView;
  dispose(): void;
};

const COLORS = {
  wood: '#a8673a', woodDark: '#7a4625', deskTop: '#d9a66b', metal: '#2b2d33', chair: '#1f4f8f', sofa: '#e7a73a', cushion: '#3b82c4',
  glass: '#9fd3e6', rail: '#e08a5f', wall: '#1d2433', glow: '#fbbf24', ask: '#38bdf8', done: '#34d399', lamp: '#fde68a',
};

const BOARD_COLORS: Record<TaskStatus | 'empty', string> = {
  empty: '#273042', queued: '#64748b', assigned: '#f59e0b', working: '#facc15', asking: '#38bdf8', review: '#f97316', approved: '#22c55e', failed: '#ef4444',
};

const SKY = { night: new T.Color('#0b1020'), day: new T.Color('#cfe3f3') };

const box = (w: number, h: number, d: number, color: string, extra: T.MeshStandardMaterialParameters = {}) => {
  const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color, roughness: 0.75, ...extra }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};
const at = <O extends T.Object3D>(object: O, x: number, y: number, z: number) => { object.position.set(x, y, z); return object; };
const ease = (current: number, target: number, rate: number, dt: number) => current + (target - current) * Math.min(1, dt * rate);
/** Marks a material or object the scene changes while running, so baking leaves it alone. */
const live = <O extends T.Material | T.Object3D>(thing: O) => { thing.userData.live = true; return thing; };

function canvasTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

function woodTexture() {
  const texture = canvasTexture(512, 512, g => {
    g.fillStyle = COLORS.wood;
    g.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 16; row++) {
      const offset = (row % 2) * 128;
      for (let col = -1; col < 3; col++) {
        const shade = 0.88 + ((row * 7 + col * 13) % 10) / 45;
        g.fillStyle = `rgba(${Math.round(168 * shade)},${Math.round(103 * shade)},${Math.round(58 * shade)},1)`;
        g.fillRect(col * 256 + offset + 2, row * 32 + 2, 252, 28);
        // A few grain lines per plank.
        g.strokeStyle = `rgba(90,50,25,${0.08 + ((row + col) % 3) * 0.03})`;
        for (let line = 0; line < 3; line++) {
          g.beginPath();
          g.moveTo(col * 256 + offset + 6, row * 32 + 8 + line * 7);
          g.bezierCurveTo(col * 256 + offset + 90, row * 32 + 5 + line * 7, col * 256 + offset + 170, row * 32 + 12 + line * 7, col * 256 + offset + 250, row * 32 + 8 + line * 7);
          g.stroke();
        }
      }
    }
  });
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(6, 4);
  texture.anisotropy = 4;
  return texture;
}

/** A city skyline across the window row: lit windows and stars at night, a pale sky by day. */
function skylineTexture(night: boolean) {
  return canvasTexture(1024, 256, g => {
    const sky = g.createLinearGradient(0, 0, 0, 256);
    if (night) { sky.addColorStop(0, '#050a1a'); sky.addColorStop(1, '#1b2a4f'); } else { sky.addColorStop(0, '#7fb6e8'); sky.addColorStop(1, '#d8ecfa'); }
    g.fillStyle = sky;
    g.fillRect(0, 0, 1024, 256);
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    if (night) for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + random() * 0.6})`; g.fillRect(random() * 1024, random() * 110, 1.5, 1.5); }
    for (let x = 0; x < 1024;) {
      const w = 40 + random() * 70, h = 60 + random() * 150;
      g.fillStyle = night ? `rgb(${12 + random() * 14},${18 + random() * 16},${36 + random() * 20})` : `rgb(${120 + random() * 40},${140 + random() * 40},${165 + random() * 30})`;
      g.fillRect(x, 256 - h, w, h);
      for (let wy = 256 - h + 8; wy < 248; wy += 12) for (let wx = x + 6; wx < x + w - 6; wx += 10) {
        if (random() < (night ? 0.35 : 0.15)) { g.fillStyle = night ? `rgba(253,224,138,${0.5 + random() * 0.5})` : 'rgba(255,255,255,0.45)'; g.fillRect(wx, wy, 5, 6); }
      }
      x += w + 4 + random() * 12;
    }
  });
}

function buildRoom(scene: T.Scene) {
  const width = FLOOR.maxX - FLOOR.minX, depth = FLOOR.maxZ - FLOOR.minZ;
  const floor = new T.Mesh(new T.PlaneGeometry(width, depth), new T.MeshStandardMaterial({ map: woodTexture(), roughness: 0.62 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Back wall with a row of tall windows; the skyline runs across them, day and night crossfading.
  const wallZ = FLOOR.minZ;
  scene.add(at(box(width, 3.4, 0.2, COLORS.wall), 0, 1.7, wallZ - 0.1));
  const day = new T.MeshBasicMaterial({ map: skylineTexture(false), toneMapped: false });
  const night = live(new T.MeshBasicMaterial({ map: skylineTexture(true), toneMapped: false, transparent: true, opacity: 1 }));
  const panes: number[] = [];
  for (let x = FLOOR.minX + 1.6; x < FLOOR.maxX - 1; x += 2.6) panes.push(x);
  panes.forEach((x, i) => {
    for (const [material, z] of [[day, 0.01], [night, 0.015]] as const) {
      const geometry = new T.PlaneGeometry(2.3, 2.2);
      const uv = geometry.attributes.uv as T.BufferAttribute;
      for (let v = 0; v < uv.count; v++) uv.setX(v, (i + uv.getX(v) * 0.88 + 0.06) / panes.length);
      scene.add(at(new T.Mesh(geometry, material), x, 1.85, wallZ + z));
    }
    // Mullions and sill.
    scene.add(at(box(0.06, 2.2, 0.05, '#cbd5e1'), x, 1.85, wallZ + 0.03), at(box(2.4, 0.06, 0.12, '#cbd5e1'), x, 0.74, wallZ + 0.06));
  });
  scene.add(at(box(width, 0.12, 0.3, COLORS.rail), 0, 0.75, wallZ + 0.1));

  // Side wall on the lounge side.
  scene.add(at(box(0.2, 3.4, depth, COLORS.wall), FLOOR.minX - 0.1, 1.7, 0));

  // Glass railings on the open sides, like a mezzanine.
  const glass = new T.MeshStandardMaterial({ color: COLORS.glass, transparent: true, opacity: 0.18, roughness: 0.1 });
  const front = new T.Mesh(new T.BoxGeometry(width, 0.9, 0.04), glass);
  scene.add(at(front, 0, 0.45, FLOOR.maxZ), at(box(width, 0.06, 0.12, COLORS.rail), 0, 0.92, FLOOR.maxZ));
  const side = new T.Mesh(new T.BoxGeometry(0.04, 0.9, depth), glass);
  scene.add(at(side, FLOOR.maxX, 0.45, 0), at(box(0.12, 0.06, depth, COLORS.rail), FLOOR.maxX, 0.92, 0));

  // A glass partition between the lounge and the desks, open at the lounge exit.
  const partition = new T.Mesh(new T.BoxGeometry(0.04, 1.1, 4.2), glass);
  scene.add(at(partition, -3.6, 0.55, -4.6), at(box(0.1, 0.05, 4.2, COLORS.rail), -3.6, 1.1, -4.6));
  return night;
}

type ScreenKind = 'sheet' | 'doc' | 'slides' | 'design' | 'mail' | 'dash';
const SCREEN_KIND: Record<TaskCategoryId, ScreenKind> = {
  spreadsheet: 'sheet', data: 'sheet', document: 'doc', translation: 'doc', research: 'doc', presentation: 'slides', design: 'design', correspondence: 'mail',
};
type ScreenState = { kind: ScreenKind | 'off'; accent: string; progress: number; asking: boolean; counts?: number[] };

/** What a desk's screen shows: the kind of work being built, as far as it has got. */
function drawScreen(g: CanvasRenderingContext2D, s: ScreenState) {
  const W = 192, H = 112;
  g.fillStyle = '#04060c';
  g.fillRect(0, 0, W, H);
  if (s.kind === 'off') {
    g.fillStyle = 'rgba(148,163,184,0.08)';
    g.beginPath(); g.arc(W / 2, H / 2, 6, 0, Math.PI * 2); g.fill();
    return;
  }
  g.fillStyle = '#0f172a';
  g.fillRect(0, 0, W, H);
  g.fillStyle = s.accent;
  g.fillRect(0, 0, W, 9);
  g.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 3; i++) g.fillRect(6 + i * 7, 3, 4, 3);
  const p = Math.max(0, Math.min(1, s.progress));
  const lines = (x: number, y: number, width: number, count: number, gap = 7, color = '#cbd5e1') => {
    for (let i = 0; i < count; i++) { g.fillStyle = color; g.fillRect(x, y + i * gap, width * (0.55 + ((i * 37) % 45) / 100), 3); }
  };
  switch (s.kind) {
    case 'sheet': {
      const rows = 8, cols = 6, cw = (W - 16) / cols, rh = 9;
      g.fillStyle = s.accent; g.globalAlpha = 0.35; g.fillRect(8, 14, W - 16, rh); g.globalAlpha = 1;
      const filled = Math.ceil(p * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        g.strokeStyle = '#1e293b'; g.strokeRect(8 + c * cw, 14 + (r + 1) * rh, cw, rh);
        if (r < filled) { g.fillStyle = c === cols - 1 ? s.accent : '#94a3b8'; g.fillRect(10 + c * cw, 17 + (r + 1) * rh, cw * (0.4 + ((r * 3 + c * 5) % 5) / 10), 3); }
      }
      break;
    }
    case 'doc': {
      g.fillStyle = '#f8fafc'; g.fillRect(48, 13, 96, H - 26);
      g.fillStyle = s.accent; g.fillRect(56, 19, 50, 5);
      lines(56, 30, 80, Math.ceil(p * 9), 7, '#94a3b8');
      break;
    }
    case 'slides': {
      for (let i = 0; i < 4; i++) { g.fillStyle = i / 4 < p ? '#334155' : '#1e293b'; g.fillRect(6, 14 + i * 22, 30, 18); }
      g.fillStyle = '#f8fafc'; g.fillRect(44, 14, W - 52, H - 30);
      g.fillStyle = s.accent; g.fillRect(52, 20, 70, 7);
      if (p > 0.3) lines(52, 34, 60, 4, 8, '#94a3b8');
      if (p > 0.55) { g.fillStyle = s.accent; g.globalAlpha = 0.6; g.fillRect(124, 34, 52, 40); g.globalAlpha = 1; }
      break;
    }
    case 'design': {
      g.fillStyle = '#f1f5f9'; g.fillRect(40, 13, 112, H - 26);
      const shapes = [() => { g.fillStyle = s.accent; g.beginPath(); g.arc(78, 46, 18, 0, Math.PI * 2); g.fill(); },
        () => { g.fillStyle = '#0f172a'; g.fillRect(100, 30, 40, 10); },
        () => { g.fillStyle = '#f97316'; g.fillRect(100, 46, 30, 22); },
        () => { g.fillStyle = '#64748b'; g.fillRect(52, 72, 88, 5); g.fillRect(52, 80, 60, 4); }];
      shapes.slice(0, Math.ceil(p * shapes.length)).forEach(draw => draw());
      // Tool palette on the left.
      ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'].forEach((c, i) => { g.fillStyle = c; g.fillRect(14, 18 + i * 12, 14, 8); });
      break;
    }
    case 'mail': {
      g.fillStyle = '#1e293b'; g.fillRect(8, 14, W - 16, 22);
      lines(14, 18, 90, 2, 8, '#64748b');
      g.fillStyle = '#f8fafc'; g.fillRect(8, 40, W - 16, H - 54);
      lines(14, 46, 150, Math.ceil(p * 7), 7, '#94a3b8');
      g.fillStyle = s.accent; g.fillRect(W - 48, H - 22, 36, 9);
      break;
    }
    case 'dash': {
      const counts = s.counts ?? [];
      const max = Math.max(1, ...counts);
      const colors = [BOARD_COLORS.queued, BOARD_COLORS.working, BOARD_COLORS.asking, BOARD_COLORS.review, BOARD_COLORS.approved];
      counts.forEach((n, i) => {
        const h = 6 + (n / max) * 58;
        g.fillStyle = colors[i]; g.fillRect(16 + i * 34, H - 22 - h, 24, h);
      });
      g.fillStyle = '#334155'; g.fillRect(10, H - 21, W - 20, 2);
      lines(14, 16, 70, 2, 7, '#64748b');
      return;
    }
  }
  g.fillStyle = '#1e293b'; g.fillRect(8, H - 8, W - 16, 4);
  g.fillStyle = s.accent; g.fillRect(8, H - 8, (W - 16) * p, 4);
  if (s.asking) {
    g.fillStyle = 'rgba(2,6,23,0.55)'; g.fillRect(0, 0, W, H);
    g.fillStyle = COLORS.ask; g.beginPath(); g.arc(W / 2, H / 2, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#04111d'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', W / 2, H / 2 + 1);
  }
}

type DeskParts = {
  screen: T.MeshBasicMaterial; glow: T.MeshBasicMaterial; lamp: T.MeshStandardMaterial;
  draw: (state: ScreenState) => void; key: string; level: number;
};

function buildDesk(scene: T.Scene, desk: Desk, wide = false): DeskParts {
  const group = at(new T.Group(), desk.x, 0, desk.z);
  const w = wide ? 1.9 : 1.4;
  group.add(at(box(w, 0.06, 0.8, COLORS.deskTop), 0, 0.75, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) group.add(at(box(0.05, 0.72, 0.05, COLORS.metal), sx * (w / 2 - 0.06), 0.36, sz * 0.34));
  group.add(at(box(0.06, 0.22, 0.06, COLORS.metal), 0, 0.89, -0.22), at(box(0.22, 0.02, 0.16, COLORS.metal), 0, 0.79, -0.22));
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 112;
  const g = canvas.getContext('2d')!;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const screen = live(new T.MeshBasicMaterial({ map: texture, toneMapped: false }));
  screen.color.setScalar(0.35);
  group.add(at(box(0.66, 0.4, 0.04, COLORS.metal), 0, 1.12, -0.22));
  group.add(at(new T.Mesh(new T.PlaneGeometry(0.6, 0.35), screen), 0, 1.12, -0.199));
  group.add(at(box(0.42, 0.02, 0.14, '#3f3f46'), 0, 0.79, 0.08), at(box(0.07, 0.02, 0.1, '#52525b'), 0.3, 0.79, 0.1));
  // A mug and a desk lamp that comes on at night.
  const mug = new T.Mesh(new T.CylinderGeometry(0.04, 0.035, 0.09, 12), new T.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.5 }));
  mug.castShadow = true;
  group.add(at(mug, -w / 2 + 0.2, 0.825, 0.12));
  const lamp = live(new T.MeshStandardMaterial({ color: '#f8fafc', emissive: COLORS.lamp, emissiveIntensity: 0, roughness: 0.4 }));
  group.add(at(box(0.03, 0.34, 0.03, COLORS.metal), w / 2 - 0.15, 0.95, -0.25));
  group.add(at(new T.Mesh(new T.ConeGeometry(0.09, 0.1, 14, 1, true), lamp), w / 2 - 0.15, 1.1, -0.2));

  // Chair on the aisle side; its back stays behind the person, who faces the windows.
  const chair = at(new T.Group(), desk.chair.x - desk.x, 0, desk.chair.z - desk.z);
  chair.add(at(box(0.5, 0.08, 0.5, COLORS.chair), 0, 0.44, 0));
  chair.add(at(box(0.5, 0.55, 0.08, COLORS.chair), 0, 0.75, 0.24));
  chair.add(at(box(0.06, 0.4, 0.06, COLORS.metal), 0, 0.2, 0));
  chair.add(at(box(0.5, 0.03, 0.06, COLORS.metal), 0, 0.03, 0), at(box(0.06, 0.03, 0.5, COLORS.metal), 0, 0.03, 0));
  group.add(chair);

  const glow = new T.Mesh(new T.CircleGeometry(1.15, 40), live(new T.MeshBasicMaterial({ color: COLORS.glow, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })));
  glow.rotation.x = -Math.PI / 2;
  group.add(at(glow, 0, 0.01, 0.35));
  scene.add(group);
  const parts: DeskParts = {
    screen, glow: glow.material as T.MeshBasicMaterial, lamp, key: '', level: 0.35,
    draw(state) { drawScreen(g, state); texture.needsUpdate = true; },
  };
  parts.draw({ kind: 'off', accent: '#000', progress: 0, asking: false });
  return parts;
}

function buildLounge(scene: T.Scene) {
  const rug = new T.Mesh(new T.PlaneGeometry(LOUNGE.maxX - LOUNGE.minX, LOUNGE.maxZ - LOUNGE.minZ), new T.MeshStandardMaterial({ color: '#c26d4f', roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.receiveShadow = true;
  scene.add(at(rug, (LOUNGE.minX + LOUNGE.maxX) / 2, 0.005, (LOUNGE.minZ + LOUNGE.maxZ) / 2));
  const sofa = (x: number, z: number, facing: number, length: number) => {
    const group = at(new T.Group(), x, 0, z);
    group.rotation.y = facing;
    group.add(at(box(length, 0.38, 0.8, COLORS.sofa), 0, 0.19, 0));
    group.add(at(box(length, 0.55, 0.22, COLORS.sofa), 0, 0.55, -0.4));
    for (const side of [-1, 1]) group.add(at(box(0.22, 0.55, 0.8, COLORS.sofa), side * (length / 2 + 0.05), 0.3, 0));
    for (let i = 0; i < Math.max(1, Math.round(length / 1.2)); i++) {
      const cushion = at(box(0.42, 0.32, 0.12, COLORS.cushion), -length / 2 + (i + 0.5) * (length / Math.max(1, Math.round(length / 1.2))), 0.58, -0.25);
      cushion.rotation.x = -0.25;
      group.add(cushion);
    }
    scene.add(group);
  };
  sofa(-8, -5.55, 0, 3.6);
  sofa(-8, -2.05, Math.PI, 3.6);
  for (const seat of LOUNGE_SEATS.slice(6)) sofa(seat.x, seat.z, seat.facing, 0.9);
  scene.add(at(box(1.6, 0.08, 0.9, COLORS.woodDark), LOUNGE.table.x, 0.38, LOUNGE.table.z), at(box(1.2, 0.34, 0.5, COLORS.woodDark), LOUNGE.table.x, 0.17, LOUNGE.table.z));
  scene.add(at(box(0.3, 0.12, 0.22, '#e5e7eb'), LOUNGE.table.x - 0.3, 0.48, LOUNGE.table.z));
  const cup = new T.Mesh(new T.CylinderGeometry(0.05, 0.04, 0.08, 12), new T.MeshStandardMaterial({ color: '#f97316' }));
  scene.add(at(cup, LOUNGE.table.x + 0.35, 0.46, LOUNGE.table.z + 0.1));
  // A floor lamp in the lounge corner, lit at night.
  const shade = live(new T.MeshStandardMaterial({ color: '#fef3c7', emissive: COLORS.lamp, emissiveIntensity: 0, roughness: 0.6 }));
  scene.add(at(box(0.04, 1.6, 0.04, COLORS.metal), -10.6, 0.8, -6.4));
  scene.add(at(new T.Mesh(new T.CylinderGeometry(0.18, 0.26, 0.3, 18, 1, true), shade), -10.6, 1.65, -6.4));
  return shade;
}

function buildDecor(scene: T.Scene) {
  const plant = (x: number, z: number, scale = 1) => {
    scene.add(at(box(0.4 * scale, 0.45 * scale, 0.4 * scale, '#e5e7eb'), x, 0.22 * scale, z));
    const leaves = new T.Mesh(new T.IcosahedronGeometry(0.42 * scale, 0), new T.MeshStandardMaterial({ color: '#2f855a', flatShading: true }));
    leaves.castShadow = true;
    scene.add(at(leaves, x, 0.85 * scale, z));
    const top = new T.Mesh(new T.IcosahedronGeometry(0.28 * scale, 0), new T.MeshStandardMaterial({ color: '#38a169', flatShading: true }));
    top.castShadow = true;
    scene.add(at(top, x + 0.08, 1.18 * scale, z - 0.05));
  };
  [plant(-11.3, -7.3), plant(11.3, -7.3), plant(-6.3, 7.4, 0.8), plant(-4.1, -7.3), plant(11.3, 7.6, 0.7), plant(0.3, -7.3, 0.7), plant(-11.3, 3.3, 0.8)];
  // Water cooler by the lounge exit.
  scene.add(at(box(0.36, 1, 0.36, '#e5e7eb'), -4.3, 0.5, -7.4));
  const bottle = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.42, 16), new T.MeshStandardMaterial({ color: '#60a5fa', transparent: true, opacity: 0.7 }));
  scene.add(at(bottle, -4.3, 1.21, -7.4));
  // A printer by the desks, where deliveries come out.
  scene.add(at(box(0.7, 0.7, 0.5, '#d4d4d8'), -2.6, 0.35, 6.9), at(box(0.5, 0.06, 0.3, '#f8fafc'), -2.6, 0.73, 6.85));
}

/** Kitchen along the side wall: counter, cabinets, coffee machine with steam, fridge, microwave. */
function buildKitchen(scene: T.Scene) {
  const depth = 0.6, x = KITCHEN.x + 0.05;
  const counterLength = KITCHEN.fridgeZ - 0.45 - KITCHEN.minZ;
  const counterZ = KITCHEN.minZ + counterLength / 2;
  scene.add(at(box(depth, 0.86, counterLength, '#f1f5f9'), x, 0.43, counterZ));
  scene.add(at(box(depth + 0.04, 0.05, counterLength + 0.02, '#334155'), x, 0.885, counterZ));
  for (let z = KITCHEN.minZ + 0.35; z < KITCHEN.fridgeZ - 0.5; z += 0.55) scene.add(at(box(0.02, 0.7, 0.5, '#e2e8f0'), x + depth / 2 + 0.005, 0.45, z));
  scene.add(at(box(0.36, 0.55, counterLength, '#e2e8f0'), KITCHEN.x - 0.05, 1.85, counterZ));
  // Coffee machine: body, spout, a light that turns green while it brews.
  const machine = live(at(box(0.36, 0.48, 0.34, '#18181b'), x, 1.15, KITCHEN.coffeeZ));
  machine.userData.pick = { kind: 'coffee' } satisfies StagePick;
  scene.add(machine);
  scene.add(at(box(0.1, 0.06, 0.12, '#52525b'), x + 0.18, 1.05, KITCHEN.coffeeZ));
  const light = live(new T.MeshBasicMaterial({ color: '#ef4444' }));
  scene.add(at(new T.Mesh(new T.SphereGeometry(0.025, 8, 6), light), x + 0.185, 1.3, KITCHEN.coffeeZ + 0.1));
  const steam = Array.from({ length: 6 }, () => {
    const puff = live(new T.Mesh(new T.SphereGeometry(0.05, 8, 6), new T.MeshBasicMaterial({ color: '#f8fafc', transparent: true, opacity: 0, depthWrite: false })));
    scene.add(puff);
    return puff;
  });
  // Mugs, a kettle, a microwave and the fridge.
  for (const [i, color] of ['#f97316', '#3b82f6', '#22c55e'].entries()) {
    const mug = new T.Mesh(new T.CylinderGeometry(0.045, 0.04, 0.1, 12), new T.MeshStandardMaterial({ color }));
    scene.add(at(mug, x + 0.05, 0.96, KITCHEN.coffeeZ + 0.45 + i * 0.13));
  }
  scene.add(at(box(0.36, 0.26, 0.48, '#d4d4d8'), x - 0.02, 1.04, KITCHEN.minZ + 0.45), at(box(0.02, 0.18, 0.3, '#0f172a'), x + 0.165, 1.04, KITCHEN.minZ + 0.42));
  const kettle = new T.Mesh(new T.CylinderGeometry(0.08, 0.1, 0.2, 14), new T.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.6, roughness: 0.3 }));
  scene.add(at(kettle, x, 1.01, counterZ + 0.3));
  scene.add(at(box(0.7, 1.9, 0.8, '#e5e7eb', { metalness: 0.3, roughness: 0.4 }), KITCHEN.x + 0.1, 0.95, KITCHEN.fridgeZ));
  scene.add(at(box(0.03, 0.5, 0.04, '#94a3b8'), KITCHEN.x + 0.47, 1.25, KITCHEN.fridgeZ - 0.3));
  // Café table with two stools.
  const top = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.05, 24), new T.MeshStandardMaterial({ color: '#f5f5f4', roughness: 0.4 }));
  top.castShadow = true;
  scene.add(at(top, CAFE_TABLE.x, 0.74, CAFE_TABLE.z), at(box(0.06, 0.72, 0.06, COLORS.metal), CAFE_TABLE.x, 0.36, CAFE_TABLE.z));
  for (const side of [-1, 1]) {
    const seat = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.06, 16), new T.MeshStandardMaterial({ color: '#b45309' }));
    seat.castShadow = true;
    scene.add(at(seat, CAFE_TABLE.x + side * 0.6, 0.44, CAFE_TABLE.z), at(box(0.04, 0.42, 0.04, COLORS.metal), CAFE_TABLE.x + side * 0.6, 0.21, CAFE_TABLE.z));
  }
  return { steam, light };
}

/** A racing game: split screen for two players, one road against the console otherwise. */
function drawGame(g: CanvasRenderingContext2D, w: number, h: number, time: number, players: number) {
  const road = (x0: number, width: number, color: string, wobble: number) => {
    g.save();
    g.beginPath(); g.rect(x0, 0, width, h); g.clip();
    g.fillStyle = '#14532d'; g.fillRect(x0, 0, width, h);
    const mid = x0 + width / 2, sway = Math.sin(time * 0.8 + wobble) * width * 0.12;
    g.fillStyle = '#334155'; g.beginPath(); g.moveTo(mid - width * 0.08 + sway, 0); g.lineTo(mid + width * 0.08 + sway, 0); g.lineTo(x0 + width * 0.92, h); g.lineTo(x0 + width * 0.08, h); g.fill();
    g.fillStyle = '#f8fafc';
    for (let i = 0; i < 6; i++) { const y = ((i * h) / 5 + time * 70) % (h + 12) - 12; g.fillRect(mid - 2 + (sway * (1 - y / h)), y, 4, 6 + (y / h) * 10); }
    const cx = mid + Math.sin(time * 2.1 + wobble) * width * 0.12;
    g.fillStyle = color; g.fillRect(cx - width * 0.07, h * 0.72, width * 0.14, h * 0.2);
    g.fillStyle = '#0f172a'; g.fillRect(cx - width * 0.05, h * 0.75, width * 0.1, h * 0.05);
    g.restore();
  };
  if (players >= 2) {
    road(0, w / 2 - 1, '#ef4444', 0);
    road(w / 2 + 1, w / 2 - 1, '#3b82f6', 1.7);
    g.fillStyle = '#0f172a'; g.fillRect(w / 2 - 1, 0, 2, h);
  } else road(0, w, '#ef4444', 0);
  g.fillStyle = '#fde047'; g.font = 'bold 13px sans-serif'; g.fillText(`TUR ${1 + (Math.floor(time / 20) % 3)}/3`, 8, 16);
}

/** The record in the screen's top right corner, small enough not to steal the picture. */
function drawRecord(g: CanvasRenderingContext2D, w: number, best: number) {
  if (best <= 0) return;
  const text = `REKOR ${formatScore(best)}`;
  g.font = 'bold 12px sans-serif';
  const width = g.measureText(text).width + 12;
  g.fillStyle = 'rgba(2,6,23,0.6)'; g.fillRect(w - width - 6, 5, width, 18);
  g.fillStyle = '#fde047'; g.textAlign = 'right'; g.fillText(text, w - 12, 18); g.textAlign = 'start';
}

/** The games corner: a big screen on a low stand facing the room, a console, two bean bags. */
function buildGamingCorner(scene: T.Scene) {
  const { x, screenZ, seatZ, standWidth } = GAMING;
  scene.add(at(box(standWidth, 0.45, 0.45, '#27272a'), x, 0.225, screenZ));
  const consoleBox = at(box(0.32, 0.07, 0.24, '#f8fafc'), x - 0.5, 0.485, screenZ + 0.02);
  const consoleLight = live(new T.MeshBasicMaterial({ color: '#3b82f6' }));
  scene.add(consoleBox, at(new T.Mesh(new T.BoxGeometry(0.2, 0.008, 0.01), consoleLight), x - 0.5, 0.485, screenZ + 0.145));
  scene.add(at(box(1.75, 1.0, 0.07, '#09090b'), x, 1.05, screenZ - 0.05));
  const canvas = document.createElement('canvas');
  canvas.width = 288;
  canvas.height = 162;
  const g = canvas.getContext('2d')!;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const screen = at(new T.Mesh(new T.PlaneGeometry(1.64, 0.92), live(new T.MeshBasicMaterial({ map: texture, toneMapped: false }))), x, 1.05, screenZ - 0.01);
  screen.userData.pick = { kind: 'tv' } satisfies StagePick;
  scene.add(screen);
  const rug = new T.Mesh(new T.CircleGeometry(1.3, 32), new T.MeshStandardMaterial({ color: '#1e3a8a', roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.receiveShadow = true;
  scene.add(at(rug, x, 0.006, seatZ - 0.1));
  for (const [side, color] of [[-1, '#f97316'], [1, '#14b8a6']] as const) {
    const bag = new T.Mesh(new T.SphereGeometry(0.42, 18, 12), new T.MeshStandardMaterial({ color, roughness: 0.9 }));
    bag.scale.set(1, 0.55, 1);
    bag.castShadow = true;
    scene.add(at(bag, x + side * 0.6, 0.22, seatZ + 0.12));
  }
  let shown = '', record = 0;
  const draw = (players: number, time: number) => {
    const key = players ? `${players}|${Math.floor(time * 12)}` : `idle|${record}`;
    if (key === shown) return;
    shown = key;
    if (players) drawGame(g, 288, 162, time, players);
    else {
      const idle = g.createLinearGradient(0, 0, 288, 162);
      idle.addColorStop(0, '#1e1b4b'); idle.addColorStop(1, '#0c4a6e');
      g.fillStyle = idle; g.fillRect(0, 0, 288, 162);
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.fillText('BAŞLAMAK İÇİN BİR TUŞA BASIN', 144, 86);
      if (record > 0) { g.fillStyle = '#fde047'; g.font = 'bold 13px sans-serif'; g.fillText(`REKOR ${formatScore(record)}`, 144, 110); }
      g.textAlign = 'start';
    }
    if (players) drawRecord(g, 288, record);
    texture.needsUpdate = true;
    consoleLight.color.set(players ? '#22c55e' : '#3b82f6');
  };
  draw(0, 0);
  /** A new record shows on the next frame; nothing is redrawn until then. */
  const setRecord = (best: number) => { record = Math.max(0, Math.floor(best)); };
  return { draw, screen, setRecord };
}

/** The TV corner: a screen showing a programme, a sofa facing it. */
function buildTvCorner(scene: T.Scene) {
  scene.add(at(box(0.45, 0.5, 1.8, '#3f3f46'), TV.x, 0.25, TV.z));
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 144;
  const g = canvas.getContext('2d')!;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const screen = live(new T.MeshBasicMaterial({ map: texture, toneMapped: false }));
  scene.add(at(box(0.08, 0.95, 1.65, '#09090b'), TV.x + 0.05, 1.12, TV.z));
  const panel = new T.Mesh(new T.PlaneGeometry(1.55, 0.86), screen);
  panel.rotation.y = -Math.PI / 2;
  scene.add(at(panel, TV.x, 1.12, TV.z));
  const rug = new T.Mesh(new T.PlaneGeometry(2.4, 2.6), new T.MeshStandardMaterial({ color: '#334155', roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.receiveShadow = true;
  scene.add(at(rug, (TV.x + TV.sofaX) / 2, 0.006, TV.z));
  const group = at(new T.Group(), TV.sofaX, 0, TV.z);
  group.rotation.y = Math.PI / 2;
  group.add(at(box(2.0, 0.38, 0.8, '#7c3aed'), 0, 0.19, 0), at(box(2.0, 0.55, 0.22, '#7c3aed'), 0, 0.55, -0.4));
  for (const side of [-1, 1]) group.add(at(box(0.22, 0.55, 0.8, '#6d28d9'), side * 1.05, 0.3, 0));
  scene.add(group);
  let frame = 0;
  /** Redrawn a few times a second while someone watches. */
  const draw = (mode: 'off' | 'tv', time: number) => {
    frame++;
    if (mode === 'off') {
      const off = g.createLinearGradient(0, 0, 256, 144);
      off.addColorStop(0, '#0b0f19'); off.addColorStop(1, '#151b2b');
      g.fillStyle = off; g.fillRect(0, 0, 256, 144);
    } else if (mode === 'tv') {
      // A nature programme: sky, hills, a moving sun and the channel logo.
      const sky = g.createLinearGradient(0, 0, 0, 144);
      sky.addColorStop(0, '#38bdf8'); sky.addColorStop(1, '#bae6fd');
      g.fillStyle = sky; g.fillRect(0, 0, 256, 144);
      g.fillStyle = '#fde047'; g.beginPath(); g.arc(40 + ((time * 8) % 180), 34, 14, 0, Math.PI * 2); g.fill();
      for (const [color, base, amp, speed] of [['#4ade80', 98, 12, 10], ['#16a34a', 112, 9, 18]] as const) {
        g.fillStyle = color; g.beginPath(); g.moveTo(0, 144);
        for (let px = 0; px <= 256; px += 8) g.lineTo(px, base + Math.sin((px + time * speed) / 30) * amp);
        g.lineTo(256, 144); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(222, 8, 26, 10);
    }
    texture.needsUpdate = true;
  };
  draw('off', 0);
  return { draw, frame: () => frame };
}

/** Bookshelf against the side wall, and a clock showing the real time. */
function buildShelfAndClock(scene: T.Scene) {
  const x = BOOKSHELF.x, z = BOOKSHELF.z;
  scene.add(at(box(0.36, 2, 1.6, '#92400e'), x, 1, z));
  const colors = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#e11d48', '#65a30d'];
  for (let shelf = 0; shelf < 4; shelf++) {
    scene.add(at(box(0.32, 0.03, 1.5, '#78350f'), x + 0.03, 0.25 + shelf * 0.48, z));
    for (let i = 0, offset = -0.68; offset < 0.66; i++) {
      const w = 0.06 + ((i * 7 + shelf * 3) % 4) * 0.015, h = 0.26 + ((i * 5 + shelf) % 3) * 0.05;
      scene.add(at(box(0.22, h, w, colors[(i + shelf * 3) % colors.length]), x + 0.06, 0.27 + shelf * 0.48 + h / 2, z + offset + w / 2));
      offset += w + 0.012;
    }
  }
  const face = new T.Mesh(new T.CircleGeometry(0.32, 32), new T.MeshStandardMaterial({ color: '#f8fafc' }));
  face.rotation.y = Math.PI / 2;
  scene.add(at(face, FLOOR.minX + 0.02, 2.55, LOUNGE.table.z));
  const ring = new T.Mesh(new T.TorusGeometry(0.32, 0.03, 8, 32), new T.MeshStandardMaterial({ color: '#1f2937' }));
  ring.rotation.y = Math.PI / 2;
  scene.add(at(ring, FLOOR.minX + 0.02, 2.55, LOUNGE.table.z));
  const hand = (length: number, width: number) => {
    const pivot = live(at(new T.Group(), FLOOR.minX + 0.04, 2.55, LOUNGE.table.z));
    pivot.add(at(new T.Mesh(new T.BoxGeometry(0.01, length, width), new T.MeshBasicMaterial({ color: '#111827' })), 0, length / 2, 0));
    scene.add(pivot);
    return pivot;
  };
  return { hour: hand(0.18, 0.03), minute: hand(0.27, 0.02) };
}

/** The task board on the back wall: one tile per task, coloured by its status, drawn on one texture. */
function buildBoard(scene: T.Scene) {
  const group = at(new T.Group(), BOARD_X - 0.05, 1.95, FLOOR.minZ + 0.06);
  group.add(at(box(4.4, 1.7, 0.06, '#f8fafc'), 0, 0, 0));
  const canvas = document.createElement('canvas');
  canvas.width = 424;
  canvas.height = 150;
  const g = canvas.getContext('2d')!;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const material = live(new T.MeshBasicMaterial({ map: texture, toneMapped: false }));
  group.add(at(new T.Mesh(new T.PlaneGeometry(4.24, 1.5), material), 0, 0, 0.04));
  scene.add(group);
  /** Tiles of work in progress pulse with `glow` (0..1). */
  return (statuses: Array<TaskStatus | undefined>, glow: number) => {
    g.fillStyle = '#f8fafc';
    g.fillRect(0, 0, 424, 150);
    for (let i = 0; i < 24; i++) {
      const status = statuses[i];
      const active = status === 'working' || status === 'asking';
      g.globalAlpha = active ? 0.7 + glow * 0.3 : status ? 0.9 : 1;
      g.fillStyle = BOARD_COLORS[status ?? 'empty'];
      g.fillRect(4 + (i % 8) * 53, 4 + Math.floor(i / 8) * 50, 46, 42);
    }
    g.globalAlpha = 1;
    texture.needsUpdate = true;
  };
}

/** What decides whether two meshes can share one draw call. */
function lookKey(material: T.Material) {
  const m = material as T.MeshStandardMaterial;
  return [m.type, m.color?.getHexString(), m.emissive?.getHexString(), m.emissiveIntensity, m.roughness, m.metalness, m.map?.uuid,
    m.transparent, m.opacity, m.side, m.flatShading, m.blending, m.depthWrite, m.toneMapped].join('|');
}

/**
 * The furniture never moves, so its hundreds of small meshes are merged into one mesh per look
 * (material, texture, shadow flags): a few dozen draw calls instead of over a thousand a frame.
 * Whatever the scene changes while running (screens, lamps, glow, the board, steam, clock hands,
 * the TV) is marked live and stays as it is.
 */
function bakeStatic(scene: T.Scene) {
  scene.updateMatrixWorld(true);
  const looks = new Map<string, { material: T.Material; cast: boolean; receive: boolean; parts: T.BufferGeometry[] }>();
  const baked: T.Mesh[] = [];
  scene.traverse(object => {
    if (!(object instanceof T.Mesh) || Array.isArray(object.material) || object.material.userData.live) return;
    for (let node: T.Object3D | null = object; node; node = node.parent) if (node.userData.live) return;
    const key = `${lookKey(object.material)}|${object.castShadow}|${object.receiveShadow}`;
    const look = looks.get(key) ?? { material: object.material as T.Material, cast: object.castShadow, receive: object.receiveShadow, parts: [] as T.BufferGeometry[] };
    looks.set(key, look);
    const geometry = object.geometry as T.BufferGeometry;
    const part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(part.attributes)) if (!['position', 'normal', 'uv'].includes(name)) part.deleteAttribute(name);
    part.applyMatrix4(object.matrixWorld);
    look.parts.push(part);
    baked.push(object);
  });
  for (const object of baked) {
    object.removeFromParent();
    object.geometry.dispose();
  }
  for (const look of looks.values()) {
    const merged = mergeGeometries(look.parts);
    look.parts.forEach(part => part.dispose());
    if (!merged) continue;
    const mesh = new T.Mesh(merged, look.material);
    mesh.castShadow = look.cast;
    mesh.receiveShadow = look.receive;
    scene.add(mesh);
  }
}

type Person = {
  root: T.Group; body: T.Group; head: T.Group;
  legs: [T.Group, T.Group]; knees: [T.Group, T.Group]; arms: [T.Group, T.Group];
  facing: number;
  /** 0 standing, 1 seated; eased so people sit down and get up. */
  sit: number;
  /** The sheet that floats up when the person hands work in. */
  paper: T.Group; paperMaterials: T.MeshBasicMaterial[];
  /** What the person holds; at most one shows at a time. */
  props: Record<Prop, T.Object3D>;
};

type Prop = 'mug' | 'phone' | 'book' | 'controller' | 'can' | 'sheet';

/** One material for everyone: colours come from the vertices. */
const PERSON_MATERIAL = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

function buildPerson(look: Look, scene: T.Scene): Person {
  const root = new T.Group();
  const body = new T.Group();
  root.add(body);
  // Each moving part is one mesh with its colours painted on the vertices: eight draw calls a person.
  type Piece = [geometry: T.BufferGeometry, color: string, x: number, y: number, z: number, extra?: { rx?: number; sz?: number }];
  const part = (...pieces: Piece[]) => {
    const painted = pieces.map(([geometry, color, x, y, z, extra]) => {
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      if (flat !== geometry) geometry.dispose();
      for (const name of Object.keys(flat.attributes)) if (!['position', 'normal'].includes(name)) flat.deleteAttribute(name);
      flat.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(extra?.rx ?? 0, 0, 0)), new T.Vector3(1, 1, extra?.sz ?? 1)));
      const tint = new T.Color(color);
      flat.setAttribute('color', new T.Float32BufferAttribute(Array.from({ length: flat.attributes.position.count }, () => [tint.r, tint.g, tint.b]).flat(), 3));
      return flat;
    });
    const mesh = new T.Mesh(mergeGeometries(painted)!, PERSON_MATERIAL);
    painted.forEach(g => g.dispose());
    mesh.castShadow = true;
    return mesh;
  };
  const shoe = '#18181b', eye = '#111827', cheek = '#efb0a1';

  // Thigh from the hip, shin from the knee: seated legs bend at the knee instead of sticking out.
  const knees: T.Group[] = [];
  const legs = [-1, 1].map(side => {
    const hip = at(new T.Group(), side * 0.09, 0.48, 0);
    hip.add(part([new T.BoxGeometry(0.15, 0.24, 0.17), look.pants, 0, -0.12, 0]));
    const knee = at(new T.Group(), 0, -0.23, 0);
    knee.add(part([new T.BoxGeometry(0.14, 0.22, 0.15), look.pants, 0, -0.1, 0], [new T.BoxGeometry(0.16, 0.07, 0.24), shoe, 0, -0.215, 0.04]));
    hip.add(knee);
    knees.push(knee);
    body.add(hip);
    return hip;
  }) as [T.Group, T.Group];

  body.add(part([new T.CapsuleGeometry(0.2, 0.3, 4, 12), look.shirt, 0, 0.82, 0, { sz: 0.78 }], [new T.CylinderGeometry(0.08, 0.1, 0.06, 12), look.skin, 0, 1.15, 0]));

  const arms = [-1, 1].map(side => {
    const shoulder = at(new T.Group(), side * 0.26, 1.06, 0);
    shoulder.add(part([new T.CapsuleGeometry(0.065, 0.26, 4, 8), look.shirt, 0, -0.18, 0], [new T.SphereGeometry(0.065, 10, 8), look.skin, 0, -0.38, 0]));
    body.add(shoulder);
    return shoulder;
  }) as [T.Group, T.Group];

  const head = at(new T.Group(), 0, 1.36, 0);
  head.add(part(
    [new T.SphereGeometry(0.21, 20, 16), look.skin, 0, 0, 0],
    ...[-1, 1].map((side): Piece => [new T.SphereGeometry(0.026, 8, 6), eye, side * 0.075, 0.02, 0.19]),
    ...[-1, 1].map((side): Piece => [new T.SphereGeometry(0.03, 8, 6), cheek, side * 0.11, -0.04, 0.17, { sz: 0.4 }]),
    [new T.SphereGeometry(look.hairStyle === 'buzz' ? 0.215 : 0.225, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), look.hair, 0, 0.02, -0.015, { rx: -0.25 }],
    ...(look.hairStyle === 'long' ? [[new T.BoxGeometry(0.4, 0.42, 0.14), look.hair, 0, -0.14, -0.13] as Piece] : []),
    ...(look.hairStyle === 'bun' ? [[new T.SphereGeometry(0.1, 12, 10), look.hair, 0, 0.17, -0.16] as Piece] : []),
  ));
  body.add(head);

  const paperMaterials = [new T.MeshBasicMaterial({ color: '#f8fafc', transparent: true, opacity: 0, side: T.DoubleSide }), new T.MeshBasicMaterial({ color: look.shirt, transparent: true, opacity: 0, side: T.DoubleSide })];
  const paper = new T.Group();
  paper.add(new T.Mesh(new T.PlaneGeometry(0.24, 0.32), paperMaterials[0]));
  paper.add(at(new T.Mesh(new T.PlaneGeometry(0.18, 0.05), paperMaterials[1]), 0, 0.1, 0.002));
  paper.visible = false;
  scene.add(paper);

  // Held in the right hand (upright ones are turned level each frame), or in front of the body.
  const hand = (object: T.Object3D) => { object.visible = false; arms[1].add(at(object, 0, -0.42, 0.04)); return object; };
  const front = (object: T.Object3D) => { object.visible = false; body.add(object); return object; };
  const group = (...parts: T.Object3D[]) => { const g = new T.Group(); parts.forEach(p => g.add(p)); return g; };
  const material = (color: string, extra: T.MeshStandardMaterialParameters = {}) => new T.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
  const props: Record<Prop, T.Object3D> = {
    mug: hand(group(new T.Mesh(new T.CylinderGeometry(0.045, 0.04, 0.1, 12), material('#f8fafc')), at(new T.Mesh(new T.TorusGeometry(0.025, 0.008, 6, 10), material('#f8fafc')), 0.05, 0, 0))),
    phone: hand(group(new T.Mesh(new T.BoxGeometry(0.07, 0.13, 0.012), material('#0f172a')), at(new T.Mesh(new T.PlaneGeometry(0.06, 0.115), new T.MeshBasicMaterial({ color: '#60a5fa' })), 0, 0, 0.007))),
    book: front(at(group(new T.Mesh(new T.BoxGeometry(0.26, 0.03, 0.2), material(look.shirt)), at(new T.Mesh(new T.BoxGeometry(0.24, 0.032, 0.18), material('#fefce8')), 0, 0, 0.005)), 0, 0.92, 0.3)),
    controller: front(at(group(new T.Mesh(new T.BoxGeometry(0.16, 0.04, 0.08), material('#111827')), at(new T.Mesh(new T.SphereGeometry(0.012, 6, 4), new T.MeshBasicMaterial({ color: '#22c55e' })), 0.04, 0.025, 0)), 0, 0.88, 0.32)),
    can: hand(group(new T.Mesh(new T.CylinderGeometry(0.07, 0.08, 0.14, 12), material('#16a34a')), at(new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.16, 6), material('#16a34a')), 0, 0.05, 0.1))),
    sheet: hand(new T.Mesh(new T.BoxGeometry(0.2, 0.005, 0.28), new T.MeshBasicMaterial({ color: '#f8fafc' }))),
  };
  (props.can.children[1] as T.Object3D).rotation.x = 1.1;
  return { root, body, head, legs, knees: knees as [T.Group, T.Group], arms, facing: 0, sit: 1, paper, paperMaterials, props };
}

/** What a person has in hand right now. */
function propFor(agent: Agent): Prop | null {
  if (agent.phase === 'break' || (agent.phase === 'to_break' && agent.activity === 'cafe')) {
    switch (agent.activity) {
      case 'coffee': case 'cafe': case 'water': return 'mug';
      case 'game': return 'controller';
      case 'plant': return 'can';
      case 'printer': return agent.phaseTime > 1.5 ? 'sheet' : null;
      case 'books': return agent.phaseTime > 1.5 ? 'book' : null;
      default: return null;
    }
  }
  if (agent.phase === 'from_break' || agent.phase === 'lounge' || agent.phase === 'called') {
    if (agent.carrying === 'coffee') return 'mug';
    if (agent.carrying === 'book') return 'book';
    if (agent.phase === 'lounge' && agent.lounging === 'phone') return 'phone';
    if (agent.phase === 'lounge' && agent.lounging === 'read') return 'book';
  }
  return null;
}

/** Shortest turn from one yaw to another, so people never spin the long way round. */
const turn = (from: number, to: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));

function pose(person: Person, agent: Agent, time: number, dt: number) {
  person.root.position.set(agent.position.x, 0, agent.position.z);
  person.facing += (turn(person.facing, agent.facing) - person.facing) * Math.min(1, dt * 10);
  person.root.rotation.y = person.facing;
  const [leftLeg, rightLeg] = person.legs, [leftKnee, rightKnee] = person.knees, [leftArm, rightArm] = person.arms;
  const walking = agent.path.length > 0;
  person.sit = ease(person.sit, agent.seated && !walking ? 1 : 0, 7, dt);
  const sit = person.sit;
  const phase = time * 9 + agent.seatIndex;
  const inLounge = agent.phase === 'lounge' || agent.phase === 'called';
  person.head.rotation.y = 0;
  rightArm.rotation.z = 0;
  leftArm.rotation.z = 0;

  // Legs: a walking stride blends into the seated bend (thigh forward, shin down).
  const stride = walking ? Math.sin(phase) * 0.6 : 0;
  const thigh = -Math.PI / 2 + (inLounge ? 0.15 : 0);
  leftLeg.rotation.x = stride * (1 - sit) + thigh * sit;
  rightLeg.rotation.x = -stride * (1 - sit) + thigh * sit;
  leftKnee.rotation.x = Math.max(0, -stride) * 0.5 * (1 - sit) + (Math.PI / 2 - 0.1) * sit;
  rightKnee.rotation.x = Math.max(0, stride) * 0.5 * (1 - sit) + (Math.PI / 2 - 0.1) * sit;
  person.body.position.y = (walking ? Math.abs(Math.cos(phase)) * 0.04 : 0) * (1 - sit) + (inLounge ? -0.08 : -0.02) * sit;
  person.body.rotation.x = walking ? 0.06 : 0;
  person.body.rotation.z = 0;

  const holding = propFor(agent);
  if (walking) {
    leftArm.rotation.x = holding === 'book' ? -0.9 : -stride * 0.8;
    // A cup is carried level, not swung.
    rightArm.rotation.x = holding === 'mug' || holding === 'book' ? -0.9 : stride * 0.8;
    person.head.rotation.x = Math.sin(phase * 2) * 0.02;
    return;
  }
  if (agent.phase === 'break') return breakPose(person, agent, time);
  if (agent.phase === 'lounge' && agent.lounging !== 'relax') return loungePose(person, agent, time);
  if (agent.phase === 'briefing' || agent.phase === 'checking') {
    // Standing beside the person: a tap on the shoulder, or pointing at the screen while checking.
    leftArm.rotation.x = -0.2;
    rightArm.rotation.x = agent.phase === 'briefing' ? -1.35 + Math.max(0, Math.sin(time * 9)) * 0.25 : -1.1 + Math.sin(time * 2) * 0.08;
    person.head.rotation.x = 0.2;
    person.head.rotation.y = agent.phase === 'checking' ? Math.sin(time * 0.9) * 0.25 : 0;
    return;
  }
  if (agent.phase === 'asking') {
    // Hand up at the desk, waving now and then, until the question is answered.
    leftArm.rotation.x = -1.15;
    rightArm.rotation.x = -2.95 + Math.sin(time * 5) * 0.12;
    rightArm.rotation.z = 0.15 + Math.sin(time * 5) * 0.08;
    person.head.rotation.x = -0.15;
    person.head.rotation.y = Math.sin(time * 1.4) * 0.2;
  } else if (agent.phase === 'working' || agent.phase === 'managing') {
    const tap = agent.phase === 'managing' ? Math.max(0, Math.sin(time * 0.7)) : 1;
    // Typing, with a glance at the screen and a short pause every few seconds.
    const pause = Math.sin(time * 0.45 + agent.seatIndex) > 0.85 ? 0.2 : 1;
    leftArm.rotation.x = -1.15 + Math.sin(time * 14) * 0.08 * tap * pause;
    rightArm.rotation.x = -1.15 + Math.sin(time * 14 + 1.7) * 0.08 * tap * pause;
    person.head.rotation.x = 0.12 + Math.sin(time * 1.3) * 0.03;
    person.head.rotation.y = Math.sin(time * 0.37 + agent.seatIndex) * 0.12;
  } else if (agent.phase === 'delivering') {
    leftArm.rotation.x = -0.4;
    rightArm.rotation.x = -2.6;
    person.head.rotation.x = -0.25;
  } else if (agent.phase === 'called') {
    // Looks up at the manager who is coming over.
    leftArm.rotation.x = rightArm.rotation.x = -0.35;
    person.head.rotation.x = -0.25;
  } else {
    leftArm.rotation.x = rightArm.rotation.x = -0.35 * sit;
    person.head.rotation.x = Math.sin(time * 0.6 + agent.seatIndex) * 0.06;
    person.head.rotation.y = Math.sin(time * 0.3 + agent.seatIndex * 2) * 0.35;
  }
  // Breathing.
  person.body.position.y += Math.sin(time * 2 + agent.seatIndex) * 0.004;
}

/** A sip now and then: the cup comes up to the mouth and the head tips back a little. */
function sip(person: Person, time: number, offset: number) {
  const up = Math.max(0, Math.sin(time * 0.9 + offset)) ** 6;
  person.arms[1].rotation.x = -0.75 - up * 1.35;
  person.head.rotation.x = -up * 0.25;
  return up;
}

function loungePose(person: Person, agent: Agent, time: number) {
  const [leftArm, rightArm] = person.arms;
  const o = agent.seatIndex * 1.7;
  if (agent.lounging === 'phone') {
    leftArm.rotation.x = -0.9;
    rightArm.rotation.x = -1.25 + Math.sin(time * 6 + o) * 0.03;
    person.head.rotation.x = 0.4;
  } else if (agent.lounging === 'read') {
    leftArm.rotation.x = rightArm.rotation.x = -1.05;
    person.head.rotation.x = 0.35;
    person.head.rotation.y = Math.sin(time * 0.8 + o) * 0.12;
  } else if (agent.lounging === 'chat') {
    leftArm.rotation.x = -0.35;
    rightArm.rotation.x = -0.6 - Math.max(0, Math.sin(time * 2.2 + o)) * 0.6;
    person.head.rotation.y = Math.sin(time * 0.5 + o) > 0 ? 0.6 : -0.6;
    person.head.rotation.x = Math.sin(time * 4 + o) * 0.05;
  } else {
    leftArm.rotation.x = -0.35;
    sip(person, time, o);
  }
}

/** What each break looks like. */
function breakPose(person: Person, agent: Agent, time: number) {
  const [leftArm, rightArm] = person.arms;
  const o = agent.seatIndex * 1.3;
  leftArm.rotation.x = -0.25;
  rightArm.rotation.x = -0.25;
  switch (agent.activity) {
    case 'coffee':
      rightArm.rotation.x = -1.25;
      leftArm.rotation.x = -0.6;
      person.head.rotation.x = 0.3;
      break;
    case 'snack':
      rightArm.rotation.x = -1.45 + Math.sin(time * 3) * 0.1;
      person.head.rotation.x = 0.15;
      person.body.rotation.x = 0.12;
      break;
    case 'cafe':
      leftArm.rotation.x = -0.9;
      sip(person, time, o);
      person.head.rotation.y = Math.sin(time * 0.6 + o) * 0.3;
      break;
    case 'water':
      if (sip(person, time, o) < 0.1) person.head.rotation.y = Math.sin(time * 0.7 + o) * 0.5;
      leftArm.rotation.x = -0.4 - Math.max(0, Math.sin(time * 2.5 + o)) * 0.5;
      break;
    case 'tv':
      leftArm.rotation.x = rightArm.rotation.x = -0.4;
      // A laugh now and then.
      person.body.position.y += Math.max(0, Math.sin(time * 0.7 + o)) ** 8 * Math.abs(Math.sin(time * 16)) * 0.03;
      person.head.rotation.x = -0.05;
      break;
    case 'game':
      leftArm.rotation.x = -1.05 + Math.sin(time * 17 + o) * 0.04;
      rightArm.rotation.x = -1.05 + Math.sin(time * 19 + o + 1) * 0.04;
      person.body.rotation.x = 0.14 + Math.sin(time * 1.3 + o) * 0.05;
      person.body.rotation.z = Math.sin(time * 1.9 + o) * 0.08;
      person.head.rotation.x = 0.1;
      break;
    case 'board':
      leftArm.rotation.x = rightArm.rotation.x = 0.35;
      person.head.rotation.x = -0.2;
      person.head.rotation.y = Math.sin(time * 0.6 + o) * 0.35;
      break;
    case 'window':
      leftArm.rotation.x = -0.3;
      rightArm.rotation.x = -0.3 - Math.max(0, Math.sin(time * 0.4 + o)) ** 10 * 1.4;
      person.head.rotation.x = -0.1;
      person.head.rotation.y = Math.sin(time * 0.35 + o) * 0.5;
      break;
    case 'plant':
      rightArm.rotation.x = -1.0;
      person.head.rotation.x = 0.35;
      break;
    case 'printer':
      rightArm.rotation.x = leftArm.rotation.x = -1.1;
      person.head.rotation.x = 0.4;
      break;
    case 'books':
      rightArm.rotation.x = agent.phaseTime < 1.5 ? -2.3 : -1.1;
      person.head.rotation.x = agent.phaseTime < 1.5 ? -0.3 : 0.3;
      break;
  }
  person.body.position.y += Math.sin(time * 2 + agent.seatIndex) * 0.004;
}

/** Shows what is in hand, held level. */
function holdProps(person: Person, agent: Agent) {
  const holding = propFor(agent);
  for (const [name, prop] of Object.entries(person.props) as Array<[Prop, T.Object3D]>) {
    prop.visible = name === holding;
    if (!prop.visible || prop.parent !== person.arms[1]) continue;
    // Level against the arm's swing; the can tips while watering, the phone faces the eyes.
    prop.rotation.x = -person.arms[1].rotation.x + (name === 'can' ? 0.6 : name === 'phone' ? -0.9 : 0);
    prop.rotation.z = -person.arms[1].rotation.z;
  }
}

/** The delivered sheet: out of the raised hand, up and fading over the hand-in. */
function floatPaper(person: Person, agent: Agent) {
  const show = agent.phase === 'delivering';
  person.paper.visible = show;
  if (!show) return;
  const t = Math.min(1, agent.phaseTime / DELIVER_SECONDS);
  person.paper.position.set(person.root.position.x + Math.sin(person.facing) * 0.15, 1.75 + t * 0.9, person.root.position.z + Math.cos(person.facing) * 0.15);
  person.paper.rotation.set(-0.3, person.facing + t * 2.2, Math.sin(t * 6) * 0.15);
  const opacity = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.6) / 0.4);
  for (const m of person.paperMaterials) m.opacity = opacity;
}

export function createOfficeStage(canvas: HTMLCanvasElement, sim: OfficeSimulation, labels: Map<string, HTMLElement>, options: { quality?: StageQuality; camera?: CameraView; onHint?: (hint: StageHint) => void; onPick?: (pick: StagePick) => void } = {}): OfficeStage {
  const fast = options.quality === 'performance';
  const scene = new T.Scene();
  scene.background = SKY.night.clone();
  scene.fog = new T.Fog(SKY.night.clone(), 38, 70);
  const renderer = new T.WebGLRenderer({ canvas, antialias: !fast, powerPreference: fast ? 'low-power' : 'high-performance' });
  // Sharp enough on high-density screens at a fraction of the pixels a ratio of 2 or 3 would cost.
  renderer.setPixelRatio(Math.min(devicePixelRatio, fast ? 1 : 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = !fast;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  // People move slowly: shadows are redrawn every few frames rather than every frame (see the loop).
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const camera = new T.PerspectiveCamera(34, 1, 0.5, 200);

  const hemi = new T.HemisphereLight('#c7d2fe', '#3b2a1e', 1.1);
  const sun = new T.DirectionalLight('#ffe8c7', 1.6);
  sun.position.set(-8, 16, 10);
  sun.castShadow = !fast;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  // Warm light from the window side at night, cool daylight by day.
  const fill = new T.DirectionalLight('#93c5fd', 0.35);
  fill.position.set(4, 8, -14);
  scene.add(hemi, sun, fill);

  const nightWindows = buildRoom(scene);
  const desks = new Map(DESKS.map(desk => [desk.id, buildDesk(scene, desk)]));
  desks.set(MANAGER_DESK.id, buildDesk(scene, MANAGER_DESK, true));
  const loungeLamp = buildLounge(scene);
  buildDecor(scene);
  const kitchen = buildKitchen(scene);
  const games = buildGamingCorner(scene);
  const tv = buildTvCorner(scene);
  const clock = buildShelfAndClock(scene);
  let tvDrawn = -1, visitor = false, brewUntil = 0;
  const waves = new Map<string, number>();
  const drawBoard = buildBoard(scene);
  bakeStatic(scene);
  const people = new Map(sim.agents.map(agent => {
    const person = buildPerson(agent.look, scene);
    person.facing = agent.facing;
    person.sit = agent.seated && !agent.path.length ? 1 : 0;
    person.root.userData.pick = { kind: 'agent', id: agent.id } satisfies StagePick;
    scene.add(person.root);
    return [agent.id, person];
  }));

  const clickable: T.Object3D[] = [games.screen, ...scene.children.filter(o => o.userData.pick && o !== games.screen), ...[...people.values()].map(p => p.root)];
  const target = new T.Vector3(-0.3, 0, 1.4);
  const initialView = { theta: 0.42, phi: 0.9, distance: 28.5 };
  // The camera eases towards where the person dragged or zoomed it.
  const view = { ...(options.camera ?? initialView) }, goal = { ...view };
  const place = () => {
    camera.position.set(
      target.x + view.distance * Math.sin(view.phi) * Math.sin(view.theta),
      target.y + view.distance * Math.cos(view.phi),
      target.z + view.distance * Math.sin(view.phi) * Math.cos(view.theta),
    );
    camera.lookAt(target);
  };
  place();

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  // Scrolled out of view: the office goes on, nothing is drawn.
  let onScreen = true;
  const visibility = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; });
  visibility.observe(canvas);
  // Resolution follows the device: a machine that cannot keep up gets fewer pixels, then more again.
  const maxRatio = Math.min(devicePixelRatio, fast ? 1 : 1.5), minRatio = fast ? 0.6 : 0.75;
  // Performance mode draws at most 30 frames a second; the office itself still moves every frame.
  const frameBudget = fast ? 1000 / 30 : 0, slowFrame = fast ? 40 : 26, quickFrame = fast ? 34 : 18;
  let ratio = maxRatio, frameMs = 16, frames = 0, drawnAt = performance.now();
  // The browser's own frame rate, measured on every frame, decides whether to suggest the other mode.
  let refreshMs = 16, slowFor = 0, smoothFor = 0, hinted = false;
  const watch = (interval: number) => {
    if (hinted || !options.onHint) return;
    refreshMs = refreshMs * 0.95 + interval * 0.05;
    // Quality mode: still under ~35 fps with the resolution already down, or under ~22 fps at all.
    slowFor = !fast && ((ratio <= minRatio && refreshMs > 28) || refreshMs > 45) ? slowFor + interval : 0;
    // Performance mode: the full refresh rate holds easily at full resolution.
    smoothFor = fast && ratio >= maxRatio && refreshMs < 18 ? smoothFor + interval : 0;
    if (slowFor > 8000 || smoothFor > 20000) { hinted = true; options.onHint(slowFor > 8000 ? 'slow' : 'smooth'); }
  };

  // Drag to turn round the office; wheel, or pinch with two fingers, to zoom.
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const zoom = (distance: number) => { goal.distance = Math.min(40, Math.max(10, distance)); };
  const spread = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  // A click (a press that barely moved) picks what is under it; a mouse over something clickable shows a hand.
  const raycaster = new T.Raycaster(), pointer = new T.Vector2();
  const pickAt = (e: PointerEvent): StagePick | null => {
    const box = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(clickable, true)[0];
    for (let node: T.Object3D | null = hit?.object ?? null; node; node = node.parent) if (node.userData.pick) return node.userData.pick as StagePick;
    return null;
  };
  let pressedAt: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    pressedAt = pointers.size === 1 ? { x: e.clientX, y: e.clientY } : null;
    if (pointers.size === 2) pinch = spread();
  };
  const onMove = (e: PointerEvent) => {
    const last = pointers.get(e.pointerId);
    if (!last) {
      if (e.pointerType === 'mouse' && options.onPick) canvas.style.cursor = pickAt(e) ? 'pointer' : '';
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const now = spread();
      if (pinch > 0 && now > 0) zoom(goal.distance * (pinch / now));
      pinch = now;
      return;
    }
    goal.theta -= (e.clientX - last.x) * 0.006;
    goal.phi = Math.min(1.25, Math.max(0.45, goal.phi - (e.clientY - last.y) * 0.004));
  };
  const onUp = (e: PointerEvent) => {
    if (pressedAt && pointers.size === 1 && Math.hypot(e.clientX - pressedAt.x, e.clientY - pressedAt.y) < 6) {
      const picked = pickAt(e);
      if (picked) options.onPick?.(picked);
    }
    pressedAt = null;
    pointers.delete(e.pointerId);
    pinch = 0;
  };
  const onWheel = (e: WheelEvent) => { e.preventDefault(); zoom(goal.distance + e.deltaY * 0.02); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  let speed = 1, paused = false, frame = 0, last = performance.now(), boardVersion = -1, boardBeat = -2;
  let night = 1, nightGoal = 1, nightSet = false;
  const glowColor = new T.Color();
  const projected = new T.Vector3();
  const screenState = (id: string): ScreenState => {
    const owner = sim.agents.find(a => a.deskId === id && !a.path.length);
    if (!owner) return { kind: 'off', accent: '#000', progress: 0, asking: false };
    if (owner.role === 'manager') {
      const count = (...statuses: TaskStatus[]) => sim.tasks.filter(t => statuses.includes(t.status)).length;
      return { kind: owner.phase === 'managing' ? 'dash' : 'off', accent: owner.look.shirt, progress: 0, asking: false, counts: [count('queued', 'assigned'), count('working'), count('asking'), count('review'), count('approved')] };
    }
    const task = sim.task(owner.taskId);
    if (!task || !['working', 'asking', 'delivering'].includes(owner.phase)) return { kind: 'off', accent: '#000', progress: 0, asking: false };
    return { kind: SCREEN_KIND[task.category], accent: owner.look.shirt, progress: owner.phase === 'delivering' ? 1 : task.progress, asking: owner.phase === 'asking' };
  };

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    // A slow frame still moves the office on, up to a quarter second at a time.
    if (!paused) sim.tick(Math.min(0.25, (now - last) / 1000) * speed);
    if (onScreen) watch(Math.min(100, now - last));
    last = now;
    if (!onScreen || now - drawnAt < frameBudget - 2) return;
    // Everything below eases by the time since the last drawn frame.
    const dt = Math.min(0.25, (now - drawnAt) / 1000);
    frameMs = frameMs * 0.95 + Math.min(100, now - drawnAt) * 0.05;
    drawnAt = now;
    const time = sim.time;
    if (++frames % 3 === 0 && !fast) renderer.shadowMap.needsUpdate = true;
    if (frames % 90 === 0) {
      const next = frameMs > slowFrame ? Math.max(minRatio, ratio - 0.2) : frameMs < quickFrame ? Math.min(maxRatio, ratio + 0.2) : ratio;
      if (next !== ratio) { ratio = next; renderer.setPixelRatio(ratio); }
    }

    view.theta = ease(view.theta, goal.theta, 8, dt);
    view.phi = ease(view.phi, goal.phi, 8, dt);
    view.distance = ease(view.distance, goal.distance, 8, dt);
    place();

    // Day and night fade into each other.
    night = ease(night, nightGoal, 2.5, dt);
    (scene.background as T.Color).copy(SKY.day).lerp(SKY.night, night);
    scene.fog!.color.copy(scene.background as T.Color);
    nightWindows.opacity = night;
    nightWindows.visible = night > 0.01;
    hemi.intensity = 2 - night * 0.9;
    sun.intensity = 2.6 - night * 1;
    fill.intensity = 0.2 + night * 0.25;
    loungeLamp.emissiveIntensity = night * 1.4;

    for (const agent of sim.agents) {
      const person = people.get(agent.id)!;
      pose(person, agent, time, dt);
      // A wave back when clicked: the right hand up and swaying.
      if ((waves.get(agent.id) ?? 0) > now && !agent.path.length) {
        person.arms[1].rotation.x = -2.9;
        person.arms[1].rotation.z = 0.25 + Math.sin(now / 90) * 0.35;
        person.head.rotation.x = -0.1;
      }
      holdProps(person, agent);
      floatPaper(person, agent);
    }

    // Break corners come alive while someone uses them.
    const brewing = brewUntil > now || sim.agents.some(a => a.spotId === 'coffee' && a.phase === 'break');
    kitchen.light.color.set(brewing ? '#22c55e' : '#ef4444');
    kitchen.steam.forEach((puff, i) => {
      const t = (time * 0.6 + i / kitchen.steam.length) % 1;
      puff.position.set(KITCHEN.x + 0.18, 1.45 + t * 0.6, KITCHEN.coffeeZ + Math.sin(t * 6 + i) * 0.05);
      puff.scale.setScalar(0.6 + t * 1.4);
      (puff.material as T.MeshBasicMaterial).opacity = brewing ? (1 - t) * 0.45 : 0;
      puff.visible = Boolean(brewing);
    });
    games.draw(sim.agents.filter(a => a.phase === 'break' && a.activity === 'game').length + (visitor ? 1 : 0), time);
    const mode = sim.agents.some(a => a.phase === 'break' && a.activity === 'tv') ? 'tv' : 'off';
    const tick = mode === 'off' ? -2 : Math.floor(now / 90);
    if (tick !== tvDrawn) { tvDrawn = tick; tv.draw(mode, time); }
    const clockNow = new Date();
    clock.minute.rotation.x = -((clockNow.getMinutes() + clockNow.getSeconds() / 60) / 60) * Math.PI * 2;
    clock.hour.rotation.x = -(((clockNow.getHours() % 12) + clockNow.getMinutes() / 60) / 12) * Math.PI * 2;
    for (const [id, desk] of desks) {
      const state = screenState(id);
      const owner = sim.agents.find(a => a.deskId === id && !a.path.length);
      const key = `${state.kind}|${state.accent}|${Math.floor(state.progress * 24)}|${state.asking}|${state.counts?.join(',') ?? ''}`;
      if (key !== desk.key) { desk.key = key; desk.draw(state); }
      const busy = state.kind !== 'off';
      desk.level = ease(desk.level, busy ? 1 : 0.35, 4, dt);
      desk.screen.color.setScalar(desk.level);
      glowColor.set(owner?.phase === 'asking' ? COLORS.ask : owner?.phase === 'delivering' ? COLORS.done : COLORS.glow);
      desk.glow.color.lerp(glowColor, Math.min(1, dt * 6));
      const glow = busy && owner?.role !== 'manager' ? 0.3 + Math.sin(now / 400) * 0.05 : busy ? 0.14 : 0;
      desk.glow.opacity = ease(desk.glow.opacity, glow, 4, dt);
      desk.glow.visible = desk.glow.opacity > 0.01;
      desk.lamp.emissiveIntensity = ease(desk.lamp.emissiveIntensity, night * (owner ? 1.6 : 0.5), 3, dt);
    }
    // The board is redrawn when a task changes, and a few times a second while one is in progress.
    const recent = sim.tasks.slice(-24);
    const pulsing = recent.some(t => t.status === 'working' || t.status === 'asking');
    const beat = pulsing ? Math.floor(now / 120) : -1;
    if (boardVersion !== sim.version || beat !== boardBeat) {
      boardVersion = sim.version;
      boardBeat = beat;
      drawBoard(recent.map(t => t.status), (Math.sin(now / 300) + 1) / 2);
    }
    renderer.render(scene, camera);
    const { clientWidth: w, clientHeight: h } = canvas;
    for (const agent of sim.agents) {
      const label = labels.get(agent.id);
      if (!label) continue;
      const person = people.get(agent.id)!;
      projected.set(person.root.position.x, 1.85 + person.body.position.y, person.root.position.z).project(camera);
      const visible = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
      label.style.opacity = visible ? '1' : '0';
      label.style.transform = `translate(${((projected.x + 1) / 2) * w}px, ${((1 - projected.y) / 2) * h}px) translate(-50%, -100%)`;
    }
  };
  frame = requestAnimationFrame(loop);

  return {
    setSpeed(value) { speed = value; },
    setPaused(value) { paused = value; },
    setVisitorPlaying(value) { visitor = value; },
    setRecord(value) { games.setRecord(value); },
    wave(agentId) { waves.set(agentId, performance.now() + 2500); },
    brew() { brewUntil = performance.now() + 4000; },
    setNight(value) {
      nightGoal = value ? 1 : 0;
      // The first call sets the look the page opens with; later ones fade.
      if (!nightSet) { night = nightGoal; nightSet = true; }
    },
    resetView() { Object.assign(goal, initialView); },
    cameraView() { return { ...goal }; },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      scene.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        object.geometry.dispose();
        for (const material of [object.material].flat()) {
          (material as T.MeshStandardMaterial).map?.dispose();
          material.dispose();
        }
      });
      renderer.dispose();
    },
  };
}
