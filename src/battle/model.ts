// Shared shapes and constants of a battle: what an enemy, a champion on the board, a projectile and a visual effect are.
import { COLS, ROWS } from '../data/maps';
import type { ChampionDef, EnemyDef, Priority, Stats } from '../types';
export const TILE = 48;
export const W = COLS * TILE;
export const H = ROWS * TILE;
export const STEP = 1 / 60;
/** Seconds a champion takes to drop onto its tile, and the moment its feet touch the ground. */
export const SPAWN = 0.38, LAND = SPAWN * 0.7;
/** Saved teams per map. */
export const TEAM_SLOTS = 3;
/** Seconds the ultimate cut-in stays on screen. */
export const CUTIN = 1.15;

export interface Burn { dps: number; t: number; src: Tower | null }

export interface Enemy {
  uid: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  s: number;
  x: number;
  y: number;
  slowPct: number;
  slowT: number;
  stunT: number;
  burns: Burn[];
  dead: boolean;
  hitFlash: number;
  lane: number;
  /** Facing (-1 left, 1 right) and walk animation phase, render only. */
  face: number;
  phase: number;
  /** Render only: knock-back offset (px), squash (0..1) and game seconds since it spawned. */
  kx: number;
  ky: number;
  sq: number;
  born: number;
  /** Direct hits its shield still blocks. */
  shield: number;
  /** Render only: seconds of healing glow left. */
  healed: number;
  /** Seconds before its special move is ready again. */
  abT: number;
  /** Seconds left of a charge, of intangibility, and of a borrowed speed boost (with its multiplier). */
  chargeT: number;
  phaseT: number;
  hasteT: number;
  haste: number;
}

export interface Tower {
  def: ChampionDef;
  c: number;
  r: number;
  x: number;
  y: number;
  stats: Stats;
  cd: number;
  hits: number;
  runStacks: number;
  /** Diminishing kill stacks gained this run (Nasus). */
  stackCount: number;
  ramp: number;
  angle: number;
  flash: number;
  kills: number;
  /** Damage dealt this run (for the damage meter). */
  dmgDone: number;
  /** Active ultimate: seconds left before it can be cast again. */
  ultCd: number;
  /** Temporary ultimate buffs (attack speed / damage fractions). */
  buffs: { t: number; rate: number; dmg: number }[];
  priority: Priority;
  // Render only (attack animation); nothing below feeds back into the simulation.
  /** Smoothed aim angle and facing side. */
  aim: number;
  face: 1 | -1;
  /** Attack beat: 0 rest, -1 wound back, +1 follow-through (eased toward its target every frame). */
  sw: number;
  /** Game seconds since the last attack, and the attack interval at that moment. */
  since: number;
  period: number;
  /** Had a target at its last attack check. */
  engaged: boolean;
  /** Enemy the champion keeps facing between attacks. */
  tgt: Enemy | null;
  /** Real seconds since it was placed / since its last ultimate. */
  born: number;
  ultT: number;
  /** Seconds left frozen by a boss: the champion cannot attack. */
  stunT: number;
}

/** Global knob on ultimate damage multipliers (bursts, control hits, executes), tuned with scripts/sim.ts. */
export const TUNE = { ult: 0.25 };

export const PRIORITIES: Record<Priority, { name: string; desc: string }> = {
  first: { name: 'Premier', desc: 'Le plus avancé vers le nexus' },
  last: { name: 'Dernier', desc: 'Le moins avancé' },
  strong: { name: 'Plus fort', desc: 'Le plus de PV' },
  weak: { name: 'Plus faible', desc: 'Le moins de PV' },
  close: { name: 'Proche', desc: 'Le plus proche du champion' },
};

export interface Proj {
  x: number;
  y: number;
  target: Enemy;
  tower: Tower;
  dmgMult: number;
  chainLeft: number;
  hit: Set<number>;
  trail: { x: number; y: number }[];
  /** Pixels per second, and distance to the target when it was fired (for lobbed arcs). */
  speed: number;
  d0: number;
  /** Bounce shots: where this hop started (a bolt of energy links it to the projectile). */
  ox?: number;
  oy?: number;
}

export interface Fx {
  kind: 'beam' | 'ring' | 'text' | 'boom' | 'laser' | 'zap' | 'whirl' | 'storm' | 'strike' | 'pillar';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r?: number;
  t: number;
  max: number;
  color: string;
  text?: string;
  /** Font size of a text effect (default 15). */
  size?: number;
}

export type SpellId = 'smite' | 'heal' | 'exhaust';
export const SPELLS: Record<SpellId, { name: string; icon: string; cd: number; desc: string }> = {
  smite: { name: 'Châtiment', icon: '⚡', cd: 60, desc: '20 % des PV max en dégâts bruts sur l\'ennemi le plus résistant' },
  exhaust: { name: 'Fatigue', icon: '🌀', cd: 45, desc: 'Ralentit tous les ennemis de 60 % pendant 3 s' },
  heal: { name: 'Soins', icon: '💚', cd: 120, desc: '+5 vies' },
};

export interface BattleEvents {
  /** Something the side panel shows changed (placement, selection, wave). */
  onChange: () => void;
  onEnd: (win: boolean, wave: number) => void;
}

export function initials(name: string): string {
  const parts = name.replace(/'/g, '').split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

export function fmtShort(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toString();
}
