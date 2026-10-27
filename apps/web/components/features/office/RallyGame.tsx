'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { runResult, type RallyRun } from '@/lib/features/office/cheer';
import {
  COFFEE_POINTS, EVENT, MAX_SPEED, OVERTAKE_POINTS, autopilot, newRally, placeAt, readRallyBest, saveRallyBest, score, start, step,
  type RallyInput, type RallyState,
} from '@/lib/features/office/rally';
import { findWhere } from '@/lib/features/office/rally-track';
import { createArt } from './rally-art';
import { Effects, PARTICLE, carBottom, RallyRenderer, THEME_NAME, themeFor, type Overlay, type View } from './rally-render';
import { RallyAudio, readSoundOn, saveSoundOn } from './rally-audio';

/**
 * The office's racing game, opened by clicking the games screen in the 3D office: a little
 * OutRun-style time attack through the town at night. The car accelerates on its own; steer
 * with ←/→ (A/D), brake with ↓ (S), burn nitro with Space/Shift once coffee has filled it. On a
 * phone, big buttons for left, right and nitro. Game logic: lib/features/office/rally.ts.
 */

/** The record kept on this device, also shown on the office's games screen. */
export { readRallyBest };

const STEP = 1 / 60;

type Pads = { left: boolean; right: boolean; brake: boolean; nitro: boolean };

