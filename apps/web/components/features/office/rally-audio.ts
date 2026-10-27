/**
 * The racing game's sounds, synthesised with WebAudio (no files): an engine hum whose pitch
 * follows the speed, blips for coffee and checkpoints, a crunch for crashes. Off by default; the
 * choice is remembered on this device.
 */

export const SOUND_KEY = 'renkflow.rally.sound';

export function readSoundOn() {
  try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; }
}

export function saveSoundOn(on: boolean) {
  try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* not remembered */ }
}

type Ctx = AudioContext;

export class RallyAudio {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineA: OscillatorNode | null = null;
  private engineB: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  on = false;

  /** Turns the sound on or off; the first time on must come from a click or key press. */
  setOn(on: boolean) {
    this.on = on;
    if (on) this.ensure();
    if (!this.ctx) return;
    if (on) void this.ctx.resume();
    else void this.ctx.suspend();
  }

  /** Pauses the sound while the game is paused or hidden. */
  setActive(active: boolean) {
    if (!this.ctx || !this.on) return;
    if (active) void this.ctx.resume();
    else void this.ctx.suspend();
  }

  private ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 600;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineA = ctx.createOscillator();
    this.engineA.type = 'sawtooth';
    this.engineB = ctx.createOscillator();
    this.engineB.type = 'square';
    this.engineB.detune.value = -1200;
    this.engineA.connect(this.filter);
    this.engineB.connect(this.filter);
    this.filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineA.start();
    this.engineB.start();
    const length = Math.floor(ctx.sampleRate * 0.6);
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Every frame: the engine follows the speed (0..1+) and whether it is running at all. */
  engine(speed: number, running: boolean, boosting: boolean) {
    if (!this.ctx || !this.on || !this.engineA || !this.engineB || !this.engineGain || !this.filter) return;
    const t = this.ctx.currentTime;
    const freq = 55 + speed * 150 + (boosting ? 30 : 0);
    this.engineA.frequency.setTargetAtTime(freq, t, 0.05);
    this.engineB.frequency.setTargetAtTime(freq, t, 0.05);
    this.filter.frequency.setTargetAtTime(400 + speed * 1400, t, 0.08);
    this.engineGain.gain.setTargetAtTime(running ? 0.06 + speed * 0.05 : 0, t, 0.1);
  }

  private tone(type: OscillatorType, from: number, to: number, length: number, volume: number, delay = 0) {
    if (!this.ctx || !this.on || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + length);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  private hiss(length: number, volume: number, cutoff: number, sweep = cutoff) {
    if (!this.ctx || !this.on || !this.master || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
    src.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(sweep, t + length);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start(t);
    src.stop(t + length);
  }

  coffee() { this.tone('sine', 660, 1320, 0.12, 0.25); this.tone('sine', 990, 1980, 0.1, 0.12, 0.06); }
  crash() { this.hiss(0.5, 0.6, 1800, 200); this.tone('square', 120, 40, 0.35, 0.2); }
  bump() { this.hiss(0.15, 0.35, 900, 300); }
  tick() { this.tone('square', 440, 440, 0.15, 0.15); }
  go() { this.tone('square', 880, 880, 0.35, 0.18); }
  checkpoint() { this.tone('triangle', 784, 784, 0.12, 0.25); this.tone('triangle', 1046, 1046, 0.2, 0.25, 0.1); }
  overtake() { this.tone('sine', 520, 780, 0.08, 0.12); }
  nitro() { this.hiss(0.6, 0.35, 400, 3000); }
  record() { [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.22, i * 0.09)); }
  over() { this.tone('sawtooth', 440, 110, 0.8, 0.15); }

  close() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
