// Active ultimates of the champions: aiming, casting each effect type, and the auto-cast option.
import { heroLook, lightColor } from '../art/heroes';
import { sfx } from '../audio';
import { MAX_LIVES, waveBonus } from '../game';
import { earnGold, store } from '../save';
import { type Enemy, H, TILE, TUNE, type Tower, W, fmtShort } from './model';
import { burst, boom, stop } from './effects';
import { grip } from './enemies';
import { inRange, damage } from './combat';
import type { Battle } from './battle';

/** Centre of the densest group of enemies within radius tiles (ties go to the one furthest along). */
export function densest(list: Enemy[], radius: number): { x: number; y: number } {
  const r = radius * TILE;
  let best = list[0], bn = -1;
  for (const a of list) {
    let n = 0;
    for (const b of list) if (Math.hypot(a.x - b.x, a.y - b.y) <= r) n++;
    if (n > bn || (n === bn && a.s > best.s)) { best = a; bn = n; }
  }
  return { x: best.x, y: best.y };
}

export function addBurn(e: Enemy, dps: number, dur: number, src: Tower): void {
  if (e.dead || e.def.fireproof) return;
  if (e.burns.length >= 6) e.burns.shift();
  e.burns.push({ dps, t: dur, src });
}

/** True when bt ultimate lands on a spot the player can choose (area blasts and area control). */
export function needsAim(t: Tower): boolean {
  const fx = t.def.active.fx;
  return fx.kind === 'burst' || (fx.kind === 'control' && !!fx.radius);
}

/** Radius (px) of the area an aimed ultimate covers. */
export function aimRadius(t: Tower): number {
  const fx = t.def.active.fx;
  return ((fx.kind === 'burst' || fx.kind === 'control') && fx.radius ? fx.radius : 0) * TILE;
}

/**
 * Ultimate button or key: aimed ultimates first show their target circle (a click on the board casts there,
 * pressing again lets the game pick the densest group); the others fire at once.
 */
export function requestUlt(bt: Battle, t: Tower): void {
  if (!bt.ultReady(t)) return;
  if (needsAim(t) && bt.aiming !== t) { bt.aiming = t; bt.selectedRoster = null; bt.ev.onChange(); return; }
  bt.aiming = null;
  castUlt(bt, t);
  bt.ev.onChange();
}

