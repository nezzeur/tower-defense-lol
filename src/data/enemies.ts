import type { EnemyDef } from '../types';

export const ENEMIES: Record<string, EnemyDef> = {
  melee: { id: 'melee', name: 'Sbire mêlée', hp: 12, speed: 1.2, armor: 0, gold: 2, leak: 1, size: 9, color: '#e05555', shape: 'circle' },
  caster: { id: 'caster', name: 'Sbire lanceur', hp: 9, speed: 1.25, armor: 0, gold: 2, leak: 1, size: 8, color: '#c86dd7', shape: 'circle' },
  cannon: { id: 'cannon', name: 'Sbire canon', hp: 30, speed: 0.9, armor: 0.15, gold: 5, leak: 2, size: 12, color: '#b0563a', shape: 'square' },
  super: { id: 'super', name: 'Super sbire', hp: 60, speed: 0.85, armor: 0.25, gold: 8, leak: 3, size: 14, color: '#8a1c1c', shape: 'square' },
  scuttle: { id: 'scuttle', name: 'Carapateur', hp: 8, speed: 2.4, armor: 0, gold: 3, leak: 1, size: 9, color: '#4fd1c5', shape: 'diamond' },
  // Jungle camps mixed into the waves
  wolf: { id: 'wolf', name: 'Loup des ombres', hp: 14, speed: 1.6, armor: 0, gold: 3, leak: 1, size: 9, color: '#5b5f7a', shape: 'circle' },
  raptor: { id: 'raptor', name: 'Raptor', hp: 7, speed: 1.9, armor: 0, gold: 2, leak: 1, size: 7, color: '#d9534f', shape: 'circle' },
  krug: { id: 'krug', name: 'Krug', hp: 70, speed: 0.65, armor: 0.3, gold: 9, leak: 2, size: 12, color: '#8a7f73', shape: 'square' },
  gromp: { id: 'gromp', name: 'Gromp', hp: 110, speed: 0.75, armor: 0.1, gold: 14, leak: 3, size: 14, color: '#5fa86a', shape: 'square' },
  drake: { id: 'drake', name: 'Drake infernal', hp: 250, speed: 0.7, armor: 0.15, gold: 40, leak: 5, size: 17, color: '#ff6b35', shape: 'boss' },
  herald: { id: 'herald', name: 'Larve du Néant', hp: 400, speed: 0.6, armor: 0.15, gold: 60, leak: 5, size: 17, color: '#8e44ad', shape: 'boss' },

  // --- Regional troops (see REGION_ROSTER in game.ts) ---
  // Demacia: armour, shields and wings
  dem_soldier: { id: 'dem_soldier', name: 'Soldat demacien', hp: 13, speed: 1.15, armor: 0.15, gold: 2, leak: 1, size: 9, color: '#3f6fc9', shape: 'circle' },
  dem_knight: { id: 'dem_knight', name: "Chevalier d'argent", hp: 34, speed: 0.85, armor: 0.35, gold: 6, leak: 2, size: 12, color: '#eef1f5', shape: 'square', shield: 3 },
  dem_hunter: { id: 'dem_hunter', name: 'Chasseur de mages', hp: 16, speed: 1.5, armor: 0, gold: 3, leak: 1, size: 9, color: '#5a6a7a', shape: 'circle', tenacity: 0.7 },
  dem_wing: { id: 'dem_wing', name: "Aile d'argent", hp: 8, speed: 2, armor: 0, gold: 2, leak: 1, size: 8, color: '#dfe6f2', shape: 'diamond', fly: true },
  // Freljord: hardy, cold-blooded, hard to slow
  frl_raider: { id: 'frl_raider', name: 'Pillard des glaces', hp: 14, speed: 1.2, armor: 0, gold: 2, leak: 1, size: 9, color: '#5d7f9e', shape: 'circle' },
  frl_wolf: { id: 'frl_wolf', name: 'Loup des neiges', hp: 13, speed: 1.75, armor: 0, gold: 3, leak: 1, size: 9, color: '#eef4f8', shape: 'circle', tenacity: 1 },
  frl_troll: { id: 'frl_troll', name: 'Troll des glaces', hp: 75, speed: 0.65, armor: 0.1, gold: 9, leak: 2, size: 14, color: '#7fb0c9', shape: 'square', regen: 0.03 },
  frl_witch: { id: 'frl_witch', name: 'Sorcière de givre', hp: 22, speed: 1, armor: 0, gold: 6, leak: 1, size: 9, color: '#9fe8ff', shape: 'circle', heal: { pct: 0.04, radius: 2.2 } },
  // Noxus: heavy armour, fire-hardened beasts, blood magic
  nox_legion: { id: 'nox_legion', name: 'Légionnaire noxien', hp: 13, speed: 1.15, armor: 0.2, gold: 2, leak: 1, size: 9, color: '#8a1c26', shape: 'circle' },
  nox_hound: { id: 'nox_hound', name: 'Molosse drakéen', hp: 13, speed: 1.8, armor: 0, gold: 3, leak: 1, size: 9, color: '#4a2a2e', shape: 'circle', fireproof: true },
  nox_basilisk: { id: 'nox_basilisk', name: 'Basilic', hp: 80, speed: 0.6, armor: 0.45, gold: 10, leak: 2, size: 14, color: '#5f7a52', shape: 'square', tenacity: 0.5 },
  nox_mage: { id: 'nox_mage', name: 'Mage de sang', hp: 20, speed: 1, armor: 0, gold: 6, leak: 1, size: 9, color: '#ff3a3a', shape: 'circle', heal: { pct: 0.04, radius: 2.2 } },
  // Ionia: fast, evasive, spirits
  ion_acolyte: { id: 'ion_acolyte', name: "Acolyte de l'Ordre", hp: 12, speed: 1.25, armor: 0, gold: 2, leak: 1, size: 9, color: '#3f9a8a', shape: 'circle' },
  ion_ninja: { id: 'ion_ninja', name: 'Ombre du Kinkou', hp: 12, speed: 1.7, armor: 0, gold: 3, leak: 1, size: 9, color: '#4a3a6a', shape: 'circle', shield: 2 },
  ion_crane: { id: 'ion_crane', name: 'Grue spirituelle', hp: 9, speed: 2.2, armor: 0, gold: 3, leak: 1, size: 8, color: '#ffd9ec', shape: 'diamond', fly: true },
  ion_oni: { id: 'ion_oni', name: 'Oni', hp: 70, speed: 0.65, armor: 0.2, gold: 9, leak: 2, size: 14, color: '#b84a5a', shape: 'square', split: { id: 'ion_wisp', n: 3 } },
  ion_wisp: { id: 'ion_wisp', name: 'Feu follet', hp: 5, speed: 2, armor: 0, gold: 1, leak: 1, size: 6, color: '#7ff0e0', shape: 'diamond' },

  // Final bosses: reaching the nexus costs 12 lives and they walk the lane again.
  riftherald: { id: 'riftherald', name: 'Héraut de la Faille', hp: 900, speed: 0.45, armor: 0.2, gold: 200, leak: 12, size: 22, color: '#7d3cff', boss: true, shape: 'boss' },
  baron: { id: 'baron', name: 'Baron Nashor', hp: 1000, speed: 0.45, armor: 0.2, gold: 250, leak: 12, size: 24, color: '#6a1b9a', boss: true, shape: 'boss' },
  poroking: { id: 'poroking', name: 'Roi Poro', hp: 1000, speed: 0.5, armor: 0.2, gold: 250, leak: 12, size: 24, color: '#f0f0f0', boss: true, shape: 'boss' },
  colossus: { id: 'colossus', name: 'Colosse de glace', hp: 1100, speed: 0.4, armor: 0.25, gold: 300, leak: 12, size: 24, color: '#8fd3ff', boss: true, shape: 'boss' },
  sentinel: { id: 'sentinel', name: 'Sentinelle de Shurima', hp: 1200, speed: 0.4, armor: 0.25, gold: 350, leak: 12, size: 24, color: '#d4a537', boss: true, shape: 'boss' },
  fallenking: { id: 'fallenking', name: 'Spectre du Roi déchu', hp: 1300, speed: 0.42, armor: 0.25, gold: 400, leak: 12, size: 25, color: '#3dd6a3', boss: true, shape: 'boss' },
  petricite: { id: 'petricite', name: 'Golem de pétricite', hp: 1150, speed: 0.42, armor: 0.25, gold: 280, leak: 12, size: 24, color: '#e6e9f0', boss: true, shape: 'boss' },
  warbeast: { id: 'warbeast', name: 'Bête de guerre noxienne', hp: 1250, speed: 0.45, armor: 0.25, gold: 320, leak: 12, size: 24, color: '#8a1c2a', boss: true, shape: 'boss' },
  spiritguard: { id: 'spiritguard', name: 'Gardien spirituel', hp: 1350, speed: 0.45, armor: 0.2, gold: 340, leak: 12, size: 24, color: '#ff9ed2', boss: true, shape: 'boss' },
  automaton: { id: 'automaton', name: 'Automate hextech', hp: 1450, speed: 0.4, armor: 0.3, gold: 380, leak: 12, size: 24, color: '#c9a35a', boss: true, shape: 'boss' },
};

