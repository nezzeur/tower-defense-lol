// Monsters: spawning, movement along the lane, traits (regeneration, healers), boss abilities, allied turrets.
import { CREATURE_HEIGHT } from '../art/creatures';
import { sfx } from '../audio';
import { ENEMIES } from '../data/enemies';
import { store } from '../save';
import { type Enemy, TILE } from './model';
import { burst, stop } from './effects';
import { damage } from './combat';
import type { Battle } from './battle';

/** Spawns a monster at the start of the next lane, or at a given point of a lane (splitting monsters). */
export function spawn(bt: Battle, id: string, at?: { s: number; lane: number }): void {
  const def = ENEMIES[id];
  const hp = def.hp * bt.waveHp();
  const lane = at ? at.lane : bt.spawnCount++ % bt.lanes.length;
  const s0 = at?.s ?? 0;
  const p = bt.posAt(s0, lane);
  bt.enemies.push({
    uid: ++bt.uid, def, hp, maxHp: hp, s: s0, x: p.x, y: p.y, lane,
    slowPct: 0, slowT: 0, stunT: 0, burns: [], dead: false, hitFlash: 0, face: 1, phase: Math.random() * 6,
    kx: 0, ky: 0, sq: 0, born: at ? 0.2 : 0, shield: def.shield ?? 0, healed: 0,
    abT: (def.ability?.cd ?? 0) * 0.6, chargeT: 0, phaseT: 0, hasteT: 0, haste: 1,
  });
  store.data.bestiary[id] ??= 0;
}

/** How much of a slow or stun gets through bt monster's tenacity (0 = immune). */
export function grip(e: Enemy): number {
  return 1 - (e.def.tenacity ?? 0);
}

export function updateEnemies(bt: Battle, dt: number): void {
  for (const e of bt.enemies) {
    if (e.dead) continue;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    for (const b of e.burns) {
      b.t -= dt;
      damage(bt, e, b.dps * dt, b.src, true);
    }
    e.burns = e.burns.filter((b) => b.t > 0);
    if (e.dead) continue;
    if (e.def.regen && !e.burns.length && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.def.regen * dt);
      e.healed = 0.3;
    }
    if (e.def.heal && e.stunT <= 0) {
      // Healers mend everyone around them (not each other, not bosses)
      const hr = e.def.heal.radius * TILE;
      for (const o of bt.enemies) {
        if (o === e || o.dead || o.def.boss || o.def.heal || o.hp >= o.maxHp || Math.hypot(o.x - e.x, o.y - e.y) > hr) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * e.def.heal.pct * dt);
        o.healed = 0.3;
      }
    }
    if (e.slowT > 0) e.slowT -= dt; else e.slowPct = 0;
    if (e.stunT > 0) { e.stunT -= dt; continue; }
    if (e.def.ability && (e.abT -= dt) <= 0) { e.abT = e.def.ability.cd; useAbility(bt, e); }
    if (e.phaseT > 0) e.phaseT -= dt;
    if (e.hasteT > 0) e.hasteT -= dt;
    const charging = e.chargeT > 0;
    if (charging) e.chargeT -= dt;
    const river = !e.def.fly && bt.featureAt(Math.floor(e.x / TILE), Math.floor(e.y / TILE)) === 'river' ? 0.8 : 1;
    const pace = (charging && e.def.ability?.kind === 'charge' ? e.def.ability.mult : 1 - e.slowPct) * (e.hasteT > 0 ? e.haste : 1);
    e.s += e.def.speed * TILE * pace * river * dt;
    const p = bt.posAt(e.s, e.lane);
    if (Math.abs(p.x - e.x) > 0.01) e.face = p.x > e.x ? 1 : -1;
    e.phase += dt * e.def.speed * 8 * (1 - e.slowPct);
    e.x = p.x;
    e.y = p.y;
    if (e.s >= bt.lanes[e.lane].len) {
      bt.lives -= e.def.leak;
      bt.livesLost += e.def.leak;
      if (bt.visual) sfx('lifeLost');
      bt.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 40, t: 0, max: 0.5, color: '#ff4d4d' });
      bt.nexusHurt = 0.5;
      bt.shake = Math.max(bt.shake, e.def.boss ? 10 : 3);
      burst(bt, e.x, e.y, '#ff5a5a', e.def.boss ? 30 : 8, 120);
      bt.vfx?.light(e.x, e.y, e.def.boss ? 170 : 80, '#ff4d4d', 0.7, 0.4);
      if (e.def.boss) stop(bt, 0.1);
      // A boss that reaches the nexus walks the lane again instead of vanishing.
      if (e.def.boss) e.s = 0; else e.dead = true;
      if (bt.lives <= 0 && !bt.over) bt.lose();
    }
  }
}