/** Casts the champion's active ultimate (at a chosen spot when aimed); false when it is on cooldown or has nothing to act on. */
export function castUlt(bt: Battle, t: Tower, at?: { x: number; y: number }): boolean {
  if (!bt.ultReady(t)) return false;
  const u = t.def.active, fx = u.fx;
  const alive = bt.enemies.filter((e) => !e.dead);
  const dmg = (t.stats.dmg + t.runStacks) * TUNE.ult;
  const vis = bt.visual;
  if (fx.kind === 'gold') {
    if (!bt.waveActive) return false;
    const g = Math.max(1, Math.round(waveBonus(bt.map, Math.max(1, bt.wave)) * fx.mult));
    earnGold(g);
    bt.runGold += g;
    if (vis) {
      bt.fx.push({ kind: 'text', x: t.x, y: t.y - 40, t: 0, max: 1.2, color: '#f5c542', text: `+${fmtShort(g)}`, size: 20 });
      bt.fx.push({ kind: 'pillar', x: t.x, y: t.y + 12, t: 0, max: 0.9, color: '#f5c542' });
      bt.vfx!.coins(t.x, t.y - 30, 26, t.y + 14);
      bt.vfx!.sparks(t.x, t.y - 20, -Math.PI / 2, 2.4, 14, 260, '#fff3b0', 1.6, t.y + 14);
    }
  } else if (fx.kind === 'lives') {
    if (bt.lives >= MAX_LIVES) return false;
    bt.lives = Math.min(MAX_LIVES, bt.lives + fx.n);
    const end = bt.pts[bt.pts.length - 1];
    if (vis) {
      bt.fx.push({ kind: 'ring', x: end.x, y: end.y, r: 70, t: 0, max: 0.9, color: '#6be08a' });
      bt.fx.push({ kind: 'pillar', x: end.x, y: end.y + 14, t: 0, max: 1.1, color: '#6be08a' });
      bt.fx.push({ kind: 'pillar', x: t.x, y: t.y + 12, t: 0, max: 0.8, color: '#6be08a' });
      bt.fx.push({ kind: 'text', x: end.x, y: end.y - 50, t: 0, max: 1.2, color: '#6be08a', text: `+${fx.n} ♥`, size: 20 });
      bt.vfx!.embers(end.x, end.y - 10, 18, '#6be08a', '#ffffff', 22);
      bt.vfx!.light(end.x, end.y, 150, '#6be08a', 0.7, 0.7);
    }
  } else if (!alive.length) {
    return false;
  } else if (fx.kind === 'burst') {
    const c = at ?? densest(alive, fx.radius), r = fx.radius * TILE;
    for (const e of alive) {
      if (Math.hypot(e.x - c.x, e.y - c.y) > r + e.def.size) continue;
      damage(bt, e, dmg * fx.mult, t, false);
      if (fx.burn) addBurn(e, dmg * fx.burn.mult, fx.burn.dur, t);
    }
    if (vis) {
      boom(bt, c.x, c.y, r * 1.15, t.def.color, 0.6, t);
      bt.fx.push({ kind: 'ring', x: c.x, y: c.y, r: r * 1.3, t: 0, max: 0.7, color: '#ffffff' });
      burst(bt, c.x, c.y, t.def.color, 30, 220, 3.5);
      bt.shake = Math.max(bt.shake, 7);
      // Barrage: shots rain down across the area for half a second
      const col = lightColor(heroLook(t.def.id, t.def.role).element, t.def.color);
      for (let i = 0; i < 11; i++) {
        const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r, delay = 0.04 + i * 0.045;
        const sx = c.x + Math.cos(a) * d, sy = c.y + Math.sin(a) * d * 0.8;
        bt.fx.push({ kind: 'strike', x: sx, y: sy, t: -delay, max: 0.2, color: col });
        bt.fx.push({ kind: 'boom', x: sx, y: sy, r: 22 + r * 0.22, t: -delay - 0.18, max: 0.32, color: i % 3 ? col : '#ffffff' });
      }
    }
  } else if (fx.kind === 'control') {
    const c = fx.radius ? at ?? densest(alive, fx.radius) : null, r = (fx.radius ?? 0) * TILE;
    for (const e of alive) {
      if (c && Math.hypot(e.x - c.x, e.y - c.y) > r + e.def.size) continue;
      const k = grip(e);
      if (fx.slow && k > 0) { e.slowPct = Math.max(e.slowPct, fx.slow * k); e.slowT = Math.max(e.slowT, fx.slowDur ?? 3); }
      if (fx.stun && k > 0) e.stunT = Math.max(e.stunT, fx.stun * k * (e.def.boss ? 0.3 : 1));
      if (fx.mult) damage(bt, e, dmg * fx.mult, t, false);
    }
    if (vis) {
      const cx = c?.x ?? W / 2, cy = c?.y ?? H / 2, rr = c ? r * 1.2 : W * 0.6;
      bt.fx.push({ kind: 'ring', x: cx, y: cy, r: rr, t: 0, max: 0.8, color: t.def.color });
      bt.fx.push({ kind: 'boom', x: cx, y: cy, r: rr * 0.8, t: 0, max: 0.5, color: t.def.color });
      bt.vfx!.light(cx, cy, rr * 1.6, t.def.color, 0.6, 0.45);
      bt.shake = Math.max(bt.shake, 3);
      const look = heroLook(t.def.id, t.def.role), col = lightColor(look.element, t.def.color);
      // Waves rolling out, and a bolt binding every monster caught in it
      for (let i = 1; i <= 2; i++) bt.fx.push({ kind: 'ring', x: cx, y: cy, r: rr, t: -i * 0.14, max: 0.8, color: i % 2 ? '#ffffff' : t.def.color });
      if (look.element === 'ice') bt.fx.push({ kind: 'storm', x: cx, y: cy, r: Math.min(rr, 260), t: 0, max: 1.1, color: t.def.color });
      let bound = 0;
      for (const e of alive) {
        if (bound >= 14 || (c && Math.hypot(e.x - c.x, e.y - c.y) > r + e.def.size)) continue;
        bound++;
        bt.fx.push({ kind: 'zap', x: c ? cx : t.x, y: (c ? cy : t.y) - 8, x2: e.x, y2: e.y - 8, t: 0, max: 0.4, color: col });
        bt.vfx!.impact(look.element, t.def.color, e.x, e.y - 8, 0, 2, e.y + 15);
      }
    }
  } else if (fx.kind === 'buff') {
    const r = (fx.radius ?? 0) * TILE;
    for (const o of bt.towers) {
      if (fx.scope === 'self' && o !== t) continue;
      if (fx.scope === 'near' && Math.hypot(o.x - t.x, o.y - t.y) > r) continue;
      o.buffs.push({ t: fx.dur, rate: fx.rate ?? 0, dmg: fx.dmg ?? 0 });
      if (vis) {
        bt.fx.push({ kind: 'ring', x: o.x, y: o.y, r: 44, t: 0, max: 0.8, color: t.def.color });
        bt.fx.push({ kind: 'pillar', x: o.x, y: o.y + 12, t: o === t ? 0 : -0.12, max: 1, color: t.def.color });
        bt.vfx!.embers(o.x, o.y - 4, 12, t.def.color, '#ffffff', 12);
        if (o !== t) bt.fx.push({ kind: 'zap', x: t.x, y: t.y - 16, x2: o.x, y2: o.y - 16, t: 0, max: 0.3, color: t.def.color });
      }
    }
    if (vis && fx.scope === 'near') bt.fx.push({ kind: 'ring', x: t.x, y: t.y, r, t: 0, max: 0.6, color: t.def.color });
  } else {
    const target = alive.reduce((a, b) => (b.hp > a.hp ? b : a));
    const boss = target.def.boss ? t.stats.bossMult ?? 1 : 1;
    damage(bt, target, dmg * fx.mult * boss, t, false);
    damage(bt, target, target.maxHp * fx.pct * bt.pctHpScale() * (target.def.boss ? 0.5 : 1), t, true);
    if (vis) {
      bt.fx.push({ kind: 'beam', x: t.x, y: t.y - 14, x2: target.x, y2: target.y, t: 0, max: 0.3, color: t.def.color });
      boom(bt, target.x, target.y, 50, t.def.color, 0.45, t);
      burst(bt, target.x, target.y, t.def.color, 18, 180, 3);
      bt.shake = Math.max(bt.shake, 6);
      // Judgement from above: a column of light slams down on the target
      bt.fx.push({ kind: 'laser', x: target.x + 30, y: target.y - 420, x2: target.x, y2: target.y, t: 0, max: 0.45, color: t.def.color });
      bt.fx.push({ kind: 'ring', x: target.x, y: target.y, r: 90, t: 0, max: 0.6, color: '#ffffff' });
      bt.fx.push({ kind: 'ring', x: target.x, y: target.y, r: 130, t: -0.1, max: 0.7, color: t.def.color });
      bt.vfx!.shards(target.x, target.y, 12, '#3a3128', 300, target.y + 15, 'debris');
      stop(bt, 0.09);
    }
  }
  t.ultCd = u.cd;
  bt.ultCasts++;
  t.flash = 0.3;
  t.ultT = 0;
  if (vis) {
    const band = !bt.vfx!.low && store.data.speed <= 4;
    // The name floats above the champion only when the cut-in band is not shown
    if (!band) bt.fx.push({ kind: 'text', x: t.x, y: t.y - 62, t: 0, max: 1.3, color: '#ffd84a', text: u.name, size: 17 });
    sfx('ult');
    // The ground darkens for a moment so the ultimate's light carries
    bt.dim = 1;
    bt.vfx!.light(t.x, t.y - 20, 150, t.def.color, 0.75, 0.6);
    bt.vfx!.embers(t.x, t.y - 6, 14, t.def.color, '#ffffff', 14);
    stop(bt, 0.06);
    if (band) bt.cutin = { id: t.def.id, name: u.name, champ: t.def.name, color: t.def.color, t: 0 };
  }
  return true;
}

/** Auto-cast (option): fires ready ultimates only when they have something worthwhile to hit. */
export function autoUlts(bt: Battle): void {
  const alive = bt.enemies.filter((e) => !e.dead);
  const big = alive.some((e) => e.def.boss || e.def.shape === 'boss');
  for (const t of bt.towers) {
    if (t.ultCd > 0) continue;
    const k = t.def.active.fx.kind;
    const worth = k === 'gold' ? true
      : k === 'lives' ? bt.lives <= MAX_LIVES - 3
      // Executes wait for the epic monster or boss on the waves that have one.
      : k === 'execute' ? big || (alive.length > 0 && bt.wave % 10 !== 0 && bt.wave !== bt.map.waves && !(bt.endless && bt.endlessWave() % 25 === 0))
      : k === 'buff' ? inRange(bt, t).length >= 2 || (big && inRange(bt, t).length > 0)
      : big || alive.length >= 5;
    if (worth) castUlt(bt, t);
  }
}
