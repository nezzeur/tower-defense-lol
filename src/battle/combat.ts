// Champions attacking: target choice, projectiles, hits, damage, kills and loot.
import { heroLook, lightColor, SHOT_SPEED } from '../art/heroes';
import { sfx } from '../audio';
import { MAT_BY_ID, relicOf, rollLoot } from '../data/loot';
import { goldScale, ENDLESS_LOOT, endlessChampMap, permStackMult } from '../game';
import { persist, store } from '../save';
import { type Enemy, type Proj, TILE, type Tower, fmtShort } from './model';
import { boom, laserFx, auraFx, hitFx, deathFx, showBanner } from './effects';
import { spawn, grip } from './enemies';
import type { Battle } from './battle';

const LOOT_COLOR = ['', '#a09b8c', '#4a8fd8', '#c084fc', '#ffb347'];

export function sortTargets(bt: Battle, list: Enemy[], t: Tower): Enemy[] {
  // Distance left to the nexus: lanes differ in length, so raw progress is not comparable.
  const left = (e: Enemy) => bt.lanes[e.lane].len - e.s;
  switch (t.priority) {
    case 'last': return list.sort((a, b) => left(b) - left(a));
    case 'strong': return list.sort((a, b) => b.hp - a.hp);
    case 'weak': return list.sort((a, b) => a.hp - b.hp);
    case 'close': {
      const d = (e: Enemy) => Math.hypot(e.x - t.x, e.y - t.y);
      return list.sort((a, b) => d(a) - d(b));
    }
    default: return list.sort((a, b) => left(a) - left(b));
  }
}

export function inRange(bt: Battle, t: Tower, range = t.stats.range): Enemy[] {
  const r = range * TILE;
  return bt.enemies.filter((e) => !e.dead && Math.hypot(e.x - t.x, e.y - t.y) <= r + e.def.size);
}

export function updateTowers(bt: Battle, dt: number): void {
  for (const t of bt.towers) {
    t.flash = Math.max(0, t.flash - dt);
    if (t.stunT > 0) { t.stunT -= dt; t.cd = Math.max(t.cd, 0.2); continue; }
    if (t.buffs.length) { for (const b of t.buffs) b.t -= dt; t.buffs = t.buffs.filter((b) => b.t > 0); }
    const s = t.stats;
    const rate = s.rate * (1 + t.ramp) * (1 + t.buffs.reduce((n, b) => n + b.rate, 0));
    t.cd -= dt;
    if (t.cd > 0) continue;
    const targets = sortTargets(bt, inRange(bt, t), t);
    if (!targets.length) {
      if (s.ramp) t.ramp = Math.max(0, t.ramp - dt * 0.5);
      t.cd = 0;
      t.engaged = false;
      t.tgt = null;
      continue;
    }
    t.cd = 1 / rate;
    t.flash = 0.12;
    const first = targets[0];
    t.since = 0;
    t.period = t.cd;
    t.engaged = true;
    t.tgt = first;
    t.angle = Math.atan2(first.y - t.y, first.x - t.x);
    if (s.ramp) t.ramp = Math.min(s.ramp.max, t.ramp + s.ramp.perHit);

    switch (s.type) {
      case 'single':
      case 'splash':
        shoot(bt, t, first, 0);
        break;
      case 'chain':
        shoot(bt, t, first, s.targets - 1);
        break;
      case 'multi':
        for (const e of targets.slice(0, s.targets)) shoot(bt, t, e, 0);
        break;
      case 'aura':
        for (const e of targets) hit(bt, t, e, 1);
        if (bt.vfx) auraFx(bt, t, s.range * TILE);
        break;
      case 'pierce': {
        const len = s.range * TILE * 1.15;
        const x2 = t.x + Math.cos(t.angle) * len, y2 = t.y + Math.sin(t.angle) * len;
        for (const e of bt.enemies) {
          if (!e.dead && distToSeg(e.x, e.y, t.x, t.y, x2, y2) < TILE * 0.45 + e.def.size) hit(bt, t, e, 1);
        }
        if (bt.vfx) laserFx(bt, t, x2, y2, len);
        break;
      }
    }
  }
}

export function shoot(bt: Battle, t: Tower, target: Enemy, chainLeft: number): void {
  const look = heroLook(t.def.id, t.def.role);
  // The shot leaves from the weapon, not from the centre of the tile
  const x = t.x + Math.cos(t.angle) * 16, y = t.y - 10 + Math.sin(t.angle) * 12;
  bt.projs.push({
    x, y, target, tower: t, dmgMult: 1, chainLeft, hit: new Set(), trail: [],
    speed: SHOT_SPEED[look.shot] * TILE, d0: Math.hypot(target.x - x, target.y - y),
  });
  if (!bt.vfx) return;
  sfx('shot');
  bt.vfx.light(x, y, 28, lightColor(look.element, t.def.color), 0.45, 0.09);
}

