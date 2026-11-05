import type { MapDef } from '../types';

export const COLS = 20;
export const ROWS = 12;

export const MAPS: MapDef[] = [
  {
    id: 'botlane', name: 'Voie du Bas', subtitle: 'Faille de l\'invocateur', unlock: 0, mult: 1.5, waves: 50,
    path: [[-1, 2.5], [6, 1.5], [11, 3], [12.5, 6], [8, 7.5], [4, 9], [8, 10.5], [14, 9.5], [17, 7.5], [18.5, 8]],
    theme: { style: 'rift', grass: '#2f5d3a', grass2: '#346642', path: '#9c8a6a', pathEdge: '#7a6a50', decor: '#25492e', accent: '#4aa3ff' },
    features: [{ kind: 'river', c: 9, r: 0, h: 12 }, { kind: 'dragon', c: 14, r: 4, w: 2, h: 2 }, { kind: 'brush', c: 1, r: 5, w: 3, h: 2 }, { kind: 'turret', c: 17, r: 10 }, { kind: 'turret', c: 16, r: 5 }],
    finalBoss: 'riftherald',
  },
  {
    id: 'jungle', name: 'Jungle', subtitle: 'Faille de l\'invocateur', unlock: 3, mult: 8, waves: 50,
    path: [[-1, 6], [3, 4], [5, 1.5], [9, 2], [10, 5.5], [7, 8.5], [10, 10.5], [14, 9], [14.5, 5.5], [17, 2.5], [18.5, 6], [17.5, 9.5]],
    theme: { style: 'jungle', grass: '#244a33', grass2: '#295239', path: '#7d6b4f', pathEdge: '#5e503a', decor: '#1b3826', accent: '#a55eea' },
    features: [{ kind: 'river', c: 0, r: 6, w: 20 }, { kind: 'blue', c: 4, r: 8 }, { kind: 'red', c: 16, r: 8 }, { kind: 'dragon', c: 11, r: 7, w: 2, h: 2 }, { kind: 'brush', c: 5, r: 3, w: 3 }, { kind: 'brush', c: 1, r: 8, w: 2 }],
    finalBoss: 'baron',
  },
  {
    id: 'aram', name: 'Abîme Hurlant', subtitle: 'Une seule voie sur le pont', unlock: 7, mult: 45, waves: 50,
    path: [[-1, 2], [8, 1.2], [17, 2.5], [17.5, 5.5], [10, 6], [2.5, 6.8], [2.5, 9.6], [10, 10.6], [18.5, 9.5]],
    theme: { style: 'bridge', grass: '#1b2433', grass2: '#202b3d', path: '#8a6a48', pathEdge: '#5a432c', decor: '#2c3a52', accent: '#5dade2' },
    features: [{ kind: 'turret', c: 5, r: 4 }, { kind: 'turret', c: 12, r: 8 }, { kind: 'turret', c: 8, r: 3 }],
    finalBoss: 'poroking',
  },
  {
    id: 'demacia', name: 'Demacia', subtitle: 'Les remparts de la Cité blanche', unlock: 11, mult: 180, waves: 50,
    path: [[-1, 1], [17, 0.8], [18.6, 5], [17, 10.4], [3, 10.6], [1.2, 6], [4, 3.2], [13, 3.2], [15.2, 6.5], [12.5, 8.3], [7, 8.2], [6, 6], [9.5, 5.6]],
    theme: { style: 'demacia', grass: '#6fae5a', grass2: '#7aba64', path: '#cfd3da', pathEdge: '#8d94a0', decor: '#5e9a4c', accent: '#f5d76e' },
    features: [{ kind: 'blue', c: 8, r: 4 }, { kind: 'red', c: 12, r: 6 }, { kind: 'brush', c: 3, r: 6, w: 2, h: 2 }, { kind: 'turret', c: 15, r: 9 }, { kind: 'turret', c: 11, r: 7 }],
    finalBoss: 'petricite',
  },
  {
    id: 'freljord', name: 'Freljord', subtitle: 'Toundra gelée', unlock: 15, mult: 200, waves: 50,
    path: [[-1, 6], [3, 5.5], [5, 1.8], [10, 1], [15, 1.8], [17.6, 6], [15, 10.2], [10, 10.8], [5.5, 9.6], [6.5, 7.4], [11, 7.6], [13.4, 5.6]],
    theme: { style: 'tundra', grass: '#e9f3f8', grass2: '#deedf5', path: '#8fb3c9', pathEdge: '#6f93a9', decor: '#c6dce8', accent: '#3498db' },
    features: [{ kind: 'river', c: 7, r: 3, w: 5, h: 3 }, { kind: 'blue', c: 15, r: 7 }, { kind: 'red', c: 2, r: 9 }, { kind: 'turret', c: 14, r: 4 }],
    finalBoss: 'colossus',
  },
  {
    id: 'noxus', name: 'Noxus', subtitle: 'L\'arène de l\'Empire', unlock: 19, mult: 120, waves: 50,
    path: [[-1, 1.5], [6, 1.8], [11, 3.6], [15, 5.5], [18.4, 5.5]],
    lanes: [[[-1, 10], [6, 9.6], [11, 7.6], [15, 5.5], [18.4, 5.5]]],
    theme: { style: 'noxus', grass: '#6b4a42', grass2: '#74514a', path: '#5a5560', pathEdge: '#3a353f', decor: '#5a3a34', accent: '#e84057' },
    features: [{ kind: 'dragon', c: 2, r: 5, w: 2, h: 2 }, { kind: 'turret', c: 16, r: 3 }, { kind: 'turret', c: 16, r: 8 }, { kind: 'red', c: 9, r: 5 }, { kind: 'blue', c: 6, r: 6 }, { kind: 'brush', c: 4, r: 3, w: 2 }, { kind: 'brush', c: 5, r: 8, w: 2 }],
    finalBoss: 'warbeast',
  },
  {
    id: 'ionia', name: 'Ionia', subtitle: 'Le sanctuaire des esprits', unlock: 23, mult: 450, waves: 50,
    path: [[2, -1], [3, 3], [7, 4.8], [5, 8], [9, 10.5], [13, 8.2], [11, 5], [14, 1.8], [18, 3], [17, 7], [18.5, 10]],
    theme: { style: 'ionia', grass: '#7fbf6a', grass2: '#8ac874', path: '#c9a87a', pathEdge: '#8a6a48', decor: '#6aa858', accent: '#ff9ed2' },
    features: [{ kind: 'river', c: 0, r: 6, w: 20 }, { kind: 'blue', c: 14, r: 5 }, { kind: 'red', c: 3, r: 9 }, { kind: 'brush', c: 8, r: 2, w: 2, h: 2 }, { kind: 'brush', c: 15, r: 8, h: 2 }],
    finalBoss: 'spiritguard',
  },
  {
    id: 'shurima', name: 'Shurima', subtitle: 'Désert de l\'empereur', unlock: 27, mult: 600, waves: 50,
    path: [[10, -1], [9, 3], [4, 3.6], [2.8, 8], [8, 10.4], [14, 10], [17.5, 7.5], [17, 3], [13.5, 2.5], [12.2, 5.6]],
    theme: { style: 'desert', grass: '#d9b779', grass2: '#d2af70', path: '#a8834a', pathEdge: '#8a6a38', decor: '#c39f60', accent: '#f1c40f' },
    features: [{ kind: 'river', c: 5, r: 5, w: 3, h: 2 }, { kind: 'blue', c: 6, r: 7 }, { kind: 'red', c: 14, r: 6 }, { kind: 'turret', c: 9, r: 6 }, { kind: 'turret', c: 15, r: 4 }],
    finalBoss: 'sentinel',
  },
  {
    id: 'piltover', name: 'Piltover', subtitle: 'La Cité du progrès', unlock: 31, mult: 1000, waves: 50,
    path: [[-1, 6], [3, 6], [3.6, 2], [9, 1.4], [9.6, 6], [9.6, 10], [15, 10.6], [15.6, 4], [18.6, 4]],
    theme: { style: 'piltover', grass: '#b8a88a', grass2: '#c2b294', path: '#8a8f98', pathEdge: '#5a5f68', decor: '#a8987a', accent: '#3fe0d0' },
    features: [{ kind: 'river', c: 0, r: 8, w: 20 }, { kind: 'turret', c: 6, r: 4 }, { kind: 'turret', c: 12, r: 7 }, { kind: 'turret', c: 17, r: 7 }, { kind: 'blue', c: 6, r: 5 }, { kind: 'red', c: 13, r: 3 }],
    finalBoss: 'automaton',
  },
  {
    id: 'shadowisles', name: 'Îles Obscures', subtitle: 'La Brume noire', unlock: 35, mult: 500, waves: 50,
    path: [[-1, 9], [5, 10.2], [6, 5.5], [3, 2.2], [9, 1.4], [11, 5], [14, 9.6], [17, 6.5], [16.4, 2.4], [18.6, 1.6]],
    lanes: [[[-1, 4], [3, 2.2], [9, 1.4], [11, 5], [14, 9.6], [17, 6.5], [16.4, 2.4], [18.6, 1.6]]],
    theme: { style: 'haunted', grass: '#1f2d2b', grass2: '#22332f', path: '#4a5a55', pathEdge: '#36433f', decor: '#172320', accent: '#1abc9c' },
    features: [{ kind: 'brush', c: 6, r: 3, w: 3 }, { kind: 'brush', c: 13, r: 4, w: 2, h: 2 }, { kind: 'red', c: 8, r: 6 }, { kind: 'blue', c: 2, r: 6 }, { kind: 'river', c: 8, r: 8, w: 3, h: 2 }],
    finalBoss: 'fallenking',
  },
];

export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));