export interface Trait { icon: string; name: string; desc: string }

/** Special traits of a monster, for the HUD. */
export function enemyTraits(d: EnemyDef): Trait[] {
  const out: Trait[] = [];
  const pc = (v: number) => `${Math.round(v * 100)} %`;
  if (d.fly) out.push({ icon: '🪽', name: 'Volant', desc: 'Dégâts de zone et d\'aura réduits de 50 %. Ignore les rivières.' });
  if (d.shield) out.push({ icon: '🛡️', name: `Bouclier ×${d.shield}`, desc: `Bloque les ${d.shield} premiers coups directs.` });
  if (d.armor >= 0.3) out.push({ icon: '⛓️', name: 'Blindé', desc: `Armure ${pc(d.armor)} : privilégie les dégâts bruts, la brûlure, la synergie de Demacia.` });
  if (d.tenacity) out.push({ icon: '💢', name: d.tenacity >= 1 ? 'Insensible' : 'Tenace', desc: d.tenacity >= 1 ? 'Immunisé aux ralentissements et aux étourdissements.' : `Ralentissements et étourdissements réduits de ${pc(d.tenacity)}.` });
  if (d.regen) out.push({ icon: '💚', name: 'Régénération', desc: `Récupère ${pc(d.regen)} de ses PV par seconde. La brûlure l'en empêche.` });
  if (d.heal) out.push({ icon: '✚', name: 'Soigneur', desc: `Soigne les monstres proches de ${pc(d.heal.pct)} de leurs PV par seconde. À éliminer en premier.` });
  if (d.split) out.push({ icon: '✂️', name: 'Se divise', desc: `Libère ${d.split.n} ${ENEMIES[d.split.id].name.toLowerCase()}s en mourant.` });
  if (d.fireproof) out.push({ icon: '🔥', name: 'Ignifugé', desc: 'Immunisé aux brûlures.' });
  return out;
}
