import { CHAMPIONS, CHAMP_BY_ID } from './data/champions';
import { ENEMIES } from './data/enemies';
import { ITEM_BY_ID } from './data/items';
import { MAPS } from './data/maps';
import { store } from './save';
import type { ChampionDef, MapDef, Stats } from './types';

export const MAX_LEVEL = 150;
export const ULT_LEVELS = [6, 11, 16];
export const START_LIVES = 20;
export const MAX_LIVES = 30;

/**
 * Economy knobs. Tuned with scripts/sim.ts (a bot playing the real engine): keep it
 * so each new map reaches ~wave 10-20 on first try, then needs a few farming runs.
 */
export const BALANCE = {
  /** Damage multiplier gained per level (compounding). */
  dmgPerLevel: 1.08,
  levelCostBase: 40,
  levelCostGrowth: 1.12,
  /** Enemy HP growth per wave inside a map (compounding, on top of +10 %/wave linear). */
  hpPerWave: 1.06,
  /** Gold scales with map multiplier ^ this. */
  goldMultExp: 0.95,
  /** Kill gold growth per wave (linear). */
  goldPerWave: 0.03,
  chestBase: 120,
  chestGrowth: 1.45,
};

export const level = (id: string): number => store.data.levels[id] ?? 1;
export const ultRank = (lvl: number): number => ULT_LEVELS.filter((l) => lvl >= l).length;
export const levelCost = (lvl: number): number => Math.round(BALANCE.levelCostBase * BALANCE.levelCostGrowth ** (lvl - 1));

export function computeStats(def: ChampionDef, lvl = level(def.id)): Stats {
  const s: Stats = JSON.parse(JSON.stringify(def.base));
  const rank = ultRank(lvl);
  s.dmg *= BALANCE.dmgPerLevel ** (lvl - 1) * 1.2 ** rank;
  if (rank > 0) def.ult.apply(s, rank);
  const item = store.data.equip[def.id];
  if (item && ITEM_BY_ID[item]) ITEM_BY_ID[item].apply(s);
  s.dmg += store.data.stacks[def.id] ?? 0;
  return s;
}

/** Stars on one map (or all): one per fifth of its waves cleared. */
export function stars(mapId?: string): number {
  const maps = mapId ? MAPS.filter((m) => m.id === mapId) : MAPS;
  return maps.reduce((n, m) => n + Math.min(5, Math.floor(((store.data.best[m.id] ?? 0) * 5) / m.waves)), 0);
}

export const teamSlots = (): number => Math.min(8, 3 + Math.floor(stars() / 8));

/** Stars needed on the previous map of a region to open the next one. */
export const STARS_TO_ADVANCE = 3;

/**
 * Maps open in order inside a region: each needs 3 stars on the previous one.
 * A region's first map opens once the previous region's arena (its last map) is beaten.
 */
export function unlockReason(m: MapDef): string | null {
  const i = MAPS.indexOf(m);
  if (i <= 0) return null;
  const prev = MAPS[i - 1];
  if (prev.region === m.region) {
    return stars(prev.id) >= STARS_TO_ADVANCE ? null : `${STARS_TO_ADVANCE} ★ sur « ${prev.name} »`;
  }
  return (store.data.best[prev.id] ?? 0) >= prev.waves ? null : `Bats l'arène « ${prev.name} »`;
}

export const isUnlocked = (m: MapDef): boolean => unlockReason(m) === null;

/** True when this map is its region's arena (last map). */
export const isArena = (m: MapDef): boolean => {
  const i = MAPS.indexOf(m);
  return i === MAPS.length - 1 || MAPS[i + 1].region !== m.region;
};

export const hpScale = (m: MapDef, w: number): number => m.mult * (1 + 0.1 * (w - 1)) * BALANCE.hpPerWave ** (w - 1);
export const goldScale = (m: MapDef, w: number): number => (1 + BALANCE.goldPerWave * w) * m.mult ** BALANCE.goldMultExp;
export const waveBonus = (m: MapDef, w: number): number => Math.round((10 + 3 * w) * m.mult ** BALANCE.goldMultExp);

export interface Spawn { id: string; delay: number }