export function updateProjs(bt: Battle, dt: number): void {
  for (const p of bt.projs) {
    const speed = p.speed;
    const dx = p.target.x - p.x, dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < speed * dt + 4) {
      p.x = p.target.x;
      p.y = p.target.y;
      if (bt.vfx && p.ox !== undefined) {
        // The bolt of a bounce lingers for an instant after it lands
        const look = heroLook(p.tower.def.id, p.tower.def.role);
        bt.fx.push({ kind: 'zap', x: p.ox, y: p.oy! - 8, x2: p.x, y2: p.y - 8, t: 0, max: 0.16, color: lightColor(look.element, p.tower.def.color) });
      }
      impact(bt, p);
      p.chainLeft = -1;
    } else {
      if (bt.visual) { p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 6) p.trail.shift(); }
      p.x += (dx / d) * speed * dt;
      p.y += (dy / d) * speed * dt;
    }
  }
  bt.projs = bt.projs.filter((p) => p.chainLeft >= 0);
}

export function impact(bt: Battle, p: Proj): void {
  const t = p.tower, s = t.stats;
  if (s.type === 'splash') {
    const r = s.splash * TILE;
    for (const e of bt.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= r + e.def.size) hit(bt, t, e, p.dmgMult);
    boom(bt, p.x, p.y, r, t.def.color, 0.32, t);
    return;
  }
  if (!p.target.dead) hit(bt, t, p.target, p.dmgMult);
  if (s.type === 'chain' && p.chainLeft > 0) {
    p.hit.add(p.target.uid);
    const next = bt.enemies
      .filter((e) => !e.dead && !p.hit.has(e.uid) && Math.hypot(e.x - p.x, e.y - p.y) < 2.5 * TILE)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (next) {
      bt.projs.push({
        x: p.x, y: p.y, target: next, tower: t, dmgMult: p.dmgMult * 0.8, chainLeft: p.chainLeft - 1, hit: p.hit, trail: [],
        speed: p.speed, d0: Math.hypot(next.x - p.x, next.y - p.y), ox: p.x, oy: p.y,
      });
    }
  }
}

export function hit(bt: Battle, t: Tower, e: Enemy, mult: number): void {
  if (bt.visual) sfx('hit');
  const s = t.stats;
  t.hits++;
  if (e.shield > 0 && !s.trueSight) {
    // The shield swallows the whole hit
    e.shield--;
    e.hitFlash = 0.08;
    if (bt.vfx) {
      bt.vfx.sparks(e.x, e.y - 10, Math.atan2(e.y - t.y, e.x - t.x) + Math.PI, 2.4, 6, 190, '#bfe9ff', 1.6, e.y + 15);
      bt.fx.push({ kind: 'ring', x: e.x, y: e.y - 8, r: 22, t: 0, max: 0.25, color: '#bfe9ff' });
      if (e.shield === 0) bt.fx.push({ kind: 'text', x: e.x, y: e.y - 30, t: 0, max: 0.7, color: '#bfe9ff', text: 'Bouclier brisé', size: 12 });
    }
    return;
  }
  let dmg = (s.dmg + t.runStacks) * mult;
  // Flyers slip out of area attacks
  if (e.def.fly && !s.trueSight && (s.type === 'splash' || s.type === 'aura')) dmg *= 0.5;
  let crit = false;
  if (s.everyN && t.hits % s.everyN.n === 0) { dmg *= s.everyN.mult; crit = true; }
  if (s.crit && Math.random() < s.crit.chance) { dmg *= s.crit.mult; crit = true; }
  if (e.def.boss && s.bossMult) dmg *= s.bossMult;
  if (e.def.boss && bt.syn.boss) dmg *= 1 + bt.syn.boss;
  if (t.buffs.length) dmg *= 1 + t.buffs.reduce((n, b) => n + b.dmg, 0);
  if (crit) bt.fx.push({ kind: 'text', x: e.x, y: e.y - 18, t: 0, max: 0.8, color: '#ffd84a', text: fmtShort(dmg), size: 21 });
  if (bt.vfx) hitFx(bt, t, e, crit, dmg);
  damage(bt, e, dmg, t, false);
  if (s.pctHp && t.hits % s.pctHp.every === 0) damage(bt, e, e.maxHp * s.pctHp.pct * bt.pctHpScale(), t, true);
  if (e.dead) return;
  e.hitFlash = 0.08;
  const hold = grip(e);
  if (s.slow && hold > 0 && s.slow.pct * hold >= e.slowPct) { e.slowPct = Math.min(0.8, s.slow.pct * hold); e.slowT = s.slow.dur; }
  if (s.stun && hold > 0 && Math.random() < s.stun.chance) e.stunT = Math.max(e.stunT, s.stun.dur * hold * (e.def.boss ? 0.3 : 1));
  if (s.burn && !e.def.fireproof) {
    if (e.burns.length >= 6) e.burns.shift();
    e.burns.push({ dps: (s.dmg + t.runStacks) * s.burn.mult, t: s.burn.dur, src: t });
  }
  if (s.goldHit && Math.random() < s.goldHit.chance) {
    const g = Math.max(1, Math.round(s.goldHit.amount * goldScale(bt.map, bt.wave)));
    store.data.gold += g;
    bt.runGold += g;
    bt.fx.push({ kind: 'text', x: e.x, y: e.y - 20, t: 0, max: 0.7, color: '#f5c542', text: `+${g}` });
  }
}

