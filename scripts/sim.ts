// Balance simulation: a greedy bot plays the real engine headless from a fresh save
// and reports how long (in x1 game time) each progression milestone takes.
// Usage: npx tsx scripts/sim.ts [starter] [maxHours]
import { Battle, TILE } from '../src/battle';
import { CHAMPIONS } from '../src/data/champions';
import { ITEMS } from '../src/data/items';
import { COLS, MAPS, ROWS } from '../src/data/maps';
import {
  BALANCE, chestPool, claimChest, chestPrice, computeStats, isUnlocked, level, levelCost, MAX_LEVEL, openChest, rewardFor, stars, teamSlots,
  tryLevelUp,
} from '../src/game';
import { store } from '../src/save';
import type { MapDef } from '../src/types';

const DT = 1 / 30;
/** Seconds a player idles between waves. */
const WAVE_GAP = 2;
const starter = process.argv[2] ?? 'ashe';
const maxHours = Number(process.argv[3] ?? 30);

// Sweep overrides: BAL='{"dmgPerLevel":1.07}' MULTS='1,5,25,120,600,3000'
Object.assign(BALANCE, JSON.parse(process.env.BAL ?? '{}'));
if (process.env.MULTS) process.env.MULTS.split(',').forEach((v, i) => { MAPS[i].mult = Number(v); });

store.data.owned = [starter];
let time = 0;

