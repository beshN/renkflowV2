import * as T from 'three';
import type { Look } from './catalog';
import { DESKS, FLOOR, LOUNGE, LOUNGE_SEATS, MANAGER_DESK, type Desk } from './layout';
import type { Agent, OfficeSimulation, TaskStatus } from './simulation';

/**
 * The 3D office drawn from the simulation: a night-time open-plan floor seen from above at an
 * angle, desks that light up while someone works at them, a lounge and simple low-poly people.
 * The scene owns the clock: each frame it advances the simulation, moves the people and places
 * the name labels the page renders over the canvas.
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
  glass: '#9fd3e6', rail: '#e08a5f', wall: '#1d2433', windowNight: '#0d1b33', windowDay: '#9cc8ec', screenOff: '#0f172a', screenOn: '#7dd3fc', glow: '#fbbf24',
};

const BOARD_COLORS: Record<TaskStatus | 'empty', string> = {
  empty: '#273042', queued: '#64748b', assigned: '#f59e0b', working: '#facc15', review: '#f97316', approved: '#22c55e',
};

const box = (w: number, h: number, d: number, color: string, extra: T.MeshStandardMaterialParameters = {}) => {
  const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color, roughness: 0.75, ...extra }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};
const at = <O extends T.Object3D>(object: O, x: number, y: number, z: number) => { object.position.set(x, y, z); return object; };

function woodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext('2d')!;
  g.fillStyle = COLORS.wood;
  g.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 16; row++) {
    const offset = (row % 2) * 128;
    for (let col = -1; col < 3; col++) {
      const shade = 0.88 + ((row * 7 + col * 13) % 10) / 45;
      g.fillStyle = `rgba(${Math.round(168 * shade)},${Math.round(103 * shade)},${Math.round(58 * shade)},1)`;
      g.fillRect(col * 256 + offset + 2, row * 32 + 2, 252, 28);
    }
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(6, 4);
  return texture;
}

function buildRoom(scene: T.Scene) {
  const width = FLOOR.maxX - FLOOR.minX, depth = FLOOR.maxZ - FLOOR.minZ;
  const floor = new T.Mesh(new T.PlaneGeometry(width, depth), new T.MeshStandardMaterial({ map: woodTexture(), roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Back wall with a row of tall windows.
  const wallZ = FLOOR.minZ;
  scene.add(at(box(width, 3.4, 0.2, COLORS.wall), 0, 1.7, wallZ - 0.1));
  const windows = new T.MeshStandardMaterial({ color: COLORS.windowNight, emissive: COLORS.windowNight, emissiveIntensity: 0.6, roughness: 0.2 });
  for (let x = FLOOR.minX + 1.6; x < FLOOR.maxX - 1; x += 2.6) {
    const pane = new T.Mesh(new T.PlaneGeometry(2.3, 2.2), windows);
    scene.add(at(pane, x, 1.85, wallZ + 0.01));
  }
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
  return windows;
}

function buildDesk(scene: T.Scene, desk: Desk, wide = false) {
  const group = at(new T.Group(), desk.x, 0, desk.z);
  const w = wide ? 1.9 : 1.4;
  group.add(at(box(w, 0.06, 0.8, COLORS.deskTop), 0, 0.75, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) group.add(at(box(0.05, 0.72, 0.05, COLORS.metal), sx * (w / 2 - 0.06), 0.36, sz * 0.34));
  group.add(at(box(0.06, 0.22, 0.06, COLORS.metal), 0, 0.89, -0.22));
  const screen = new T.MeshStandardMaterial({ color: COLORS.screenOff, emissive: COLORS.screenOn, emissiveIntensity: 0, roughness: 0.4 });
  group.add(at(box(0.62, 0.38, 0.04, COLORS.metal), 0, 1.12, -0.22));
  group.add(at(new T.Mesh(new T.PlaneGeometry(0.56, 0.32), screen), 0, 1.12, -0.199));
  group.add(at(box(0.42, 0.02, 0.14, '#3f3f46'), 0, 0.79, 0.08));

  // Chair on the aisle side; its back stays behind the person, who faces the windows.
  const chair = at(new T.Group(), desk.chair.x - desk.x, 0, desk.chair.z - desk.z);
  chair.add(at(box(0.5, 0.08, 0.5, COLORS.chair), 0, 0.44, 0));
  chair.add(at(box(0.5, 0.55, 0.08, COLORS.chair), 0, 0.75, 0.24));
  chair.add(at(box(0.06, 0.4, 0.06, COLORS.metal), 0, 0.2, 0));
  group.add(chair);

  const glow = new T.Mesh(new T.CircleGeometry(1.15, 32), new T.MeshBasicMaterial({ color: COLORS.glow, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2;
  group.add(at(glow, 0, 0.01, 0.35));
  scene.add(group);
  return { screen, glow: glow.material as T.MeshBasicMaterial };
}

function buildLounge(scene: T.Scene) {
  const rug = new T.Mesh(new T.PlaneGeometry(LOUNGE.maxX - LOUNGE.minX, LOUNGE.maxZ - LOUNGE.minZ), new T.MeshStandardMaterial({ color: '#c26d4f', roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
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
}

function buildDecor(scene: T.Scene) {
  const plant = (x: number, z: number) => {
    scene.add(at(box(0.4, 0.45, 0.4, '#e5e7eb'), x, 0.22, z));
    const leaves = new T.Mesh(new T.IcosahedronGeometry(0.42, 0), new T.MeshStandardMaterial({ color: '#2f855a', flatShading: true }));
    leaves.castShadow = true;
    scene.add(at(leaves, x, 0.85, z));
  };
  plant(-11.3, -7.3); plant(11.3, -7.3); plant(-11.3, 7.3); plant(-4.1, -7.3);
  // Water cooler by the lounge exit.
  scene.add(at(box(0.36, 1, 0.36, '#e5e7eb'), -4.3, 0.5, -7.4));
  const bottle = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.42, 16), new T.MeshStandardMaterial({ color: '#60a5fa', transparent: true, opacity: 0.7 }));
  scene.add(at(bottle, -4.3, 1.21, -7.4));
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
  legs: [T.Group, T.Group]; arms: [T.Group, T.Group];
  facing: number;
};

function buildPerson(look: Look): Person {
  const root = new T.Group();
  const body = new T.Group();
  root.add(body);
  const skin = new T.MeshStandardMaterial({ color: look.skin, roughness: 0.8 });
  const hair = new T.MeshStandardMaterial({ color: look.hair, roughness: 0.9 });
  const shirt = new T.MeshStandardMaterial({ color: look.shirt, roughness: 0.85 });
  const pants = new T.MeshStandardMaterial({ color: look.pants, roughness: 0.85 });
  const shoe = new T.MeshStandardMaterial({ color: '#18181b', roughness: 0.9 });
  const mesh = (geometry: T.BufferGeometry, material: T.Material) => { const m = new T.Mesh(geometry, material); m.castShadow = true; return m; };

  const legs = [-1, 1].map(side => {
    const hip = at(new T.Group(), side * 0.09, 0.48, 0);
    hip.add(at(mesh(new T.BoxGeometry(0.15, 0.44, 0.17), pants), 0, -0.22, 0));
    hip.add(at(mesh(new T.BoxGeometry(0.16, 0.07, 0.24), shoe), 0, -0.445, 0.04));
    body.add(hip);
    return hip;
  }) as [T.Group, T.Group];

  const torso = mesh(new T.CapsuleGeometry(0.2, 0.3, 4, 12), shirt);
  torso.scale.z = 0.78;
  body.add(at(torso, 0, 0.82, 0));

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
  const cap = mesh(new T.SphereGeometry(look.hairStyle === 'buzz' ? 0.215 : 0.225, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  cap.rotation.x = -0.25;
  head.add(at(cap, 0, 0.02, -0.015));
  if (look.hairStyle === 'long') head.add(at(mesh(new T.BoxGeometry(0.4, 0.42, 0.14), hair), 0, -0.14, -0.13));
  if (look.hairStyle === 'bun') head.add(at(mesh(new T.SphereGeometry(0.1, 12, 10), hair), 0, 0.17, -0.16));
  body.add(head);
  return { root, body, head, legs, arms, facing: 0 };
}

/** Shortest turn from one yaw to another, so people never spin the long way round. */
const turn = (from: number, to: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));

