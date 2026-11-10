// Synthesized sound effects (WebAudio, no asset files). No-ops without a browser AudioContext (headless sim).
import { store } from './save';

export type Sfx =
  | 'click' | 'place' | 'upgrade' | 'shot' | 'hit' | 'death' | 'bossDeath' | 'lifeLost'
  | 'wave' | 'victory' | 'defeat' | 'gold' | 'chestCharge' | 'chestBurst' | 'card' | 'ult';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const last: Partial<Record<Sfx, number>> = {};
// Minimum gap (ms) between two plays of the same sound, so busy fights don't stack.
const GAP: Partial<Record<Sfx, number>> = { shot: 60, hit: 60, death: 45, lifeLost: 120, gold: 70, click: 30, card: 80, ult: 150 };

function level(): number {
  const d = store.data;
  return d.muted ? 0 : Math.max(0, Math.min(1, d.volume ?? 0.5));
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = level() * 0.6;
      master.connect(ctx.destination);
    } catch { ctx = null; return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

/** Re-applies volume/mute from the save to the master gain. */
export function applyVolume(): void {
  if (ctx && master) master.gain.setTargetAtTime(level() * 0.6, ctx.currentTime, 0.02);
}

// Unlock audio on the first user gesture.
if (typeof window !== 'undefined') {
  const unlock = () => { getCtx(); };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
}

function tone(c: AudioContext, o: {
  f: number; to?: number; t?: number; d: number; v: number; type?: OscillatorType; a?: number;
}): void {
  const t0 = c.currentTime + (o.t ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.d);
  const a = o.a ?? 0.006;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(o.v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
  osc.connect(g).connect(master!);
  osc.start(t0);
  osc.stop(t0 + o.d + 0.03);
}

function noise(c: AudioContext, o: { t?: number; d: number; v: number; f: number; to?: number; q?: number; type?: BiquadFilterType }): void {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + (o.t ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const flt = c.createBiquadFilter();
  flt.type = o.type ?? 'bandpass';
  flt.Q.value = o.q ?? 0.8;
  flt.frequency.setValueAtTime(o.f, t0);
  if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t0 + o.d);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(o.v, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
  src.connect(flt).connect(g).connect(master!);
  src.start(t0);
  src.stop(t0 + o.d + 0.03);
}

const N = { C4: 262, E4: 330, G4: 392, A4: 440, C5: 523, D5: 587, E5: 659, G5: 784, C6: 1047 };

const PLAY: Record<Sfx, (c: AudioContext) => void> = {
  click: (c) => tone(c, { f: 620, to: 480, d: 0.06, v: 0.12, type: 'triangle' }),
  place: (c) => {
    tone(c, { f: 220, to: 120, d: 0.14, v: 0.22 });
    noise(c, { d: 0.08, v: 0.08, f: 900, to: 400 });
  },
  upgrade: (c) => [N.C5, N.E5, N.G5].forEach((f, i) => tone(c, { f, t: i * 0.07, d: 0.2, v: 0.14, type: 'triangle' })),
  shot: (c) => tone(c, { f: 900, to: 500, d: 0.05, v: 0.025, type: 'triangle' }),
  hit: (c) => noise(c, { d: 0.05, v: 0.035, f: 1800, to: 900, q: 1.2 }),
  death: (c) => {
    tone(c, { f: 440, to: 180, d: 0.14, v: 0.07, type: 'triangle' });
    noise(c, { d: 0.1, v: 0.04, f: 1200, to: 500 });
  },
  bossDeath: (c) => {
    tone(c, { f: 300, to: 60, d: 0.7, v: 0.22 });
    noise(c, { d: 0.6, v: 0.15, f: 1500, to: 150 });
    [N.C5, N.G5, N.C6].forEach((f, i) => tone(c, { f, t: 0.25 + i * 0.1, d: 0.4, v: 0.1, type: 'triangle' }));
  },
  lifeLost: (c) => {
    tone(c, { f: 260, to: 130, d: 0.28, v: 0.2, type: 'triangle' });
    tone(c, { f: 196, to: 98, d: 0.28, v: 0.12 });
  },
  wave: (c) => {
    tone(c, { f: N.G4, d: 0.22, v: 0.16, type: 'triangle' });
    tone(c, { f: N.C5, t: 0.14, d: 0.35, v: 0.18, type: 'triangle' });
    tone(c, { f: N.C5 / 2, t: 0.14, d: 0.35, v: 0.1 });
  },
  victory: (c) => {
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(c, { f, t: i * 0.13, d: 0.35, v: 0.15, type: 'triangle' }));
    [N.C5, N.E5, N.G5].forEach((f) => tone(c, { f, t: 0.6, d: 0.9, v: 0.09 }));
  },
  defeat: (c) => [N.A4, N.G4, N.E4, N.C4].forEach((f, i) => tone(c, { f, t: i * 0.2, d: 0.45, v: 0.14, type: 'triangle' })),
  gold: (c) => {
    tone(c, { f: 1319, d: 0.1, v: 0.1, type: 'triangle' });
    tone(c, { f: 1760, t: 0.06, d: 0.18, v: 0.1, type: 'triangle' });
  },
  chestCharge: (c) => {
    tone(c, { f: 110, to: 440, d: 1.05, v: 0.14, a: 0.3 });
    tone(c, { f: 220, to: 880, d: 1.05, v: 0.06, type: 'triangle', a: 0.4 });
    noise(c, { d: 1.05, v: 0.05, f: 300, to: 4000, q: 2 });
  },
  chestBurst: (c) => {
    noise(c, { d: 0.5, v: 0.22, f: 3000, to: 300, q: 0.6 });
    tone(c, { f: 160, to: 50, d: 0.4, v: 0.3 });
    [N.C5, N.G5, N.C6].forEach((f, i) => tone(c, { f, t: 0.05 + i * 0.06, d: 0.8, v: 0.1, type: 'triangle' }));
  },
  ult: (c) => {
    tone(c, { f: 140, to: 620, d: 0.35, v: 0.2, type: 'sawtooth', a: 0.05 });
    noise(c, { d: 0.45, v: 0.14, f: 500, to: 3500, q: 1.5 });
    [N.C5, N.G5, N.C6].forEach((f, i) => tone(c, { f, t: 0.18 + i * 0.07, d: 0.5, v: 0.1, type: 'triangle' }));
  },
  card: (c) => {
    tone(c, { f: N.E5, d: 0.2, v: 0.12, type: 'triangle' });
    tone(c, { f: N.G5 * 1.5, t: 0.05, d: 0.25, v: 0.07 });
  },
};

export function sfx(name: Sfx): void {
  if (typeof window === 'undefined' || level() <= 0) return;
  const now = performance.now();
  const gap = GAP[name] ?? 0;
  if (gap && now - (last[name] ?? -1e9) < gap) return;
  last[name] = now;
  const c = getCtx();
  if (!c || c.state !== 'running' || !master) return;
  try { PLAY[name](c); } catch { /* audio failure must never break the game */ }
}
