import type { ItemDef, Stats } from '../types';

export const ITEMS: ItemDef[] = [
  { id: 'doran', dd: 1055, category: 'Dégâts', name: 'Lame de Doran', icon: '🗡️', desc: '+15 % dégâts', price: 150, apply: (s) => { s.dmg *= 1.15; } },
  { id: 'coin', category: 'Utilitaire', name: 'Pièce ancienne', icon: '🪙', desc: '+50 % d\'or sur les éliminations', price: 800, apply: (s) => { s.killGold = (s.killGold ?? 0) + 0.5; } },
  { id: 'rfc', dd: 3094, category: 'Utilitaire', name: 'Canon ultrarapide', icon: '🔭', desc: '+1 portée', price: 600, apply: (s) => { s.range += 1; } },
  { id: 'guinsoo', dd: 3124, category: 'Vitesse', name: 'Lame enragée de Guinsoo', icon: '⚡', desc: '+35 % vitesse d\'attaque', price: 1200, apply: (s) => { s.rate *= 1.35; } },
  { id: 'rylai', category: 'Utilitaire', name: 'Sceptre de cristal de Rylai', icon: '❄️', desc: 'Ralentit de 25 % pendant 1 s', price: 1500,
    apply: (s) => { if (!s.slow || s.slow.pct < 0.25) s.slow = { pct: 0.25, dur: 1 }; } },
  { id: 'liandry', dd: 6653, category: 'Dégâts', name: 'Tourment de Liandry', icon: '🔥', desc: 'Brûle : 30 % des dégâts/s pendant 3 s', price: 2500,
    apply: (s) => { s.burn = s.burn ? { mult: s.burn.mult + 0.3, dur: s.burn.dur } : { mult: 0.3, dur: 3 }; } },
  { id: 'ie', dd: 3031, category: 'Dégâts', name: "Lame d'infini", icon: '💎', desc: '+30 % chance de critique, critiques x2,5', price: 3000,
    apply: (s) => { s.crit = { chance: Math.min(1, (s.crit?.chance ?? 0) + 0.3), mult: Math.max(2.5, s.crit?.mult ?? 0) }; } },
  { id: 'botrk', dd: 3153, category: 'Dégâts', name: 'Lame du roi déchu', icon: '⚔️', desc: 'Chaque coup : 1,5 % des PV max en dégâts bruts', price: 4000,
    apply: (s) => { s.pctHp = s.pctHp ? { every: s.pctHp.every, pct: s.pctHp.pct + 0.015 } : { every: 1, pct: 0.015 }; } },
  { id: 'rabadon', dd: 3089, category: 'Dégâts', name: 'Coiffe de Rabadon', icon: '🎩', desc: '+45 % dégâts', price: 6000, apply: (s) => { s.dmg *= 1.45; } },
  // --- Starter and mid-range shop items ---
  { id: 'longsword', dd: 1036, category: 'Dégâts', name: 'Épée longue', icon: '🗡️', desc: '+8 % dégâts', price: 80, apply: (s) => { s.dmg *= 1.08; } },
  { id: 'dagger', dd: 1042, category: 'Vitesse', name: 'Dague', icon: '🔪', desc: "+12 % vitesse d'attaque", price: 120, apply: (s) => { s.rate *= 1.12; } },
  { id: 'cull', dd: 1083, category: 'Utilitaire', name: 'Abatteuse', icon: '🌾', desc: "+20 % d'or sur les éliminations", price: 300, apply: (s) => { s.killGold = (s.killGold ?? 0) + 0.2; } },
  { id: 'recurve', dd: 1043, category: 'Vitesse', name: 'Arc courbe', icon: '🏹', desc: "+20 % vitesse d'attaque", price: 400, apply: (s) => { s.rate *= 1.2; } },
  { id: 'bfsword', dd: 1038, category: 'Dégâts', name: 'B.F. Glaive', icon: '⚔️', desc: '+25 % dégâts', price: 500, apply: (s) => { s.dmg *= 1.25; } },
  { id: 'executioner', dd: 3123, category: 'Dégâts', name: 'Appel du bourreau', icon: '🪓', desc: '+25 % dégâts contre les boss', price: 700, apply: (s) => { s.bossMult = (s.bossMult ?? 1) + 0.25; } },
  { id: 'zeal', dd: 3086, category: 'Vitesse', name: 'Zèle', icon: '💨', desc: "+15 % vitesse d'attaque, +10 % chance de critique (x2)", price: 900,
    apply: (s) => { s.rate *= 1.15; s.crit = { chance: Math.min(1, (s.crit?.chance ?? 0) + 0.1), mult: Math.max(2, s.crit?.mult ?? 0) }; } },
  { id: 'sheen', dd: 3057, category: 'Dégâts', name: 'Brillance', icon: '✨', desc: 'Tous les 4 coups : dégâts x2 (ou +12 % dégâts si le champion a déjà un coup spécial)', price: 1000,
    apply: (s) => { if (s.everyN) s.dmg *= 1.12; else s.everyN = { n: 4, mult: 2 }; } },
  { id: 'mejai', dd: 3041, category: 'Dégâts', name: 'Voleur d\'âmes de Mejai', icon: '📕', desc: '+1 % de dégâts par élimination pendant la partie (ou +15 % dégâts si le champion cumule déjà)', price: 1800,
    apply: (s) => { if (s.killStack) s.dmg *= 1.15; else s.killStack = { amount: 0.01, persistent: false }; } },
  { id: 'runaan', dd: 3085, category: 'Utilitaire', name: 'Ouragan de Runaan', icon: '🌪️', desc: '+1 cible (cible unique, multi-cibles ou rebonds), sinon +20 % dégâts', price: 2800, apply: (s) => extraTarget(s, 1.2) },
  { id: 'ga', dd: 3026, category: 'Utilitaire', name: 'Ange gardien', icon: '👼', desc: '+1 vie à chaque vague terminée', price: 3500, apply: (s) => { s.livesPerWave = (s.livesPerWave ?? 0) + 1; } },

  // --- Forged items (materials dropped by monsters, see data/loot.ts) ---
  { id: 'f-rift', origin: 'rift', category: 'Dégâts', name: 'Talisman de la Faille', icon: '🧿', desc: "+20 % dégâts, +10 % vitesse d'attaque", price: 0,
    craft: { herbe: 30, rune: 6, essence: 25 }, apply: (s) => { s.dmg *= 1.2; s.rate *= 1.1; } },
  { id: 'f-rift2', origin: 'rift', category: 'Dégâts', name: 'Couronne du Baron', icon: '👑', desc: '+35 % dégâts, +30 % dégâts contre les boss', price: 0,
    craft: { herbe: 70, rune: 18, buff: 4, ecaille: 1 }, apply: (s) => { s.dmg *= 1.35; s.bossMult = (s.bossMult ?? 1) + 0.3; } },
  { id: 'f-dem', origin: 'demacia', category: 'Utilitaire', name: 'Lance de pétricite', icon: '🔱', desc: '+25 % dégâts, +0,6 portée', price: 0,
    craft: { petricite: 40, acier: 8, essence: 40 }, apply: (s) => { s.dmg *= 1.25; s.range += 0.6; } },
  { id: 'f-dem2', origin: 'demacia', category: 'Vitesse', name: "Étendard de l'Aile d'argent", icon: '🪽', desc: "+50 % vitesse d'attaque", price: 0,
    craft: { petricite: 90, acier: 22, plume: 5 }, apply: (s) => { s.rate *= 1.5; } },
  { id: 'f-frel', origin: 'freljord', category: 'Utilitaire', name: 'Cœur de givre', icon: '🧊', desc: '+15 % dégâts, ralentit de 35 % pendant 1,5 s', price: 0,
    craft: { glace: 40, fourrure: 8, croc: 10 },
    apply: (s) => { s.dmg *= 1.15; if (!s.slow || s.slow.pct < 0.35) s.slow = { pct: 0.35, dur: Math.max(1.5, s.slow?.dur ?? 0) }; } },
  { id: 'f-frel2', origin: 'freljord', category: 'Dégâts', name: 'Arc de glace véritable', icon: '❄️', desc: "+30 % dégâts, 12 % de chance d'étourdir 0,8 s", price: 0,
    craft: { glace: 90, fourrure: 22, glacevraie: 5 },
    apply: (s) => { s.dmg *= 1.3; s.stun = { chance: Math.min(0.5, (s.stun?.chance ?? 0) + 0.12), dur: Math.max(0.8, s.stun?.dur ?? 0) }; } },
  { id: 'f-nox', origin: 'noxus', category: 'Dégâts', name: 'Hache de fer noir', icon: '🪓', desc: '+15 % dégâts, saignement : 50 % des dégâts/s pendant 4 s', price: 0,
    craft: { fer: 40, insigne: 8, krug: 6 },
    apply: (s) => { s.dmg *= 1.15; s.burn = s.burn ? { mult: s.burn.mult + 0.5, dur: s.burn.dur } : { mult: 0.5, dur: 4 }; } },
  { id: 'f-nox2', origin: 'noxus', category: 'Dégâts', name: 'Guillotine runique', icon: '⚰️', desc: '+25 % dégâts, tous les 4 coups : dégâts x3 (ou coups spéciaux +50 %)', price: 0,
    craft: { fer: 90, insigne: 22, runenoire: 5 },
    apply: (s) => { s.dmg *= 1.25; if (s.everyN) s.everyN = { n: s.everyN.n, mult: s.everyN.mult * 1.5 }; else s.everyN = { n: 4, mult: 3 }; } },
  { id: 'f-ion', origin: 'ionia', category: 'Vitesse', name: 'Éventail de soie', icon: '🪭', desc: "+15 % vitesse d'attaque, +1 cible (sinon +20 % dégâts)", price: 0,
    craft: { fleur: 40, soie: 8, carapace: 6 }, apply: (s) => { s.rate *= 1.15; extraTarget(s, 1.2); } },
  { id: 'f-ion2', origin: 'ionia', category: 'Vitesse', name: "Masque de l'esprit", icon: '🎭', desc: "+30 % vitesse d'attaque, chaque coup : 2 % des PV max en dégâts bruts", price: 0,
    craft: { fleur: 90, soie: 22, esprit: 5 },
    apply: (s) => { s.rate *= 1.3; s.pctHp = s.pctHp ? { every: s.pctHp.every, pct: s.pctHp.pct + 0.02 } : { every: 1, pct: 0.02 }; } },
  { id: 'f-nexus', origin: 'all', category: 'Dégâts', name: 'Cœur du Nexus', icon: '💠', desc: "+70 % dégâts, +30 % vitesse d'attaque, +0,5 portée", price: 0,
    craft: { nexus: 3, ecaille: 3, buff: 3, plume: 3, glacevraie: 3, runenoire: 3, esprit: 3 },
    apply: (s) => { s.dmg *= 1.7; s.rate *= 1.3; s.range += 0.5; } },
];

/** One more target for single/multi/chain attacks; other attack types get a damage bonus instead. */
function extraTarget(s: Stats, elseDmg: number): void {
  if (s.type === 'single') { s.type = 'multi'; s.targets = 2; }
  else if (s.type === 'multi' || s.type === 'chain') s.targets += 1;
  else s.dmg *= elseDmg;
}

export const SHOP_ITEMS = ITEMS.filter((i) => !i.craft);
export const FORGE_ITEMS = ITEMS.filter((i) => i.craft);

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