function pose(person: Person, agent: Agent, time: number, dt: number) {
  person.root.position.set(agent.position.x, 0, agent.position.z);
  person.facing += (turn(person.facing, agent.facing) - person.facing) * Math.min(1, dt * 10);
  person.root.rotation.y = person.facing;
  const [leftLeg, rightLeg] = person.legs, [leftArm, rightArm] = person.arms;
  const walking = agent.path.length > 0;
  const phase = time * 9 + agent.seatIndex;
  person.head.rotation.y = 0;
  if (walking) {
    const swing = Math.sin(phase) * 0.6;
    leftLeg.rotation.x = swing; rightLeg.rotation.x = -swing;
    leftArm.rotation.x = -swing * 0.8; rightArm.rotation.x = swing * 0.8;
    person.body.position.y = Math.abs(Math.cos(phase)) * 0.04;
    person.head.rotation.x = 0;
    return;
  }
  if (agent.phase === 'briefing') {
    // Standing beside the person, tapping their shoulder.
    leftLeg.rotation.x = rightLeg.rotation.x = 0;
    leftArm.rotation.x = -0.2;
    rightArm.rotation.x = -1.35 + Math.max(0, Math.sin(time * 9)) * 0.25;
    person.body.position.y = 0;
    person.head.rotation.x = 0.2;
    return;
  }
  // Seated: hips on the seat, legs straight forward.
  const inLounge = agent.phase === 'lounge' || agent.phase === 'called';
  person.body.position.y = inLounge ? -0.08 : -0.02;
  leftLeg.rotation.x = rightLeg.rotation.x = -Math.PI / 2 + (inLounge ? 0.15 : 0);
  if (agent.phase === 'working' || agent.phase === 'managing') {
    const tap = agent.phase === 'managing' ? Math.max(0, Math.sin(time * 0.7)) : 1;
    leftArm.rotation.x = -1.15 + Math.sin(time * 14) * 0.08 * tap;
    rightArm.rotation.x = -1.15 + Math.sin(time * 14 + 1.7) * 0.08 * tap;
    person.head.rotation.x = 0.12 + Math.sin(time * 1.3) * 0.03;
  } else if (agent.phase === 'delivering') {
    leftArm.rotation.x = -0.4;
    rightArm.rotation.x = -2.6;
    person.head.rotation.x = -0.1;
  } else if (agent.phase === 'called') {
    // Looks up at the manager who is coming over.
    leftArm.rotation.x = rightArm.rotation.x = -0.35;
    person.head.rotation.x = -0.25;
  } else {
    leftArm.rotation.x = rightArm.rotation.x = -0.35;
    person.head.rotation.x = Math.sin(time * 0.6 + agent.seatIndex) * 0.06;
    person.head.rotation.y = Math.sin(time * 0.3 + agent.seatIndex * 2) * 0.35;
  }
  person.body.position.y += Math.sin(time * 2 + agent.seatIndex) * 0.004;
}

