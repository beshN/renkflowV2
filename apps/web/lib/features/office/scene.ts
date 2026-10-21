import * as T from 'three';
import type { Look, TaskCategoryId } from './catalog';
import { DESKS, FLOOR, LOUNGE, LOUNGE_SEATS, MANAGER_DESK, type Desk } from './layout';
import { DELIVER_SECONDS, type Agent, type OfficeSimulation, type TaskStatus } from './simulation';

/**
 * The 3D office drawn from the simulation: an open-plan floor seen from above at an angle, desks
 * whose screens show the work in progress, a lounge and simple low-poly people who sit down and
 * stand up instead of snapping between poses. The scene owns the clock: each frame it advances
 * the simulation, moves the people and places the name labels the page renders over the canvas.
 */

export type OfficeStage = {
  setSpeed(speed: number): void;
  setPaused(paused: boolean): void;
  setNight(night: boolean): void;
  resetView(): void;
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
  const night = new T.MeshBasicMaterial({ map: skylineTexture(true), toneMapped: false, transparent: true, opacity: 1 });
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
  const screen = new T.MeshBasicMaterial({ map: texture, toneMapped: false });
  screen.color.setScalar(0.35);
  group.add(at(box(0.66, 0.4, 0.04, COLORS.metal), 0, 1.12, -0.22));
  group.add(at(new T.Mesh(new T.PlaneGeometry(0.6, 0.35), screen), 0, 1.12, -0.199));
  group.add(at(box(0.42, 0.02, 0.14, '#3f3f46'), 0, 0.79, 0.08), at(box(0.07, 0.02, 0.1, '#52525b'), 0.3, 0.79, 0.1));
  // A mug and a desk lamp that comes on at night.
  const mug = new T.Mesh(new T.CylinderGeometry(0.04, 0.035, 0.09, 12), new T.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.5 }));
  mug.castShadow = true;
  group.add(at(mug, -w / 2 + 0.2, 0.825, 0.12));
  const lamp = new T.MeshStandardMaterial({ color: '#f8fafc', emissive: COLORS.lamp, emissiveIntensity: 0, roughness: 0.4 });
  group.add(at(box(0.03, 0.34, 0.03, COLORS.metal), w / 2 - 0.15, 0.95, -0.25));
  group.add(at(new T.Mesh(new T.ConeGeometry(0.09, 0.1, 14, 1, true), lamp), w / 2 - 0.15, 1.1, -0.2));

  // Chair on the aisle side; its back stays behind the person, who faces the windows.
  const chair = at(new T.Group(), desk.chair.x - desk.x, 0, desk.chair.z - desk.z);
  chair.add(at(box(0.5, 0.08, 0.5, COLORS.chair), 0, 0.44, 0));
  chair.add(at(box(0.5, 0.55, 0.08, COLORS.chair), 0, 0.75, 0.24));
  chair.add(at(box(0.06, 0.4, 0.06, COLORS.metal), 0, 0.2, 0));
  chair.add(at(box(0.5, 0.03, 0.06, COLORS.metal), 0, 0.03, 0), at(box(0.06, 0.03, 0.5, COLORS.metal), 0, 0.03, 0));
  group.add(chair);

  const glow = new T.Mesh(new T.CircleGeometry(1.15, 40), new T.MeshBasicMaterial({ color: COLORS.glow, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
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
  const shade = new T.MeshStandardMaterial({ color: '#fef3c7', emissive: COLORS.lamp, emissiveIntensity: 0, roughness: 0.6 });
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
    return [leaves, top];
  };
  const leaves = [plant(-11.3, -7.3), plant(11.3, -7.3), plant(-11.3, 7.3), plant(-4.1, -7.3), plant(11.3, 7.3, 0.8), plant(0.3, -7.3, 0.7)].flat();
  // Water cooler by the lounge exit.
  scene.add(at(box(0.36, 1, 0.36, '#e5e7eb'), -4.3, 0.5, -7.4));
  const bottle = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.42, 16), new T.MeshStandardMaterial({ color: '#60a5fa', transparent: true, opacity: 0.7 }));
  scene.add(at(bottle, -4.3, 1.21, -7.4));
  // A printer by the desks, where deliveries come out.
  scene.add(at(box(0.7, 0.7, 0.5, '#d4d4d8'), -2.6, 0.35, 6.9), at(box(0.5, 0.06, 0.3, '#f8fafc'), -2.6, 0.73, 6.85));
  return leaves;
}

