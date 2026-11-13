import type { SynStat } from './synergies';

/** A blessing picked between waves of endless mode; it lasts until the end of the run. Stackable. */
export interface BoonDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Team-wide stat it adds to (same channels as region synergies). */
  stat?: SynStat;
  value?: number;
  /** Effects outside the stat channels. */
  special?: 'lives' | 'regen' | 'burn';
}

/** Chance that a blessing is offered after each endless wave. */
export const BOON_CHANCE = 0.25;
/** Seconds before auto waves pick one for an absent player. */
export const BOON_AUTO_DELAY = 8;

export const BOONS: BoonDef[] = [
  { id: 'might', name: 'Force', icon: '⚔️', desc: '+10 % de dégâts pour toute l\'équipe', stat: 'dmg', value: 0.1 },
  { id: 'haste', name: 'Célérité', icon: '💨', desc: '+8 % de vitesse d\'attaque pour toute l\'équipe', stat: 'rate', value: 0.08 },
  { id: 'reach', name: 'Longue-vue', icon: '🔭', desc: '+8 % de portée pour toute l\'équipe', stat: 'range', value: 0.08 },
  { id: 'fortune', name: 'Fortune', icon: '🪙', desc: '+25 % d\'or sur les éliminations', stat: 'gold', value: 0.25 },
  { id: 'focus', name: 'Concentration', icon: '🌀', desc: 'Les ultimes se rechargent 20 % plus vite', stat: 'ultCd', value: 0.2 },
  { id: 'giant', name: 'Tueur de géants', icon: '🗡️', desc: '+20 % de dégâts contre les boss', stat: 'boss', value: 0.2 },
  { id: 'pierce', name: 'Perce-armure', icon: '⛏️', desc: 'Ignore 10 % d\'armure ennemie', stat: 'armorShred', value: 0.1 },
  { id: 'ember', name: 'Braise', icon: '🔥', desc: 'Tous les coups brûlent : +12 % des dégâts par seconde pendant 3 s', special: 'burn', value: 0.12 },
  { id: 'heal', name: 'Second souffle', icon: '💚', desc: '+6 vies tout de suite', special: 'lives', value: 6 },
  { id: 'ward', name: 'Rempart', icon: '🛡️', desc: '+1 vie à chaque vague terminée', special: 'regen', value: 1 },
];

export const BOON_BY_ID: Record<string, BoonDef> = Object.fromEntries(BOONS.map((b) => [b.id, b]));

/** Three different boons drawn at random. */
export function rollBoons(n = 3): BoonDef[] {
  const pool = [...BOONS];
  const out: BoonDef[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
