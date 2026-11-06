// Procedural map builder: picks a lane shape, then dresses the grid in its region's style
// (forest or rock borders, water, plateaus, landmarks, LoL tile features). Deterministic per seed.
import type { Landmark, LandmarkKind, MapDef, MapFeature, MapStyle, MapTheme } from '../types';

const C = 20, R = 12;
type P = [number, number];

function rng(seed: number): () => number {
  let s = (seed * 2654435761) % 2147483647 || 7;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const pick = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)];
const between = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));

// ---------- Lane shapes (orthogonal waypoints, entry off-grid, nexus inside) ----------

type Shape = (r: () => number) => { path: P[]; lanes?: P[][] };

const SHAPES: Record<string, Shape> = {
  snakeH: (r) => {
    const rows = r() < 0.5 ? [2, 5, 9] : [2, 6, 9];
    const a = between(r, 15, 17), b = between(r, 2, 4);
    return { path: [[-1, rows[0]], [a, rows[0]], [a, rows[1]], [b, rows[1]], [b, rows[2]], [between(r, 16, 18), rows[2]]] };
  },
  snakeV: (r) => {
    const cols = [between(r, 2, 3), between(r, 7, 8), between(r, 12, 13), between(r, 16, 17)];
    return { path: [[cols[0], -1], [cols[0], 9], [cols[1], 9], [cols[1], 2], [cols[2], 2], [cols[2], 9], [cols[3], 9], [cols[3], 4]] };
  },
  spiral: (r) => {
    const t = between(r, 1, 2);
    return { path: [[-1, t], [18, t], [18, 10], [1, 10], [1, t + 3], [15, t + 3], [15, 7], [5, 7], [5, 6]] };
  },
  uLoop: (r) => {
    const x = between(r, 15, 17);
    return { path: [[-1, 2], [x, 2], [x, 5], [5, 5], [5, 9], [x + 1, 9], [x + 1, 7]] };
  },
  stairs: (r) => {
    const s = between(r, 3, 4);
    return { path: [[-1, 1], [s, 1], [s, 4], [s + 5, 4], [s + 5, 7], [s + 10, 7], [s + 10, 10], [18, 10]] };
  },
  ringLake: (r) => {
    const y = between(r, 5, 6);
    return { path: [[-1, y], [2, y], [2, 1], [17, 1], [17, 10], [5, 10], [5, 8], [12, 8], [12, y - 1]] };
  },
  comb: (r) => {
    const y = between(r, 2, 3);
    return { path: [[-1, y], [4, y], [4, 9], [8, 9], [8, y], [12, y], [12, 9], [16, 9], [16, y + 2], [18, y + 2]] };
  },
  converge: (r) => {
    const mx = between(r, 10, 12), ny = between(r, 5, 6);
    return { path: [[-1, 2], [mx, 2], [mx, ny], [17, ny]], lanes: [[[-1, 9], [mx, 9], [mx, ny], [17, ny]]] };
  },
  twinSnake: (r) => {
    const x = between(r, 13, 15);
    return {
      path: [[-1, 1], [6, 1], [6, 4], [x, 4], [x, 6], [18, 6]],
      lanes: [[[-1, 10], [6, 10], [6, 8], [x, 8], [x, 6], [18, 6]]],
    };
  },
  topDown: (r) => {
    const c = between(r, 3, 5);
    return { path: [[c, -1], [c, 4], [10, 4], [10, 1], [16, 1], [16, 8], [8, 8], [8, 10], [18, 10]] };
  },
};

// ---------- Region dressing ----------

interface Style {
  border: string;
  water: 'river' | 'lake' | 'canal' | 'pools' | 'none';
  landmarks: LandmarkKind[];
  decor: string;
}