export function RallyGame({ onClose, onPlaying, onRunEnd, watcher }: {
  onClose: () => void; onPlaying?: (playing: boolean) => void;
  /** Every finished run, with whether it beat the record kept before it. */
  onRunEnd?: (run: RallyRun) => void;
  /** Who in the office is watching, shown in the header. */
  watcher?: string | null;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [best, setBest] = useState(0);
  const [sound, setSound] = useState(false);
  const [paused, setPaused] = useState(false);
  const [touch, setTouch] = useState(false);
  const [announce, setAnnounce] = useState('');

  // Everything the game loop reads, kept out of React so a render never restarts it.
  const sim = useRef<{
    game: RallyState; demo: RallyState; paused: boolean; keys: Pads; pads: Pads; canvasSteer: Map<number, -1 | 1>;
    best: number; record: boolean; auto: boolean; audio: RallyAudio; fx: Effects; view: View; touch: boolean;
  } | null>(null);
  const callbacks = useRef({ onClose, onPlaying, onRunEnd });
  useEffect(() => { callbacks.current = { onClose, onPlaying, onRunEnd }; }, [onClose, onPlaying, onRunEnd]);

  if (sim.current === null) {
    const seed = Math.floor(Math.random() * 1e9) + 1;
    const demo = newRally(seed + 1);
    demo.phase = 'playing';
    demo.timeLeft = 999;
    placeAt(demo, 30, MAX_SPEED * 0.8);
    sim.current = {
      game: newRally(seed), demo, paused: false, canvasSteer: new Map(),
      keys: { left: false, right: false, brake: false, nitro: false }, pads: { left: false, right: false, brake: false, nitro: false },
      best: 0, record: false, auto: false, audio: new RallyAudio(), fx: new Effects(), view: { w: 640, h: 400 }, touch: false,
    };
  }

  // The record and sound choice from this device, and whether this is a touch screen.
  useEffect(() => {
    const s = sim.current!;
    s.best = readRallyBest();
    s.game.best = s.best;
    setBest(s.best);
    setSound(readSoundOn());
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    s.touch = coarse;
    setTouch(coarse);
    s.fx.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  useEffect(() => { sim.current!.audio.setOn(sound); }, [sound]);

  const setPause = (on: boolean) => {
    const s = sim.current!;
    if (on && s.game.phase !== 'playing' && s.game.phase !== 'countdown') return;
    s.paused = on;
    setPaused(on);
    s.audio.setActive(!on);
    setAnnounce(on ? 'Oyun duraklatıldı.' : 'Oyun devam ediyor.');
  };
  const pauseRef = useRef(setPause);
  pauseRef.current = setPause;

  /** Starts a run from the title, or the next one once the last has been over for a moment. */
  const begin = () => {
    const s = sim.current!;
    // A remembered "sound on" can only really start from a key press or a tap: this one.
    s.audio.setActive(true);
    if (s.paused) { pauseRef.current(false); return true; }
    if (s.game.phase === 'ready' || (s.game.phase === 'over' && s.game.elapsed > 1)) {
      s.game.best = s.best;
      s.game = start(s.game);
      s.record = false;
      s.fx.banner = 0;
      setAnnounce('Geri sayım başladı.');
      return true;
    }
    return false;
  };
  const beginRef = useRef(begin);
  beginRef.current = begin;

  const toggleSound = () => {
    const on = !sim.current!.audio.on;
    saveSoundOn(on);
    setSound(on);
    sim.current!.audio.setOn(on);
  };
  const soundRef = useRef(toggleSound);
  soundRef.current = toggleSound;

  // Keep the canvas sharp and the right shape for the space it has.
  useEffect(() => {
    const box = stage.current, el = canvas.current;
    if (!box || !el) return;
    const fit = () => {
      const s = sim.current!;
      const bw = box.clientWidth, bh = box.clientHeight;
      if (!bw || !bh) return;
      // Phones on their side keep room at both edges for the buttons.
      const sides = s.touch && bw > bh ? Math.min(240, bw * 0.28) : 0;
      let w = bw - sides, h = bh;
      if (w / h > 1.9) w = h * 1.9;
      if (w / h < 0.5) h = w / 0.5;
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2_600_000 / (w * h)));
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      s.view = { w, h };
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [touch]);

  // The game loop: fixed 1/60 s steps, drawn every animation frame.
  useEffect(() => {
    const el = canvas.current;
    const g = el?.getContext('2d');
    if (!el || !g) return;
    const s = sim.current!;
    const renderer = new RallyRenderer(createArt());
    const input: RallyInput = { steer: 0, brake: false, nitro: false };
    const demoInput: RallyInput = { steer: 0, brake: false, nitro: false };
    let frame = 0, last = performance.now(), acc = 0, wasActive = false;

    const handle = (events: number) => {
      if (!events) return;
      const { fx, audio, view, game } = s;
      const carY = carBottom(view.w, view.h) - view.h * 0.06;
      if (events & EVENT.coffee) { fx.burst(view.w / 2, carY, 18, PARTICLE.coffee, 260); fx.float(`+${COFFEE_POINTS}`); audio.coffee(); }
      if (events & EVENT.crash) { fx.hit(18); fx.flash = fx.reduced ? 0.2 : 0.6; fx.flashColor = '#ffffff'; fx.burst(view.w / 2, carY, 28, PARTICLE.sparks, 420); audio.crash(); }
      if (events & EVENT.bump) { fx.hit(7); fx.burst(view.w / 2, carY - view.h * 0.05, 10, PARTICLE.sparks, 300); audio.bump(); }
      if (events & EVENT.overtake) { fx.float(`+${OVERTAKE_POINTS} sollama`); audio.overtake(); }
      if (events & EVENT.checkpoint) {
        audio.checkpoint();
        fx.banner = 1.6;
        fx.bannerText = events & EVENT.lap ? `TUR ${game.lap} · ${THEME_NAME[themeFor(game.lap)]}` : 'KONTROL NOKTASI';
        if (events & EVENT.lap) { fx.flash = fx.reduced ? 0.15 : 0.5; fx.flashColor = game.lap % 2 ? '#a78bfa' : '#fdba74'; }
      }
      if (events & EVENT.tick) audio.tick();
      if (events & EVENT.go) { audio.go(); setAnnounce('Başla!'); }
      if (events & EVENT.nitro) { audio.nitro(); fx.hit(3); }
      if (events & EVENT.record) { fx.record = 3; fx.burst(view.w / 2, view.h * 0.3, 40, PARTICLE.confetti, 380); audio.record(); }
      if (events & EVENT.over) {
        const run = runResult(score(game), s.best);
        if (run.isRecord) {
          s.best = run.best;
          s.record = true;
          saveRallyBest(run.best);
          setBest(run.best);
          fx.burst(view.w / 2, view.h * 0.4, 60, PARTICLE.confetti, 460);
          audio.record();
        } else audio.over();
        setAnnounce(`Süre doldu. ${run.score} puan${run.isRecord ? ', yeni rekor!' : '.'} Tekrar oynamak için Enter.`);
        callbacks.current.onRunEnd?.(run);
      }
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { game, demo, keys, pads, fx, view } = s;
      let canvasSteer = 0;
      for (const side of s.canvasSteer.values()) canvasSteer += side;
      const left = keys.left || pads.left, right = keys.right || pads.right;
      input.steer = left === right ? Math.sign(canvasSteer) : left ? -1 : 1;
      input.brake = keys.brake || pads.brake;
      input.nitro = keys.nitro || pads.nitro;
      if (s.auto && game.phase === 'playing') autopilot(game, input);
      if (!s.paused) {
        acc += dt;
        let events = 0, steps = 0;
        while (acc >= STEP && steps < 6) {
          if (game.phase === 'ready') {
            autopilot(demo, demoInput);
            step(demo, STEP, demoInput);
            demo.timeLeft = 999;
          } else {
            step(s.game, STEP, input);
            events |= s.game.events;
          }
          acc -= STEP;
          steps++;
        }
        if (steps === 6) acc = 0;
        handle(events);
        fx.update(dt);
      }
      const current = s.game;
      const shown = current.phase === 'ready' ? demo : current;
      const overlay: Overlay = current.phase === 'ready' ? 'title' : s.paused ? 'paused' : current.phase === 'over' && current.elapsed > 0.7 ? 'over' : 'none';
      const dpr = el.width / view.w;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderer.render(g, shown, view, fx, overlay, now / 1000, input.brake && current.phase === 'playing');
      renderer.overlay(g, current, view, overlay, now / 1000, s.best, s.touch, s.record);

      const active = (current.phase === 'playing' || current.phase === 'countdown') && !s.paused;
      s.audio.engine(shown.speed / MAX_SPEED, active || (current.phase === 'over' && current.speed > 0), shown.boosting);
      if (active !== wasActive) { wasActive = active; callbacks.current.onPlaying?.(active); }
    };
    frame = requestAnimationFrame(loop);

    // Screenshots and manual testing only: never in a normal build.
    if (process.env.NEXT_PUBLIC_RALLY_DEBUG === '1') {
      const track = s.game.track;
      const spots: Record<string, number> = {
        curve: findWhere(track, x => x.curve > 3.5, 400),
        hill: steepest(track) - 50,
        city: 60,
        offroad: findWhere(track, x => x.zone === 'forest' && Math.abs(x.curve) < 0.5),
        lap2: track.segments.length - 40,
      };
      (window as unknown as { __rally: unknown }).__rally = {
        state: () => s.game,
        auto: (on: boolean) => { s.auto = on; },
        jump: (where: string) => {
          placeAt(s.game, spots[where] ?? 0);
          if (where === 'offroad') s.game.x = -0.95;
          if (where === 'lap2') s.game.travelled = track.length * 0.9;
        },
        crash: () => { const car = s.game.cars[0]; car.x = s.game.x; car.z = (s.game.position + 900) % track.length; car.speed = 1000; s.game.safe = 0; },
        finish: () => { s.game.timeLeft = 0.05; },
        nitro: () => { s.game.nitro = 1; },
      };
    }

    return () => {
      cancelAnimationFrame(frame);
      callbacks.current.onPlaying?.(false);
      s.audio.close();
    };
  }, []);

  // Pause when the tab is hidden.
  useEffect(() => {
    const hidden = () => { if (document.hidden) pauseRef.current(true); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);

  // Keyboard: steering, brake, nitro, pause, sound, restart, close; focus kept inside the dialog.
  useEffect(() => {
    const s = sim.current!;
    const set = (e: KeyboardEvent, on: boolean) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') s.keys.left = on;
      else if (k === 'arrowright' || k === 'd') s.keys.right = on;
      else if (k === 'arrowdown' || k === 's') s.keys.brake = on;
      else if (k === ' ' || k === 'shift') s.keys.nitro = on;
      else return false;
      return true;
    };
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Tab') { trapFocus(e, dialog.current); return; }
      const onButton = e.target instanceof HTMLButtonElement;
      if (onButton && (e.key === 'Enter' || e.key === ' ')) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') {
        e.preventDefault();
        const playing = s.game.phase === 'playing' || s.game.phase === 'countdown';
        if (playing && !s.paused) pauseRef.current(true);
        else callbacks.current.onClose();
        return;
      }
      if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
      if (k === 'p') { if (!e.repeat) pauseRef.current(!s.paused); return; }
      if (k === 'm') { if (!e.repeat) soundRef.current(); return; }
      const game = set(e, true);
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      // Enter (or, on the title, any key) starts; Enter also resumes and restarts.
      if (e.key === 'Enter' || (s.game.phase === 'ready' && (game || e.key.length === 1)) || (s.game.phase === 'over' && e.key === ' ')) beginRef.current();
    };
    const up = (e: KeyboardEvent) => { set(e, false); };
    const blur = () => { s.keys.left = s.keys.right = s.keys.brake = s.keys.nitro = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  // Focus moves into the game and back to where it was when the dialog closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    canvas.current?.focus();
    return () => { before?.focus?.(); };
  }, []);

  const press = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const s = sim.current!;
    if (e.pointerType === 'touch' && !s.touch) { s.touch = true; setTouch(true); }
    if (beginRef.current()) return;
    if (s.game.phase !== 'playing') return;
    const box = e.currentTarget.getBoundingClientRect();
    s.canvasSteer.set(e.pointerId, e.clientX - box.left < box.width / 2 ? -1 : 1);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const release = (e: ReactPointerEvent<HTMLCanvasElement>) => { sim.current!.canvasSteer.delete(e.pointerId); };

  /** A big on-screen button held down with one finger while others hold the rest. */
  const pad = (key: keyof Pads) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const s = sim.current!;
      if (beginRef.current() && key !== 'nitro') return;
      s.pads[key] = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerUp: () => { sim.current!.pads[key] = false; },
    onPointerCancel: () => { sim.current!.pads[key] = false; },
    onLostPointerCapture: () => { sim.current!.pads[key] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 sm:p-4" onClick={() => onClose()}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="rally-title" aria-describedby="rally-help"
        className="flex h-full max-h-[56rem] w-full max-w-5xl flex-col overflow-hidden bg-zinc-950 shadow-2xl sm:rounded-2xl sm:border sm:border-zinc-700"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2 text-zinc-100 sm:px-4">
          <h2 id="rally-title" className="min-w-0 truncate text-sm font-semibold">RenkFlow Ralli <span className="hidden font-normal text-zinc-500 sm:inline">· ofisin oyun köşesi</span>
            {watcher && <span className="font-normal text-zinc-400"> · {watcher} izliyor 👀</span>}</h2>
          <div className="flex shrink-0 items-center gap-1">
            {best > 0 && <span className="mr-1 hidden text-xs font-semibold text-amber-300 sm:inline">Rekor {best.toLocaleString('tr-TR')}</span>}
            <button type="button" onClick={toggleSound} className="rounded-lg p-2 text-zinc-300 hover:bg-zinc-800" aria-pressed={sound}
              aria-label={sound ? 'Sesi kapat (M)' : 'Sesi aç (M)'} title={sound ? 'Sesi kapat (M)' : 'Sesi aç (M)'}>
              {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <button type="button" onClick={() => setPause(!paused)} className="rounded-lg p-2 text-zinc-300 hover:bg-zinc-800"
              aria-label={paused ? 'Devam et (P)' : 'Duraklat (P)'} title={paused ? 'Devam et (P)' : 'Duraklat (P)'}>
              {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-300 hover:bg-zinc-800" aria-label="Oyunu kapat (Esc)" title="Oyunu kapat (Esc)">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p id="rally-help" className="sr-only">
          Zamana karşı araba yarışı. Araba kendiliğinden hızlanır. Sol ve sağ ok tuşları ya da A ve D ile direksiyon, aşağı ok ya da S ile fren,
          boşluk ya da Shift ile nitro. Kahveler puan ve nitro verir, kontrol noktaları süre ekler. P duraklatır, M sesi açar, Esc çıkar, Enter yeniden başlatır.
        </p>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={stage} className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
            <canvas ref={canvas} tabIndex={0} onPointerDown={press} onPointerUp={release} onPointerCancel={release}
              className="block touch-none select-none outline-none"
              role="img" aria-label={`Araba yarışı oyun alanı. Rekor ${best}.`} />
          </div>
          {touch && (
            <div className="flex gap-2 bg-zinc-950 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] landscape:pointer-events-none landscape:absolute landscape:inset-0 landscape:bg-transparent landscape:p-0">
              <PadButton label="Sola" className="landscape:bottom-3 landscape:left-3" {...pad('left')}><ChevronLeft className="h-10 w-10" /></PadButton>
              <PadButton label="Nitro" className="bg-sky-500/30 active:bg-sky-400/50 landscape:bottom-[6.5rem] landscape:right-3" {...pad('nitro')}>
                <Zap className="h-8 w-8" /><span className="text-xs font-bold">NİTRO</span>
              </PadButton>
              <PadButton label="Sağa" className="landscape:bottom-3 landscape:right-3" {...pad('right')}><ChevronRight className="h-10 w-10" /></PadButton>
            </div>
          )}
        </div>
        <div className="sr-only" aria-live="polite">{announce}</div>
      </div>
    </div>
  );
}

function PadButton({ label, className, children, ...handlers }: {
  label: string; className?: string; children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} tabIndex={-1}
      className={cn('pointer-events-auto flex h-20 flex-1 touch-none select-none flex-col items-center justify-center rounded-2xl bg-white/15 text-white active:bg-white/30 landscape:absolute landscape:h-[5.5rem] landscape:w-24 landscape:flex-none', className)}
      {...handlers}>
      {children}
    </button>
  );
}

/** The steepest climb of the track (for the debug jump to a hill). */
function steepest(track: RallyState['track']) {
  let top = 0;
  for (const seg of track.segments) if (seg.y2 - seg.y1 > track.segments[top].y2 - track.segments[top].y1) top = seg.index;
  return top;
}

/** Keeps Tab and Shift+Tab inside the dialog. */
function trapFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>('button:not([tabindex="-1"]), canvas[tabindex="0"]'));
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !root.contains(active))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (active === last || !root.contains(active))) { e.preventDefault(); first.focus(); }
}
