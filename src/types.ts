export type Role = 'Tireur' | 'Mage' | 'Combattant' | 'Support' | 'Assassin';
export type AttackType = 'single' | 'splash' | 'pierce' | 'aura' | 'multi' | 'chain';

/** Combat stats of a champion once level, ult rank, item and stacks are applied. */
export interface Stats {
  dmg: number;
  /** Range in tiles. */
  range: number;
  /** Attacks per second. */
  rate: number;
  type: AttackType;
  /** Splash radius in tiles (splash attacks). */
  splash: number;
  /** Number of targets (multi) or bounces (chain). */
  targets: number;
  slow?: { pct: number; dur: number };
  stun?: { chance: number; dur: number };
  /** Damage over time: dps = dmg * mult. */
  burn?: { mult: number; dur: number };
  goldHit?: { chance: number; amount: number };
  /** Every N hits, deal pct of max HP as true damage. */
  pctHp?: { every: number; pct: number };
  crit?: { chance: number; mult: number };
  /** Every N hits, multiply damage. */
  everyN?: { n: number; mult: number };
  /** Damage gained per kill. Persistent stacks survive between runs. */
  killStack?: { amount: number; persistent: boolean };
  /** Bonus fraction of gold on kills by this champion. */
  killGold?: number;
  livesPerWave?: number;
  /** Attack speed ramp while attacking: +perHit per hit, up to max. */
  ramp?: { perHit: number; max: number };
  bossMult?: number;
}

/** How a placed champion picks among the enemies in range. */
export type Priority = 'first' | 'last' | 'strong' | 'weak' | 'close';

/** Effect of an active ultimate (generic building blocks, scaled by the caster's damage). */
export type UltFx =
  /** Damage (x caster damage) to every enemy around the densest cluster, optional burn. */
  | { kind: 'burst'; radius: number; mult: number; burn?: { mult: number; dur: number } }
  /** Slow / stun (and optional damage) on a cluster (radius in tiles) or on every enemy (no radius). */
  | { kind: 'control'; radius?: number; slow?: number; slowDur?: number; stun?: number; mult?: number }
  /** Attack speed / damage buff for dur seconds on self, allies within radius tiles, or the whole team. */
  | { kind: 'buff'; scope: 'self' | 'near' | 'team'; radius?: number; rate?: number; dmg?: number; dur: number }
  /** Big hit on the toughest enemy: mult x damage plus pct of its max HP as true damage. */
  | { kind: 'execute'; mult: number; pct: number }
  /** Instant gold: mult x the current wave bonus. */
  | { kind: 'gold'; mult: number }
  | { kind: 'lives'; n: number };

/** Active ultimate: cast by the player, recharges while the champion is on the board. */
export interface ActiveUlt {
  name: string;
  desc: string;
  /** Cooldown in game seconds. */
  cd: number;
  fx: UltFx;
}

export interface ChampionDef {
  id: string;
  name: string;
  title: string;
  role: Role;
  region: string;
  color: string;
  /** Chest weight class: 1 common, 2 rare, 3 epic. */
  rarity: 1 | 2 | 3;
  starter?: boolean;
  /** Map id whose completion grants this champion (not in chests). */
  reward?: string;
  passive: string;
  base: Stats;
  /** Passive upgrade unlocked at levels 6 / 11 / 16 ("ult rank"). */
  ult: { name: string; desc: string; apply: (s: Stats, rank: number) => void };
  /** Active ultimate. */
  active: ActiveUlt;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  /** Tiles per second. */
  speed: number;
  armor: number;
  gold: number;
  /** Lives lost when it reaches the nexus. */
  leak: number;
  size: number;
  color: string;
  boss?: boolean;
  shape: 'circle' | 'square' | 'diamond' | 'boss';
  // --- Traits ---
  /** Flying: halves damage from area attacks (splash, aura) and ignores rivers. */
  fly?: boolean;
  /** 0..1 resistance to slows and stuns (1 = immune). */
  tenacity?: number;
  /** Fraction of max HP regenerated per second (stopped while burning). */
  regen?: number;
  /** Heals nearby monsters: fraction of their max HP per second, within radius tiles. */
  heal?: { pct: number; radius: number };
  /** Number of direct hits fully blocked before it takes damage. */
  shield?: number;
  /** On death, splits into n monsters of this id. */
  split?: { id: string; n: number };
  /** Cannot be set on fire (immune to burns). */
  fireproof?: boolean;
  /** Special move of a boss or epic monster, used on a cooldown (seconds). */
  ability?: Ability;
}

