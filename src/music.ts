// Generative music and ambience, synthesized with WebAudio (no audio files). One theme per region plus a calm
// one for the menus: pad chords, bass, a wandering lead, light percussion that comes in when a wave is running,
// and a background bed (birds, wind, fire, water). Does nothing without a browser AudioContext (headless sim).
import { audioContext } from './audio';
import { store } from './save';

type Lead = 'pluck' | 'bell' | 'flute' | 'brass';
type Drum = 'none' | 'soft' | 'march' | 'war' | 'taiko';
type Bed = 'none' | 'birds' | 'wind' | 'fire' | 'water';

interface Theme {
  /** MIDI note of the tonic. */
  root: number;
  scale: number[];
  bpm: number;
  /** One chord per bar, as scale degrees. */
  chords: number[][];
  lead: Lead;
  drum: Drum;
  bed: Bed;
  /** Lowpass on the pad (Hz): darker themes sit lower. */
  tone: number;
}

const DORIAN = [0, 2, 3, 5, 7, 9, 10], MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10], PENTA = [0, 2, 4, 7, 9];

const THEMES: Record<string, Theme> = {
  menu: { root: 50, scale: DORIAN, bpm: 70, chords: [[0, 2, 4], [3, 5, 7], [5, 7, 9], [4, 6, 8]], lead: 'bell', drum: 'none', bed: 'none', tone: 900 },
  rift: { root: 50, scale: DORIAN, bpm: 96, chords: [[0, 2, 4], [6, 8, 10], [3, 5, 7], [0, 2, 4]], lead: 'pluck', drum: 'soft', bed: 'birds', tone: 1100 },
  demacia: { root: 48, scale: MAJOR, bpm: 100, chords: [[0, 2, 4], [4, 6, 8], [5, 7, 9], [3, 5, 7]], lead: 'brass', drum: 'march', bed: 'birds', tone: 1400 },
  freljord: { root: 45, scale: MINOR, bpm: 76, chords: [[0, 2, 4], [5, 7, 9], [2, 4, 6], [6, 8, 10]], lead: 'bell', drum: 'taiko', bed: 'wind', tone: 800 },
  noxus: { root: 50, scale: PHRYGIAN, bpm: 88, chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [4, 6, 8]], lead: 'brass', drum: 'war', bed: 'fire', tone: 650 },
  ionia: { root: 52, scale: PENTA, bpm: 84, chords: [[0, 2, 3], [1, 3, 4], [2, 4, 5], [0, 2, 3]], lead: 'flute', drum: 'soft', bed: 'water', tone: 1300 },
};

let current: string | null = null;
let wanted: string | null = null;
/** 0 calm (between waves, menus), 1 a wave is running, 2 epic monster or boss wave. */
let intensity = 0;

let bus: GainNode | null = null;      // music volume
let layer: GainNode | null = null;    // current theme (cross-faded on change)
let echo: DelayNode | null = null;
let padFilter: BiquadFilterNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let bedNodes: AudioNode[] = [];
let timer = 0;
let nextTime = 0;
let step = 0;
let leadDeg = 9;
let bedT = 0;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
function note(th: Theme, degree: number): number {
  const n = th.scale.length, oct = Math.floor(degree / n);
  return hz(th.root + th.scale[((degree % n) + n) % n] + 12 * oct);
}

function level(): number {
  const d = store.data;
  return d.muted ? 0 : Math.max(0, Math.min(1, d.music ?? 0.35)) * 0.5;
}

