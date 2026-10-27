'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { newRally, score, start, step, type RallyState, type RallyThing } from '@/lib/features/office/rally';
import { runResult, type RallyRun } from '@/lib/features/office/cheer';

/**
 * The office's racing game, opened by clicking the games screen in the 3D office: the same road
 * the staff play on their breaks, now for the person at the keyboard. Arrow keys or A/D steer; on
 * a phone, hold the left or right half of the screen.
 */

const W = 640, H = 400, HORIZON = 150;
const BEST_KEY = 'renkflow.rally.best';

function readBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

/** 0 at the horizon, 1 at the bottom of the screen, for a thing at `depth`. */
const nearness = (depth: number) => Math.max(0, 1 - depth) ** 2.2;
const halfWidth = (p: number) => W * (0.035 + p * 0.43);
const rowY = (p: number) => HORIZON + p * (H - HORIZON);

function drawCar(g: CanvasRenderingContext2D, cx: number, y: number, scale: number, color: string) {
  const w = 70 * scale, h = 44 * scale;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(cx - w / 2, y - h * 0.15, w, h * 0.3);
  g.fillStyle = '#111827';
  for (const side of [-1, 1]) for (const back of [0, 1]) g.fillRect(cx + side * w * 0.42 - w * 0.08, y - h * (0.85 - back * 0.55), w * 0.16, h * 0.28);
  g.fillStyle = color;
  g.fillRect(cx - w * 0.4, y - h, w * 0.8, h * 0.95);
  g.fillStyle = 'rgba(15,23,42,0.85)';
  g.fillRect(cx - w * 0.28, y - h * 0.82, w * 0.56, h * 0.3);
  g.fillStyle = '#fde68a';
  g.fillRect(cx - w * 0.34, y - h * 0.18, w * 0.12, h * 0.1);
  g.fillRect(cx + w * 0.22, y - h * 0.18, w * 0.12, h * 0.1);
}

function drawCoffee(g: CanvasRenderingContext2D, cx: number, y: number, scale: number, time: number) {
  const s = 26 * scale;
  g.fillStyle = '#f8fafc';
  g.fillRect(cx - s / 2, y - s, s, s);
  g.strokeStyle = '#f8fafc';
  g.lineWidth = Math.max(1, 3 * scale);
  g.beginPath(); g.arc(cx + s / 2, y - s / 2, s * 0.25, -Math.PI / 2, Math.PI / 2); g.stroke();
  g.fillStyle = '#78350f';
  g.fillRect(cx - s / 2 + 2 * scale, y - s + 2 * scale, s - 4 * scale, s * 0.25);
  g.strokeStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 2; i++) {
    g.beginPath();
    g.moveTo(cx - s * 0.15 + i * s * 0.3, y - s * 1.1);
    g.quadraticCurveTo(cx - s * 0.3 + i * s * 0.3 + Math.sin(time * 6 + i) * s * 0.15, y - s * 1.4, cx - s * 0.1 + i * s * 0.3, y - s * 1.7);
    g.stroke();
  }
}

