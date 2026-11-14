import type { EnemyDef, MaterialDef } from '../types';

/** Fixed drop chance per roll, by material rarity (1 commun .. 4 légendaire). */
export const DROP_CHANCE: Record<number, number> = { 1: 0.05, 2: 0.015, 3: 0.004, 4: 0.002 };
export const MAT_RARITY = ['', 'Commun', 'Rare', 'Épique', 'Légendaire', 'Mythique'];

export const MATERIALS: MaterialDef[] = [
  // Dropped everywhere, by monster family
  { id: 'essence', name: 'Essence bleue', icon: '🔹', rarity: 1, from: ['any'], desc: 'Tous les monstres.' },
  { id: 'croc', name: 'Croc acéré', icon: '🦷', rarity: 1, from: ['wolf', 'raptor', 'frl_wolf', 'nox_hound', 'dem_hound', 'ion_fox'], desc: 'Loups, raptors, molosses et chasseurs.' },
  { id: 'krug', name: 'Éclat de krug', icon: '🪨', rarity: 1, from: ['krug', 'gromp', 'frl_troll', 'nox_basilisk', 'ion_treant', 'dem_golem'], desc: 'Krugs, gromps et gros monstres des régions.' },
  { id: 'carapace', name: 'Carapace de carapateur', icon: '🦀', rarity: 1, from: ['scuttle', 'ion_crane', 'dem_wing'], desc: 'Carapateurs et volants (vagues 5, 15, 25…).' },
  { id: 'ecaille', name: 'Écaille de drake', icon: '🐉', rarity: 3, from: ['drake', 'herald', 'drake_mountain', 'drake_ocean', 'drake_cloud'], desc: 'Monstres épiques (toutes les 10 vagues).' },
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
  // Relics: only from the endless-mode boss of each region (see ENDLESS_LOOT in game.ts), never guaranteed
  { id: 'r_rift', name: 'Œil du Baron', icon: '👁️', rarity: 5, relic: 'rift', desc: 'Boss du mode infini — Faille de l\'invocateur.' },
  { id: 'r_demacia', name: 'Cœur de pétricite', icon: '🤍', rarity: 5, relic: 'demacia', desc: 'Boss du mode infini — Demacia.' },
  { id: 'r_freljord', name: 'Éclat de glace éternelle', icon: '💎', rarity: 5, relic: 'freljord', desc: 'Boss du mode infini — Freljord.' },
  { id: 'r_noxus', name: 'Croc de bête de guerre', icon: '🩸', rarity: 5, relic: 'noxus', desc: 'Boss du mode infini — Noxus.' },
  { id: 'r_ionia', name: 'Larme d\'esprit', icon: '💧', rarity: 5, relic: 'ionia', desc: 'Boss du mode infini — Ionia.' },
];

/** Relic dropped by the endless-mode boss of a region, if any. */
export const relicOf = (region: string): MaterialDef | undefined => MATERIALS.find((m) => m.relic === region);

export const MAT_BY_ID: Record<string, MaterialDef> = Object.fromEntries(MATERIALS.map((m) => [m.id, m]));

/** Loot rolls per kill: tougher monsters roll more often (the chance per roll never changes). */
export function lootRolls(e: EnemyDef): number {
  if (e.boss) return 50;
  if (e.shape === 'boss') return 25;
  return { cannon: 2, scuttle: 2, super: 3, krug: 3, gromp: 4, dem_golem: 2, frl_troll: 3, nox_basilisk: 3, ion_treant: 3, frl_shaman: 2, nox_mage: 2 }[e.id] ?? 1;
}

/** Materials this monster can drop on a map of the given region. */
export function lootTable(e: EnemyDef, region: string): MaterialDef[] {
  return MATERIALS.filter((m) => m.relic ? false : m.region
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
