// Battle visual effects: particles with a little physics, short-lived lights, ground marks and dying monsters.
// Purely visual: nothing here feeds back into the simulation, and none of it exists in headless runs.
import { drawCreature } from './creatures';
import { drawGlow } from './glow';
import { impactColors, lightColor, type Element, type Shot } from './heroes';

type G = CanvasRenderingContext2D;

type PKind = 'dot' | 'spark' | 'ember' | 'smoke' | 'shard' | 'debris' | 'coin' | 'wisp' | 'drop';

interface P {
  k: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  /** Ground height the particle bounces or dies on. */
  gy: number;
}

/** Gravity (px/s², negative rises), drag (1/s) and bounce (0 = none) per particle kind. */
const PHYS: Record<PKind, { g: number; drag: number; bounce: number; add: boolean }> = {
  dot: { g: 260, drag: 2.2, bounce: 0, add: false },
  spark: { g: 340, drag: 2.2, bounce: 0.35, add: true },
  ember: { g: -70, drag: 1.6, bounce: 0, add: true },
  smoke: { g: -28, drag: 1.4, bounce: 0, add: false },
  shard: { g: 560, drag: 0.6, bounce: 0.42, add: false },
  debris: { g: 620, drag: 0.6, bounce: 0.35, add: false },
  coin: { g: 640, drag: 0.5, bounce: 0.55, add: false },
  wisp: { g: -95, drag: 1.2, bounce: 0, add: true },
  drop: { g: 520, drag: 0.4, bounce: 0, add: false },
};

interface Light { x: number; y: number; r: number; color: string; a: number; t: number; max: number }
interface Decal { kind: 'scorch' | 'frost' | 'poison'; x: number; y: number; r: number; t: number; max: number }

export interface Corpse {
  id: string;
  /** Custom monster picture (public/mobs), when there is one. */
  img: HTMLImageElement | null;
  /** Feet position. */
  x: number;
  y: number;
  face: number;
  ph: number;
  color: string;
  /** Sprite height in pixels. */
  h: number;
  /** 0 monster, 1 epic monster, 2 boss. */
  tier: 0 | 1 | 2;
  vx: number;
  vy: number;
  t: number;
  max: number;
}

const rnd = Math.random;

/** Removes finished entries in place (no per-frame array allocation). */
function prune<T extends { t: number; max: number }>(list: T[]): void {
  let n = 0;
  for (const it of list) if (it.t < it.max) list[n++] = it;
  list.length = n;
}

export class Vfx {
  /** Reduced effects (option): fewer particles, no lights or ground marks. */
  low = false;
  private parts: P[] = [];
  private lights: Light[] = [];
  private decals: Decal[] = [];
  corpses: Corpse[] = [];

  private get cap(): number {
    return this.low ? 220 : 900;
  }

  /** Scales a particle count down as the pool fills up, so busy fights stay smooth. */
  private n(n: number): number {
    const f = this.parts.length / this.cap;
    return f > 0.75 ? Math.ceil(n / 4) : f > 0.45 ? Math.ceil(n / 2) : n;
  }

  private add(k: PKind, x: number, y: number, vx: number, vy: number, max: number, size: number, color: string, gy: number): void {
    if (this.parts.length >= this.cap) return;
    this.parts.push({ k, x, y, vx, vy, t: 0, max, size, color, rot: rnd() * 6.283, vr: (rnd() - 0.5) * 16, gy });
  }

  clear(): void {
    this.parts.length = this.lights.length = this.decals.length = this.corpses.length = 0;
  }

  // ---------- Emitters ----------

