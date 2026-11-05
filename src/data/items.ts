import type { ItemDef } from '../types';

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
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