export function damage(bt: Battle, e: Enemy, amount: number, src: Tower | null, trueDmg: boolean): void {
  if (e.dead || e.phaseT > 0) return;
  const dealt = trueDmg ? amount : amount * (1 - Math.max(0, e.def.armor - (bt.syn.armorShred ?? 0)));
  if (src) src.dmgDone += Math.min(dealt, Math.max(0, e.hp));
  if (dealt > bt.bestHit) bt.bestHit = dealt;
  e.hp -= dealt;
  // Executioner items finish off weakened monsters (never bosses)
  if (e.hp > 0 && src?.stats.execute && !e.def.boss && e.hp < e.maxHp * src.stats.execute) e.hp = 0;
  if (e.hp <= 0) kill(bt, e, src);
}

export function kill(bt: Battle, e: Enemy, src: Tower | null): void {
  e.dead = true;
  if (bt.vfx) deathFx(bt, e, src);
  const gold = Math.max(1, Math.round(e.def.gold * goldScale(bt.map, bt.wave) * (1 + (src?.stats.killGold ?? 0) + (bt.syn.gold ?? 0))));
  store.data.gold += gold;
  store.data.kills++;
  store.data.bestiary[e.def.id] = (store.data.bestiary[e.def.id] ?? 0) + 1;
  if (e.def.shape === 'boss') bt.epicKills++;
  bt.runKills++;
  bt.runGold += gold;
  if (e.def.boss || e.def.shape === 'boss') {
    bt.fx.push({ kind: 'text', x: e.x, y: e.y - 24, t: 0, max: 1.2, color: '#f5c542', text: `+${fmtShort(gold)}` });
  }
  dropLoot(bt, e);
  if (bt.endless && e.def.boss) endlessBossLoot(bt, e);
  if (src?.stats.ultOnKill) src.ultCd = Math.max(0, src.ultCd - src.stats.ultOnKill);
  if (e.def.split && !bt.over) {
    for (let i = 0; i < e.def.split.n; i++) spawn(bt, e.def.split.id, { s: Math.max(0, e.s - i * 12), lane: e.lane });
  }
  if (!src) return;
  src.kills++;
  const ks = src.stats.killStack;
  if (ks) {
    if (ks.persistent) {
      const before = store.data.stacks[src.def.id] ?? 0;
      store.data.stacks[src.def.id] = before + ks.amount;
      src.stats.dmg *= permStackMult(before + ks.amount) / permStackMult(before);
    } else {
      // Per-run stacks are a fraction of the champion's damage, so they keep their weight at high levels.
      src.runStacks += ks.amount * src.stats.dmg;
    }
  }
}

/** Loot roll for one kill: fixed chance per material rarity, straight into the inventory. */
/**
 * Endless-mode boss down: pure luck, nothing is ever guaranteed. It may drop the region's relic and,
 * on the last map, the exclusive champion.
 */
export function endlessBossLoot(bt: Battle, e: Enemy): void {
  const d = store.data;
  const relic = relicOf(bt.map.region ?? '');
  if (relic && Math.random() < ENDLESS_LOOT.relicChance) {
    d.mats[relic.id] = (d.mats[relic.id] ?? 0) + 1;
    bt.runLoot[relic.id] = (bt.runLoot[relic.id] ?? 0) + 1;
    if (bt.visual) {
      bt.fx.push({ kind: 'text', x: e.x, y: e.y - 70, t: 0, max: 2.2, color: '#ff6ad5', text: `${relic.icon} ${relic.name} !`, size: 20 });
      bt.fx.push({ kind: 'pillar', x: e.x, y: e.y + 14, t: 0, max: 1.4, color: '#ff6ad5' });
      showBanner(bt, `${relic.icon} Relique obtenue`, relic.name, '#ff6ad5');
      sfx('chestBurst');
    }
  }
  if (bt.map === endlessChampMap() && !d.owned.includes(ENDLESS_LOOT.champ) && Math.random() < ENDLESS_LOOT.champChance) {
    d.owned.push(ENDLESS_LOOT.champ);
    bt.newChampion = ENDLESS_LOOT.champ;
    if (bt.visual) {
      bt.fx.push({ kind: 'pillar', x: e.x, y: e.y + 14, t: 0, max: 2, color: '#b48be0' });
      sfx('victory');
    }
  }
  persist();
}

export function dropLoot(bt: Battle, e: Enemy): void {
  const loot = rollLoot(e.def, bt.map.region ?? '');
  let row = 0;
  for (const [id, n] of Object.entries(loot)) {
    store.data.mats[id] = (store.data.mats[id] ?? 0) + n;
    bt.runLoot[id] = (bt.runLoot[id] ?? 0) + n;
    const m = MAT_BY_ID[id];
    if (!bt.visual || m.rarity < 2) continue;
    bt.fx.push({ kind: 'text', x: e.x, y: e.y - 30 - 16 * row++, t: 0, max: 1.4, color: LOOT_COLOR[m.rarity], text: `${m.icon} +${n}` });
    sfx('gold');
  }
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
