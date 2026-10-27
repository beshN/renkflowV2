/**
 * The racing game's pictures, all drawn with canvas paths once when the game opens (no image
 * files): every roadside thing, the traffic, the player's car in its steering frames and the
 * parallax skylines. The renderer then only scales them with drawImage.
 */

import { BILLBOARDS, type SpriteKind } from '@/lib/features/office/rally-track';
import { CAR_COLORS } from '@/lib/features/office/rally';

export type Picture = HTMLCanvasElement;
export type Theme = 'night' | 'dusk';

export type Art = {
  sprites: Record<Exclude<SpriteKind, 'post'>, Picture[]>;
  /** Lamps on the right side of the road, their arms reaching left over it. */
  lampRight: Picture;
  /** [colour][model] */
  cars: Picture[][];
  /** Steering left, straight, right. */
  player: [Picture, Picture, Picture];
  /** Far and near skyline per theme, drawn side by side as they scroll. */
  layers: Record<Theme, [Picture, Picture]>;
  stars: Picture;
};

function canvas(w: number, h: number): [Picture, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** A colour lighter (f > 1) or darker (f < 1). */
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
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

/** A seeded generator for the pictures, so they look the same every time. */
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ---- Cars ------------------------------------------------------------------------------------

/** The player's car from behind: a red sports car with a spoiler, wide tail lights and twin exhausts. */
function playerCar(lean: number): Picture {
  const S = 2.4, [c, g] = canvas(160 * S, 92 * S);
  g.scale(S, S);
  // Shadow, then tyres (they stay put while the body leans into the turn).
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.beginPath(); g.ellipse(80, 86, 78, 6, 0, 0, Math.PI * 2); g.fill();
  for (const x of [8, 128]) {
    g.fillStyle = '#0a0a0a'; roundRect(g, x + lean * 0.4, 58, 24, 31, 5); g.fill();
    g.fillStyle = '#262626';
    for (let k = 0; k < 5; k++) g.fillRect(x + 3 + lean * 0.4, 62 + k * 5.5, 18, 2);
  }
  g.save();
  // The body leans: its top shifts towards the turn.
  g.transform(1, 0, -lean * 0.012, 1, lean * 0.012 * 70, 0);
  const body = g.createLinearGradient(0, 30, 0, 80);
  body.addColorStop(0, '#ff5a5a'); body.addColorStop(0.45, '#dc2626'); body.addColorStop(1, '#7f1d1d');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(4, 76); g.lineTo(4, 56); g.quadraticCurveTo(6, 40, 22, 38); g.lineTo(138, 38); g.quadraticCurveTo(154, 40, 156, 56);
  g.lineTo(156, 76); g.quadraticCurveTo(80, 82, 4, 76); g.closePath(); g.fill();
  // Cabin and rear window.
  const cabin = g.createLinearGradient(0, 12, 0, 40);
  cabin.addColorStop(0, '#ef4444'); cabin.addColorStop(1, '#991b1b');
  g.fillStyle = cabin;
  g.beginPath(); g.moveTo(30, 40); g.lineTo(46, 14); g.quadraticCurveTo(80, 9, 114, 14); g.lineTo(130, 40); g.closePath(); g.fill();
  const glass = g.createLinearGradient(0, 16, 0, 38);
  glass.addColorStop(0, '#1e293b'); glass.addColorStop(1, '#0b1220');
  g.fillStyle = glass;
  g.beginPath(); g.moveTo(38, 37); g.lineTo(50, 18); g.quadraticCurveTo(80, 14, 110, 18); g.lineTo(122, 37); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(148,163,184,0.45)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(56, 34); g.lineTo(66, 19); g.stroke();
  g.beginPath(); g.moveTo(64, 34); g.lineTo(71, 23); g.stroke();
  // Spoiler.
  g.fillStyle = '#1f1f1f';
  g.fillRect(36, 34, 4, 8); g.fillRect(120, 34, 4, 8);
  g.fillStyle = '#b91c1c'; roundRect(g, 8, 30, 144, 6, 3); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(12, 30.5, 136, 1.2);
  // Tail lights with a glow.
  g.save();
  g.shadowColor = '#ff2d2d'; g.shadowBlur = 8;
  g.fillStyle = '#ff3030';
  roundRect(g, 10, 46, 46, 9, 3); g.fill();
  roundRect(g, 104, 46, 46, 9, 3); g.fill();
  g.restore();
  g.fillStyle = '#ffb4b4'; g.fillRect(14, 48.5, 38, 2); g.fillRect(108, 48.5, 38, 2);
  g.fillStyle = '#fff7ed'; g.fillRect(48, 47, 6, 7); g.fillRect(106, 47, 6, 7);
  // Black panel, plate and exhausts.
  g.fillStyle = '#111827'; roundRect(g, 58, 45, 44, 11, 2); g.fill();
  g.fillStyle = '#f8fafc'; roundRect(g, 64, 58, 32, 9, 1.5); g.fill();
  g.fillStyle = '#111827'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.fillText('RF 34', 80, 65);
  g.fillStyle = '#262626'; roundRect(g, 10, 68, 140, 9, 4); g.fill();
  for (const x of [30, 44, 116, 130]) {
    g.fillStyle = '#9ca3af'; g.beginPath(); g.arc(x, 73, 3.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(x, 73, 2, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(8, 40, 144, 1.5);
  g.restore();
  return c;
}

/** A car of the traffic from behind: 0 a saloon, 1 a van, 2 a low sports car. */
function trafficCar(color: string, model: number): Picture {
  const S = 1.6, [c, g] = canvas(160 * S, (model === 1 ? 128 : 100) * S);
  g.scale(S, S);
  const top = model === 1 ? 8 : model === 2 ? 46 : 30, base = model === 1 ? 118 : 90;
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath(); g.ellipse(80, base + 4, 76, 5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0a0a0a';
  roundRect(g, 10, base - 24, 22, 28, 4); g.fill(); roundRect(g, 128, base - 24, 22, 28, 4); g.fill();
  const body = g.createLinearGradient(0, top, 0, base);
  body.addColorStop(0, shade(color, 1.25)); body.addColorStop(0.5, color); body.addColorStop(1, shade(color, 0.55));
  g.fillStyle = body;
  if (model === 1) {
    roundRect(g, 8, top, 144, base - top - 4, 8); g.fill();
    g.fillStyle = '#0f172a'; roundRect(g, 20, top + 8, 120, 30, 4); g.fill();
    g.strokeStyle = shade(color, 0.6); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(80, top + 42); g.lineTo(80, base - 14); g.stroke();
    g.fillStyle = shade(color, 0.8); g.fillRect(70, top + 62, 6, 3); g.fillRect(84, top + 62, 6, 3);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('KARGO', 80, top + 56);
  } else {
    g.beginPath();
    g.moveTo(6, base - 6); g.lineTo(6, top + 24); g.quadraticCurveTo(8, top + 12, 22, top + 10); g.lineTo(138, top + 10);
    g.quadraticCurveTo(152, top + 12, 154, top + 24); g.lineTo(154, base - 6); g.closePath(); g.fill();
    const cabinTop = model === 2 ? top - 12 : top - 22;
    g.fillStyle = shade(color, 0.85);
    g.beginPath(); g.moveTo(28, top + 11); g.lineTo(40, cabinTop); g.lineTo(120, cabinTop); g.lineTo(132, top + 11); g.closePath(); g.fill();
    g.fillStyle = '#0f172a';
    g.beginPath(); g.moveTo(36, top + 9); g.lineTo(45, cabinTop + 4); g.lineTo(115, cabinTop + 4); g.lineTo(124, top + 9); g.closePath(); g.fill();
    g.fillStyle = 'rgba(148,163,184,0.35)'; g.fillRect(52, cabinTop + 6, 4, top + 2 - cabinTop - 6);
  }
  // Tail lights, plate, bumper.
  const ly = base - 30;
  g.save(); g.shadowColor = '#ef4444'; g.shadowBlur = 6; g.fillStyle = '#f43f5e';
  roundRect(g, 12, ly, 30, 8, 2); g.fill(); roundRect(g, 118, ly, 30, 8, 2); g.fill();
  g.restore();
  g.fillStyle = '#fecaca'; g.fillRect(15, ly + 2, 24, 1.5); g.fillRect(121, ly + 2, 24, 1.5);
  g.fillStyle = '#f1f5f9'; roundRect(g, 66, base - 20, 28, 8, 1); g.fill();
  g.fillStyle = '#1f2937'; g.fillRect(8, base - 9, 144, 6);
  return c;
}

// ---- Roadside --------------------------------------------------------------------------------

function tree(variant: number): Picture {
  const [c, g] = canvas(260, 300);
  const random = rng(11 + variant * 7);
  if (variant === 3) {
    // A palm for the coast.
    g.strokeStyle = '#6b4f2a'; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(130, 296); g.quadraticCurveTo(110, 180, 150, 80); g.stroke();
    g.strokeStyle = '#4b3720'; g.lineWidth = 2;
    for (let y = 280; y > 90; y -= 14) { g.beginPath(); g.moveTo(118, y); g.lineTo(140, y - 4); g.stroke(); }
    g.fillStyle = '#166534';
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.5;
      g.save(); g.translate(150, 80); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(50, -26, 104, 14); g.quadraticCurveTo(50, -6, 0, 6); g.fill();
      g.restore();
    }
    return c;
  }
  g.fillStyle = '#4a3222'; g.fillRect(120, 180, 22, 120);
  g.fillStyle = '#3a2618'; g.fillRect(132, 180, 10, 120);
  const greens = [['#14532d', '#166534', '#22c55e'], ['#1a4d2e', '#2f6b3a', '#5fa35a'], ['#365314', '#4d7c0f', '#84cc16']][variant % 3];
  for (let layer = 0; layer < 3; layer++) {
    g.fillStyle = greens[layer];
    for (let k = 0; k < 9 - layer * 2; k++) {
      const a = random() * Math.PI * 2, r = (1 - layer * 0.3) * 70 * random();
      g.beginPath();
      g.arc(130 + Math.cos(a) * r - layer * 10, 120 + Math.sin(a) * r * 0.8 - layer * 14, 50 - layer * 10 + random() * 14, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

function pine(variant: number): Picture {
  const [c, g] = canvas(180, 320);
  g.fillStyle = '#3b2a1c'; g.fillRect(82, 260, 16, 60);
  const colors = [['#0f3d2a', '#14532d'], ['#123524', '#1d4d33'], ['#0b3b38', '#115e59']][variant % 3];
  for (let k = 0; k < 5; k++) {
    const y = 30 + k * 48, w = 34 + k * 14;
    g.fillStyle = colors[0];
    g.beginPath(); g.moveTo(90, y - 30); g.lineTo(90 + w, y + 46); g.lineTo(90 - w, y + 46); g.closePath(); g.fill();
    g.fillStyle = colors[1];
    g.beginPath(); g.moveTo(90, y - 30); g.lineTo(90 - w, y + 46); g.lineTo(90 - w * 0.2, y + 40); g.closePath(); g.fill();
  }
  return c;
}

function bush(variant: number): Picture {
  const [c, g] = canvas(180, 100);
  const random = rng(5 + variant);
  const colors = [['#14532d', '#22c55e'], ['#365314', '#65a30d'], ['#1e3a2a', '#3f7a52']][variant % 3];
  for (let k = 0; k < 7; k++) {
    g.fillStyle = k < 4 ? colors[0] : colors[1];
    g.beginPath(); g.arc(30 + random() * 120, 60 + random() * 20 - (k > 3 ? 10 : 0), 26 + random() * 12, 0, Math.PI * 2); g.fill();
  }
  if (variant === 1) { g.fillStyle = '#fbbf24'; for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(30 + random() * 120, 46 + random() * 30, 3, 0, Math.PI * 2); g.fill(); } }
  return c;
}

/** A street lamp; `reach` says which way its arm goes over the road. */
function lamp(reach: 1 | -1): Picture {
  const [c, g] = canvas(140, 360);
  const pole = reach > 0 ? 24 : 116;
  const glow = g.createRadialGradient(pole + reach * 80, 40, 2, pole + reach * 80, 40, 60);
  glow.addColorStop(0, 'rgba(255,236,170,0.9)'); glow.addColorStop(0.25, 'rgba(255,214,120,0.35)'); glow.addColorStop(1, 'rgba(255,214,120,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 140, 120);
  g.fillStyle = '#475569'; g.fillRect(pole - 5, 30, 10, 330);
  g.fillStyle = '#334155'; g.fillRect(pole - 9, 330, 18, 30);
  g.strokeStyle = '#475569'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(pole, 40); g.quadraticCurveTo(pole + reach * 30, 18, pole + reach * 80, 32); g.stroke();
  g.fillStyle = '#1e293b'; roundRect(g, pole + reach * 80 - 20, 28, 40, 10, 4); g.fill();
  g.fillStyle = '#fff4cf'; g.fillRect(pole + reach * 80 - 15, 37, 30, 5);
  return c;
}

function billboard(variant: number): Picture {
  const [c, g] = canvas(380, 250);
  const [title, line] = BILLBOARDS[variant % BILLBOARDS.length];
  const looks = [['#7c3aed', '#2563eb'], ['#78350f', '#b45309'], ['#be123c', '#7c3aed'], ['#0f766e', '#1d4ed8'], ['#ca8a04', '#b91c1c'], ['#1e3a8a', '#0891b2']][variant % 6];
  g.fillStyle = '#334155'; g.fillRect(70, 150, 14, 100); g.fillRect(296, 150, 14, 100);
  g.fillStyle = '#1e293b'; roundRect(g, 8, 14, 364, 150, 8); g.fill();
  const face = g.createLinearGradient(0, 20, 380, 160);
  face.addColorStop(0, looks[0]); face.addColorStop(1, looks[1]);
  g.fillStyle = face; roundRect(g, 16, 22, 348, 134, 5); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.beginPath(); g.moveTo(16, 22); g.lineTo(200, 22); g.lineTo(120, 156); g.lineTo(16, 156); g.fill();
  g.textAlign = 'center'; g.fillStyle = '#fff';
  g.font = 'italic 900 44px sans-serif'; g.fillText(title, 190, 82, 330);
  g.fillStyle = '#fde68a'; g.font = 'bold 30px sans-serif'; g.fillText(line, 190, 130, 330);
  // Little lamps on top, lighting the board.
  for (const x of [80, 190, 300]) {
    g.fillStyle = '#64748b'; g.fillRect(x - 2, 4, 4, 12);
    g.fillStyle = '#fef3c7'; g.fillRect(x - 8, 2, 16, 5);
  }
  return c;
}

/** Buildings: 0-5 towers with lit windows, 6-8 factory halls. */
function building(variant: number): Picture {
  const random = rng(101 + variant * 13);
  if (variant >= 6) {
    const [c, g] = canvas(420, 300);
    const wall = ['#475569', '#57534e', '#3f3f46'][variant - 6];
    g.fillStyle = '#334155'; g.fillRect(320, 20, 30, 200);
    for (let y = 30; y < 200; y += 34) { g.fillStyle = '#ef4444'; g.fillRect(320, y, 30, 12); }
    g.fillStyle = wall; g.fillRect(10, 120, 400, 180);
    g.fillStyle = shade(wall.length === 7 ? wall : '#475569', 0.8);
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(10 + k * 80, 120); g.lineTo(10 + k * 80 + 40, 80); g.lineTo(10 + k * 80 + 80, 120); g.fill(); }
    g.fillStyle = '#fbbf24';
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(10 + k * 80 + 44, 86); g.lineTo(10 + k * 80 + 76, 116); g.lineTo(10 + k * 80 + 44, 116); g.fill(); }
    g.fillStyle = '#1f2937'; g.fillRect(150, 210, 120, 90);
    g.fillStyle = '#374151'; for (let y = 216; y < 300; y += 10) g.fillRect(150, y, 120, 3);
    g.fillStyle = '#0f172a'; roundRect(g, 40, 140, 340, 46, 6); g.fill();
    g.fillStyle = ['#22d3ee', '#f472b6', '#a3e635'][variant - 6];
    g.font = 'bold 32px sans-serif'; g.textAlign = 'center';
    g.fillText(['RENKFLOW BOYA', 'PROFİL A.Ş.', 'KESİM ATÖLYESİ'][variant - 6], 210, 175, 320);
    return c;
  }
  const h = 300 + Math.floor(random() * 4) * 70, [c, g] = canvas(300, h);
  const tone = ['#1e293b', '#312e81', '#3f3f46', '#164e63', '#422006', '#3b0764'][variant];
  const wall = g.createLinearGradient(0, 0, 300, 0);
  wall.addColorStop(0, shade(tone, 1.25)); wall.addColorStop(0.7, tone); wall.addColorStop(1, shade(tone, 0.7));
  g.fillStyle = wall; g.fillRect(10, 30, 280, h - 30);
  g.fillStyle = shade(tone, 0.6); g.fillRect(10, 22, 280, 12);
  if (variant % 2) { g.fillStyle = '#64748b'; g.fillRect(200, 0, 4, 24); g.fillStyle = '#ef4444'; g.fillRect(198, 0, 8, 5); }
  else { g.fillStyle = '#52525b'; g.fillRect(40, 6, 50, 18); }
  const warm = ['#fde68a', '#fcd34d', '#fef3c7', '#bae6fd', '#fbcfe8'];
  for (let y = 48; y < h - 40; y += 30) {
    for (let x = 26; x < 270; x += 28) {
      const lit = random() < 0.55;
      g.fillStyle = lit ? warm[Math.floor(random() * warm.length)] : 'rgba(15,23,42,0.75)';
      g.fillRect(x, y, 16, 18);
    }
  }
  g.fillStyle = '#0f172a'; g.fillRect(120, h - 40, 60, 40);
  g.fillStyle = '#fbbf24'; g.fillRect(124, h - 36, 52, 20);
  if (variant === 2 || variant === 5) {
    g.fillStyle = '#0f172a'; roundRect(g, 40, 50, 220, 40, 6); g.fill();
    g.fillStyle = variant === 2 ? '#f472b6' : '#22d3ee'; g.font = 'bold 28px sans-serif'; g.textAlign = 'center';
    g.fillText(variant === 2 ? 'KAFE ☕' : 'OTEL', 150, 80);
  }
  return c;
}

function gate(variant: number): Picture {
  const [c, g] = canvas(580, 280);
  for (const x of [8, 548]) {
    g.fillStyle = '#e5e7eb'; g.fillRect(x, 20, 24, 260);
    g.fillStyle = '#dc2626'; for (let y = 30; y < 280; y += 40) g.fillRect(x, y, 24, 20);
  }
  g.fillStyle = '#0f172a'; roundRect(g, 0, 8, 580, 72, 8); g.fill();
  if (variant === 0) {
    for (let x = 0; x < 72; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#f8fafc' : '#111827'; g.fillRect(6 + x * 7.9, 12 + y * 8, 7.9, 8); }
    g.fillStyle = '#f8fafc'; g.font = 'italic 900 36px sans-serif'; g.textAlign = 'center'; g.fillText('BAŞLANGIÇ · BİTİŞ', 290, 66, 540);
  } else {
    const face = g.createLinearGradient(0, 0, 580, 0);
    face.addColorStop(0, '#f97316'); face.addColorStop(1, '#facc15');
    g.fillStyle = face; roundRect(g, 6, 14, 568, 60, 6); g.fill();
    g.fillStyle = '#111827'; g.font = 'italic 900 38px sans-serif'; g.textAlign = 'center'; g.fillText('KONTROL NOKTASI', 290, 58, 540);
  }
  return c;
}

function coffee(): Picture {
  const [c, g] = canvas(110, 140);
  const glow = g.createRadialGradient(55, 80, 4, 55, 80, 55);
  glow.addColorStop(0, 'rgba(253,224,71,0.55)'); glow.addColorStop(1, 'rgba(253,224,71,0)');
  g.fillStyle = glow; g.fillRect(0, 20, 110, 120);
  g.fillStyle = '#f8fafc';
  g.beginPath(); g.moveTo(30, 48); g.lineTo(80, 48); g.lineTo(74, 128); g.lineTo(36, 128); g.closePath(); g.fill();
  g.fillStyle = '#92400e';
  g.beginPath(); g.moveTo(32, 72); g.lineTo(78, 72); g.lineTo(76, 100); g.lineTo(34, 100); g.closePath(); g.fill();
  g.fillStyle = '#fde68a'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.fillText('RF', 55, 93);
  g.fillStyle = '#e2e8f0'; roundRect(g, 25, 38, 60, 12, 4); g.fill();
  g.fillStyle = '#cbd5e1'; g.fillRect(48, 32, 14, 7);
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 4; g.lineCap = 'round';
  for (const x of [44, 64]) { g.beginPath(); g.moveTo(x, 28); g.quadraticCurveTo(x - 10, 16, x, 4); g.stroke(); }
  return c;
}

function cone(): Picture {
  const [c, g] = canvas(60, 80);
  g.fillStyle = '#ea580c';
  g.beginPath(); g.moveTo(30, 4); g.lineTo(46, 70); g.lineTo(14, 70); g.closePath(); g.fill();
  g.fillStyle = '#f8fafc'; g.fillRect(20, 32, 20, 9);
  g.fillStyle = '#9a3412'; g.fillRect(6, 68, 48, 10);
  return c;
}

// ---- Skylines --------------------------------------------------------------------------------

function skyline(theme: Theme, near: boolean): Picture {
  const W = 1536, H = near ? 300 : 240, [c, g] = canvas(W, H);
  const random = rng(near ? 77 : 31);
  if (theme === 'dusk' && !near) {
    // Far purple mountains behind the town.
    g.fillStyle = '#6b2f6e';
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 48) g.lineTo(x, H - 90 - Math.sin(x / 140) * 40 - Math.sin(x / 57) * 18);
    g.lineTo(W, H); g.fill();
  }
  const fill = theme === 'night' ? (near ? '#0b1024' : '#18204a') : (near ? '#2b1236' : '#4a1d4f');
  const windowLit = theme === 'night' ? (near ? ['#fde68a', '#fcd34d', '#93c5fd', '#f9a8d4'] : ['#a5b4fc', '#fde68a']) : ['#fdba74', '#fde68a'];
  const litChance = theme === 'night' ? (near ? 0.35 : 0.25) : 0.12;
  let x = 0;
  while (x < W) {
    const w = (near ? 50 : 30) + Math.floor(random() * (near ? 70 : 50));
    const h = (near ? 70 : 50) + Math.floor(random() * (near ? 170 : 130));
    const bw = Math.min(w, W - x);
    g.fillStyle = fill;
    g.fillRect(x, H - h, bw, h);
    if (random() < 0.3) g.fillRect(x + w * 0.4, H - h - 18, 3, 18);
    const step = near ? 9 : 6;
    for (let wy = H - h + 8; wy < H - 6; wy += step) {
      for (let wx = x + 5; wx < x + bw - 6; wx += step) {
        if (random() < litChance) { g.fillStyle = windowLit[Math.floor(random() * windowLit.length)]; g.fillRect(wx, wy, near ? 4 : 2.5, near ? 5 : 3); }
      }
    }
    if (near && random() < 0.25) { g.fillStyle = '#ef4444'; g.fillRect(x + w * 0.4 - 1, H - h - 20, 5, 4); }
    x += w + (random() < 0.3 ? Math.floor(random() * 30) : 0);
  }
  if (near && theme === 'night') {
    // A neon sign on one rooftop.
    g.save(); g.shadowColor = '#22d3ee'; g.shadowBlur = 12; g.fillStyle = '#67e8f9';
    g.font = 'bold 22px sans-serif'; g.fillText('RENKFLOW', 250, H - 120); g.restore();
  }
  return c;
}

function stars(): Picture {
  const [c, g] = canvas(1024, 260);
  const random = rng(3);
  for (let k = 0; k < 160; k++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + random() * 0.7})`;
    const s = random() < 0.1 ? 2 : 1;
    g.fillRect(random() * 1024, random() * 260, s, s);
  }
  return c;
}

export function createArt(): Art {
  return {
    sprites: {
      tree: [0, 1, 2, 3].map(tree),
      pine: [0, 1, 2].map(pine),
      bush: [0, 1, 2].map(bush),
      lamp: [lamp(1)],
      billboard: BILLBOARDS.map((_, i) => billboard(i)),
      building: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(building),
      gate: [gate(0), gate(1)],
      coffee: [coffee()],
      cone: [cone()],
    },
    lampRight: lamp(-1),
    cars: CAR_COLORS.map(color => [0, 1, 2].map(model => trafficCar(color, model))),
    player: [playerCar(-1), playerCar(0), playerCar(1)],
    layers: { night: [skyline('night', false), skyline('night', true)], dusk: [skyline('dusk', false), skyline('dusk', true)] },
    stars: stars(),
  };
}