const STYLES: Record<MapStyle, Style> = {
  rift: { border: 'T', water: 'river', landmarks: ['inhibitor', 'camp', 'baronpit', 'fountain'], decor: ',' },
  jungle: { border: 'T', water: 'pools', landmarks: ['camp', 'baronpit'], decor: ',' },
  bridge: { border: '~', water: 'none', landmarks: ['statue'], decor: '.' },
  demacia: { border: 'T', water: 'lake', landmarks: ['citadel', 'statue'], decor: ',' },
  tundra: { border: 'T', water: 'lake', landmarks: ['waterfall', 'camp', 'statue'], decor: 'R' },
  noxus: { border: 'R', water: 'pools', landmarks: ['arena', 'fortress'], decor: 'R' },
  ionia: { border: 'T', water: 'river', landmarks: ['shrine'], decor: ',' },
  desert: { border: 'R', water: 'pools', landmarks: ['pyramid', 'sundisc', 'ruins'], decor: 's' },
  piltover: { border: 'R', water: 'canal', landmarks: ['hexgate', 'workshop'], decor: '.' },
  haunted: { border: 'T', water: 'pools', landmarks: ['ruins', 'graves'], decor: 'R' },
};

function laneTiles(paths: P[][]): Set<string> {
  const t = new Set<string>();
  for (const p of paths) {
    for (let i = 1; i < p.length; i++) {
      const [c0, r0] = p[i - 1], [c1, r1] = p[i];
      for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++)
        for (let rr = Math.min(r0, r1); rr <= Math.max(r0, r1); rr++) t.add(`${c},${rr}`);
    }
  }
  return t;
}

export interface GenSpec {
  id: string;
  name: string;
  subtitle: string;
  region: string;
  style: MapStyle;
  theme: MapTheme;
  waves: number;
  finalBoss: string;
  seed: number;
  /** Lane shape to favor (else random). */
  shape?: string;
}