/** Allied map turrets: steady damage scaled to the wave, on the closest enemy in range. */
export function updateTurrets(bt: Battle, dt: number): void {
  for (const tu of bt.turrets) {
    tu.cd -= dt;
    if (tu.cd > 0) continue;
    let best: Enemy | null = null, bd = 3.2 * TILE;
    for (const e of bt.enemies) {
      const d = Math.hypot(e.x - tu.x, e.y - tu.y);
      if (!e.dead && d < bd) { bd = d; best = e; }
    }
    if (!best) { tu.cd = 0.1; continue; }
    tu.cd = 1.4;
    damage(bt, best, ENEMIES.melee.hp * bt.waveHp() * 0.25, null, false);
    if (bt.vfx) {
      bt.fx.push({ kind: 'beam', x: tu.x, y: tu.y - 40, x2: best.x, y2: best.y, t: 0, max: 0.18, color: '#7fd8ff' });
      bt.vfx.impact('spark', '#7fd8ff', best.x, best.y - 6, Math.atan2(best.y - tu.y + 40, best.x - tu.x), 1, best.y + 15);
      bt.vfx.light(tu.x, tu.y - 40, 34, '#7fd8ff', 0.55, 0.12);
    }
  }
}

/** A boss or epic monster uses its special move. */
export function useAbility(bt: Battle, e: Enemy): void {
  const ab = e.def.ability!, v = bt.vfx;
  switch (ab.kind) {
    case 'summon':
      for (let i = 0; i < ab.n; i++) spawn(bt, ab.id, { s: Math.max(0, e.s - 14 - i * 12), lane: e.lane });
      v?.wisps(e.x, e.y - 20, 8, e.def.color);
      break;
    case 'charge':
      e.chargeT = ab.dur;
      e.slowPct = 0;
      v?.smoke(e.x, e.y + 12, 6, 9, '#b9b2a3');
      break;
    case 'shield':
      e.shield = ab.hits;
      break;
    case 'freeze': {
      const r = ab.radius * TILE;
      for (const t of bt.towers) {
        if (Math.hypot(t.x - e.x, t.y - e.y) > r) continue;
        t.stunT = Math.max(t.stunT, ab.dur);
        t.engaged = false;
        if (v) { bt.fx.push({ kind: 'pillar', x: t.x, y: t.y + 12, t: 0, max: 0.7, color: '#8fd3ff' }); v.shards(t.x, t.y - 10, 6, '#e8f7ff', 140, t.y + 14); }
      }
      if (v) bt.fx.push({ kind: 'storm', x: e.x, y: e.y, r, t: 0, max: 0.9, color: '#8fd3ff' });
      break;
    }
    case 'rally': {
      const r = ab.radius * TILE;
      for (const o of bt.enemies) {
        if (o.dead || Math.hypot(o.x - e.x, o.y - e.y) > r) continue;
        o.hasteT = ab.dur;
        o.haste = ab.mult;
      }
      break;
    }
    case 'phase':
      e.phaseT = ab.dur;
      e.burns = [];
      break;
    case 'mend': {
      const r = ab.radius * TILE;
      for (const o of bt.enemies) {
        if (o.dead || Math.hypot(o.x - e.x, o.y - e.y) > r) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * ab.pct * (o.def.boss ? 0.5 : 1));
        o.healed = 0.8;
      }
      break;
    }
  }
  if (!v) return;
  // Every special move is announced: its name above the monster, a wave of its colour, a flash
  bt.fx.push({ kind: 'text', x: e.x, y: e.y - (CREATURE_HEIGHT[e.def.id] ?? 16) * 3 - 26, t: 0, max: 1.4, color: '#ff9d5c', text: ab.name, size: 15 });
  const reach = 'radius' in ab ? ab.radius * TILE : 60;
  bt.fx.push({ kind: 'ring', x: e.x, y: e.y, r: reach, t: 0, max: 0.6, color: e.def.color });
  v.light(e.x, e.y - 20, reach * 1.4, e.def.color, 0.6, 0.4);
  bt.shake = Math.max(bt.shake, e.def.boss ? 5 : 2.5);
  sfx('ult');
}