export function createOfficeStage(canvas: HTMLCanvasElement, sim: OfficeSimulation, labels: Map<string, HTMLElement>): OfficeStage {
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
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
  scene.add(hemi, sun);

  const windows = buildRoom(scene);
  const desks = new Map(DESKS.map(desk => [desk.id, buildDesk(scene, desk)]));
  desks.set(MANAGER_DESK.id, buildDesk(scene, MANAGER_DESK, true));
  buildLounge(scene);
  buildDecor(scene);
  const tiles = buildBoard(scene);
  const people = new Map(sim.agents.map(agent => {
    const person = buildPerson(agent.look);
    person.facing = agent.facing;
    scene.add(person.root);
    return [agent.id, person];
  }));

  const target = new T.Vector3(-1, 0, 0.8);
  const view = { theta: 0.5, phi: 0.92, distance: 26 };
  const initialView = { ...view };
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

  // Drag to turn round the office, wheel or pinch distance to zoom.
  let drag: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    view.theta -= (e.clientX - drag.x) * 0.006;
    view.phi = Math.min(1.25, Math.max(0.45, view.phi - (e.clientY - drag.y) * 0.004));
    drag = { x: e.clientX, y: e.clientY };
    place();
  };
  const onUp = () => { drag = null; };
  const onWheel = (e: WheelEvent) => { e.preventDefault(); view.distance = Math.min(40, Math.max(10, view.distance + e.deltaY * 0.02)); place(); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  let speed = 1, paused = false, frame = 0, last = performance.now(), boardVersion = -1;
  const projected = new T.Vector3();
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    // A slow frame still moves the office on, up to a quarter second at a time.
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!paused) sim.tick(dt * speed);
    const time = sim.time;
    for (const agent of sim.agents) pose(people.get(agent.id)!, agent, time, dt);
    for (const [id, desk] of desks) {
      const owner = sim.agents.find(a => a.deskId === id && !a.path.length);
      const busy = owner?.phase === 'working' || owner?.phase === 'delivering' || owner?.phase === 'managing';
      const glow = busy ? 0.32 + Math.sin(now / 400) * 0.04 : 0;
      desk.glow.opacity += (glow - desk.glow.opacity) * Math.min(1, dt * 4);
      desk.screen.emissiveIntensity += ((busy ? 0.9 : 0) - desk.screen.emissiveIntensity) * Math.min(1, dt * 4);
    }
    if (boardVersion !== sim.version) {
      boardVersion = sim.version;
      const recent = sim.tasks.slice(-tiles.length);
      tiles.forEach((tile, i) => {
        const color = BOARD_COLORS[recent[i]?.status ?? 'empty'];
        tile.color.set(color);
        tile.emissive.set(color);
      });
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
    setNight(night) {
      const color = night ? COLORS.windowNight : COLORS.windowDay;
      windows.color.set(color);
      windows.emissive.set(color);
      windows.emissiveIntensity = night ? 0.6 : 0.9;
      scene.background = new T.Color(night ? '#0b1020' : '#cfe3f3');
      hemi.intensity = night ? 1.1 : 2;
      sun.intensity = night ? 1.6 : 2.6;
    },
    resetView() { Object.assign(view, initialView); place(); },
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
