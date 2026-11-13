// Visual and sound cues fired by the simulation (banner, bursts, blasts, hit-stop, hit and death effects). All no-ops headless.
import { mobImage } from '../art/mobArt';
import { CREATURE_HEIGHT } from '../art/creatures';
import { heroLook } from '../art/heroes';
import { sfx } from '../audio';
import { store } from '../save';
import { type Enemy, type Tower } from './model';
import type { Battle } from './battle';

export function showBanner(bt: Battle, text: string, sub: string, color: string): void {
  if (bt.visual) bt.banner = { text, sub, t: 0, color };
}

export function burst(bt: Battle, x: number, y: number, color: string, n: number, speed: number, size = 2.5): void {
  bt.vfx?.burst(x, y, color, n, speed, size);
}

/** Explosion: flash and shockwave, plus (when visible) debris, smoke, a mark on the ground and a light. */
export function boom(bt: Battle, x: number, y: number, r: number, color: string, max: number, src: Tower | null = null): void {
  bt.fx.push({ kind: 'boom', x, y, r, t: 0, max, color });
  if (!bt.vfx) return;
  bt.vfx.explosion(x, y, r, color, src ? heroLook(src.def.id, src.def.role).element : 'magic');
  if (r >= 90) bt.shake = Math.max(bt.shake, Math.min(8, r / 16));
}

/** Freezes the simulation for a few frames (hit-stop). Never headless, at high speed or with reduced motion. */
export function stop(bt: Battle, sec: number): void {
  if (!bt.vfx || bt.vfx.low || bt.calm || store.data.speed > 2) return;
  const now = performance.now();
  if (now - bt.lastStop < 350) return;
  bt.lastStop = now;
  bt.hitStop = Math.max(bt.hitStop, sec);
}

/** Piercing ray: a real laser from the weapon, with sparks along its path and a flare where it ends. */
export function laserFx(bt: Battle, t: Tower, x2: number, y2: number, len: number): void {
  const v = bt.vfx!, col = t.def.color;
  const x1 = t.x + Math.cos(t.angle) * 16, y1 = t.y - 10 + Math.sin(t.angle) * 12;
  bt.fx.push({ kind: 'laser', x: x1, y: y1, x2, y2, t: 0, max: 0.3, color: col });
  for (let i = 0; i < 9; i++) {
    const u = Math.random();
    v.embers(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, 1, col, '#ffffff', 5);
  }
  v.sparks(x2, y2, t.angle, 1.6, 6, 180, '#ffffff', 1.5, y2 + 16);
  v.sparks(x1, y1, t.angle, 0.9, 4, 160, col, 1.5, y1 + 24);
  v.light(x1, y1, 46, col, 0.7, 0.2);
  v.light((x1 + x2) / 2, (y1 + y2) / 2, len * 0.6, col, 0.45, 0.24);
  v.light(x2, y2, 40, col, 0.55, 0.2);
}

/** Aura attack: a blizzard swirling around ice champions, a whirl of blades around the others. */
export function auraFx(bt: Battle, t: Tower, r: number): void {
  const v = bt.vfx!, ice = heroLook(t.def.id, t.def.role).element === 'ice';
  bt.fx.push({ kind: ice ? 'storm' : 'whirl', x: t.x, y: t.y - 4, r, t: 0, max: ice ? 0.75 : 0.42, color: t.def.color });
  if (ice) {
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * 6.283, d = r * (0.25 + Math.random() * 0.75);
      v.embers(t.x + Math.cos(a) * d, t.y - 4 + Math.sin(a) * d, 1, '#e8f7ff', '#8fd3ff', 3);
    }
    v.light(t.x, t.y, r * 1.2, '#8fd3ff', 0.3, 0.4);
  } else {
    v.sparks(t.x, t.y - 6, 0, 6.283, 5, r * 3, '#ffffff', 1.4, t.y + 14);
    v.light(t.x, t.y, r * 1.1, t.def.color, 0.35, 0.2);
  }
}

/** Impact visuals: particles of the attacker's element, a flash of light and a shove away from the blow. */
export function hitFx(bt: Battle, t: Tower, e: Enemy, crit: boolean, dmg: number): void {
  const look = heroLook(t.def.id, t.def.role);
  const dir = Math.atan2(e.y - t.y, e.x - t.x);
  const aura = t.stats.type === 'aura';
  bt.vfx!.impact(look.element, t.def.color, e.x, e.y - 8, dir, crit ? 2 : aura ? 0.5 : 1, e.y + 15);
  // Heavier monsters barely move
  const heavy = e.def.boss ? 0.25 : e.def.shape === 'boss' ? 0.5 : 1;
  const k = Math.min(7, 2 + (dmg / e.maxHp) * 14) * heavy * (crit ? 1.6 : 1) * (aura ? 0.4 : 1);
  e.kx = Math.max(-11, Math.min(11, e.kx + Math.cos(dir) * k));
  e.ky = Math.max(-7, Math.min(7, e.ky + Math.sin(dir) * k * 0.6));
  e.sq = Math.min(1, e.sq + (crit ? 0.9 : 0.45) * heavy);
  if (crit) {
    bt.shake = Math.max(bt.shake, 2.5);
    stop(bt, 0.035);
  }
}

/** Death visuals: the body is knocked away and dissolves; epic monsters and bosses go out in a chain of blasts. */
export function deathFx(bt: Battle, e: Enemy, src: Tower | null): void {
  const tier = e.def.boss ? 2 : e.def.shape === 'boss' ? 1 : 0;
  sfx(tier ? 'bossDeath' : 'death');
  const dir = src ? Math.atan2(e.y - src.y, e.x - src.x) : -Math.PI / 2;
  bt.vfx!.death({
    id: e.def.id, img: mobImage(e.def.id), x: e.x + e.kx, y: e.y + 15 + e.ky, face: e.face, ph: e.phase, color: e.def.color,
    h: (CREATURE_HEIGHT[e.def.id] ?? 16) * 3, tier,
  }, dir, src ? heroLook(src.def.id, src.def.role).element : null, src?.def.color ?? e.def.color);
  if (!tier) return;
  bt.shake = Math.max(bt.shake, tier === 2 ? 12 : 6);
  stop(bt, tier === 2 ? 0.16 : 0.08);
  bt.dim = Math.max(bt.dim, tier === 2 ? 1 : 0.5);
  const n = tier === 2 ? 7 : 3;
  for (let i = 0; i < n; i++) {
    bt.fx.push({
      kind: 'boom', x: e.x + (Math.random() - 0.5) * 56, y: e.y - 6 - Math.random() * 54, r: 26 + Math.random() * 30,
      t: -i * 0.11, max: 0.4, color: i % 2 ? '#ffffff' : e.def.color,
    });
  }
  bt.fx.push({ kind: 'ring', x: e.x, y: e.y, r: tier === 2 ? 190 : 110, t: 0, max: 0.8, color: '#ffffff' });
}