export function buildWave(m: MapDef, w: number): Spawn[] {
  const out: Spawn[] = [];
  if (w === m.waves) {
    out.push({ id: m.finalBoss, delay: 0 });
    for (let i = 0; i < 10; i++) out.push({ id: 'super', delay: 0.8 });
    return out;
  }
  const n = 6 + Math.floor(w * 0.5);
  for (let i = 0; i < n; i++) {
    let id = i % 3 === 2 ? 'caster' : 'melee';
    if (w >= 4 && i % 7 === 6) id = 'cannon';
    if (w >= 25 && i % 9 === 8) id = 'super';
    out.push({ id, delay: i === 0 ? 0 : 0.7 });
  }
  // Jungle camps join the minions on a rotation
  if (w % 3 === 0) for (let i = 0; i < 3; i++) out.push({ id: 'wolf', delay: i ? 0.4 : 1 });
  if (w % 4 === 2) for (let i = 0; i < 6; i++) out.push({ id: 'raptor', delay: i ? 0.25 : 1 });
  if (w >= 6 && w % 6 === 0) for (let i = 0; i < 2; i++) out.push({ id: 'krug', delay: i ? 0.8 : 1.2 });
  if (w >= 7 && w % 7 === 0) out.push({ id: 'gromp', delay: 1.2 });
  if (w % 5 === 0 && w % 10 !== 0) for (let i = 0; i < 6; i++) out.push({ id: 'scuttle', delay: 0.3 });
  if (w % 10 === 0) out.push({ id: w % 20 === 0 ? 'herald' : 'drake', delay: 1.2 });
  return out;
}

export const chestPrice = (): number => Math.round(BALANCE.chestBase * BALANCE.chestGrowth ** Math.max(0, store.data.owned.length - 1));

export function chestPool(): ChampionDef[] {
  return CHAMPIONS.filter((c) => !c.reward && !store.data.owned.includes(c.id));
}

export const CHEST_CHOICES = 3;
/** After this many chests without an epic, the next offer guarantees one. */
export const EPIC_PITY = 3;

function weightedPick(pool: ChampionDef[]): ChampionDef {
  const weight = (c: ChampionDef) => (c.rarity === 1 ? 6 : c.rarity === 2 ? 3 : 1);
  let roll = Math.random() * pool.reduce((n, c) => n + weight(c), 0);
  return pool.find((c) => (roll -= weight(c)) < 0) ?? pool[pool.length - 1];
}

/** Pays for a chest and rolls an offer of up to 3 champions; the player keeps one (claimChest). */
export function openChest(): ChampionDef[] | null {
  const pool = chestPool();
  const price = chestPrice();
  if (store.data.chestOffer || !pool.length || store.data.gold < price) return null;
  const offer: ChampionDef[] = [];
  const epics = pool.filter((c) => c.rarity === 3);
  if (store.data.chestsSinceEpic >= EPIC_PITY && epics.length) offer.push(weightedPick(epics));
  while (offer.length < Math.min(CHEST_CHOICES, pool.length)) {
    offer.push(weightedPick(pool.filter((c) => !offer.includes(c))));
  }
  store.data.gold -= price;
  store.data.chestsOpened++;
  store.data.chestOffer = offer.sort(() => Math.random() - 0.5).map((c) => c.id);
  return offer;
}

export function claimChest(id: string): ChampionDef | null {
  const offer = store.data.chestOffer;
  if (!offer?.includes(id)) return null;
  const def = CHAMP_BY_ID[id];
  store.data.owned.push(id);
  store.data.chestOffer = null;
  store.data.chestsSinceEpic = offer.some((o) => CHAMP_BY_ID[o].rarity === 3) ? 0 : store.data.chestsSinceEpic + 1;
  return def;
}

export function rewardFor(mapId: string): ChampionDef | undefined {
  return CHAMPIONS.find((c) => c.reward === mapId);
}

export function tryLevelUp(id: string): boolean {
  const lvl = level(id);
  const cost = levelCost(lvl);
  if (lvl >= MAX_LEVEL || store.data.gold < cost) return false;
  store.data.gold -= cost;
  store.data.levels[id] = lvl + 1;
  return true;
}

export function enemyName(id: string): string {
  return ENEMIES[id]?.name ?? id;
}

export function champ(id: string): ChampionDef {
  return CHAMP_BY_ID[id];
}

export function fmt(n: number): string {
  if (n < 1000) return Math.floor(n).toString();
  const units = ['k', 'M', 'B', 'T'];
  let u = -1;
  while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
  return `${n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0)}${units[u]}`;
}
