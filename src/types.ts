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
  ult: { name: string; desc: string; apply: (s: Stats, rank: number) => void };
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
}

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
  price: number;
  apply: (s: Stats) => void;
}