/** Re-applies the music volume / mute from the save. */
export function applyMusicVolume(): void {
  const c = audioContext();
  if (c && bus) bus.gain.setTargetAtTime(level(), c.currentTime, 0.05);
  if (level() > 0) kick();
}

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** One enveloped oscillator note into `out`. */
function tone(c: AudioContext, out: AudioNode, f: number, t: number, dur: number, vol: number, type: OscillatorType, attack: number, vibrato = 0): void {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (vibrato) {
    const l = c.createOscillator(), lg = c.createGain();
    l.frequency.value = 5.2;
    lg.gain.value = f * vibrato;
    l.connect(lg).connect(o.frequency);
    l.start(t);
    l.stop(t + dur + 0.1);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Burst of filtered noise (drums, crackles). */
function hit(c: AudioContext, out: AudioNode, t: number, dur: number, vol: number, f: number, type: BiquadFilterType, q = 0.8): void {
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise(c);
  s.loop = true;
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = q;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(out);
  s.start(t, Math.random());
  s.stop(t + dur + 0.02);
}

function drumHit(c: AudioContext, out: AudioNode, t: number, f: number, vol: number, dur: number): void {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.45, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function leadNote(c: AudioContext, th: Theme, out: AudioNode, f: number, t: number, len: number): void {
  switch (th.lead) {
    case 'pluck': tone(c, out, f, t, 0.5, 0.11, 'triangle', 0.005); tone(c, out, f * 2, t, 0.2, 0.03, 'sine', 0.005); break;
    case 'bell': tone(c, out, f, t, 1.6, 0.09, 'sine', 0.005); tone(c, out, f * 2.76, t, 0.7, 0.025, 'sine', 0.005); break;
    case 'flute': tone(c, out, f, t, Math.max(0.5, len * 1.6), 0.1, 'sine', 0.07, 0.006); tone(c, out, f * 2, t, 0.3, 0.012, 'sine', 0.05); break;
    case 'brass': tone(c, out, f, t, Math.max(0.45, len * 1.4), 0.05, 'sawtooth', 0.05); tone(c, out, f, t, Math.max(0.45, len * 1.4), 0.05, 'triangle', 0.05); break;
  }
}

/** Schedules one sixteenth-note step of the current theme at time t. */
function playStep(c: AudioContext, th: Theme, t: number): void {
  const out = layer!, sixteenth = 60 / th.bpm / 4, bar = Math.floor(step / 16), s = step % 16;
  const chord = th.chords[bar % th.chords.length];
  const calm = intensity === 0;

  if (s === 0) {
    // Pad: the chord held for the whole bar, through the theme's lowpass
    const len = sixteenth * 16;
    for (const d of chord) {
      tone(c, padFilter!, note(th, d), t, len * 1.05, 0.05, 'sawtooth', len * 0.25);
      tone(c, padFilter!, note(th, d) * 1.004, t, len * 1.05, 0.04, 'triangle', len * 0.25);
    }
  }
  // Bass: the chord's root, busier while a wave is running
  const bassOn = calm ? s === 0 : s === 0 || s === 6 || s === 8 || (intensity === 2 && (s === 3 || s === 11 || s === 14));
  if (bassOn) tone(c, out, note(th, chord[0] - th.scale.length), t, sixteenth * (calm ? 10 : 3), 0.16, 'triangle', 0.01);

  // Lead: a random walk over the scale that leans on chord tones on the strong beats
  const strong = s % 8 === 0, onBeat = s % 2 === 0;
  if (onBeat && Math.random() < (strong ? 0.8 : calm ? 0.25 : 0.5)) {
    const n = th.scale.length;
    if (strong) {
      const target = chord[Math.floor(Math.random() * chord.length)] + n;
      leadDeg += Math.sign(target - leadDeg) * Math.min(2, Math.abs(target - leadDeg));
    } else {
      leadDeg += [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
    }
    leadDeg = Math.max(n - 1, Math.min(n * 2 + 3, leadDeg));
    leadNote(c, th, out, note(th, leadDeg), t, sixteenth * (strong ? 4 : 2));
  }

  // Percussion: only once the fight has started
  if (!calm && th.drum !== 'none') {
    const big = intensity === 2;
    if (th.drum === 'soft') {
      if (s === 0 || s === 8 || (big && s === 10)) drumHit(c, out, t, 110, 0.22, 0.18);
      if (s % 4 === 2) hit(c, out, t, 0.04, 0.035, 7000, 'highpass');
    } else if (th.drum === 'march') {
      if (s === 0 || s === 8) drumHit(c, out, t, 100, 0.24, 0.2);
      if (s === 4 || s === 12 || (big && (s === 13 || s === 14 || s === 15))) hit(c, out, t, 0.09, 0.07, 1900, 'bandpass', 0.7);
    } else if (th.drum === 'war') {
      if (s === 0 || s === 3 || s === 8 || s === 11 || (big && s % 2 === 0)) drumHit(c, out, t, 78, 0.3, 0.26);
      if (s === 4 || s === 12) hit(c, out, t, 0.12, 0.08, 900, 'bandpass', 0.6);
    } else {
      if (s === 0 || s === 10 || (big && (s === 6 || s === 14))) drumHit(c, out, t, 64, 0.34, 0.4);
      if (big && s % 4 === 2) hit(c, out, t, 0.05, 0.03, 5000, 'highpass');
    }
  }
  step++;
}

/** Background bed: a looping filtered noise for wind / water / fire, plus scattered events. */
function startBed(c: AudioContext, th: Theme): void {
  if (th.bed === 'none' || th.bed === 'birds') return;
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  s.buffer = noise(c);
  s.loop = true;
  fl.type = th.bed === 'fire' ? 'lowpass' : 'bandpass';
  fl.frequency.value = th.bed === 'wind' ? 420 : th.bed === 'water' ? 1300 : 520;
  fl.Q.value = th.bed === 'wind' ? 0.9 : 0.4;
  const base = th.bed === 'wind' ? 0.1 : th.bed === 'water' ? 0.045 : 0.06;
  g.gain.value = base;
  lfo.frequency.value = th.bed === 'wind' ? 0.09 : 0.23;
  lg.gain.value = base * 0.7;
  lfo.connect(lg).connect(g.gain);
  if (th.bed === 'wind') {
    // Gusts also sweep the tone of the wind
    const lg2 = c.createGain();
    lg2.gain.value = 180;
    lfo.connect(lg2).connect(fl.frequency);
    bedNodes.push(lg2);
  }
  s.connect(fl).connect(g).connect(layer!);
  s.start();
  lfo.start();
  bedNodes.push(s, lfo, fl, g, lg);
}

function bedEvents(c: AudioContext, th: Theme, t: number): void {
  if (t < bedT) return;
  const out = layer!;
  if (th.bed === 'birds') {
    // A few chirps: quick upward sweeps
    const f = 2200 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator(), g = c.createGain(), t0 = t + i * 0.11;
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(f * 1.35, t0 + 0.07);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.025, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + 0.12);
    }
    bedT = t + 2.5 + Math.random() * 5;
  } else if (th.bed === 'fire') {
    hit(c, out, t, 0.03 + Math.random() * 0.04, 0.05 + Math.random() * 0.05, 2500 + Math.random() * 2500, 'highpass');
    bedT = t + 0.08 + Math.random() * 0.5;
  } else if (th.bed === 'water') {
    tone(c, out, 900 + Math.random() * 900, t, 0.12, 0.012, 'sine', 0.01);
    bedT = t + 0.4 + Math.random() * 1.4;
  } else {
    bedT = t + 10;
  }
}

function stopBed(): void {
  for (const n of bedNodes) {
    try { (n as AudioScheduledSourceNode).stop?.(); } catch { /* already stopped */ }
    try { n.disconnect(); } catch { /* not connected */ }
  }
  bedNodes = [];
}

/** Cross-fades to the wanted theme. */
function switchTheme(c: AudioContext): void {
  const now = c.currentTime;
  if (layer) {
    const old = layer;
    old.gain.setTargetAtTime(0, now, 0.25);
    setTimeout(() => { try { old.disconnect(); } catch { /* gone */ } }, 1500);
  }
  stopBed();
  current = wanted;
  if (!current) { layer = null; return; }
  const th = THEMES[current];
  layer = c.createGain();
  layer.gain.setValueAtTime(0.0001, now);
  layer.gain.linearRampToValueAtTime(1, now + 1.2);
  layer.connect(bus!);
  layer.connect(echo!);
  padFilter = c.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = th.tone;
  padFilter.connect(layer);
  step = 0;
  leadDeg = th.scale.length + 2;
  nextTime = now + 0.15;
  bedT = now + 1;
  startBed(c, th);
}

function tick(): void {
  const c = audioContext();
  if (!c || c.state !== 'running' || level() <= 0) return;
  if (!bus) {
    bus = c.createGain();
    bus.gain.value = level();
    bus.connect(c.destination);
    // A little space: one echo fed back on itself
    echo = c.createDelay(1);
    echo.delayTime.value = 0.31;
    const fb = c.createGain(), wet = c.createGain();
    fb.gain.value = 0.32;
    wet.gain.value = 0.22;
    echo.connect(fb).connect(echo);
    echo.connect(wet).connect(bus);
  }
  if (current !== wanted) switchTheme(c);
  if (!current || !layer) return;
  const th = THEMES[current], sixteenth = 60 / th.bpm / 4;
  if (nextTime < c.currentTime - 0.5) nextTime = c.currentTime + 0.05; // woke up after a pause
  // Schedule a little over a second ahead: timers are throttled in a hidden tab
  while (nextTime < c.currentTime + 1.3) {
    playStep(c, th, nextTime);
    nextTime += sixteenth;
  }
  bedEvents(c, th, c.currentTime + 0.1);
}

function kick(): void {
  if (typeof window === 'undefined' || timer) return;
  timer = window.setInterval(tick, 150);
}

/** Chooses the theme: a region id while in battle, 'menu' elsewhere, null for silence. */
export function setMusic(theme: string | null): void {
  wanted = theme && THEMES[theme] ? theme : theme ? 'rift' : null;
  intensity = 0;
  kick();
}

/** 0 calm, 1 wave running, 2 epic monster or boss wave. Takes effect within a second or so. */
export function setMusicIntensity(level2: number): void {
  intensity = level2;
}