function draw(g: CanvasRenderingContext2D, state: RallyState, best: number, time: number) {
  const sky = g.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#1e3a8a'); sky.addColorStop(1, '#f59e0b');
  g.fillStyle = sky; g.fillRect(0, 0, W, HORIZON);
  g.fillStyle = '#fde047'; g.beginPath(); g.arc(W * 0.72, HORIZON - 18, 26, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#312e81';
  g.beginPath(); g.moveTo(0, HORIZON);
  for (let x = 0; x <= W; x += 40) g.lineTo(x, HORIZON - 18 - Math.abs(Math.sin(x / 90 + state.x * 0.3)) * 34);
  g.lineTo(W, HORIZON); g.fill();

  // The road, row by row: grass, red-white kerbs and lane marks scroll with the distance driven.
  for (let y = HORIZON; y < H; y += 3) {
    const p = (y - HORIZON) / (H - HORIZON);
    const stripe = Math.floor(1 / (p + 0.06) * 2 + state.distance * 0.03) % 2 === 0;
    const hw = halfWidth(p), cx = W / 2 - state.x * hw * 0.25;
    g.fillStyle = stripe ? '#15803d' : '#166534';
    g.fillRect(0, y, W, 3);
    g.fillStyle = stripe ? '#ef4444' : '#f8fafc';
    g.fillRect(cx - hw * 1.08, y, hw * 2.16, 3);
    g.fillStyle = stripe ? '#475569' : '#4b5563';
    g.fillRect(cx - hw, y, hw * 2, 3);
    if (stripe) {
      g.fillStyle = '#f8fafc';
      for (const lane of [-0.3, 0.3]) g.fillRect(cx + lane * hw - hw * 0.012, y, Math.max(1, hw * 0.024), 3);
    }
  }

  const far = [...state.things].sort((a: RallyThing, b: RallyThing) => b.depth - a.depth);
  for (const thing of far) {
    const p = nearness(thing.depth);
    if (p <= 0) continue;
    const hw = halfWidth(p), cx = W / 2 - state.x * hw * 0.25 + thing.x * hw;
    if (thing.kind === 'car') drawCar(g, cx, rowY(p), hw / (W * 0.43), thing.color);
    else drawCoffee(g, cx, rowY(p), hw / (W * 0.43), time);
  }
  // The player's car, a little bouncy at speed.
  const bounce = state.phase === 'playing' ? Math.sin(time * 30) * 1.2 : 0;
  drawCar(g, W / 2 + state.x * halfWidth(1) * 0.75, H - 18 + bounce, 1.15, '#dc2626');

  g.fillStyle = 'rgba(2,6,23,0.6)';
  g.fillRect(8, 8, 230, 52);
  g.fillStyle = '#fde047'; g.font = 'bold 16px ui-monospace, monospace'; g.textAlign = 'left';
  g.fillText(`SKOR ${score(state).toString().padStart(6, '0')}`, 18, 30);
  g.fillStyle = '#e2e8f0'; g.font = '13px ui-monospace, monospace';
  g.fillText(`${Math.round(state.speed * 120)} km/sa · REKOR ${best}`, 18, 50);

  if (state.phase !== 'playing') {
    g.fillStyle = 'rgba(2,6,23,0.7)';
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.fillStyle = '#f8fafc';
    g.font = 'bold 26px sans-serif';
    g.fillText(state.phase === 'ready' ? 'RENKFLOW RALLİ' : 'KAZA!', W / 2, H / 2 - 36);
    g.font = '15px sans-serif';
    if (state.phase === 'crashed') {
      g.fillStyle = score(state) >= best && score(state) > 0 ? '#fde047' : '#cbd5e1';
      g.fillText(score(state) >= best && score(state) > 0 ? `Yeni rekor: ${score(state)}` : `Skor: ${score(state)} · Rekor: ${best}`, W / 2, H / 2 - 6);
    } else {
      g.fillStyle = '#cbd5e1';
      g.fillText('Arabalardan kaçın, kahveleri toplayın (+100).', W / 2, H / 2 - 6);
    }
    g.fillStyle = '#fbbf24';
    g.font = 'bold 15px sans-serif';
    g.fillText(Math.floor(time * 2) % 2 ? 'BAŞLAMAK İÇİN BİR TUŞA BASIN' : '', W / 2, H / 2 + 28);
    g.fillStyle = '#94a3b8';
    g.font = '12px sans-serif';
    g.fillText('← → veya A D ile sürün · telefonda ekranın sol/sağ yarısına basılı tutun · Esc ile çıkın', W / 2, H - 16);
  }
}

/** The record kept on this device, also shown on the office's games screen. */
export const readRallyBest = readBest;

export function RallyGame({ onClose, onPlaying, onRunEnd, watcher }: {
  onClose: () => void; onPlaying?: (playing: boolean) => void;
  /** Every finished run, with whether it beat the record kept before it. */
  onRunEnd?: (run: RallyRun) => void;
  /** Who in the office is watching, shown in the header. */
  watcher?: string | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<RallyState>(newRally(Math.floor(Math.random() * 1e9) + 1));
  const keys = useRef({ left: false, right: false, touch: 0 as -1 | 0 | 1 });
  const [best, setBest] = useState(readBest);
  const bestRef = useRef(best);
  /** A crash is shown for a moment before a key may start the next run. */
  const crashedAt = useRef(0);
  // Read through a ref so a new callback never restarts the game loop.
  const runEnd = useRef(onRunEnd);
  useEffect(() => { runEnd.current = onRunEnd; }, [onRunEnd]);

  useEffect(() => {
    const g = canvas.current?.getContext('2d');
    if (!g) return;
    let frame = 0, last = performance.now(), wasPlaying = false;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const k = keys.current;
      const steer = (k.touch || (k.left === k.right ? 0 : k.left ? -1 : 1)) as -1 | 0 | 1;
      const before = game.current.phase;
      game.current = step(game.current, (now - last) / 1000, steer);
      last = now;
      if (before === 'playing' && game.current.phase === 'crashed') {
        crashedAt.current = now;
        const run = runResult(score(game.current), bestRef.current);
        if (run.isRecord) {
          bestRef.current = run.best;
          setBest(bestRef.current);
          try { localStorage.setItem(BEST_KEY, String(bestRef.current)); } catch { /* the record just is not kept */ }
        }
        runEnd.current?.(run);
      }
      const playing = game.current.phase === 'playing';
      if (playing !== wasPlaying) { wasPlaying = playing; onPlaying?.(playing); }
      draw(g, game.current, bestRef.current, now / 1000);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); onPlaying?.(false); };
  }, [onPlaying]);

  useEffect(() => {
    const begin = () => { if (game.current.phase !== 'playing' && performance.now() - crashedAt.current > 700) game.current = start(game.current); };
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab') return;
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keys.current.left = true;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.current.right = true;
      // Arrows and space would scroll the page behind the game.
      if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
      // Any key starts a run (or the next one after a crash); a held key's repeats do not.
      if (!e.repeat) begin();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keys.current.left = false;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.current.right = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [onClose]);

  const press = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (game.current.phase !== 'playing') { if (performance.now() - crashedAt.current > 700) game.current = start(game.current); return; }
    const box = e.currentTarget.getBoundingClientRect();
    keys.current.touch = e.clientX - box.left < box.width / 2 ? -1 : 1;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const release = () => { keys.current.touch = 0; };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-labelledby="rally-title" onClick={onClose}>
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5 text-zinc-100">
          <h2 id="rally-title" className="text-sm font-semibold">RenkFlow Ralli <span className="font-normal text-zinc-500">· ofisin oyun köşesi</span>
            {watcher && <span className="font-normal text-zinc-400"> · {watcher} izliyor 👀</span>}</h2>
          <button type="button" onClick={onClose} autoFocus className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800" aria-label="Oyunu kapat"><X className="h-5 w-5" /></button>
        </div>
        <canvas ref={canvas} width={W} height={H} onPointerDown={press} onPointerUp={release} onPointerCancel={release}
          className="block aspect-[8/5] w-full touch-none select-none" aria-label={`Araba yarışı. Rekor ${best}.`} />
      </div>
    </div>
  );
}
