'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const BAR = 6000;
const ROUNDS = 5;
const TARGETS = [1450, 2100, 980, 3200, 1675, 2650, 1200, 4100];

type Result = { target: number; cut: number };

function grade(totalError: number) {
  if (totalError <= 60) return ['Usta', 'Fire neredeyse sıfır. Kesim istasyonu sizi bekliyor.'];
  if (totalError <= 250) return ['Kalfa', 'Fena değil — biraz daha pratikle tolerans içindesiniz.'];
  return ['Çırak', 'Bu kesimler fireye gider. Bir tur daha?'];
}

/**
 * 404 easter egg: a saw head sweeps a 6 m profile; stop it on the target length.
 * Space, Enter or a click cuts. Respects reduced motion by slowing the sweep.
 */
export function CutGame() {
  const reduce = useReducedMotion();
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [pos, setPos] = useState(0);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState<Result | null>(null);
  const frame = useRef(0);
  const start = useRef(0);
  const target = TARGETS[(round + results.length * 3) % TARGETS.length];
  const done = results.length >= ROUNDS;

  useEffect(() => {
    if (!running) return;
    const speed = reduce ? 0.00018 : 0.00042;
    const tick = (now: number) => {
      if (!start.current) start.current = now;
      const t = (now - start.current) * speed;
      setPos((1 - Math.cos(t * Math.PI)) / 2);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [running, reduce]);

  const cut = useCallback(() => {
    if (done) return;
    if (!running) { start.current = 0; setRunning(true); return; }
    setRunning(false);
    const value = Math.round((pos * BAR) / 5) * 5;
    const result = { target, cut: value };
    setFlash(result);
    setResults((list) => [...list, result]);
    setTimeout(() => { setFlash(null); setRound((r) => r + 1); start.current = 0; if (results.length + 1 < ROUNDS) setRunning(true); }, 1100);
  }, [done, running, pos, target, results.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); cut(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cut]);

  const totalError = results.reduce((sum, r) => sum + Math.abs(r.cut - r.target), 0);
  const [title, detail] = grade(totalError);
  const reset = () => { setResults([]); setRound((r) => r + 7); setPos(0); setRunning(false); };

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-6 text-left backdrop-blur-[2px]">
      <div className="flex items-center justify-between">
        <p className="rf-mono-label text-zinc-500">Kesim ustası · Tur {Math.min(results.length + 1, ROUNDS)}/{ROUNDS}</p>
        <p className="font-mono text-[11px] text-zinc-500">Toplam fire <span className="text-zinc-200">{totalError} mm</span></p>
      </div>

      {!done ? (
        <>
          <p className="mt-5 text-[15px] text-zinc-300">Hedef: <span className="font-mono text-white">{target.toLocaleString('tr-TR')} mm</span></p>
          <button type="button" onClick={cut} aria-label={running ? 'Kes' : 'Başlat'} className="relative mt-4 block h-14 w-full cursor-crosshair select-none rounded-md bg-zinc-800/80 ring-1 ring-inset ring-white/10">
            <span aria-hidden className="absolute inset-y-0 left-0 rounded-l-md bg-zinc-600/60" style={{ width: `${pos * 100}%` }} />
            <span aria-hidden className="absolute inset-y-[-6px] w-px bg-[hsl(var(--primary))]" style={{ left: `${(target / BAR) * 100}%` }}>
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 font-mono text-[9px] text-[hsl(var(--primary))]">▼</span>
            </span>
            <span aria-hidden className="absolute inset-y-[-10px] w-[2px] bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.08)]" style={{ left: `${pos * 100}%` }} />
            {[0, 1000, 2000, 3000, 4000, 5000, 6000].map((mark) => (
              <span key={mark} aria-hidden className="absolute bottom-[-18px] -translate-x-1/2 font-mono text-[9px] text-zinc-600" style={{ left: `${(mark / BAR) * 100}%` }}>{mark / 1000}m</span>
            ))}
          </button>
          <div className="mt-8 flex h-6 items-center justify-between text-[12px]">
            <span className="text-zinc-500">{running ? 'Boşluk veya tıklama ile kesin' : 'Başlamak için boşluk tuşuna basın'}</span>
            <AnimatePresence>
              {flash && (
                <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`font-mono ${Math.abs(flash.cut - flash.target) <= 20 ? 'text-emerald-400' : 'text-amber-300'}`}>
                  {flash.cut} mm · {flash.cut - flash.target >= 0 ? '+' : ''}{flash.cut - flash.target}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
          <p className="text-[22px] font-semibold tracking-[-0.03em] text-white">{title}</p>
          <p className="mt-1.5 text-[14px] text-zinc-400">{detail}</p>
          <button type="button" onClick={reset} className="mt-5 inline-flex h-9 items-center rounded-lg border border-white/15 px-3.5 text-[13px] text-white transition-colors hover:bg-white/5">Tekrar oyna</button>
        </motion.div>
      )}
    </div>
  );
}