/** The task board on the back wall: one tile per task, coloured by its status. */
function buildBoard(scene: T.Scene) {
  const group = at(new T.Group(), 3.7, 1.95, FLOOR.minZ + 0.06);
  group.add(at(box(4.4, 1.7, 0.06, '#f8fafc'), 0, 0, 0));
  const tiles: T.MeshStandardMaterial[] = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 8; col++) {
    const material = new T.MeshStandardMaterial({ color: BOARD_COLORS.empty, emissive: BOARD_COLORS.empty, emissiveIntensity: 0.25 });
    const tile = new T.Mesh(new T.PlaneGeometry(0.46, 0.42), material);
    group.add(at(tile, -1.85 + col * 0.53, 0.5 - row * 0.5, 0.04));
    tiles.push(material);
  }
  scene.add(group);
  return tiles;
}

type Person = {
  root: T.Group; body: T.Group; head: T.Group;
  legs: [T.Group, T.Group]; knees: [T.Group, T.Group]; arms: [T.Group, T.Group];
  facing: number;
  /** 0 standing, 1 seated; eased so people sit down and get up. */
  sit: number;
  /** The sheet that floats up when the person hands work in. */
  paper: T.Group; paperMaterials: T.MeshBasicMaterial[];
};

function buildPerson(look: Look, scene: T.Scene): Person {
  const root = new T.Group();
  const body = new T.Group();
  root.add(body);
  const skin = new T.MeshStandardMaterial({ color: look.skin, roughness: 0.8 });
  const hair = new T.MeshStandardMaterial({ color: look.hair, roughness: 0.9 });
  const shirt = new T.MeshStandardMaterial({ color: look.shirt, roughness: 0.85 });
  const pants = new T.MeshStandardMaterial({ color: look.pants, roughness: 0.85 });
  const shoe = new T.MeshStandardMaterial({ color: '#18181b', roughness: 0.9 });
  const mesh = (geometry: T.BufferGeometry, material: T.Material) => { const m = new T.Mesh(geometry, material); m.castShadow = true; return m; };

  // Thigh from the hip, shin from the knee: seated legs bend at the knee instead of sticking out.
  const knees: T.Group[] = [];
  const legs = [-1, 1].map(side => {
    const hip = at(new T.Group(), side * 0.09, 0.48, 0);
    hip.add(at(mesh(new T.BoxGeometry(0.15, 0.24, 0.17), pants), 0, -0.12, 0));
    const knee = at(new T.Group(), 0, -0.23, 0);
    knee.add(at(mesh(new T.BoxGeometry(0.14, 0.22, 0.15), pants), 0, -0.1, 0));
    knee.add(at(mesh(new T.BoxGeometry(0.16, 0.07, 0.24), shoe), 0, -0.215, 0.04));
    hip.add(knee);
    knees.push(knee);
    body.add(hip);
    return hip;
  }) as [T.Group, T.Group];

  const torso = mesh(new T.CapsuleGeometry(0.2, 0.3, 4, 12), shirt);
  torso.scale.z = 0.78;
  body.add(at(torso, 0, 0.82, 0));
  const collar = mesh(new T.CylinderGeometry(0.08, 0.1, 0.06, 12), skin);
  body.add(at(collar, 0, 1.15, 0));

  const arms = [-1, 1].map(side => {
    const shoulder = at(new T.Group(), side * 0.26, 1.06, 0);
    shoulder.add(at(mesh(new T.CapsuleGeometry(0.065, 0.26, 4, 8), shirt), 0, -0.18, 0));
    shoulder.add(at(mesh(new T.SphereGeometry(0.065, 10, 8), skin), 0, -0.38, 0));
    body.add(shoulder);
    return shoulder;
  }) as [T.Group, T.Group];

  const head = at(new T.Group(), 0, 1.36, 0);
  head.add(mesh(new T.SphereGeometry(0.21, 20, 16), skin));
  const eye = new T.MeshBasicMaterial({ color: '#111827' });
  for (const side of [-1, 1]) head.add(at(new T.Mesh(new T.SphereGeometry(0.026, 8, 6), eye), side * 0.075, 0.02, 0.19));
  const cheek = new T.MeshBasicMaterial({ color: '#f9a8a8', transparent: true, opacity: 0.35 });
  for (const side of [-1, 1]) head.add(at(new T.Mesh(new T.CircleGeometry(0.03, 10), cheek), side * 0.11, -0.04, 0.185));
  const cap = mesh(new T.SphereGeometry(look.hairStyle === 'buzz' ? 0.215 : 0.225, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  cap.rotation.x = -0.25;
  head.add(at(cap, 0, 0.02, -0.015));
  if (look.hairStyle === 'long') head.add(at(mesh(new T.BoxGeometry(0.4, 0.42, 0.14), hair), 0, -0.14, -0.13));
  if (look.hairStyle === 'bun') head.add(at(mesh(new T.SphereGeometry(0.1, 12, 10), hair), 0, 0.17, -0.16));
  body.add(head);

  const paperMaterials = [new T.MeshBasicMaterial({ color: '#f8fafc', transparent: true, opacity: 0, side: T.DoubleSide }), new T.MeshBasicMaterial({ color: look.shirt, transparent: true, opacity: 0, side: T.DoubleSide })];
  const paper = new T.Group();
  paper.add(new T.Mesh(new T.PlaneGeometry(0.24, 0.32), paperMaterials[0]));
  paper.add(at(new T.Mesh(new T.PlaneGeometry(0.18, 0.05), paperMaterials[1]), 0, 0.1, 0.002));
  paper.visible = false;
  scene.add(paper);
  return { root, body, head, legs, knees: knees as [T.Group, T.Group], arms, facing: 0, sit: 1, paper, paperMaterials };
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

  if (walking) {
    leftArm.rotation.x = -stride * 0.8;
    rightArm.rotation.x = stride * 0.8;
    person.head.rotation.x = Math.sin(phase * 2) * 0.02;
    return;
  }
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

export function createOfficeStage(canvas: HTMLCanvasElement, sim: OfficeSimulation, labels: Map<string, HTMLElement>): OfficeStage {
  const scene = new T.Scene();
  scene.background = SKY.night.clone();
  scene.fog = new T.Fog(SKY.night.clone(), 38, 70);
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const camera = new T.PerspectiveCamera(34, 1, 0.5, 200);

  const hemi = new T.HemisphereLight('#c7d2fe', '#3b2a1e', 1.1);
  const sun = new T.DirectionalLight('#ffe8c7', 1.6);
  sun.position.set(-8, 16, 10);
  sun.castShadow = true;
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
  const leaves = buildDecor(scene);
  const tiles = buildBoard(scene);
  const people = new Map(sim.agents.map(agent => {
    const person = buildPerson(agent.look, scene);
    person.facing = agent.facing;
    person.sit = agent.seated && !agent.path.length ? 1 : 0;
    scene.add(person.root);
    return [agent.id, person];
  }));

  const target = new T.Vector3(-1, 0, 0.8);
  const initialView = { theta: 0.5, phi: 0.92, distance: 26 };
  // The camera eases towards where the person dragged or zoomed it.
  const view = { ...initialView }, goal = { ...initialView };
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

  // Drag to turn round the office; wheel, or pinch with two fingers, to zoom.
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const zoom = (distance: number) => { goal.distance = Math.min(40, Math.max(10, distance)); };
  const spread = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const onDown = (e: PointerEvent) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 2) pinch = spread();
  };
  const onMove = (e: PointerEvent) => {
    const last = pointers.get(e.pointerId);
    if (!last) return;
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
  const onUp = (e: PointerEvent) => { pointers.delete(e.pointerId); pinch = 0; };
  const onWheel = (e: WheelEvent) => { e.preventDefault(); zoom(goal.distance + e.deltaY * 0.02); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  let speed = 1, paused = false, frame = 0, last = performance.now(), boardVersion = -1;
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
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!paused) sim.tick(dt * speed);
    const time = sim.time;

    view.theta = ease(view.theta, goal.theta, 8, dt);
    view.phi = ease(view.phi, goal.phi, 8, dt);
    view.distance = ease(view.distance, goal.distance, 8, dt);
    place();

    // Day and night fade into each other.
    night = ease(night, nightGoal, 2.5, dt);
    (scene.background as T.Color).copy(SKY.day).lerp(SKY.night, night);
    scene.fog!.color.copy(scene.background as T.Color);
    nightWindows.opacity = night;
    hemi.intensity = 2 - night * 0.9;
    sun.intensity = 2.6 - night * 1;
    fill.intensity = 0.2 + night * 0.25;
    loungeLamp.emissiveIntensity = night * 1.4;
    for (const leaf of leaves) leaf.rotation.y = Math.sin(time * 0.4 + leaf.position.x) * 0.05;

    for (const agent of sim.agents) {
      const person = people.get(agent.id)!;
      pose(person, agent, time, dt);
      floatPaper(person, agent);
    }
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
      desk.lamp.emissiveIntensity = ease(desk.lamp.emissiveIntensity, night * (owner ? 1.6 : 0.5), 3, dt);
    }
    if (boardVersion !== sim.version) {
      boardVersion = sim.version;
      const recent = sim.tasks.slice(-tiles.length);
      tiles.forEach((tile, i) => {
        const color = BOARD_COLORS[recent[i]?.status ?? 'empty'];
        tile.color.set(color);
        tile.emissive.set(color);
        tile.userData.active = recent[i]?.status === 'working' || recent[i]?.status === 'asking';
      });
    }
    // Tiles of work in progress pulse.
    for (const tile of tiles) tile.emissiveIntensity = tile.userData.active ? 0.35 + Math.sin(now / 300) * 0.2 : 0.25;
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
    setNight(value) {
      nightGoal = value ? 1 : 0;
      // The first call sets the look the page opens with; later ones fade.
      if (!nightSet) { night = nightGoal; nightSet = true; }
    },
    resetView() { Object.assign(goal, initialView); },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
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
