import type { MapDef } from '../types';

export const COLS = 20;
export const ROWS = 12;

export const MAPS: MapDef[] = [
  {
    id: 'botlane', name: 'Voie du Bas', subtitle: 'Faille de l\'invocateur', unlock: 0, mult: 1.5, waves: 50,
    path: [[-1, 2], [15, 2], [15, 6], [4, 6], [4, 9], [19, 9]],
    theme: { style: 'rift', grass: '#2f5d3a', grass2: '#346642', path: '#9c8a6a', pathEdge: '#7a6a50', decor: '#25492e', accent: '#4aa3ff' },
    features: [
      { kind: 'river', c: 11, r: 0, h: 12 }, { kind: 'dragon', c: 8, r: 3, w: 2, h: 2 },
      { kind: 'brush', c: 7, r: 7, w: 3 }, { kind: 'brush', c: 1, r: 3, w: 2, h: 2 },
      { kind: 'turret', c: 13, r: 10 }, { kind: 'turret', c: 17, r: 10 },
    ],
    finalBoss: 'riftherald',
  },
  {
    id: 'jungle', name: 'Jungle', subtitle: 'Faille de l\'invocateur', unlock: 3, mult: 8, waves: 50,
    path: [[-1, 5], [3, 5], [3, 1], [8, 1], [8, 10], [13, 10], [13, 3], [17, 3], [17, 8], [19, 8]],
    theme: { style: 'jungle', grass: '#244a33', grass2: '#295239', path: '#7d6b4f', pathEdge: '#5e503a', decor: '#1b3826', accent: '#a55eea' },
    features: [
      { kind: 'river', c: 0, r: 7, w: 20 }, { kind: 'blue', c: 5, r: 9 }, { kind: 'red', c: 15, r: 5 },
      { kind: 'dragon', c: 10, r: 4, w: 2, h: 2 }, { kind: 'brush', c: 10, r: 2, w: 2 }, { kind: 'brush', c: 1, r: 9, w: 2 },
    ],
    finalBoss: 'baron',
  },
  {
    id: 'aram', name: 'Abîme Hurlant', subtitle: 'Une seule voie sur le pont', unlock: 7, mult: 30, waves: 50,
    path: [[-1, 1], [18, 1], [18, 5], [1, 5], [1, 9], [19, 9]],
    theme: { style: 'bridge', grass: '#1b2433', grass2: '#202b3d', path: '#8a6a48', pathEdge: '#5a432c', decor: '#2c3a52', accent: '#5dade2' },
    features: [{ kind: 'turret', c: 4, r: 3 }, { kind: 'turret', c: 12, r: 7 }, { kind: 'turret', c: 17, r: 3 }],
    finalBoss: 'poroking',
  },
  {
    id: 'demacia', name: 'Demacia', subtitle: 'Les remparts de la Cité blanche', unlock: 11, mult: 70, waves: 50,
    path: [[-1, 3], [6, 3], [6, 9], [12, 9], [12, 2], [17, 2], [17, 10], [19, 10]],
    theme: { style: 'demacia', grass: '#6fae5a', grass2: '#7aba64', path: '#cfd3da', pathEdge: '#8d94a0', decor: '#5e9a4c', accent: '#f5d76e' },
    features: [
      { kind: 'blue', c: 9, r: 5 }, { kind: 'red', c: 15, r: 5 }, { kind: 'brush', c: 2, r: 6, w: 2, h: 2 },
      { kind: 'turret', c: 18, r: 8 }, { kind: 'turret', c: 14, r: 10 },
    ],
    finalBoss: 'petricite',
  },
  {
    id: 'freljord', name: 'Freljord', subtitle: 'Toundra gelée', unlock: 15, mult: 150, waves: 50,
    path: [[-1, 1], [18, 1], [18, 10], [1, 10], [1, 4], [15, 4], [15, 7], [5, 7]],
    theme: { style: 'tundra', grass: '#e9f3f8', grass2: '#deedf5', path: '#8fb3c9', pathEdge: '#6f93a9', decor: '#c6dce8', accent: '#3498db' },
    features: [
      { kind: 'river', c: 9, r: 0, h: 12 }, { kind: 'blue', c: 5, r: 8 }, { kind: 'red', c: 12, r: 5 }, { kind: 'turret', c: 3, r: 6 },
    ],
    finalBoss: 'colossus',
  },
  {
    id: 'noxus', name: 'Noxus', subtitle: 'L\'arène de l\'Empire', unlock: 19, mult: 280, waves: 50,
    path: [[-1, 2], [14, 2], [14, 5], [18, 5]],
    lanes: [[[-1, 9], [14, 9], [14, 5], [18, 5]]],
    theme: { style: 'noxus', grass: '#6b4a42', grass2: '#74514a', path: '#5a5560', pathEdge: '#3a353f', decor: '#5a3a34', accent: '#e84057' },
    features: [
      { kind: 'turret', c: 16, r: 3 }, { kind: 'turret', c: 16, r: 7 }, { kind: 'red', c: 7, r: 5 }, { kind: 'blue', c: 10, r: 6 },
      { kind: 'dragon', c: 3, r: 5, w: 2, h: 2 }, { kind: 'brush', c: 8, r: 4, w: 2 },
    ],
    finalBoss: 'warbeast',
  },
  {
    id: 'ionia', name: 'Ionia', subtitle: 'Le sanctuaire des esprits', unlock: 23, mult: 450, waves: 50,
    path: [[2, -1], [2, 4], [9, 4], [9, 1], [16, 1], [16, 6], [6, 6], [6, 10], [17, 10]],
    theme: { style: 'ionia', grass: '#7fbf6a', grass2: '#8ac874', path: '#c9a87a', pathEdge: '#8a6a48', decor: '#6aa858', accent: '#ff9ed2' },
    features: [
      { kind: 'river', c: 12, r: 0, h: 12 }, { kind: 'blue', c: 4, r: 8 }, { kind: 'red', c: 14, r: 3 },
      { kind: 'brush', c: 8, r: 8, w: 2 }, { kind: 'brush', c: 18, r: 2, h: 2 },
    ],
    finalBoss: 'spiritguard',
  },
  {
    id: 'shurima', name: 'Shurima', subtitle: 'Désert de l\'empereur', unlock: 27, mult: 700, waves: 50,
    path: [[10, -1], [10, 3], [3, 3], [3, 8], [16, 8], [16, 3], [13, 3], [13, 5]],
    lanes: [[[-1, 10], [16, 10], [16, 3], [13, 3], [13, 5]]],
    theme: { style: 'desert', grass: '#d9b779', grass2: '#d2af70', path: '#a8834a', pathEdge: '#8a6a38', decor: '#c39f60', accent: '#f1c40f' },
    features: [{ kind: 'blue', c: 8, r: 5 }, { kind: 'red', c: 6, r: 6 }, { kind: 'turret', c: 11, r: 5 }],
    finalBoss: 'sentinel',
  },
  {
    id: 'piltover', name: 'Piltover', subtitle: 'La Cité du progrès', unlock: 31, mult: 1000, waves: 50,
    path: [[-1, 6], [4, 6], [4, 1], [10, 1], [10, 10], [15, 10], [15, 4], [19, 4]],
    theme: { style: 'piltover', grass: '#b8a88a', grass2: '#c2b294', path: '#8a8f98', pathEdge: '#5a5f68', decor: '#a8987a', accent: '#3fe0d0' },
    features: [
      { kind: 'turret', c: 6, r: 3 }, { kind: 'turret', c: 12, r: 8 }, { kind: 'turret', c: 17, r: 6 },
      { kind: 'blue', c: 7, r: 8 }, { kind: 'red', c: 13, r: 2 },
    ],
    finalBoss: 'automaton',
  },
  {
    id: 'shadowisles', name: 'Îles Obscures', subtitle: 'La Brume noire', unlock: 35, mult: 500, waves: 50,
    path: [[-1, 10], [4, 10], [4, 2], [9, 2], [9, 9], [14, 9], [14, 2], [19, 2], [19, 11]],
    lanes: [[[-1, 0], [9, 0], [9, 9], [14, 9], [14, 2], [19, 2], [19, 11]]],
    theme: { style: 'haunted', grass: '#1f2d2b', grass2: '#22332f', path: '#4a5a55', pathEdge: '#36433f', decor: '#172320', accent: '#1abc9c' },
    features: [
      { kind: 'brush', c: 6, r: 5, w: 2, h: 2 }, { kind: 'brush', c: 16, r: 5, w: 2, h: 2 }, { kind: 'red', c: 11, r: 4 }, { kind: 'blue', c: 2, r: 4 },
    ],
    finalBoss: 'fallenking',
  },
];

export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));