  /** Round dots thrown in every direction (generic pop). */
  burst(x: number, y: number, color: string, n: number, speed: number, size = 2.5): void {
    n = this.n(n);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, v = speed * (0.4 + rnd() * 0.6);
      this.add('dot', x, y, Math.cos(a) * v, Math.sin(a) * v - speed * 0.3, 0.35 + rnd() * 0.35, size * (0.6 + rnd() * 0.6), color, y + 400);
    }
  }

  /** Bright streaks thrown in a cone around `dir`. */
  sparks(x: number, y: number, dir: number, spread: number, n: number, speed: number, color: string, size = 1.5, gy = y + 14): void {
    n = this.n(n);
    for (let i = 0; i < n; i++) {
      const a = dir + (rnd() - 0.5) * spread, v = speed * (0.45 + rnd() * 0.55);
      this.add('spark', x, y, Math.cos(a) * v, Math.sin(a) * v - 40, 0.18 + rnd() * 0.22, size * (0.7 + rnd() * 0.6), color, gy);
    }
  }

  /** Glowing motes that drift upward. */
  embers(x: number, y: number, n: number, c1: string, c2: string, spread = 8): void {
    n = this.n(n);
    for (let i = 0; i < n; i++) {
      this.add('ember', x + (rnd() - 0.5) * spread * 2, y + (rnd() - 0.5) * spread, (rnd() - 0.5) * 50, -20 - rnd() * 50,
        0.45 + rnd() * 0.5, 1.4 + rnd() * 1.4, rnd() < 0.5 ? c1 : c2, y);
    }
  }

  smoke(x: number, y: number, n: number, size: number, color = '#2f333c'): void {
    n = this.n(n);
    for (let i = 0; i < n; i++) {
      this.add('smoke', x + (rnd() - 0.5) * size * 1.6, y + (rnd() - 0.5) * size * 0.6, (rnd() - 0.5) * 26, -14 - rnd() * 22,
        0.7 + rnd() * 0.6, size * (0.7 + rnd() * 0.6), color, y);
    }
  }

  /** Solid fragments that fly up, fall and bounce on the ground. */
  shards(x: number, y: number, n: number, color: string, speed: number, gy: number, kind: 'shard' | 'debris' = 'shard'): void {
    n = this.n(n);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, v = speed * (0.4 + rnd() * 0.6);
      this.add(kind, x, y, Math.cos(a) * v, -Math.abs(Math.sin(a) * v) - speed * 0.5, 0.6 + rnd() * 0.5, 2.2 + rnd() * 2.2, color, gy);
    }
  }

  coins(x: number, y: number, n: number, gy: number): void {
    n = this.n(n);
    for (let i = 0; i < n; i++) this.add('coin', x, y, (rnd() - 0.5) * 130, -150 - rnd() * 110, 0.9 + rnd() * 0.4, 2.6 + rnd() * 0.8, '#f5c542', gy);
  }

  wisps(x: number, y: number, n: number, color: string): void {
    n = this.n(n);
    for (let i = 0; i < n; i++) this.add('wisp', x + (rnd() - 0.5) * 12, y, (rnd() - 0.5) * 18, -30 - rnd() * 30, 0.7 + rnd() * 0.5, 5 + rnd() * 4, color, y);
  }

  drops(x: number, y: number, n: number, color: string, gy: number): void {
    n = this.n(n);
    for (let i = 0; i < n; i++) this.add('drop', x, y, (rnd() - 0.5) * 110, -70 - rnd() * 80, 0.9, 1.4 + rnd() * 1.2, color, gy);
  }

  /** Short flash of light that brightens the ground and whoever stands near it. */
  light(x: number, y: number, r: number, color: string, a = 0.5, dur = 0.18): void {
    if (this.low) return;
    if (this.lights.length >= 60) this.lights.shift();
    this.lights.push({ x, y, r, color, a, t: 0, max: dur });
  }

  /** Mark left on the ground (burn, frost, poison); fades out. */
  decal(kind: Decal['kind'], x: number, y: number, r: number, dur = 6): void {
    if (this.low) return;
    if (this.decals.length >= 36) this.decals.shift();
    this.decals.push({ kind, x, y, r, t: 0, max: dur });
  }

  // ---------- Composite effects ----------

  /** A hit landing on a monster. power: 0.5 light touch (auras), 1 normal, 2 critical. */
  impact(el: Element, color: string, x: number, y: number, dir: number, power: number, gy: number): void {
    const n = power >= 2 ? 7 : power >= 1 ? 3 : 1;
    const [c1, c2] = impactColors(el, color);
    const back = dir + Math.PI;
    switch (el) {
      case 'ice':
        this.shards(x, y, Math.ceil(n * 0.7), c1, 120, gy);
        this.sparks(x, y, back, 1.4, Math.ceil(n * 0.5), 120, '#ffffff', 1.3, gy);
        break;
      case 'fire':
        this.embers(x, y, n, c1, c2, 5);
        if (power >= 2 || rnd() < 0.25) this.smoke(x, y - 4, 1, 5);
        break;
      case 'poison':
        this.drops(x, y, n, c1, gy);
        if (power >= 1 && rnd() < 0.35) this.smoke(x, y, 1, 5, '#4f7a2a');
        break;
      case 'shadow':
        this.wisps(x, y, Math.ceil(n * 0.5), c1);
        this.sparks(x, y, back, 2.2, Math.ceil(n * 0.6), 110, c1, 1.4, gy);
        break;
      case 'spark':
        this.sparks(x, y, back, 1.3, n + 1, 200, c1, 1.5, gy);
        if (power >= 2) this.sparks(x, y, back, 3, 5, 270, '#ffffff', 1.8, gy);
        break;
      default:
        this.sparks(x, y, back, 6.283, n, 110, c1, 1.5, gy);
        if (power >= 1) this.embers(x, y, 1, c1, c2, 4);
    }
    if (power >= 1) this.light(x, y, power >= 2 ? 40 : 24, lightColor(el, color), power >= 2 ? 0.6 : 0.32, 0.1);
  }

  /** Area blast: fire and sparks outward, smoke, debris, a mark on the ground and a flash of light. */
  explosion(x: number, y: number, r: number, color: string, el: Element): void {
    const [c1, c2] = impactColors(el, color);
    const big = Math.min(2, r / 60);
    this.sparks(x, y, 0, 6.283, Math.round(10 * big) + 4, r * 3.4, c1, 1.8, y + 16);
    this.embers(x, y, Math.round(8 * big) + 2, c1, c2, r * 0.4);
    this.smoke(x, y - 6, Math.round(3 * big) + 1, r * 0.22);
    if (el === 'ice') this.shards(x, y, Math.round(6 * big), '#e8f7ff', r * 2.2, y + 16);
    else if (el === 'poison') this.drops(x, y, Math.round(8 * big), c1, y + 16);
    else this.shards(x, y, Math.round(4 * big), '#3a3128', r * 2.4, y + 16, 'debris');
    this.decal(el === 'ice' ? 'frost' : el === 'poison' ? 'poison' : 'scorch', x, y + 6, r * 0.85);
    this.light(x, y, r * 2.3, lightColor(el, color), 0.75, 0.32);
  }

  /** A monster dying: its body is squashed and dissolves, with a puff matching what killed it. */
  death(c: Omit<Corpse, 't' | 'max' | 'vx' | 'vy'>, dir: number, el: Element | null, killerColor: string): void {
    if (this.corpses.length >= 60) this.corpses.shift();
    const push = c.tier === 2 ? 14 : c.tier === 1 ? 30 : 70;
    this.corpses.push({ ...c, vx: Math.cos(dir) * push, vy: Math.sin(dir) * push * 0.6, t: 0, max: c.tier === 2 ? 1.3 : c.tier === 1 ? 0.75 : 0.42 });
    const cx = c.x, cy = c.y - c.h * 0.4, gy = c.y;
    const n = c.tier === 2 ? 36 : c.tier === 1 ? 16 : 5;
    this.burst(cx, cy, c.color, n, c.tier ? 200 : 110, c.tier ? 3.6 : 2.4);
    this.coins(cx, cy, c.tier === 2 ? 12 : c.tier === 1 ? 6 : rnd() < 0.6 ? 1 : 0, gy);
    if (!this.low) this.wisps(cx, cy, c.tier ? 5 : 1, '#bff3ff');
    const [c1, c2] = el ? impactColors(el, killerColor) : [c.color, '#ffffff'];
    switch (el) {
      case 'ice': this.shards(cx, cy, n, '#e8f7ff', 150, gy); break;
      case 'fire': this.embers(cx, cy, n + 2, c1, c2, 10); this.smoke(cx, cy, 2, 7); this.decal('scorch', c.x, c.y, 12 + c.h * 0.2, 4); break;
      case 'poison': this.drops(cx, cy, n + 2, c1, gy); this.decal('poison', c.x, c.y, 12 + c.h * 0.2, 4); break;
      case 'shadow': this.wisps(cx, cy, Math.ceil(n * 0.6), c1); break;
      case 'spark': this.sparks(cx, cy, dir, 2.4, n + 2, 220, c1, 1.6, gy); break;
      case 'magic': this.embers(cx, cy, n, c1, c2, 10); break;
      default: this.smoke(cx, cy, 1, 6, '#8a8f99');
    }
    if (c.tier) {
      this.smoke(cx, cy, c.tier === 2 ? 10 : 5, c.tier === 2 ? 16 : 10);
      this.shards(cx, cy, c.tier === 2 ? 14 : 6, '#3a3128', 260, gy, 'debris');
    }
    this.light(cx, cy, c.tier === 2 ? 240 : c.tier === 1 ? 120 : 28, c.tier ? '#ffffff' : c1, c.tier ? 0.85 : 0.28, c.tier === 2 ? 0.55 : c.tier === 1 ? 0.35 : 0.12);
  }

  /** Called every frame for each projectile in flight: it leaves a little of its element behind. */
  trail(el: Element, shot: Shot, color: string, x: number, y: number): void {
    if (this.low || shot === 'slash' || shot === 'bullet') return;
    const r = rnd();
    if (shot === 'rocket') {
      this.smoke(x, y, 1, 3.5, '#5a5f6b');
      if (r < 0.5) this.embers(x, y, 1, '#ffb347', '#ff5a2a', 2);
      return;
    }
    switch (el) {
      case 'fire': if (r < 0.55) this.embers(x, y, 1, '#ffb347', '#ff5a2a', 3); break;
      case 'ice': if (r < 0.35) this.embers(x, y, 1, '#e8f7ff', '#8fd3ff', 3); break;
      case 'poison': if (r < 0.25) this.drops(x, y, 1, '#c6f56a', y + 22); break;
      case 'shadow': if (r < 0.35) this.wisps(x, y, 1, '#b07cd8'); break;
      case 'magic': if (r < 0.4) this.embers(x, y, 1, color, '#ffffff', 3); break;
      default: break;
    }
  }

  // ---------- Update / draw ----------

  /** dt: real seconds; gdt: game seconds (0 during a hit-stop, larger at high game speed). */
  update(dt: number, gdt: number): void {
    if (gdt > 0) {
      for (const p of this.parts) {
        const ph = PHYS[p.k];
        p.t += gdt;
        p.vy += ph.g * gdt;
        const d = Math.exp(-ph.drag * gdt);
        p.vx *= d;
        p.vy *= d;
        p.x += p.vx * gdt;
        p.y += p.vy * gdt;
        p.rot += p.vr * gdt;
        if (p.y >= p.gy && p.vy > 0) {
          if (ph.bounce > 0) {
            p.y = p.gy;
            p.vy = -p.vy * ph.bounce;
            p.vx *= 0.6;
            p.vr *= 0.5;
            if (Math.abs(p.vy) < 26) { p.vy = 0; p.vx *= 0.5; p.vr = 0; }
          } else if (p.k === 'drop') {
            p.t = p.max;
          }
        }
      }
      prune(this.parts);
    }
    // Lights, marks and bodies keep going during a hit-stop and speed up with the game
    const fast = Math.max(dt, gdt);
    for (const l of this.lights) l.t += fast;
    for (const d of this.decals) d.t += fast;
    for (const c of this.corpses) c.t += fast;
    prune(this.lights);
    prune(this.decals);
    prune(this.corpses);
  }

  /** Ground marks, drawn right after the terrain. */
  drawDecals(g: G): void {
    for (const d of this.decals) {
      const k = d.t / d.max;
      const fade = k < 0.04 ? k / 0.04 : k > 0.55 ? (1 - k) / 0.45 : 1;
      if (d.kind === 'scorch') drawGlow(g, d.x, d.y, d.r, '#0b0906', 0.5 * fade, d.r * 0.6);
      else if (d.kind === 'frost') drawGlow(g, d.x, d.y, d.r, '#d8f1ff', 0.5 * fade, d.r * 0.6);
      else drawGlow(g, d.x, d.y, d.r, '#3f7a1f', 0.55 * fade, d.r * 0.6);
    }
  }

  drawCorpse(g: G, c: Corpse, clock: number): void {
    const k = c.t / c.max;
    const slide = (1 - Math.exp(-7 * c.t)) / 7;
    const x = c.x + c.vx * slide, y = c.y + c.vy * slide;
    let sx: number, sy: number, alpha = 1;
    if (k < 0.15) {
      // Brief stretch as the blow lands
      const u = k / 0.15;
      sx = 1 - 0.08 * u;
      sy = 1 + 0.14 * u;
    } else {
      // Then the body flattens and dissolves
      const u = (k - 0.15) / 0.85;
      sx = 0.92 + 0.5 * (1 - (1 - u) * (1 - u));
      sy = 1.14 - 0.94 * u * u;
      alpha = 1 - u ** 1.5;
    }
    drawGlow(g, x + 2, y + 1, c.h * 0.4 * sx, '#000000', 0.45 * alpha, Math.max(4, c.h * 0.12));
    g.save();
    g.translate(x, y);
    g.scale(sx, sy);
    g.globalAlpha *= Math.max(0, alpha);
    if (c.img) {
      const iw = (c.img.naturalWidth / c.img.naturalHeight) * c.h;
      if (k < 0.15) g.filter = 'brightness(2.2)';
      if (c.face < 0) g.scale(-1, 1);
      g.drawImage(c.img, -iw / 2, -c.h, iw, c.h);
    } else {
      drawCreature(g, c.id, 0, 0, c.face, c.ph, clock, c.color, k < 0.15, 3);
    }
    g.restore();
  }

  /** Solid particles first, then the glowing ones blended additively. */
  drawParticles(g: G): void {
    const base = g.globalAlpha;
    for (const p of this.parts) {
      if (PHYS[p.k].add) continue;
      const k = p.t / p.max;
      switch (p.k) {
        case 'smoke':
          drawGlow(g, p.x, p.y, p.size * (1 + k * 1.9), p.color, 0.42 * (1 - k));
          break;
        case 'shard': {
          g.globalAlpha = base * Math.min(1, (1 - k) * 3);
          const c = Math.cos(p.rot) * p.size, s = Math.sin(p.rot) * p.size;
          g.fillStyle = p.color;
          g.beginPath();
          g.moveTo(p.x + c, p.y + s);
          g.lineTo(p.x - s * 0.55, p.y + c * 0.55);
          g.lineTo(p.x - c * 0.7, p.y - s * 0.7);
          g.closePath();
          g.fill();
          break;
        }
        case 'debris': {
          g.globalAlpha = base * Math.min(1, (1 - k) * 3);
          g.fillStyle = p.color;
          g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.8);
          break;
        }
        case 'coin': {
          g.globalAlpha = base * Math.min(1, (1 - k) * 3.5);
          const rx = Math.abs(Math.cos(p.rot)) * p.size + 0.7;
          g.fillStyle = '#8a6a1c';
          g.beginPath();
          g.ellipse(p.x, p.y + 0.6, rx, p.size, 0, 0, 6.283);
          g.fill();
          g.fillStyle = p.color;
          g.beginPath();
          g.ellipse(p.x, p.y, rx, p.size, 0, 0, 6.283);
          g.fill();
          g.fillStyle = '#fff3b0';
          g.fillRect(p.x - rx * 0.35, p.y - p.size * 0.55, Math.max(0.6, rx * 0.4), p.size * 0.7);
          break;
        }
        default: {
          g.globalAlpha = base * (1 - k);
          g.fillStyle = p.color;
          g.beginPath();
          g.arc(p.x, p.y, p.size, 0, 6.283);
          g.fill();
        }
      }
    }
    g.globalAlpha = base;
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (const p of this.parts) {
      if (!PHYS[p.k].add) continue;
      const k = p.t / p.max;
      if (p.k === 'spark') {
        g.globalAlpha = base * (1 - k);
        g.strokeStyle = p.color;
        g.lineWidth = p.size;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        g.stroke();
      } else if (p.k === 'ember') {
        const flick = 0.7 + 0.3 * Math.sin(p.rot + p.t * 30);
        drawGlow(g, p.x, p.y, p.size * 2.6 * flick, p.color, 1 - k);
      } else {
        drawGlow(g, p.x + Math.sin(p.t * 7 + p.rot) * 3, p.y, p.size * (1 + k), p.color, 0.7 * (1 - k));
      }
    }
    g.globalAlpha = base;
    g.globalCompositeOperation = 'source-over';
  }

  /** Short-lived lights. The caller sets the blend mode ('screen'). */
  drawLights(g: G): void {
    for (const l of this.lights) {
      const k = 1 - l.t / l.max;
      drawGlow(g, l.x, l.y, l.r * (1.1 - 0.25 * k), l.color, l.a * k * k);
    }
  }
}
