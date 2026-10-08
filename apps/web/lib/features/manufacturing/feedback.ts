'use client';

/**
 * Touch feedback for the factory screen: a short vibration and, when sound is on, a short tone.
 * Gloves and machine noise make a silent button easy to miss. Off by the person's choice.
 */
const KEY = 'rf-factory-sound';
export const soundOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setSound = (on: boolean) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* not kept */ } };

let ctx: AudioContext | null = null;
export function feedback(kind: 'start' | 'done' | 'error') {
  try { navigator.vibrate?.(kind === 'error' ? [60, 40, 60] : kind === 'done' ? [30, 30, 30] : 30); } catch { /* no vibration */ }
  if (!soundOn()) return;
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = kind === 'error' ? 220 : kind === 'done' ? 880 : 660;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch { /* no audio */ }
}
