import type { ChampionDef, Stats } from '../types';

function base(s: Partial<Stats> & Pick<Stats, 'dmg' | 'range' | 'rate'>): Stats {
  return { type: 'single', splash: 0, targets: 1, ...s };
}

export const CHAMPIONS: ChampionDef[] = [
  // --- Starters ---
  {
    id: 'ashe', name: 'Ashe', title: "L'Archère de givre", role: 'Tireur', region: 'Freljord',
    color: '#7fc8f8', rarity: 1, starter: true,
    passive: 'Salve givrée : tire sur 3 cibles et les ralentit de 20 %.',
    base: base({ dmg: 10, rate: 1.1, range: 3.2, type: 'multi', targets: 3, slow: { pct: 0.2, dur: 1 } }),
    ult: {
      name: 'Flèche de cristal enchantée', desc: 'Ralentissement renforcé et chance d\'étourdir.',
      apply: (s, r) => { s.slow!.pct += 0.1 * r; s.stun = { chance: 0.08 * r, dur: 1.2 }; },
    },
    active: {
      name: 'Flèche de cristal enchantée', desc: 'Étourdit tous les ennemis 1,6 s et les ralentit de 40 %.', cd: 75,
      fx: { kind: 'control', slow: 0.4, slowDur: 3, stun: 1.6 },
    },
  },
  {
    id: 'lux', name: 'Lux', title: 'La Dame de lumière', role: 'Mage', region: 'Demacia',
    color: '#f9e27d', rarity: 1, starter: true,
    passive: 'Rayon traversant : touche tous les ennemis sur une ligne.',
    base: base({ dmg: 28, rate: 0.45, range: 4, type: 'pierce' }),
    ult: {
      name: 'Étincelle finale', desc: 'Rayon plus puissant et plus long.',
      apply: (s, r) => { s.dmg *= 1 + 0.35 * r; s.range += 0.5 * r; },
    },
    active: {
      name: 'Étincelle finale', desc: 'Déflagration de lumière sur le plus gros groupe d\'ennemis.', cd: 60,
      fx: { kind: 'burst', radius: 2.2, mult: 12 },
    },
  },
  {
    id: 'annie', name: 'Annie', title: "L'Enfant des ténèbres", role: 'Mage', region: 'Noxus',
    color: '#ff7a59', rarity: 1, starter: true,
    passive: 'Boule de feu : dégâts de zone.',
    base: base({ dmg: 12, rate: 0.8, range: 2.8, type: 'splash', splash: 1 }),
    ult: {
      name: 'Invocation : Tibbers', desc: 'Brûle les ennemis touchés, zone agrandie.',
      apply: (s, r) => { s.burn = { mult: 0.3 * r, dur: 3 }; s.splash += 0.3 * r; },
    },
    active: {
      name: 'Invocation : Tibbers', desc: 'Explosion de feu qui brûle le groupe ciblé.', cd: 55,
      fx: { kind: 'burst', radius: 2, mult: 9, burn: { mult: 0.5, dur: 4 } },
    },
  },

  // --- Chest pool ---
  {
    id: 'caitlyn', name: 'Caitlyn', title: 'Le Shérif de Piltover', role: 'Tireur', region: 'Piltover',
    color: '#b28dff', rarity: 2,
    passive: 'Tir dans la tête : tous les 6 tirs, dégâts x2,5.',
    base: base({ dmg: 46, rate: 0.6, range: 5.5, everyN: { n: 6, mult: 2.5 } }),
    ult: {
      name: 'Tir de précision', desc: 'Tirs dans la tête plus fréquents et plus forts.',
      apply: (s, r) => { s.everyN!.n = Math.max(3, 6 - r); s.everyN!.mult += 0.5 * r; },
    },
    active: {
      name: 'Tir de précision', desc: 'Tir massif sur l\'ennemi le plus coriace.', cd: 70,
      fx: { kind: 'execute', mult: 18, pct: 0.08 },
    },
  },
  {
    id: 'jinx', name: 'Jinx', title: 'La Gâchette folle', role: 'Tireur', region: 'Zaun',
    color: '#ff5fa2', rarity: 2,
    passive: 'Ratatatata ! : la vitesse d\'attaque augmente en tirant (jusqu\'à +45 %).',
    base: base({ dmg: 6, rate: 2.2, range: 3.2, ramp: { perHit: 0.04, max: 0.45 } }),
    ult: {
      name: 'Super méga roquette de la mort', desc: 'Les tirs deviennent des roquettes à zone.',
      apply: (s, r) => { s.type = 'splash'; s.splash = 0.7 + 0.2 * r; s.dmg *= 1 + 0.05 * r; },
    },
    active: {
      name: 'Super méga roquette de la mort', desc: 'Roquette géante : gros dégâts de zone.', cd: 70,
      fx: { kind: 'burst', radius: 2.5, mult: 14 },
    },
  },
  {
    id: 'teemo', name: 'Teemo', title: 'Le Scout rapide', role: 'Tireur', region: 'Bandle',
    color: '#8bd450', rarity: 1,
    passive: 'Fléchette toxique : empoisonne pendant 4 s.',
    base: base({ dmg: 5, rate: 1.3, range: 2.8, burn: { mult: 0.6, dur: 4 } }),
    ult: {
      name: 'Piège nocif', desc: 'Les fléchettes explosent en nuage de poison.',
      apply: (s, r) => { s.type = 'splash'; s.splash = 0.9; s.burn!.mult += 0.4 * r; },
    },
    active: {
      name: 'Piège nocif', desc: 'Nuage toxique : ralentit fortement une zone.', cd: 45,
      fx: { kind: 'control', radius: 2.5, slow: 0.5, slowDur: 4, mult: 5 },
    },
  },
  {
    id: 'tf', name: 'Twisted Fate', title: 'Le Maître des cartes', role: 'Mage', region: 'Bilgewater',
    color: '#e8b04a', rarity: 2,
    passive: 'Dés pipés : lance 3 cartes ; 25 % de chance de gagner de l\'or à chaque coup.',
    base: base({ dmg: 9, rate: 1, range: 3.2, type: 'multi', targets: 3, goldHit: { chance: 0.25, amount: 1 } }),
    ult: {
      name: 'Carte dorée', desc: 'Peut étourdir, plus d\'or par coup.',
      apply: (s, r) => { s.stun = { chance: 0.1 * r, dur: 1 }; s.goldHit!.chance += 0.1 * r; },
    },
    active: {
      name: 'Jackpot', desc: 'Gagne de l\'or immédiatement.', cd: 60,
      fx: { kind: 'gold', mult: 0.8 },
    },
  },
  {
    id: 'gangplank', name: 'Gangplank', title: 'Le Fléau des mers', role: 'Combattant', region: 'Bilgewater',
    color: '#d9534f', rarity: 2,
    passive: 'Baril de poudre : zone, +30 % d\'or sur les éliminations.',
    base: base({ dmg: 18, rate: 0.6, range: 3, type: 'splash', splash: 0.9, killGold: 0.3 }),
    ult: {
      name: 'Barrage de canon', desc: 'Plus d\'or et de dégâts.',
      apply: (s, r) => { s.killGold! += 0.25 * r; s.dmg *= 1 + 0.15 * r; },
    },
    active: {
      name: 'Barrage de canon', desc: 'Pluie de boulets sur un groupe d\'ennemis.', cd: 55,
      fx: { kind: 'burst', radius: 2.4, mult: 11 },
    },
  },
  {
    id: 'soraka', name: 'Soraka', title: "L'Enfant des étoiles", role: 'Support', region: 'Targon',
    color: '#a6f0c6', rarity: 1,
    passive: 'Prière : +1 vie à chaque vague terminée.',
    base: base({ dmg: 4, rate: 1, range: 3, livesPerWave: 1 }),
    ult: {
      name: 'Souhait', desc: '+1 vie par vague par rang.',
      apply: (s, r) => { s.livesPerWave! += r; },
    },
    active: {
      name: 'Souhait', desc: 'Restaure 3 vies.', cd: 80,
      fx: { kind: 'lives', n: 3 },
    },
  },
  {
    id: 'vayne', name: 'Vayne', title: 'La Chasseresse nocturne', role: 'Tireur', region: 'Demacia',
    color: '#9b6bd6', rarity: 3,
    passive: 'Coups d\'argent : tous les 3 coups, 4 % des PV max en dégâts bruts.',
    base: base({ dmg: 16, rate: 1.3, range: 3, pctHp: { every: 3, pct: 0.04 } }),
    ult: {
      name: 'Combat ultime', desc: 'Coups d\'argent renforcés, attaque plus vite.',
      apply: (s, r) => { s.pctHp!.pct += 0.02 * r; s.rate *= 1 + 0.15 * r; },
    },
    active: {
      name: 'Combat ultime', desc: 'Pendant 8 s : +35 % de vitesse d\'attaque, +30 % de dégâts.', cd: 60,
      fx: { kind: 'buff', scope: 'self', rate: 0.35, dmg: 0.3, dur: 8 },
    },
  },
  {
    id: 'ziggs', name: 'Ziggs', title: "L'Expert en hexplosifs", role: 'Mage', region: 'Zaun',
    color: '#ffb347', rarity: 2,
    passive: 'Bombe rebondissante : grosse zone, ralentit.',
    base: base({ dmg: 30, rate: 0.35, range: 4, type: 'splash', splash: 1.4, slow: { pct: 0.15, dur: 1 } }),
    ult: {
      name: 'Méga bombe infernale', desc: 'Zone et dégâts énormes.',
      apply: (s, r) => { s.splash += 0.4 * r; s.dmg *= 1 + 0.3 * r; },
    },
    active: {
      name: 'Méga bombe infernale', desc: 'Bombe colossale sur un groupe d\'ennemis.', cd: 70,
      fx: { kind: 'burst', radius: 3, mult: 16 },
    },
  },
  {
    id: 'kogmaw', name: "Kog'Maw", title: 'La Gueule des abysses', role: 'Tireur', region: 'Néant',
    color: '#b5d84a', rarity: 2,
    passive: 'Barrage bio-arcanique : vitesse d\'attaque qui monte jusqu\'à +80 %.',
    base: base({ dmg: 7, rate: 1.6, range: 3.2, ramp: { perHit: 0.03, max: 0.8 } }),
    ult: {
      name: 'Artillerie vivante', desc: 'Portée accrue, dégâts en % des PV max.',
      apply: (s, r) => { s.range += r; s.pctHp = { every: 4, pct: 0.02 * r }; },
    },
    active: {
      name: 'Artillerie vivante', desc: 'Pendant 8 s : +50 % de vitesse d\'attaque, +20 % de dégâts.', cd: 55,
      fx: { kind: 'buff', scope: 'self', rate: 0.5, dmg: 0.2, dur: 8 },
    },
  },
  {
    id: 'yasuo', name: 'Yasuo', title: "L'Implacable", role: 'Combattant', region: 'Ionia',
    color: '#5fa8d3', rarity: 3,
    passive: 'Voie du vagabond : 50 % de chance de coup critique.',
    base: base({ dmg: 19, rate: 1.35, range: 2.4, crit: { chance: 0.5, mult: 2 } }),
    ult: {
      name: 'Dernier souffle', desc: 'Critiques plus forts, peut projeter (étourdir).',
      apply: (s, r) => { s.crit!.mult += 0.3 * r; s.stun = { chance: 0.05 * r, dur: 1 }; },
    },
    active: {
      name: 'Dernier souffle', desc: 'Projette et étourdit les ennemis d\'un groupe 1,5 s.', cd: 40,
      fx: { kind: 'control', radius: 2, stun: 1.5, mult: 6 },
    },
  },
  {
    id: 'heimer', name: 'Heimerdinger', title: "L'Inventeur révéré", role: 'Mage', region: 'Piltover',
    color: '#f4d35e', rarity: 2,
    passive: 'Tourelles H-28G : attaque 3 cibles à la fois.',
    base: base({ dmg: 9.5, rate: 1, range: 3, type: 'multi', targets: 3 }),
    ult: {
      name: 'AMÉLIORATION !!!', desc: '+1 cible par rang, plus de dégâts.',
      apply: (s, r) => { s.targets += r; s.dmg *= 1 + 0.1 * r; },
    },
    active: {
      name: 'AMÉLIORATION !!!', desc: 'Alliés proches : +25 % de vitesse d\'attaque pendant 8 s.', cd: 50,
      fx: { kind: 'buff', scope: 'near', radius: 3, rate: 0.25, dur: 8 },
    },
  },
  {
    id: 'brand', name: 'Brand', title: 'La Vengeance flamboyante', role: 'Mage', region: 'Runeterra',
    color: '#ff8c42', rarity: 2,
    passive: 'Embrasement : rebondit sur 4 ennemis et les brûle.',
    base: base({ dmg: 12, rate: 0.7, range: 3.2, type: 'chain', targets: 4, burn: { mult: 0.25, dur: 3 } }),
    ult: {
      name: 'Pyrolyse', desc: 'Plus de rebonds, brûlure renforcée.',
      apply: (s, r) => { s.targets += r; s.burn!.mult += 0.15 * r; },
    },
    active: {
      name: 'Pyrolyse', desc: 'Déflagration qui embrase un groupe d\'ennemis.', cd: 50,
      fx: { kind: 'burst', radius: 2.2, mult: 10, burn: { mult: 0.6, dur: 4 } },
    },
  },
  {
    id: 'morgana', name: 'Morgana', title: "L'Ange déchu", role: 'Support', region: 'Demacia',
    color: '#8e7cc3', rarity: 1,
    passive: 'Entrave noire : 12 % de chance d\'immobiliser.',
    base: base({ dmg: 9, rate: 0.9, range: 3.3, stun: { chance: 0.12, dur: 1.2 } }),
    ult: {
      name: "Chaînes de l'âme", desc: 'Plus d\'immobilisations, frappe plusieurs cibles.',
      apply: (s, r) => { s.stun!.chance += 0.06 * r; s.type = 'multi'; s.targets = 1 + r; },
    },
    active: {
      name: 'Chaînes de l\'âme', desc: 'Immobilise 2 s et ralentit un large groupe.', cd: 60,
      fx: { kind: 'control', radius: 3, slow: 0.3, slowDur: 3, stun: 2, mult: 4 },
    },
  },
  {
    id: 'zed', name: 'Zed', title: 'Le Maître des ombres', role: 'Assassin', region: 'Ionia',
    color: '#c0392b', rarity: 3,
    passive: 'Ombre vivante : frappe 2 cibles ; tous les 3 coups, dégâts x2.',
    base: base({ dmg: 30, rate: 1, range: 2.4, type: 'multi', targets: 2, everyN: { n: 3, mult: 2 } }),
    ult: {
      name: 'Marque de la mort', desc: 'Coups spéciaux plus forts, bonus contre les boss.',
      apply: (s, r) => { s.everyN!.mult += 0.5 * r; s.bossMult = 1 + 0.25 * r; },
    },
    active: {
      name: 'Marque de la mort', desc: 'Marque et exécute l\'ennemi le plus coriace.', cd: 55,
      fx: { kind: 'execute', mult: 20, pct: 0.12 },
    },
  },

  // --- Map rewards ---
  {
    id: 'missfortune', name: 'Miss Fortune', title: 'La Chasseuse de primes', role: 'Tireur', region: 'Bilgewater',
    color: '#e74c3c', rarity: 2, reward: 'botlane',
    passive: 'Doublé : tire sur 2 cibles.',
    base: base({ dmg: 14, rate: 1.1, range: 3.2, type: 'multi', targets: 2 }),
    ult: {
      name: 'Pluie de balles', desc: '+1 cible par rang.',
      apply: (s, r) => { s.targets += r; s.dmg *= 1 + 0.1 * r; },
    },
    active: {
      name: 'Pluie de balles', desc: 'Déluge de balles sur une grande zone.', cd: 45,
      fx: { kind: 'burst', radius: 3, mult: 8 },
    },
  },
  {
    id: 'nasus', name: 'Nasus', title: 'Le Gardien des sables', role: 'Combattant', region: 'Shurima',
    color: '#c9a227', rarity: 3, reward: 'jungle',
    passive: 'Frappe siphonnante : chaque élimination augmente ses dégâts pendant la partie (gain de plus en plus lent).',
    base: base({ dmg: 38, rate: 1, range: 2.2, killStack: { amount: 0.6, sqrt: true } }),
    ult: {
      name: 'Fureur des sables', desc: 'Accumule plus vite, portée accrue.',
      apply: (s, r) => { s.killStack!.amount += 0.1 * r; s.range += 0.3 * r; },
    },
    active: {
      name: 'Fureur des sables', desc: 'Pendant 10 s : +50 % de dégâts, +10 % de vitesse d\'attaque.', cd: 60,
      fx: { kind: 'buff', scope: 'self', rate: 0.1, dmg: 0.5, dur: 10 },
    },
  },
  {
    id: 'veigar', name: 'Veigar', title: 'Le Petit Maître du mal', role: 'Mage', region: 'Bandle',
    color: '#6c5ce7', rarity: 3, reward: 'aram',
    passive: 'Puissance phénoménale : +3 % de dégâts par élimination (pendant la partie). x1,5 contre les boss.',
    base: base({ dmg: 20, rate: 0.85, range: 3.2, killStack: { amount: 0.03 }, bossMult: 1.5 }),
    ult: {
      name: 'Big Bang', desc: 'Dégâts contre les boss renforcés.',
      apply: (s, r) => { s.bossMult! += 0.5 * r; },
    },
    active: {
      name: 'Big Bang', desc: 'Exécution : dégâts énormes sur l\'ennemi le plus coriace.', cd: 80,
      fx: { kind: 'execute', mult: 25, pct: 0.15 },
    },
  },
  {
    id: 'anivia', name: 'Anivia', title: 'Le Cryophénix', role: 'Mage', region: 'Freljord',
    color: '#9ad1f5', rarity: 3, reward: 'freljord',
    passive: 'Aura de givre : blesse et ralentit tout dans sa zone.',
    base: base({ dmg: 10, rate: 1, range: 2.4, type: 'aura', slow: { pct: 0.3, dur: 0.6 } }),
    ult: {
      name: 'Tempête glaciale', desc: 'Aura plus large, plus froide, plus forte.',
      apply: (s, r) => { s.slow!.pct += 0.1 * r; s.dmg *= 1 + 0.4 * r; s.range += 0.3 * r; },
    },
    active: {
      name: 'Tempête glaciale', desc: 'Blizzard : ralentit de 60 % et blesse un groupe.', cd: 60,
      fx: { kind: 'control', radius: 3.2, slow: 0.6, slowDur: 5, mult: 8 },
    },
  },
  {
    id: 'malzahar', name: 'Malzahar', title: 'Le Prophète du Néant', role: 'Mage', region: 'Néant',
    color: '#a55eea', rarity: 3,
    passive: 'Visions malveillantes : infecte 2 cibles, gros dégâts sur la durée.',
    base: base({ dmg: 6, rate: 0.6, range: 3.4, type: 'multi', targets: 2, burn: { mult: 1, dur: 5 } }),
    ult: {
      name: 'Emprise du Néant', desc: 'Infection plus forte, +1 cible.',
      apply: (s, r) => { s.burn!.mult += 0.5 * r; s.targets += 1; },
    },
    active: {
      name: 'Emprise du Néant', desc: 'Infection violente d\'un groupe d\'ennemis.', cd: 50,
      fx: { kind: 'burst', radius: 1.8, mult: 8, burn: { mult: 1, dur: 5 } },
    },
  },
  {
    id: 'garen', name: 'Garen', title: 'La Force de Demacia', role: 'Combattant', region: 'Demacia',
    color: '#4a7fd4', rarity: 3, reward: 'demacia',
    passive: 'Jugement : tournoie et frappe tous les ennemis autour de lui.',
    base: base({ dmg: 15, rate: 1.2, range: 2.1, type: 'aura' }),
    ult: {
      name: 'Justice de Demacia', desc: 'Dégâts accrus, bonus contre les boss.',
      apply: (s, r) => { s.dmg *= 1 + 0.2 * r; s.bossMult = 1 + 0.5 * r; },
    },
    active: {
      name: 'Justice de Demacia', desc: 'Toute l\'équipe : +20 % de dégâts pendant 8 s.', cd: 70,
      fx: { kind: 'buff', scope: 'team', dmg: 0.2, dur: 8 },
    },
  },
  {
    id: 'darius', name: 'Darius', title: 'La Main de Noxus', role: 'Combattant', region: 'Noxus',
    color: '#b3283a', rarity: 3, reward: 'noxus',
    passive: 'Hémorragie : fait saigner ses cibles pendant 5 s.',
    base: base({ dmg: 27, rate: 0.9, range: 2.4, burn: { mult: 0.6, dur: 5 } }),
    ult: {
      name: 'Guillotine noxienne', desc: 'Exécutions régulières aux dégâts massifs.',
      apply: (s, r) => { s.everyN = { n: Math.max(2, 5 - r), mult: 2 + r }; },
    },
    active: {
      name: 'Guillotine noxienne', desc: 'Exécute l\'ennemi le plus coriace.', cd: 45,
      fx: { kind: 'execute', mult: 18, pct: 0.1 },
    },
  },
  {
    id: 'ahri', name: 'Ahri', title: 'Le Renard à neuf queues', role: 'Mage', region: 'Ionia',
    color: '#e86fb0', rarity: 3, reward: 'ionia',
    passive: "Orbe d'illusion : rebondit sur 3 ennemis. Charme : 10 % de chance d'étourdir.",
    base: base({ dmg: 23, rate: 0.85, range: 3.4, type: 'chain', targets: 3, stun: { chance: 0.1, dur: 0.6 } }),
    ult: {
      name: 'Ruée spirituelle', desc: 'Plus de rebonds, attaque plus vite.',
      apply: (s, r) => { s.targets += r; s.rate *= 1 + 0.15 * r; },
    },
    active: {
      name: 'Ruée spirituelle', desc: 'Vague d\'esprits sur un groupe d\'ennemis.', cd: 45,
      fx: { kind: 'burst', radius: 2.2, mult: 9 },
    },
  },
  {
    // Endless-mode exclusive: very strong area damage and control, built to carry a team rather than replace it
    id: 'lillia', name: 'Lillia', title: 'La Fleur timide', role: 'Mage', region: 'Ionia',
    color: '#b48be0', rarity: 3, endless: true,
    passive: 'Bâton chargé de rêves : frappe tout autour d\'elle, embrase les rêves (brûlure) et ronge 1,5 % des PV max tous les 3 coups.',
    base: base({ dmg: 15, rate: 1.3, range: 2.7, type: 'aura', burn: { mult: 0.6, dur: 3 }, pctHp: { every: 3, pct: 0.015 } }),
    ult: {
      name: 'Coups fleuris', desc: 'Zone plus large, brûlure plus forte, attaque plus vite.',
      apply: (s, r) => { s.range += 0.25 * r; s.burn!.mult += 0.15 * r; s.rate *= 1 + 0.08 * r; },
    },
    active: {
      name: 'Berceuse', desc: 'Endort tous les ennemis 2,5 s, puis les ralentit de 50 %.', cd: 60,
      fx: { kind: 'control', stun: 2.5, slow: 0.5, slowDur: 5, mult: 4 },
    },
  },
  {
    id: 'jayce', name: 'Jayce', title: 'Le Défenseur de demain', role: 'Tireur', region: 'Piltover',
    color: '#3fa3e0', rarity: 3,
    passive: 'Canon Mercure : tous les 4 tirs, dégâts doublés.',
    base: base({ dmg: 20, rate: 0.9, range: 4, everyN: { n: 4, mult: 2 } }),
    ult: {
      name: 'Transformation', desc: 'Les tirs explosent en zone.',
      apply: (s, r) => { s.type = 'splash'; s.splash = 0.8 + 0.2 * r; s.dmg *= 1 + 0.15 * r; },
    },
    active: {
      name: 'Transformation', desc: 'Forme Canon pendant 8 s : +20 % de vitesse, +35 % de dégâts.', cd: 55,
      fx: { kind: 'buff', scope: 'self', rate: 0.2, dmg: 0.35, dur: 8 },
    },
  },
];

export const CHAMP_BY_ID: Record<string, ChampionDef> = Object.fromEntries(CHAMPIONS.map((c) => [c.id, c]));