export function generateMap(spec: GenSpec): MapDef {
  for (let attempt = 0; attempt < 30; attempt++) {
    const r = rng(spec.seed * 31 + attempt);
    const shapeName = attempt === 0 && spec.shape ? spec.shape : pick(r, Object.keys(SHAPES));
    const shape = SHAPES[shapeName](r);
    const lanes = [shape.path, ...(shape.lanes ?? [])];
    const lt = laneTiles(lanes);
    const st = STYLES[spec.style];
    const g = Array.from({ length: R }, () => Array<string>(C).fill('.'));
    const isLane = (c: number, rr: number) => lt.has(`${c},${rr}`);
    const put = (ch: string, c: number, rr: number, w = 1, h = 1, overLane = false) => {
      for (let y = rr; y < rr + h; y++) for (let x = c; x < c + w; x++) {
        if (x >= 0 && y >= 0 && x < C && y < R && (overLane || !isLane(x, y) || ch === '~')) g[y][x] = ch;
      }
    };
    // Borders (with thicker corners for a framed look)
    put(st.border, 0, 0, C, 1); put(st.border, 0, R - 1, C, 1); put(st.border, 0, 0, 1, R); put(st.border, C - 1, 0, 1, R);
    for (const [cx, cy] of [[1, 1], [C - 2, 1], [1, R - 2], [C - 2, R - 2]]) if (r() < 0.6) put(st.border, cx, cy);
    // Water
    if (st.water === 'river') {
      if (r() < 0.5) put('~', between(r, 6, 13), 1, 2, R - 2); else put('~', 1, between(r, 4, 7), C - 2, 1);
    } else if (st.water === 'canal') {
      put('~', 1, between(r, 6, 8), C - 2, 1);
    } else if (st.water === 'lake' || st.water === 'pools') {
      const n = st.water === 'lake' ? 1 : 2;
      for (let k = 0, placed = 0; k < 40 && placed < n; k++) {
        const w = st.water === 'lake' ? between(r, 3, 5) : between(r, 2, 3), h = st.water === 'lake' ? between(r, 2, 3) : 2;
        const x = between(r, 2, C - 3 - w), y = between(r, 2, R - 3 - h);
        let ok = true;
        for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (isLane(xx, yy)) ok = false;
        if (ok) { put('~', x, y, w, h); placed++; }
      }
    }
    // Shores
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      if (g[y][x] === '.' && !isLane(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy]?.[x + dx] === '~')) g[y][x] = 's';
    }
    const free = (x: number, y: number) => x > 0 && y > 0 && x < C - 1 && y < R - 1 && g[y][x] === '.' && !isLane(x, y);
    const rectFree = (x: number, y: number, w: number, h: number) => {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (!free(xx, yy)) return false;
      return true;
    };
    // Landmarks (1-2) in open space
    const landmarks: Landmark[] = [];
    const wanted = between(r, 1, 2);
    for (let k = 0; k < 80 && landmarks.length < wanted; k++) {
      const kind = pick(r, st.landmarks);
      const w = kind === 'inhibitor' || kind === 'statue' ? 1 : kind === 'citadel' || kind === 'arena' || kind === 'ruins' || kind === 'pyramid' || kind === 'sundisc' || kind === 'graves' ? 3 : 2;
      const h = kind === 'statue' || kind === 'citadel' || kind === 'arena' || kind === 'fortress' || kind === 'pyramid' || kind === 'hexgate' || kind === 'shrine' || kind === 'sundisc' || kind === 'graves' || kind === 'waterfall' || kind === 'baronpit' || kind === 'camp' || kind === 'fountain' ? 2 : 1;
      const x = between(r, 1, C - 1 - w), y = between(r, 1, R - 1 - h);
      if (rectFree(x, y, w, h)) {
        landmarks.push({ kind, x, y, w, h });
        put('#', x, y, w, h);
      }
    }
    // Plateaus near the lane, then scattered forest/rock clumps and decor
    for (let k = 0, placed = 0; k < 60 && placed < 2; k++) {
      const w = between(r, 2, 3), h = between(r, 1, 2), x = between(r, 1, C - 1 - w), y = between(r, 1, R - 1 - h);
      let near = false;
      for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (isLane(xx, yy)) near = true;
      if (near && rectFree(x, y, w, h)) { put('H', x, y, w, h); placed++; }
    }
    for (let k = 0; k < 6; k++) {
      const x = between(r, 1, C - 2), y = between(r, 1, R - 2);
      if (rectFree(x, y, 1, 1)) put(r() < 0.6 ? st.border === '~' ? 'R' : st.border : 'R', x, y);
    }
    for (let k = 0; k < 10; k++) {
      const x = between(r, 1, C - 2), y = between(r, 1, R - 2);
      if (rectFree(x, y, 1, 1) && st.decor !== '.') put(st.decor, x, y);
    }
    // Features: buffs, brush, turrets
    const features: MapFeature[] = [];
    const addFeat = (kind: MapFeature['kind'], w = 1, h = 1, needNear = true) => {
      for (let k = 0; k < 80; k++) {
        const x = between(r, 1, C - 1 - w), y = between(r, 1, R - 1 - h);
        let near = !needNear;
        for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (isLane(xx, yy)) near = true;
        if (near && rectFree(x, y, w, h)) {
          features.push({ kind, c: x, r: y, ...(w > 1 ? { w } : {}), ...(h > 1 ? { h } : {}) });
          put('#', x, y, w, h);
          return;
        }
      }
    };
    if (r() < 0.7) addFeat('blue');
    if (r() < 0.7) addFeat('red');
    addFeat('brush', between(r, 2, 3));
    for (let k = 0, n = between(r, 1, 2); k < n; k++) addFeat('turret');
    // Placeholder marks were only for spacing: restore them to grass
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (g[y][x] === '#') g[y][x] = '.';
    const terrain = g.map((row) => row.join(''));
    const open = terrain.join('').split('').filter((ch, i) => '.,sH'.includes(ch) && !isLane(i % C, Math.floor(i / C))).length;
    if (open < 70 && attempt < 29) continue;
    return {
      id: spec.id, name: spec.name, subtitle: spec.subtitle, region: spec.region, unlock: 0, mult: 1, waves: spec.waves,
      path: shape.path, ...(shape.lanes ? { lanes: shape.lanes } : {}), features, terrain, landmarks, theme: spec.theme, finalBoss: spec.finalBoss,
    };
  }
  throw new Error(`could not generate ${spec.id}`);
}
