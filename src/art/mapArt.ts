// Pixel-art map rendering. Everything here draws on the low-res canvas (PT px per tile),
// which the battle and the previews upscale with nearest-neighbor.
import { COLS, ROWS } from '../data/maps';
import type { FeatureKind, MapDef, MapStyle } from '../types';

/** Pixels per tile on the low-res canvas. */
export const PT = 16;
export const LW = COLS * PT;
export const LH = ROWS * PT;

export interface PathGeo {
  /** Main lane waypoints (pixels). */
  pts: { x: number; y: number }[];
  /** Every lane (main first), in pixels. */
  lanes: { x: number; y: number }[][];
  tiles: Set<string>;
}

/** Catmull-Rom spline through the waypoints, sampled every ~6px, so lanes curve organically. */
function smoothLane(path: [number, number][], tile: number): { x: number; y: number }[] {
  const P = path.map(([c, r]) => ({ x: (c + 0.5) * tile, y: (r + 0.5) * tile }));
  const out: { x: number; y: number }[] = [P[0]];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 6));
    for (let k = 1; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}

export function pathGeometry(map: MapDef, tile: number): PathGeo {
  const tiles = new Set<string>();
  const lanes = [map.path, ...(map.lanes ?? [])].map((path) => {
    const pts = smoothLane(path, tile);
    // Every tile the lane's body (about 0.8 tile wide) passes over
    for (const p of pts) {
      for (const [dx, dy] of [[0, 0], [-0.36, 0], [0.36, 0], [0, -0.36], [0, 0.36]]) {
        tiles.add(`${Math.floor(p.x / tile + dx)},${Math.floor(p.y / tile + dy)}`);
      }
    }
    return pts;
  });
  return { pts: lanes[0], lanes, tiles };
}

/** Expands map features into a tile -> kind lookup. */
export function featureTiles(map: MapDef): Map<string, FeatureKind> {
  const out = new Map<string, FeatureKind>();
  for (const f of map.features ?? []) {
    for (let dc = 0; dc < (f.w ?? 1); dc++) for (let dr = 0; dr < (f.h ?? 1); dr++) out.set(`${f.c + dc},${f.r + dr}`, f.kind);
  }
  return out;
}

export const FEATURE_INFO: Record<FeatureKind, { name: string; desc: string; color: string; icon: string }> = {
  blue: { name: 'Buff bleu', desc: '+25 % vitesse d\'attaque pour le champion posé dessus', color: '#4fa8ff', icon: '🔷' },
  red: { name: 'Buff rouge', desc: '+10 % dégâts et brûlure (25 %/s pendant 3 s)', color: '#ff5a3d', icon: '🔶' },
  brush: { name: 'Hautes herbes', desc: 'Embuscade : +20 % dégâts', color: '#5fbf5a', icon: '🌿' },
  river: { name: 'Rivière', desc: 'Ralentit de 20 % les ennemis qui la traversent', color: '#5fc6e6', icon: '💧' },
  turret: { name: 'Tourelle alliée', desc: 'Tire automatiquement sur les ennemis proches', color: '#c8aa6e', icon: '🗼' },
  dragon: { name: 'Fosse épique', desc: '+15 % dégâts aux champions placés autour', color: '#ff9a3d', icon: '🐉' },
};

// ---------- Ambient particles (low-res coordinates) ----------

export interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  blink: boolean;
}

export function spawnMote(style: MapStyle): Mote {
  const R = Math.random;
  switch (style) {
    case 'tundra':
    case 'bridge':
      return { x: R() * LW, y: -2, vx: -3 + R() * 2, vy: 7 + R() * 8, life: 0, max: 30, color: '#ffffff', blink: false };
    case 'desert':
      return { x: -2, y: R() * LH, vx: 20 + R() * 20, vy: -1 + R() * 2, life: 0, max: 20, color: '#f3d9a4', blink: false };
    case 'haunted':
      return { x: R() * LW, y: LH + 2, vx: -2 + R() * 4, vy: -5 - R() * 5, life: 0, max: 14, color: '#5dffc1', blink: true };
    case 'ionia':
      return { x: R() * LW, y: -2, vx: 4 + R() * 4, vy: 5 + R() * 4, life: 0, max: 40, color: '#ffc8e6', blink: false };
    case 'noxus':
      return { x: R() * LW, y: LH + 2, vx: -2 + R() * 4, vy: -6 - R() * 6, life: 0, max: 12, color: '#ff7a3d', blink: true };
    case 'piltover':
      return { x: R() * LW, y: R() * LH, vx: -1 + R() * 2, vy: -2 - R() * 2, life: 0, max: 6, color: '#7ff0e6', blink: true };
    case 'jungle':
      return { x: R() * LW, y: R() * LH, vx: -3 + R() * 6, vy: -3 + R() * 6, life: 0, max: 5 + R() * 4, color: '#ffe873', blink: true };
    default:
      return { x: R() * LW, y: -2, vx: 3 + R() * 5, vy: 4 + R() * 4, life: 0, max: 40, color: '#cfe8a0', blink: false };
  }
}
