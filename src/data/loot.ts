import type { EnemyDef, MaterialDef } from '../types';

/** Fixed drop chance per roll, by material rarity (1 commun .. 4 légendaire). */
export const DROP_CHANCE: Record<number, number> = { 1: 0.05, 2: 0.015, 3: 0.004, 4: 0.002 };
export const MAT_RARITY = ['', 'Commun', 'Rare', 'Épique', 'Légendaire'];

export const MATERIALS: MaterialDef[] = [
  // Dropped everywhere, by monster family
  { id: 'essence', name: 'Essence bleue', icon: '🔹', rarity: 1, from: ['any'], desc: 'Tous les monstres.' },
  { id: 'croc', name: 'Croc acéré', icon: '🦷', rarity: 1, from: ['wolf', 'raptor', 'frl_wolf', 'nox_hound', 'dem_hunter', 'ion_ninja'], desc: 'Loups, raptors, molosses et chasseurs.' },
  { id: 'krug', name: 'Éclat de krug', icon: '🪨', rarity: 1, from: ['krug', 'gromp', 'frl_troll', 'nox_basilisk', 'ion_oni', 'dem_knight'], desc: 'Krugs, gromps et gros monstres des régions.' },
  { id: 'carapace', name: 'Carapace de carapateur', icon: '🦀', rarity: 1, from: ['scuttle', 'ion_crane', 'dem_wing'], desc: 'Carapateurs et volants (vagues 5, 15, 25…).' },
  { id: 'ecaille', name: 'Écaille de drake', icon: '🐉', rarity: 3, from: ['drake', 'herald'], desc: 'Monstres épiques (toutes les 10 vagues).' },
  { id: 'nexus', name: 'Fragment de Nexus', icon: '💠', rarity: 4, from: ['boss'], desc: 'Boss finaux uniquement.' },
  // Regional: any monster on a map of that region
  { id: 'herbe', name: 'Herbe de la Faille', icon: '🌿', rarity: 1, region: 'rift', desc: 'Faille de l\'invocateur.' },
  { id: 'rune', name: 'Rune ancienne', icon: '🔶', rarity: 2, region: 'rift', desc: 'Faille de l\'invocateur.' },
  { id: 'buff', name: 'Buff cristallisé', icon: '🔮', rarity: 3, region: 'rift', desc: 'Faille de l\'invocateur.' },
  { id: 'petricite', name: 'Pétricite', icon: '🤍', rarity: 1, region: 'demacia', desc: 'Demacia.' },
  { id: 'acier', name: 'Acier demacien', icon: '🛡️', rarity: 2, region: 'demacia', desc: 'Demacia.' },
  { id: 'plume', name: "Plume d'aile d'argent", icon: '🪶', rarity: 3, region: 'demacia', desc: 'Demacia.' },
  { id: 'glace', name: 'Glace pure', icon: '🧊', rarity: 1, region: 'freljord', desc: 'Freljord.' },
  { id: 'fourrure', name: 'Fourrure du Freljord', icon: '🐻', rarity: 2, region: 'freljord', desc: 'Freljord.' },
  { id: 'glacevraie', name: 'Glace véritable', icon: '❄️', rarity: 3, region: 'freljord', desc: 'Freljord.' },
  { id: 'fer', name: 'Fer noir', icon: '⚙️', rarity: 1, region: 'noxus', desc: 'Noxus.' },
  { id: 'insigne', name: 'Insigne noxien', icon: '🎖️', rarity: 2, region: 'noxus', desc: 'Noxus.' },
  { id: 'runenoire', name: 'Rune noire', icon: '🩸', rarity: 3, region: 'noxus', desc: 'Noxus.' },
  { id: 'fleur', name: "Fleur d'esprit", icon: '🌸', rarity: 1, region: 'ionia', desc: 'Ionia.' },
  { id: 'soie', name: "Soie d'Ionia", icon: '🎀', rarity: 2, region: 'ionia', desc: 'Ionia.' },
  { id: 'esprit', name: "Essence d'esprit", icon: '🦊', rarity: 3, region: 'ionia', desc: 'Ionia.' },
];

export const MAT_BY_ID: Record<string, MaterialDef> = Object.fromEntries(MATERIALS.map((m) => [m.id, m]));

/** Loot rolls per kill: tougher monsters roll more often (the chance per roll never changes). */
export function lootRolls(e: EnemyDef): number {
  if (e.boss) return 50;
  if (e.shape === 'boss') return 25;
  return { cannon: 2, scuttle: 2, super: 3, krug: 3, gromp: 4, dem_knight: 2, frl_troll: 3, nox_basilisk: 3, ion_oni: 3, frl_witch: 2, nox_mage: 2 }[e.id] ?? 1;
}

/** Materials this monster can drop on a map of the given region. */
export function lootTable(e: EnemyDef, region: string): MaterialDef[] {
  return MATERIALS.filter((m) => m.region
    ? m.region === region
    : m.from!.includes('any') || m.from!.includes(e.id) || (!!e.boss && m.from!.includes('boss')));
}

/** Rolls the drops of one kill (material id -> amount). */
export function rollLoot(e: EnemyDef, region: string): Record<string, number> {
  const out: Record<string, number> = {};
  const rolls = lootRolls(e);
  for (const m of lootTable(e, region)) {
    const p = DROP_CHANCE[m.rarity];
    let n = 0;
    for (let i = 0; i < rolls; i++) if (Math.random() < p) n++;
    if (n) out[m.id] = n;
  }
  return out;
}