const hms = (s: number) => `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;

// ---------- Placement ----------

function pathSamples(m: MapDef): { x: number; y: number; tile: string }[] {
  const out: { x: number; y: number; tile: string }[] = [];
  for (let i = 1; i < m.path.length; i++) {
    const [c0, r0] = m.path[i - 1], [c1, r1] = m.path[i];
    const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * 4;
    for (let k = 0; k < n; k++) {
      const c = c0 + ((c1 - c0) * k) / n, r = r0 + ((r1 - r0) * k) / n;
      out.push({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE, tile: `${Math.round(c)},${Math.round(r)}` });
    }
  }
  return out;
}

function power(id: string): number {
  const s = computeStats(CHAMPIONS.find((c) => c.id === id)!);
  const spread = s.type === 'single' ? 1 : s.type === 'multi' || s.type === 'chain' ? s.targets * 0.7 : 2;
  return s.dmg * s.rate * spread * (1 + (s.burn ? s.burn.mult * s.burn.dur : 0));
}

function fillTowers(b: Battle, m: MapDef, samples: ReturnType<typeof pathSamples>): void {
  const placed = new Set(b.towers.map((t) => t.def.id));
  const want = [...store.data.owned].sort((a, z) => power(z) - power(a));
  // Swap weakest placed champion for a stronger unplaced one.
  for (const id of want) {
    if (placed.has(id)) continue;
    if (b.slotsLeft() <= 0) {
      const weakest = [...b.towers].sort((a, z) => power(a.def.id) - power(z.def.id))[0];
      if (!weakest || power(weakest.def.id) >= power(id)) break;
      b.remove(weakest);
    }
    const range = computeStats(CHAMPIONS.find((c) => c.id === id)!).range * TILE;
    let best: { c: number; r: number; score: number } | null = null;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      if (!b.canPlace(c, r)) continue;
      const x = (c + 0.5) * TILE, y = (r + 0.5) * TILE;
      const score = samples.filter((p) => Math.hypot(p.x - x, p.y - y) <= range).length;
      if (!best || score > best.score) best = { c, r, score };
    }
    if (best && b.place(id, best.c, best.r)) placed.add(id);
  }
  void m;
}

// ---------- Spending ----------

function spend(b: Battle): void {
  for (;;) {
    const opts: { cost: number; run: () => void }[] = [];
    if (chestPool().length) opts.push({
      cost: chestPrice(),
      run: () => {
        const offer = openChest();
        if (offer) claimChest(offer.reduce((a, z) => (power(z.id) > power(a.id) ? z : a)).id);
      },
    });
    for (const t of b.towers) {
      if (level(t.def.id) < MAX_LEVEL) opts.push({ cost: levelCost(level(t.def.id)), run: () => tryLevelUp(t.def.id) });
    }
    for (const it of ITEMS) {
      if (!store.data.items.includes(it.id)) {
        opts.push({ cost: it.price * 3, run: () => { store.data.gold -= it.price; store.data.items.push(it.id); } });
      }
    }
    const pick = opts.sort((a, z) => a.cost - z.cost)[0];
    if (!pick || store.data.gold < pick.cost) break;
    pick.run();
  }
  // Best items on strongest champions.
  const items = ITEMS.filter((i) => store.data.items.includes(i.id)).sort((a, z) => z.price - a.price);
  const champs = b.towers.map((t) => t.def.id).sort((a, z) => power(z) - power(a));
  store.data.equip = {};
  items.forEach((it, i) => { if (champs[i]) store.data.equip[champs[i]] = it.id; });
  b.refreshStats();
}

// ---------- Run ----------

function useSpells(b: Battle): void {
  const any = b as unknown as { pathLen: number };
  if (!b.enemies.length) return;
  if (b.spellCd.smite <= 0) b.castSpell('smite');
  if (b.spellCd.exhaust <= 0 && b.enemies.some((e) => e.s > any.pathLen * 0.7)) b.castSpell('exhaust');
  if (b.spellCd.heal <= 0 && b.lives < 12) b.castSpell('heal');
}

function play(m: MapDef, boss = false): { wave: number; win: boolean } {
  let result = { wave: 0, win: false };
  const b = new Battle(m, { onChange: () => {}, onEnd: (win, wave) => { result = { win, wave }; } }, true);
  const samples = pathSamples(m);
  spend(b);
  fillTowers(b, m, samples);
  spend(b);
  if (boss) b.restart(true);
  b.startWave();
  while (!b.over) {
    b.step(DT);
    time += DT;
    useSpells(b);
    if (!b.waveActive && !b.over) {
      fillTowers(b, m, samples);
      spend(b);
      time += WAVE_GAP;
      b.startWave();
    }
  }
  return result;
}

// ---------- Campaign ----------

const firstSeen: Record<string, { t: number; wave: number }> = {};
const milestones: string[] = [];
let runs = 0;
let lastWasBoss = false;

while (time < maxHours * 3600) {
  const m = [...MAPS].reverse().find((x) => isUnlocked(x) && (store.data.best[x.id] ?? 0) < x.waves);
  if (!m) { milestones.push(`${hms(time)}  ALL MAPS COMPLETE`); break; }
  const before = store.data.best[m.id] ?? 0;
  // Like a player: challenge the boss once wave 49 is reached, farm a full run after each failed attempt.
  const boss: boolean = before >= m.waves - 1 && !lastWasBoss;
  const res = play(m, boss);
  lastWasBoss = boss;
  runs++;
  const best = store.data.best[m.id] ?? 0;
  if (process.env.LOG === m.id) console.log(`${hms(time)} ${m.id} ${boss ? 'boss' : 'run '} -> wave ${res.wave}${res.win ? ' WIN' : ''}`);
  if (!firstSeen[m.id]) {
    firstSeen[m.id] = { t: time, wave: best };
    milestones.push(`${hms(time)}  ${m.name.padEnd(14)} unlocked, first run -> wave ${best}`);
  }
  if (Math.floor(best / 10) > Math.floor(before / 10)) {
    const avg = store.data.owned.reduce((n, id) => n + level(id), 0) / store.data.owned.length;
    milestones.push(`${hms(time)}  ${m.name.padEnd(14)} best ${String(best).padStart(2)}  ★${String(stars()).padStart(2)}  `
      + `champs ${store.data.owned.length} avgLv ${avg.toFixed(1)} items ${store.data.items.length} slots ${teamSlots()}`);
  }
  if (res.win) {
    const rw = rewardFor(m.id);
    if (rw && !store.data.owned.includes(rw.id)) store.data.owned.push(rw.id);
  }
}

console.log(milestones.join('\n'));
console.log(`runs ${runs}, game time ${hms(time)}, gold left ${Math.round(store.data.gold)}`);