export type Ability = { name: string; cd: number } & (
  /** Calls n monsters of this id at its side. */
  | { kind: 'summon'; id: string; n: number }
  /** Rushes forward: speed x mult for dur seconds, immune to slows meanwhile. */
  | { kind: 'charge'; dur: number; mult: number }
  /** Raises a shield that blocks the next direct hits. */
  | { kind: 'shield'; hits: number }
  /** Freezes the champions within radius tiles: they stop attacking for dur seconds. */
  | { kind: 'freeze'; radius: number; dur: number }
  /** Speeds up every monster within radius tiles (x mult for dur seconds). */
  | { kind: 'rally'; radius: number; dur: number; mult: number }
  /** Turns intangible: takes no damage for dur seconds. */
  | { kind: 'phase'; dur: number }
  /** Heals itself and the monsters within radius tiles by pct of their max HP. */
  | { kind: 'mend'; radius: number; pct: number }
);

export type MapStyle = 'rift' | 'jungle' | 'bridge' | 'tundra' | 'desert' | 'haunted' | 'demacia' | 'noxus' | 'ionia' | 'piltover';

export interface MapTheme {
  style: MapStyle;
  grass: string;
  grass2: string;
  path: string;
  pathEdge: string;
  decor: string;
  accent: string;
}

export type FeatureKind = 'blue' | 'red' | 'brush' | 'river' | 'turret' | 'dragon';

/** Special tile area on a map (w x h tiles, default 1x1). */
export interface MapFeature {
  kind: FeatureKind;
  c: number;
  r: number;
  w?: number;
  h?: number;
}

export type LandmarkKind =
  | 'fountain' | 'inhibitor' | 'baronpit' | 'citadel' | 'statue' | 'arena' | 'fortress'
  | 'shrine' | 'hexgate' | 'sundisc' | 'pyramid' | 'ruins' | 'graves' | 'waterfall' | 'camp' | 'workshop';

/** Large decorative set piece (blocks placement over its w x h tiles). */
export interface Landmark {
  kind: LandmarkKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapDef {
  id: string;
  name: string;
  /** Region ("city") the map belongs to. */
  region?: string;
  subtitle: string;
  unlock: number;
  mult: number;
  waves: number;
  /** Waypoints in grid coordinates; the last one is the nexus. */
  path: [number, number][];
  /** Extra lanes; each must end on the same nexus tile as path. */
  lanes?: [number, number][][];
  features?: MapFeature[];
  /**
   * Terrain rows (ROWS strings of COLS chars). '.' grass, ',' flowers, 's' shore/sand, 'H' high ground (+range),
   * 'T' forest, 'R' rocks, '~' water (the last three block placement).
   */
  terrain?: string[];
  landmarks?: Landmark[];
  /** Spline-smoothed lanes (default: straight tile lanes). */
  curvy?: boolean;
  theme: MapTheme;
  finalBoss: string;
}

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  /** Data Dragon item id for the official icon (emoji icon is the fallback). */
  dd?: number;
  category: 'Dégâts' | 'Vitesse' | 'Utilitaire';
  desc: string;
  /** Shop price (0 for forged items). */
  price: number;
  /** Forge recipe (material id -> amount). Forged items are not sold in the shop. */
  craft?: Record<string, number>;
  /** Region whose materials the recipe mostly uses (forge grouping). */
  origin?: string;
  apply: (s: Stats) => void;
}

/** Loot material dropped by monsters; its rarity sets the fixed drop chance per roll. */
export interface MaterialDef {
  id: string;
  name: string;
  icon: string;
  /** 1 commun, 2 rare, 3 épique, 4 légendaire. */
  rarity: 1 | 2 | 3 | 4;
  /** Region id whose maps drop it (any monster there). */
  region?: string;
  /** Enemy ids that drop it on any map; 'boss' = every final boss, 'any' = every monster. */
  from?: string[];
  desc: string;
}
