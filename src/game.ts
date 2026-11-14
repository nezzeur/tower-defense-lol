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
  /**
   * Endless mode. Enemy HP = HP of the map's last wave x start x (1 + linear * n) x growth^n x level factor, n = endless wave.
   * The level factor makes enemies tougher for an over-levelled team (levelShare of each level's damage gain is
   * matched), so the mode stays tense, yet wave 200+ remains reachable with highly levelled champions and blessings.
   */
  endless: { start: 1.25, linear: 0.06, growth: 1.006, levelShare: 0.65, refLevel: 18, refLevelPerMap: 2.05 },
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

/** Average champion level a team is expected to have when it clears this map (measured with the balance bot). */
export const endlessRefLevel = (m: MapDef): number => BALANCE.endless.refLevel + BALANCE.endless.refLevelPerMap * Math.max(0, MAPS.indexOf(m));

/** How much tougher endless enemies get because the team out-levels the map (1 = no bonus). */
export const endlessLevelFactor = (m: MapDef, teamLevel: number): number =>
  BALANCE.dmgPerLevel ** (BALANCE.endless.levelShare * Math.max(0, teamLevel - endlessRefLevel(m)));

/** Wave whose enemy strength endless mode starts from (the last wave of a regular map). */
const ENDLESS_BASE_WAVE = 30;

/** How much endless wave n multiplies enemy HP compared with the map's last wave (level factor aside). */
export const endlessWaveFactor = (n: number): number => BALANCE.endless.start * (1 + BALANCE.endless.linear * n) * BALANCE.endless.growth ** n;

/** Enemy HP multiplier on endless wave n (1, 2, 3...) for a team of this average level. */
export function endlessHp(m: MapDef, n: number, teamLevel: number): number {
  // Arenas (40 waves) restart from the strength of a regular map's last wave, or their endless mode would be out of reach
  return hpScale(m, Math.min(m.waves, ENDLESS_BASE_WAVE)) * endlessWaveFactor(n) * endlessLevelFactor(m, teamLevel);
}
export const goldScale = (m: MapDef, w: number): number => (1 + BALANCE.goldPerWave * w) * m.mult ** BALANCE.goldMultExp;
export const waveBonus = (m: MapDef, w: number): number => Math.round((10 + 3 * w) * m.mult ** BALANCE.goldMultExp);

export interface Spawn { id: string; delay: number }

/**
 * Endless-mode rewards, all pure luck: the map's boss returns every `bossEvery` endless waves; killing it may drop
 * the region's relic (forge material) and, on the last map only, the exclusive champion.
 */
export const ENDLESS_LOOT = { bossEvery: 25, relicChance: 0.12, champ: 'lillia', champChance: 0.01 };

/** The endless-exclusive champion can only drop on the campaign's last map. */
export const endlessChampMap = (): MapDef => MAPS[MAPS.length - 1];

/** Who fills each slot of a wave. Regions swap in their own troops (data/enemies.ts). */
interface Roster {
  basic: string; ranged: string; tank: string; elite: string;
  /** Small groups joining on a rotation: pack x3, swarm x6, heavy x2, brute x1, runner x6. */
  pack: string; swarm: string; heavy: string; brute: string; runner: string;
  /** Region specialists (healers...): two of them every 4 waves from wave 5. */
  support?: string;
  /** Epic monster every 10 waves. */
  epic: string;
  /** Epic monster of every 20th wave instead, where the region has a second one. */
  epic2?: string;
}
const RIFT_ROSTER: Roster = { basic: 'melee', ranged: 'caster', tank: 'cannon', elite: 'super', pack: 'wolf', swarm: 'raptor', heavy: 'krug', brute: 'gromp', runner: 'scuttle', epic: 'drake', epic2: 'herald' };
export const REGION_ROSTER: Record<string, Roster> = {
  rift: RIFT_ROSTER,
  demacia: { ...RIFT_ROSTER, basic: 'dem_minion', tank: 'dem_golem', pack: 'dem_hound', swarm: 'dem_wing', epic: 'drake_mountain', epic2: undefined },
  freljord: { ...RIFT_ROSTER, basic: 'frl_minion', pack: 'frl_wolf', heavy: 'frl_troll', support: 'frl_shaman', epic: 'drake_ocean', epic2: undefined },
  noxus: { ...RIFT_ROSTER, basic: 'nox_minion', pack: 'nox_hound', heavy: 'nox_basilisk', support: 'nox_mage', epic2: undefined },
  ionia: { ...RIFT_ROSTER, basic: 'ion_minion', pack: 'ion_fox', swarm: 'ion_wisp', heavy: 'ion_treant', runner: 'ion_crane', epic: 'drake_cloud', epic2: undefined },
};

