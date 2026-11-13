import type { MapDef, MapStyle } from '../types';
import { generateMap } from './mapgen';

export const COLS = 20;
export const ROWS = 12;

/** Hand-authored maps (some are kept for later region updates). */
const HAND: MapDef[] = [
  {
    id: 'botlane', name: 'Voie du Bas', subtitle: 'Faille de l\'invocateur', unlock: 0, mult: 1.5, waves: 50,
    path: [[-1, 2], [15, 2], [15, 5], [4, 5], [4, 9], [18, 9]],
    theme: { style: 'rift', grass: '#2f5d3a', grass2: '#346642', path: '#9c8a6a', pathEdge: '#7a6a50', decor: '#25492e', accent: '#4aa3ff' },
    terrain: [
      'TTTTTTTTTTTTTTTTTTTT',
      'T.......s~~s.......T',
      '.........~~........T',
      'T.R..,,,s~~s.R..TTTT',
      'T.......s~~s.......T',
      'T........~~........T',
      'TTT...HHH~~sHH.TTTTT',
      'TTT...HHH~~sHH.TTTTT',
      'T.......s~~s.......T',
      'T........~~........T',
      'T.....,,s~~s.......T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    landmarks: [{ kind: 'inhibitor', x: 17, y: 8, w: 1, h: 1 }, { kind: 'fountain', x: 1, y: 9, w: 2, h: 2 }],
    features: [{ kind: 'brush', c: 1, r: 3 }, { kind: 'brush', c: 12, r: 10, w: 3 }, { kind: 'turret', c: 16, r: 10 }, { kind: 'turret', c: 12, r: 4 }],
    finalBoss: 'riftherald',
  },
  {
    id: 'jungle', name: 'Jungle', subtitle: 'Faille de l\'invocateur', unlock: 3, mult: 10, waves: 50,
    path: [[-1, 5], [3, 5], [3, 1], [8, 1], [8, 10], [13, 10], [13, 3], [17, 3], [17, 8], [18, 8]],
    theme: { style: 'jungle', grass: '#244a33', grass2: '#295239', path: '#7d6b4f', pathEdge: '#5e503a', decor: '#1b3826', accent: '#a55eea' },
    terrain: [
      'TTTTTTTTTTTTTTTTTTTT',
      'T.........TT..R....T',
      'TR........TT.......T',
      'T....TT...TT.......T',
      'T....TT...,,.......T',
      '.....TT..ssss..T...T',
      'T....TT..~~~~..T...T',
      'TTT......~~~~..T...T',
      'TTT.HHH..ssss..T...T',
      'TTT.HHH............T',
      'T..................T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    landmarks: [{ kind: 'baronpit', x: 10, y: 4, w: 2, h: 2 }, { kind: 'camp', x: 16, y: 9, w: 2, h: 2 }, { kind: 'camp', x: 1, y: 1, w: 2, h: 1 }],
    features: [{ kind: 'blue', c: 4, r: 3 }, { kind: 'red', c: 14, r: 6 }, { kind: 'brush', c: 9, r: 9, w: 3 }, { kind: 'brush', c: 1, r: 3 }],
    finalBoss: 'baron',
  },
  {
    id: 'aram', name: 'Abîme Hurlant', subtitle: 'Une seule voie sur le pont', unlock: 7, mult: 90, waves: 50,
    path: [[-1, 2], [17, 2], [17, 5], [2, 5], [2, 9], [18, 9]],
    theme: { style: 'bridge', grass: '#1b2433', grass2: '#202b3d', path: '#8a6a48', pathEdge: '#5a432c', decor: '#2c3a52', accent: '#5dade2' },
    terrain: [
      'ssssssssssssssssssss',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~HHHHHHHHHHHHHH~~~',
      '~~~HHHHHHHHHHHHHH~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~HHHHHHHHHHHHHH~~~',
      '~~~HHHHHHHHHHHHHH~~~',
      '~~~HHHHHHHHHHHHHH~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~HHHHHHHHHHHHHH~~~',
      'ssssssssssssssssssss',
    ],
    landmarks: [{ kind: 'statue', x: 8, y: 3, w: 1, h: 2 }, { kind: 'statue', x: 11, y: 7, w: 1, h: 2 }, { kind: 'fountain', x: 0, y: 9, w: 1, h: 2 }],
    features: [{ kind: 'turret', c: 5, r: 3 }, { kind: 'turret', c: 13, r: 7 }, { kind: 'turret', c: 9, r: 10 }],
    finalBoss: 'poroking',
  },
  {
    id: 'demacia', name: 'Demacia', subtitle: 'Les remparts de la Cité blanche', unlock: 11, mult: 700, waves: 50,
    path: [[-1, 1], [18, 1], [18, 10], [1, 10], [1, 3], [15, 3], [15, 8], [4, 8], [4, 5], [10, 5]],
    theme: { style: 'demacia', grass: '#6fae5a', grass2: '#7aba64', path: '#cfd3da', pathEdge: '#8d94a0', decor: '#5e9a4c', accent: '#f5d76e' },
    terrain: [
      'TTTTTTTTTTTTTTTTTTTT',
      '...................T',
      'T.,,,,,.R.......T..T',
      'T...............T..T',
      'T.T.............T..T',
      'T.T.............T..T',
      'T.T...HHHHHHHH..T..T',
      'T.T.............T..T',
      'T.T.............T..T',
      'T....,,,,,,.R......T',
      'T..................T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    landmarks: [{ kind: 'citadel', x: 11, y: 4, w: 3, h: 2 }, { kind: 'statue', x: 5, y: 6, w: 1, h: 2 }],
    features: [{ kind: 'blue', c: 6, r: 7 }, { kind: 'red', c: 13, r: 7 }, { kind: 'brush', c: 3, r: 9, w: 2 }, { kind: 'turret', c: 14, r: 4 }, { kind: 'turret', c: 11, r: 6 }],
    finalBoss: 'petricite',
  },
  {
    id: 'freljord', name: 'Freljord', subtitle: 'Toundra gelée', unlock: 15, mult: 550, waves: 50,
    path: [[-1, 6], [3, 6], [3, 1], [16, 1], [16, 10], [5, 10], [5, 8], [12, 8], [12, 6]],
    theme: { style: 'tundra', grass: '#e9f3f8', grass2: '#deedf5', path: '#8fb3c9', pathEdge: '#6f93a9', decor: '#c6dce8', accent: '#3498db' },
    terrain: [
      'TTTTTTTTTTTTTTTTTTTT',
      'T..................T',
      'TH....ssssssss.....T',
      'TH...s~~~~~~~~s..HHT',
      'TH...s~~~~~~~~s..HHT',
      'T....s~~~~~~~~s..HHT',
      '......ssssss.sR..HHT',
      'T................HHT',
      'TTTT...............T',
      'TTTT....R..........T',
      'TTTT...............T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    landmarks: [{ kind: 'waterfall', x: 17, y: 1, w: 2, h: 2 }, { kind: 'camp', x: 17, y: 9, w: 2, h: 2 }],
    features: [{ kind: 'blue', c: 18, r: 8 }, { kind: 'red', c: 4, r: 3 }, { kind: 'turret', c: 14, r: 9 }, { kind: 'turret', c: 9, r: 7 }],
    finalBoss: 'colossus',
  },
  {
    id: 'noxus', name: 'Noxus', subtitle: 'L\'arène de l\'Empire', unlock: 19, mult: 200, waves: 50,
    path: [[-1, 2], [11, 2], [11, 5], [17, 5]],
    lanes: [[[-1, 9], [11, 9], [11, 5], [17, 5]]],
    theme: { style: 'noxus', grass: '#6b4a42', grass2: '#74514a', path: '#5a5560', pathEdge: '#3a353f', decor: '#5a3a34', accent: '#e84057' },
    terrain: [
      'TTTTTTTTTTTTTTTTTTTT',
      'T.................TT',
      '.............HHH..TT',
      'T............HHH..TT',
      'T.RR...............T',
      'T..................T',
      'TT.................T',
      'TT....R......HHH...T',
      'T............HHH...T',
      '...................T',
      'T..................T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    landmarks: [{ kind: 'arena', x: 4, y: 5, w: 3, h: 2 }, { kind: 'fortress', x: 17, y: 6, w: 2, h: 3 }],
    features: [{ kind: 'red', c: 8, r: 4 }, { kind: 'blue', c: 8, r: 7 }, { kind: 'turret', c: 16, r: 3 }, { kind: 'turret', c: 16, r: 7 }, { kind: 'brush', c: 3, r: 3, w: 2 }, { kind: 'brush', c: 3, r: 10, w: 3 }],
    finalBoss: 'warbeast',
  },
  {
    id: 'ionia', name: 'Ionia', subtitle: 'Le sanctuaire des esprits', unlock: 23, mult: 450, waves: 50,
    path: [[2, -1], [2, 4], [9, 4], [9, 1], [16, 1], [16, 7], [6, 7], [6, 10], [17, 10]],
    theme: { style: 'ionia', grass: '#7fbf6a', grass2: '#8ac874', path: '#c9a87a', pathEdge: '#8a6a48', decor: '#6aa858', accent: '#ff9ed2' },
    terrain: [
      'TT.TTTTTTTTTTTTTTTTT',
      'T...,,,,...........T',
      'T...,,,,...HHHH...TT',
      'T..........HHHH...TT',
      'Ts........ssssss.sTT',
      '~~~~~~~~~~~~~~~~~~T~',
      'Tsssssssssssssss.sTT',
      'T..................T',
      'TTTTT...,,,,,,.....T',
      'TTTTT..............T',
      'T..................T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    landmarks: [{ kind: 'shrine', x: 12, y: 2, w: 2, h: 2 }, { kind: 'shrine', x: 1, y: 2, w: 1, h: 1 }],
    features: [{ kind: 'blue', c: 12, r: 8 }, { kind: 'red', c: 3, r: 2 }, { kind: 'brush', c: 10, r: 6, w: 3 }],
    finalBoss: 'spiritguard',
  },
  {
    id: 'shurima', name: 'Shurima', subtitle: 'Désert de l\'empereur', unlock: 27, mult: 650, waves: 50,
    path: [[10, -1], [10, 2], [3, 2], [3, 9], [15, 9], [15, 4], [12, 4], [12, 6]],
    theme: { style: 'desert', grass: '#d9b779', grass2: '#d2af70', path: '#a8834a', pathEdge: '#8a6a38', decor: '#c39f60', accent: '#f1c40f' },
    terrain: [
      'TTTTTTTTTT.TTTTTTTTT',
      'T..................T',
      'T................HHT',
      'T................HHT',
      'T.....sss........HHT',
      'TR...s~~~s.......HHT',
      'T....s~~~s.........T',
      'T.....sss..........T',
      'T................R.T',
      'T..................T',
      'T............R.....T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    landmarks: [{ kind: 'pyramid', x: 4, y: 3, w: 3, h: 2 }, { kind: 'sundisc', x: 13, y: 1, w: 3, h: 2 }],
    features: [{ kind: 'blue', c: 5, r: 7 }, { kind: 'red', c: 13, r: 7 }, { kind: 'turret', c: 10, r: 7 }, { kind: 'turret', c: 17, r: 7 }],
    finalBoss: 'sentinel',
  },
  {
    id: 'piltover', name: 'Piltover', subtitle: 'La Cité du progrès', unlock: 31, mult: 1000, waves: 50,
    path: [[-1, 6], [3, 6], [3, 1], [9, 1], [9, 10], [15, 10], [15, 4], [18, 4]],
    theme: { style: 'piltover', grass: '#b8a88a', grass2: '#c2b294', path: '#8a8f98', pathEdge: '#5a5f68', decor: '#a8987a', accent: '#3fe0d0' },
    terrain: [
      'TTTTTTTTTTTTTTTTTTTT',
      'T..................T',
      'T..........HHH.....T',
      'T..........HHH.....T',
      'T..................T',
      'T..................T',
      '...................T',
      'Tssssssss.sssss..R.T',
      '~~~~~~~~~.~~~~~....T',
      'Tssssssss.sssss....T',
      'T..................T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    landmarks: [{ kind: 'hexgate', x: 5, y: 5, w: 2, h: 2 }, { kind: 'workshop', x: 10, y: 1, w: 2, h: 1 }, { kind: 'workshop', x: 16, y: 1, w: 2, h: 2 }],
    features: [{ kind: 'turret', c: 6, r: 4 }, { kind: 'turret', c: 12, r: 6 }, { kind: 'turret', c: 17, r: 6 }, { kind: 'blue', c: 5, r: 2 }, { kind: 'red', c: 12, r: 4 }],
    finalBoss: 'automaton',
  },
  {
    id: 'shadowisles', name: 'Îles Obscures', subtitle: 'La Brume noire', unlock: 35, mult: 80, waves: 50,
    path: [[-1, 10], [4, 10], [4, 2], [9, 2], [9, 9], [14, 9], [14, 2], [18, 2]],
    lanes: [[[-1, 0], [9, 0], [9, 2]]],
    theme: { style: 'haunted', grass: '#1f2d2b', grass2: '#22332f', path: '#4a5a55', pathEdge: '#36433f', decor: '#172320', accent: '#1abc9c' },
    terrain: [
      '..........TTTTTTTTTT',
      'T..................T',
      'TTT................T',
      'TTT........ss......T',
      'TTT...HH..s~~s..TTTT',
      'TTT...HH..s~~s..TTTT',
      'TTT...HH..s~~s.....T',
      'TTT........ss......T',
      'T..................T',
      'T.....R............T',
      '...................T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    landmarks: [{ kind: 'ruins', x: 10, y: 1, w: 3, h: 2 }, { kind: 'graves', x: 16, y: 9, w: 3, h: 2 }],
    features: [{ kind: 'brush', c: 5, r: 8, h: 2 }, { kind: 'red', c: 7, r: 7 }, { kind: 'blue', c: 12, r: 8 }, { kind: 'brush', c: 15, r: 7, w: 3 }],
    finalBoss: 'fallenking',
  },
];

const hand = (id: string, region: string, waves: number): MapDef => ({ ...HAND.find((m) => m.id === id)!, region, waves });
const theme = (id: string) => HAND.find((m) => m.id === id)!.theme;

/** Bosses rotated through on generated maps (finals keep their own). */
const BOSS_POOL = ['riftherald', 'poroking', 'colossus', 'petricite', 'baron', 'warbeast', 'spiritguard', 'sentinel', 'automaton', 'fallenking'];

/** Bosses that guard each region's regular maps (the arena keeps its own). */
const REGION_BOSSES: Record<string, string[]> = {
  rift: ['riftherald', 'baron'],
  demacia: ['petricite'],
  freljord: ['colossus', 'poroking'],
  noxus: ['warbeast'],
  ionia: ['spiritguard'],
};

interface RegionPlan {
  id: string;
  style: MapStyle;
  theme: string;
  subtitle: string;
  /** Map names in order; a string entry starting with '@' is a hand-authored map id. */
  maps: string[];
}

/** Regions ("cities"): the first has 5 maps, each next one has one more. The last map is the region's arena. */
const REGION_PLANS: RegionPlan[] = [
  { id: 'rift', style: 'rift', theme: 'botlane', subtitle: 'Faille de l\'invocateur', maps: ['@botlane', 'Voie du Haut', 'Voie du Milieu', 'Rivière de la Faille', '@jungle'] },
  { id: 'demacia', style: 'demacia', theme: 'demacia', subtitle: 'Demacia', maps: ['Champs dorés', 'Forêt de pétricite', 'Remparts de l\'Ouest', 'Village fortifié', 'Pont du Roi', '@demacia'] },
  { id: 'freljord', style: 'tundra', theme: 'freljord', subtitle: 'Freljord', maps: ['Plaine gelée', 'Col des glaces', 'Forêt de pins', '@aram', 'Village des glaces', 'Lac de givre', '@freljord'] },
  { id: 'noxus', style: 'noxus', theme: 'noxus', subtitle: 'Noxus', maps: ['Routes impériales', 'Mines de fer', 'Camp militaire', 'Faille rouge', 'Remparts noxiens', 'Marché de Noxus', 'Bastion immortel', '@noxus'] },
  { id: 'ionia', style: 'ionia', theme: 'ionia', subtitle: 'Ionia', maps: ['Jardins sacrés', 'Pont des esprits', 'Forêt de bambous', 'Monastère', 'Rizières', 'Lac aux lanternes', 'Village des cerisiers', 'Falaises du vent', '@ionia'] },
];

/** Waves on regular maps; region arenas (last map) have FINAL_WAVES. */
const WAVES = 30;
const FINAL_WAVES = 40;

/** Difficulty multiplier by global map index (tuned with scripts/sim.ts). */
export const MAP_CURVE = { base: 1.5, growth: 1.25 };

function buildMaps(): MapDef[] {
  const out: MapDef[] = [];
  let seed = 11;
  for (const plan of REGION_PLANS) {
    plan.maps.forEach((entry, i) => {
      const final = i === plan.maps.length - 1;
      const waves = final ? FINAL_WAVES : WAVES;
      if (entry.startsWith('@')) {
        out.push(hand(entry.slice(1), plan.id, waves));
        return;
      }
      out.push(generateMap({
        id: `${plan.id}-${i + 1}`, name: entry, subtitle: plan.subtitle, region: plan.id, style: plan.style,
        theme: { ...theme(plan.theme), style: plan.style }, waves, finalBoss: (REGION_BOSSES[plan.id] ?? BOSS_POOL)[i % (REGION_BOSSES[plan.id] ?? BOSS_POOL).length], seed: seed++,
      }));
    });
  }
  return out;
}

export const MAPS: MapDef[] = buildMaps();

/** Applies the difficulty curve (also used by the balance bot to try other curves). */
export function applyCurve(): void {
  MAPS.forEach((m, i) => { m.mult = MAP_CURVE.base * MAP_CURVE.growth ** i * laneFactor(m); });
}

/**
 * Short lanes and split lanes give towers less time per enemy, so those maps get a lower
 * multiplier; long single lanes get a higher one. Keeps generated maps on the same curve.
 */
function laneFactor(m: MapDef): number {
  const lanes = [m.path, ...(m.lanes ?? [])];
  const lengths = lanes.map((p) => p.slice(1).reduce((n, [c, r], k) => n + Math.abs(c - p[k][0]) + Math.abs(r - p[k][1]), 0));
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  return Math.min(1.6, Math.max(0.3, (avg / 45) ** 1.5 / Math.sqrt(lanes.length)));
}
applyCurve();

export const REGION_IDS = REGION_PLANS.map((p) => p.id);

export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));