export function buildWave(m: MapDef, w: number): Spawn[] {
  const out: Spawn[] = [];
  const ro = REGION_ROSTER[m.region ?? 'rift'] ?? RIFT_ROSTER;
  // The final boss closes the map, and comes back every 10 waves of endless mode with a bigger escort
  if (w === m.waves || (w > m.waves && (w - m.waves) % ENDLESS_LOOT.bossEvery === 0)) {
    out.push({ id: m.finalBoss, delay: 0 });
    const escort = 10 + Math.max(0, Math.floor((w - m.waves) / ENDLESS_LOOT.bossEvery)) * 6;
    for (let i = 0; i < escort; i++) out.push({ id: ro.elite, delay: 0.8 });
    return out;
  }
  const n = 6 + Math.floor(w * 0.5);
  for (let i = 0; i < n; i++) {
    let id = i % 3 === 2 ? ro.ranged : ro.basic;
    if (w >= 4 && i % 7 === 6) id = ro.tank;
    if (w >= 25 && i % 9 === 8) id = ro.elite;
    out.push({ id, delay: i === 0 ? 0 : 0.7 });
  }
  // Region specialists slip in behind the front line
  if (ro.support && w >= 5 && w % 4 === 1) for (let i = 0; i < 2; i++) out.push({ id: ro.support, delay: i ? 0.9 : 0.6 });
  // Jungle camps and regional beasts join on a rotation
  if (w % 3 === 0) for (let i = 0; i < 3; i++) out.push({ id: ro.pack, delay: i ? 0.4 : 1 });
  if (w % 4 === 2) for (let i = 0; i < 6; i++) out.push({ id: ro.swarm, delay: i ? 0.25 : 1 });
  if (w >= 6 && w % 6 === 0) for (let i = 0; i < 2; i++) out.push({ id: ro.heavy, delay: i ? 0.8 : 1.2 });
  if (w >= 7 && w % 7 === 0) out.push({ id: ro.brute, delay: 1.2 });
  if (w % 5 === 0 && w % 10 !== 0) for (let i = 0; i < 6; i++) out.push({ id: ro.runner, delay: 0.3 });
  if (w % 10 === 0) out.push({ id: w % 20 === 0 && ro.epic2 ? ro.epic2 : ro.epic, delay: 1.2 });
  return out;
}

export const chestPrice = (): number => Math.round(BALANCE.chestBase * BALANCE.chestGrowth ** Math.max(0, store.data.owned.length - 1));

export function chestPool(): ChampionDef[] {
  return CHAMPIONS.filter((c) => !c.reward && !c.endless && !store.data.owned.includes(c.id));
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

/** Boss drop: chance on the first reward map, and how fast it shrinks on each later (harder) one. */
export const REWARD = { base: 0.05, decay: 0.82 };

/** Fixed chance that beating this map's final boss drops its champion (0 when there is none left to win). Harder maps: lower chance. */
export function rewardChance(mapId: string): number {
  const rw = rewardFor(mapId);
  if (!rw || store.data.owned.includes(rw.id)) return 0;
  const rank = MAPS.filter((m) => rewardFor(m.id)).findIndex((m) => m.id === mapId);
  return REWARD.base * REWARD.decay ** Math.max(0, rank);
}

/** Rolls the boss drop after a win; returns the champion when it drops (and adds it to the roster). */
export function rollReward(mapId: string): ChampionDef | null {
  const rw = rewardFor(mapId);
  if (!rw || Math.random() >= rewardChance(mapId)) return null;
  store.data.owned.push(rw.id);
  return rw;
}

export const pct = (v: number): string => `${v < 0.1 ? (v * 100).toFixed(1).replace('.0', '') : Math.round(v * 100)} %`;

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

/** True when the inventory holds every material of the item's forge recipe (and it is not owned yet). */
export function canCraft(itemId: string): boolean {
  const it = ITEM_BY_ID[itemId];
  if (!it?.craft || store.data.items.includes(itemId)) return false;
  return Object.entries(it.craft).every(([m, n]) => (store.data.mats[m] ?? 0) >= n);
}

/** Forges an item: spends the recipe's materials and adds the item to the inventory. */
export function craftItem(itemId: string): boolean {
  if (!canCraft(itemId)) return false;
  for (const [m, n] of Object.entries(ITEM_BY_ID[itemId].craft!)) store.data.mats[m] -= n;
  store.data.items.push(itemId);
  return true;
}

/** Endless mode opens on a map once its last wave has been beaten. */
export const endlessUnlocked = (mapId: string): boolean => {
  const m = MAPS.find((x) => x.id === mapId);
  return !!m && (store.data.best[mapId] ?? 0) >= m.waves;
};
