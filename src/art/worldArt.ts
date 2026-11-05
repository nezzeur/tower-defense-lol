// Pixel-art world map: regions of Runeterra (original illustration), drawn once,
// plus an animated layer (waves, clouds, boats, birds, weather, region highlight).
import { shade } from './pixel';

export const WW = 320;
export const WH = 200;

type G = CanvasRenderingContext2D;

export interface Region {
  id: string;
  name: string;
  desc: string;
  color: string;
  /** Playable maps in this region, in progression order. */
  maps: string[];
  /** Label position (world px). */
  lx: number;
  ly: number;
  /** Land blobs: [x, y, rx, ry]. */
  blobs: [number, number, number, number][];
  ground: string;
  coast: 'beach' | 'cliff';
  weather?: 'snow' | 'sand' | 'mist' | 'petals';
}

export const REGIONS: Region[] = [
  {
    id: 'freljord', name: 'Freljord', desc: 'Toundra gelée et ponts suspendus au-dessus de l\'abîme.', color: '#7cc7ff',
    maps: ['aram', 'freljord'], lx: 112, ly: 16, ground: '#e4eef5', coast: 'cliff', weather: 'snow',
    blobs: [[70, 38, 48, 22], [130, 30, 40, 20], [180, 36, 30, 16], [40, 48, 22, 14], [105, 52, 30, 12]],
  },
  {
    id: 'rift', name: 'Faille de l\'invocateur', desc: 'Les terres centrales où tout commence.', color: '#5ee06a',
    maps: ['botlane', 'jungle'], lx: 150, ly: 84, ground: '#5aa35a', coast: 'beach',
    blobs: [[150, 104, 40, 22], [118, 96, 24, 16], [190, 100, 22, 16], [150, 122, 30, 12], [168, 84, 20, 10]],
  },
  {
    id: 'shurima', name: 'Shurima', desc: 'Un désert d\'or et d\'empires engloutis.', color: '#ffd84a',
    maps: ['shurima'], lx: 168, ly: 146, ground: '#e3c27f', coast: 'beach', weather: 'sand',
    blobs: [[165, 170, 50, 20], [120, 172, 26, 14], [212, 166, 26, 14], [165, 154, 30, 10]],
  },
  {
    id: 'shadowisles', name: 'Îles Obscures', desc: 'La Brume noire recouvre ces îles maudites.', color: '#3dffb5',
    maps: ['shadowisles'], lx: 280, ly: 112, ground: '#2c403c', coast: 'cliff', weather: 'mist',
    blobs: [[280, 132, 22, 14], [298, 122, 10, 8], [262, 142, 9, 6]],
  },
  // Decorative regions
  {
    id: 'ionia', name: 'Ionia', desc: 'Terre des esprits, des cerisiers et des lanternes.', color: '#ff9ed2', maps: ['ionia'], lx: 262, ly: 50, ground: '#8fcf7a', coast: 'beach', weather: 'petals',
    blobs: [[266, 66, 22, 14], [290, 58, 12, 9], [250, 78, 10, 7]],
  },
  {
    id: 'noxus', name: 'Noxus', desc: 'L\'Empire ne connaît que la force.', color: '#ff5a5a', maps: ['noxus'], lx: 52, ly: 96, ground: '#8a6458', coast: 'cliff',
    blobs: [[56, 112, 30, 20], [80, 124, 18, 12], [40, 128, 16, 10]],
  },
  {
    id: 'demacia', name: 'Demacia', desc: 'Un royaume de pierre blanche et d\'idéaux.', color: '#f5d76e',
    maps: ['demacia'], lx: 30, ly: 62, ground: '#7fbf6a', coast: 'cliff',
    blobs: [[30, 78, 20, 12], [50, 72, 12, 8], [20, 86, 10, 7]],
  },
  {
    id: 'piltover', name: 'Piltover', desc: 'La Cité du progrès et de l\'hextech.', color: '#3fe0d0',
    maps: ['piltover'], lx: 226, ly: 74, ground: '#b9ab8e', coast: 'cliff',
    blobs: [[220, 90, 12, 9], [230, 84, 7, 5]],
  },
  {
    id: 'bilgewater', name: 'Bilgewater', desc: '', color: '#3ac0c0', maps: [], lx: 262, ly: 172, ground: '#6aa86a', coast: 'beach',
    blobs: [[258, 182, 10, 6], [276, 176, 7, 5], [244, 172, 6, 4]],
  },
];

export const REGION_OF: Record<string, string> = Object.fromEntries(REGIONS.flatMap((r) => r.maps.map((m) => [m, r.id])));

/** Map node positions in world px. */
export const NODE_PX: Record<string, { x: number; y: number }> = {
  botlane: { x: 132, y: 108 },
  jungle: { x: 172, y: 100 },
  aram: { x: 148, y: 30 },
  freljord: { x: 74, y: 40 },
  shurima: { x: 168, y: 168 },
  shadowisles: { x: 280, y: 130 },
  demacia: { x: 32, y: 80 },
  noxus: { x: 70, y: 118 },
  ionia: { x: 268, y: 66 },
  piltover: { x: 222, y: 92 },
};

/** HD painting scale: the world is painted at WW*S x WH*S. */
export const S = 4;

function rng(seed: number): () => number {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Pixel-exact ellipse into a region-id mask (used for click picking and bounds). */
function maskEll(mask: Uint8Array, cx: number, cy: number, rx: number, ry: number, id: number): void {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    const yy = Math.round(cy + y);
    if (yy < 0 || yy >= WH) continue;
    for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) if (x >= 0 && x < WW) mask[yy * WW + x] = id;
  }
}

type Shape = [number, number, number, number];

export interface World {
  /** Painted HD image (WW*S x WH*S). */
  base: HTMLCanvasElement;
  /** Outer glow ring per region, same size as base. */
  glows: HTMLCanvasElement[];
  /** 0 = sea, i + 1 = REGIONS[i]. */
  mask: Uint8Array;
  sparkles: { x: number; y: number; p: number }[];
  bbox: { x0: number; y0: number; x1: number; y1: number }[];
}

let cached: World | null = null;

function landPath(shapes: Shape[], grow = 0): Path2D {
  const p = new Path2D();
  for (const [x, y, rx, ry] of shapes) {
    p.moveTo((x + rx + grow) * S, y * S);
    p.ellipse(x * S, y * S, (rx + grow) * S, (ry + grow) * S, 0, 0, Math.PI * 2);
  }
  return p;
}

export function buildWorld(): World {
  if (cached) return cached;
  const mask = new Uint8Array(WW * WH);
  const shapes: Shape[][] = REGIONS.map(() => []);
  REGIONS.forEach((reg, i) => {
    const r = rng(i + 7);
    for (const [x, y, rx, ry] of reg.blobs) {
      shapes[i].push([x, y, rx, ry]);
      for (let k = 0; k < 10; k++) {
        const a = r() * Math.PI * 2;
        shapes[i].push([x + Math.cos(a) * rx * 0.85, y + Math.sin(a) * ry * 0.85, 3 + r() * rx * 0.25, 2 + r() * ry * 0.25]);
      }
    }
    for (const [x, y, rx, ry] of shapes[i]) maskEll(mask, x, y, rx, ry, i + 1);
  });

  const base = document.createElement('canvas');
  base.width = WW * S;
  base.height = WH * S;
  paintWorld(base.getContext('2d')!, shapes);

  const glows = shapes.map((sh, i) => {
    const c = document.createElement('canvas');
    c.width = WW * S;
    c.height = WH * S;
    const g = c.getContext('2d')!;
    const path = landPath(sh, 0.5);
    g.filter = `blur(${S * 2}px)`;
    g.fillStyle = REGIONS[i].color;
    g.fill(path);
    g.filter = 'none';
    g.strokeStyle = REGIONS[i].color;
    g.lineWidth = S * 1.2;
    g.stroke(landPath(sh, 0.6));
    g.globalCompositeOperation = 'destination-out';
    g.fill(landPath(sh, 0));
    return c;
  });

  const bbox = REGIONS.map(() => ({ x0: WW, y0: WH, x1: 0, y1: 0 }));
  const sparkles: World['sparkles'] = [];
  const r = rng(77);
  for (let y = 0; y < WH; y++) {
    for (let x = 0; x < WW; x++) {
      const id = mask[y * WW + x];
      if (!id) {
        if (r() < 0.01) sparkles.push({ x, y, p: r() * Math.PI * 2 });
        continue;
      }
      const b = bbox[id - 1];
      b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y);
    }
  }
  cached = { base, glows, mask, sparkles, bbox };
  return cached;
}

// ---------- HD painting (world units, the context is scaled by S) ----------

function mountain(g: G, x: number, y: number, h: number, rock: string, snow: boolean): void {
  const w = h * 0.75;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(x + w * 0.3, y + 0.5, w, h * 0.18, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = shade(rock, 0.15);
  g.beginPath(); g.moveTo(x - w, y); g.lineTo(x, y - h); g.lineTo(x, y); g.closePath(); g.fill();
  g.fillStyle = shade(rock, -0.25);
  g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w, y); g.lineTo(x, y); g.closePath(); g.fill();
  if (snow) {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(x - w * 0.38, y - h * 0.5); g.lineTo(x, y - h); g.lineTo(x + w * 0.38, y - h * 0.5);
    g.lineTo(x + w * 0.15, y - h * 0.58); g.lineTo(x, y - h * 0.48); g.lineTo(x - w * 0.18, y - h * 0.6); g.closePath(); g.fill();
  }
}

function pine(g: G, x: number, y: number, s: number, c: string, snow: boolean): void {
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath(); g.ellipse(x + s * 0.3, y, s * 0.5, s * 0.15, 0, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 3; i++) {
    const w = s * (0.55 - i * 0.13), top = y - s * (0.3 + i * 0.35);
    g.fillStyle = i % 2 ? shade(c, 0.1) : c;
    g.beginPath(); g.moveTo(x, top - s * 0.45); g.lineTo(x + w, top + s * 0.25); g.lineTo(x - w, top + s * 0.25); g.closePath(); g.fill();
    if (snow) {
      g.fillStyle = '#f4fbff';
      g.beginPath(); g.moveTo(x, top - s * 0.45); g.lineTo(x + w * 0.4, top - s * 0.12); g.lineTo(x - w * 0.4, top - s * 0.12); g.closePath(); g.fill();
    }
  }
}

function canopy(g: G, x: number, y: number, s: number, c: string): void {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath(); g.ellipse(x + s * 0.3, y + s * 0.5, s * 0.9, s * 0.35, 0, 0, Math.PI * 2); g.fill();
  const grad = g.createRadialGradient(x - s * 0.3, y - s * 0.3, s * 0.1, x, y, s);
  grad.addColorStop(0, shade(c, 0.3));
  grad.addColorStop(1, shade(c, -0.2));
  g.fillStyle = grad;
  g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
}

function paintWorld(g: G, shapes: Shape[][]): void {
  const r = rng(5);
  g.save();
  // Ocean: deep gradient, lighter currents and fine wave strokes
  const sea = g.createLinearGradient(0, 0, 0, WH * S);
  sea.addColorStop(0, '#0d3a5c');
  sea.addColorStop(0.5, '#0b2f4d');
  sea.addColorStop(1, '#082640');
  g.fillStyle = sea;
  g.fillRect(0, 0, WW * S, WH * S);
  g.scale(S, S);
  for (let i = 0; i < 30; i++) {
    const x = r() * WW, y = r() * WH, rad = 20 + r() * 50;
    const c = g.createRadialGradient(x, y, 0, x, y, rad);
    c.addColorStop(0, 'rgba(40,110,160,0.25)');
    c.addColorStop(1, 'rgba(40,110,160,0)');
    g.fillStyle = c;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.strokeStyle = 'rgba(150,200,235,0.18)';
  g.lineWidth = 0.35;
  for (let i = 0; i < 220; i++) {
    const x = r() * WW, y = r() * WH, w = 2 + r() * 4;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 0.8, x + w, y); g.stroke();
  }
  // Shallow water halo, then coast, then land
  const all = shapes.flat();
  g.filter = `blur(${S * 3}px)`;
  g.fillStyle = 'rgba(80,190,220,0.55)';
  g.fill(landPathW(all, 5));
  g.filter = 'none';
  g.fillStyle = 'rgba(90,200,230,0.35)';
  g.fill(landPathW(all, 2.2));
  REGIONS.forEach((reg, i) => {
    const sh = shapes[i];
    g.fillStyle = reg.coast === 'beach' ? '#ecd8a0' : shade(reg.ground, -0.45);
    g.fill(landPathW(sh, 1.1));
    const bb = sh.reduce((b, [, y, , ry]) => ({ y0: Math.min(b.y0, y - ry), y1: Math.max(b.y1, y + ry) }), { y0: WH, y1: 0 });
    const grad = g.createLinearGradient(0, bb.y0, 0, bb.y1);
    grad.addColorStop(0, shade(reg.ground, 0.12));
    grad.addColorStop(1, shade(reg.ground, -0.12));
    g.fillStyle = grad;
    g.fill(landPathW(sh, 0));
    // Ground texture clipped to the region
    g.save();
    g.clip(landPathW(sh, 0));
    for (let k = 0; k < 500; k++) {
      const [cx, cy, rx, ry] = sh[Math.floor(r() * sh.length)];
      const x = cx + (r() - 0.5) * rx * 2, y = cy + (r() - 0.5) * ry * 2;
      g.fillStyle = shade(reg.ground, (r() - 0.5) * 0.25);
      g.globalAlpha = 0.5;
      g.beginPath(); g.ellipse(x, y, 0.6 + r() * 2, 0.4 + r() * 1.2, 0, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
  });

  // Terrain details
  const idOf = (rid: string) => REGIONS.findIndex((x) => x.id === rid);
  const inLand = (i: number, x: number, y: number) => shapes[i].some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 0.75);
  const scatter = (rid: string, n: number, fn: (x: number, y: number) => void) => {
    const i = idOf(rid), list: [number, number][] = [];
    for (let k = 0; k < n * 6 && list.length < n; k++) {
      const [cx, cy, rx, ry] = REGIONS[i].blobs[Math.floor(r() * REGIONS[i].blobs.length)];
      const x = cx + (r() - 0.5) * rx * 2, y = cy + (r() - 0.5) * ry * 2;
      if (inLand(i, x, y)) list.push([x, y]);
    }
    list.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => fn(x, y));
  };
  scatter('freljord', 12, (x, y) => mountain(g, x, y, 7 + r() * 6, '#8ea6b8', true));
  scatter('freljord', 45, (x, y) => pine(g, x, y, 3.2, '#2a5a5c', true));
  // Rift: river, forests and the central road
  g.strokeStyle = '#2b78a8';
  g.lineWidth = 2.6;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(110, 58); g.bezierCurveTo(120, 80, 132, 92, 145, 104); g.bezierCurveTo(156, 114, 164, 122, 168, 134); g.stroke();
  g.strokeStyle = '#6cc0e6';
  g.lineWidth = 1;
  g.stroke();
  g.strokeStyle = '#c9a66b';
  g.lineWidth = 1.4;
  g.setLineDash([2, 1.2]);
  g.beginPath(); g.moveTo(122, 116); g.quadraticCurveTo(150, 106, 178, 96); g.stroke();
  g.setLineDash([]);
  scatter('rift', 70, (x, y) => canopy(g, x, y, 1.8 + r() * 1.2, r() < 0.5 ? '#2f7a3a' : '#3f8f45'));
  // Piltover skyline with hextech lights
  for (let i = 0; i < 8; i++) {
    const h = 4 + r() * 7, x = 212 + i * 2.4;
    g.fillStyle = i % 2 ? '#d9cbb0' : '#c9b48a'; g.fillRect(x, 92 - h, 2.1, h);
    g.fillStyle = '#7ff0e6'; g.fillRect(x + 0.6, 92 - h + 1, 0.8, 0.8);
  }
  g.fillStyle = '#c8aa6e'; g.fillRect(211, 92, 21, 1);
  // Demacia: fields and a white citadel with blue roofs
  scatter('demacia', 20, (x, y) => canopy(g, x, y, 1.6 + r(), '#3f8f45'));
  for (const [cx, h] of [[26, 7], [30, 10], [34, 7]] as const) {
    g.fillStyle = '#f2f2f5'; g.fillRect(cx - 1.5, 78 - h, 3, h);
    g.fillStyle = '#2f5fb0'; g.beginPath(); g.moveTo(cx - 2, 78 - h); g.lineTo(cx, 78 - h - 3); g.lineTo(cx + 2, 78 - h); g.closePath(); g.fill();
  }
  g.fillStyle = '#e6e9f0'; g.fillRect(24, 76, 12, 3);
  // Shurima: dunes, pyramid, oasis
  scatter('shurima', 26, (x, y) => {
    g.strokeStyle = 'rgba(160,120,60,0.45)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(x - 5, y); g.quadraticCurveTo(x, y - 2.5, x + 5, y); g.stroke();
  });
  g.fillStyle = '#e6c88a'; g.beginPath(); g.moveTo(176, 170); g.lineTo(185, 156); g.lineTo(185, 170); g.closePath(); g.fill();
  g.fillStyle = '#b08a52'; g.beginPath(); g.moveTo(185, 156); g.lineTo(194, 170); g.lineTo(185, 170); g.closePath(); g.fill();
  g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(185, 155.5, 1, 0, Math.PI * 2); g.fill();
  const oasis = g.createRadialGradient(140, 178, 0, 140, 178, 7);
  oasis.addColorStop(0, '#5fc6e6'); oasis.addColorStop(1, '#2b7fa8');
  g.fillStyle = oasis; g.beginPath(); g.ellipse(140, 178, 8, 3.5, 0, 0, Math.PI * 2); g.fill();
  canopy(g, 131, 175, 1.8, '#4f8a3a'); canopy(g, 150, 177, 1.6, '#4f8a3a');
  // Noxus: red crags and a dark fortress
  scatter('noxus', 9, (x, y) => mountain(g, x, y, 6 + r() * 4, '#6b3a34', false));
  g.fillStyle = '#1e1216';
  g.fillRect(52, 104, 10, 7); g.fillRect(51, 100, 3, 11); g.fillRect(60, 100, 3, 11); g.fillRect(55.5, 98, 3, 6);
  g.fillStyle = '#ff5a5a'; g.fillRect(56.5, 106, 1, 1.5);
  // Ionia: blossom trees
  scatter('ionia', 30, (x, y) => canopy(g, x, y, 1.6 + r(), r() < 0.5 ? '#ff9ed2' : '#f7c1e0'));
  // Shadow Isles: dead trees and glowing pools
  scatter('shadowisles', 5, (x, y) => {
    const glow = g.createRadialGradient(x, y, 0, x, y, 4);
    glow.addColorStop(0, 'rgba(61,255,181,0.7)'); glow.addColorStop(1, 'rgba(61,255,181,0)');
    g.fillStyle = glow; g.fillRect(x - 4, y - 4, 8, 8);
  });
  scatter('shadowisles', 14, (x, y) => {
    g.strokeStyle = '#0e1414'; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 4); g.moveTo(x, y - 2.5); g.lineTo(x - 1.5, y - 4); g.moveTo(x, y - 3); g.lineTo(x + 1.6, y - 4.6); g.stroke();
  });
  // Bilgewater docks
  g.fillStyle = '#7a5230'; g.fillRect(250, 185, 10, 1); g.fillRect(252, 185, 0.8, 2.5); g.fillRect(257, 185, 0.8, 2.5);
  g.restore();
  // Vignette and warm light
  const W2 = WW * S, H2 = WH * S;
  const v = g.createRadialGradient(W2 / 2, H2 / 2, H2 * 0.35, W2 / 2, H2 / 2, W2 * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = v;
  g.fillRect(0, 0, W2, H2);
}

/** Same as landPath but in world units (for a context already scaled by S). */
function landPathW(shapes: Shape[], grow: number): Path2D {
  const p = new Path2D();
  for (const [x, y, rx, ry] of shapes) {
    p.moveTo(x + rx + grow, y);
    p.ellipse(x, y, rx + grow, ry + grow, 0, 0, Math.PI * 2);
  }
  return p;
}

// ---------- Animated layer (HD canvas; drawn in world units with scale S) ----------

interface Cloud { x: number; y: number; w: number; s: number }
interface Boat { x: number; y: number; vx: number; seed: number }
interface Bird { x: number; y: number; vx: number; vy: number }
interface Flake { x: number; y: number; vx: number; vy: number; life: number; region: number }

export class WorldAnim {
  private clouds: Cloud[] = [];
  private boats: Boat[] = [];
  private birds: Bird[] = [];
  private flakes: Flake[] = [];

  constructor(private world: World) {
    const r = rng(11);
    for (let i = 0; i < 6; i++) this.clouds.push({ x: r() * WW, y: 10 + r() * (WH - 40), w: 14 + r() * 18, s: 2 + r() * 3 });
    this.boats = [{ x: 210, y: 140, vx: 2.5, seed: 1 }, { x: 40, y: 165, vx: -2, seed: 2 }, { x: 230, y: 30, vx: 1.5, seed: 3 }];
  }

  update(dt: number): void {
    for (const c of this.clouds) { c.x += c.s * dt; if (c.x - c.w > WW) c.x = -c.w * 2; }
    for (const b of this.boats) {
      const nx = b.x + b.vx * dt;
      const ok = !this.world.mask[Math.round(b.y) * WW + Math.round(nx + Math.sign(b.vx) * 5)];
      if (ok && nx > 4 && nx < WW - 4) b.x = nx; else b.vx = -b.vx;
    }
    if (this.birds.length < 3 && Math.random() < dt * 0.15) {
      const left = Math.random() < 0.5;
      this.birds.push({ x: left ? -6 : WW + 6, y: 20 + Math.random() * 120, vx: (left ? 1 : -1) * (14 + Math.random() * 8), vy: -1 + Math.random() * 2 });
    }
    for (const b of this.birds) { b.x += b.vx * dt; b.y += b.vy * dt; }
    this.birds = this.birds.filter((b) => b.x > -10 && b.x < WW + 10);
    REGIONS.forEach((reg, i) => {
      if (!reg.weather || Math.random() > dt * (reg.weather === 'snow' ? 30 : 12)) return;
      const bb = this.world.bbox[i];
      const x = bb.x0 + Math.random() * (bb.x1 - bb.x0), y = bb.y0 + Math.random() * (bb.y1 - bb.y0);
      const v = reg.weather === 'snow' ? [-1, 6] : reg.weather === 'sand' ? [10, 0.5] : reg.weather === 'mist' ? [0.5, -3] : [3, 2];
      this.flakes.push({ x, y, vx: v[0], vy: v[1], life: 0, region: i + 1 });
    });
    for (const f of this.flakes) { f.x += f.vx * dt; f.y += f.vy * dt; f.life += dt; }
    this.flakes = this.flakes.filter((f) => f.life < 4);
  }

  draw(g: G, t: number, selected: string | null, nodes: { x: number; y: number; color: string; open: boolean }[]): void {
    const w = this.world;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, WW * S, WH * S);
    // Selected region glow (pre-rendered ring, pulsing)
    const sel = REGIONS.findIndex((r) => r.id === selected);
    if (sel >= 0) {
      g.globalAlpha = 0.55 + Math.sin(t * 3) * 0.3;
      g.drawImage(w.glows[sel], 0, 0);
      g.globalAlpha = 1;
    }
    g.setTransform(S, 0, 0, S, 0, 0);
    // Wave sparkles
    g.fillStyle = '#d6f0ff';
    for (const s of w.sparkles) {
      const k = Math.sin(t * 2 + s.p);
      if (k < 0.75) continue;
      g.globalAlpha = (k - 0.75) * 4;
      g.fillRect(s.x, s.y, 1.6, 0.35);
    }
    g.globalAlpha = 1;
    // Boats with wake
    for (const b of this.boats) {
      const bob = Math.sin(t * 3 + b.seed) * 0.4, d = Math.sign(b.vx);
      g.strokeStyle = 'rgba(200,235,255,0.5)';
      g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(b.x - d * 3, b.y + 0.8); g.lineTo(b.x - d * 8, b.y + 0.3); g.stroke();
      g.fillStyle = '#6b4a2b';
      g.beginPath(); g.moveTo(b.x - 3.5, b.y + bob); g.lineTo(b.x + 3.5, b.y + bob); g.lineTo(b.x + 2.5, b.y + 1.6 + bob); g.lineTo(b.x - 2.5, b.y + 1.6 + bob); g.closePath(); g.fill();
      g.fillStyle = '#3a2a1a'; g.fillRect(b.x - 0.25, b.y - 5 + bob, 0.5, 5);
      g.fillStyle = '#f4efe2';
      g.beginPath(); g.moveTo(b.x + 0.3 * d, b.y - 5 + bob); g.lineTo(b.x + 3.2 * d, b.y - 1.2 + bob); g.lineTo(b.x + 0.3 * d, b.y - 1 + bob); g.closePath(); g.fill();
    }
    // Weather
    for (const f of this.flakes) {
      if (w.mask[Math.round(f.y) * WW + Math.round(f.x)] !== f.region) continue;
      const reg = REGIONS[f.region - 1];
      g.globalAlpha = Math.min(1, f.life, 4 - f.life) * (reg.weather === 'mist' ? 0.5 : 0.9);
      g.fillStyle = reg.weather === 'snow' ? '#ffffff' : reg.weather === 'sand' ? '#fff0c0' : reg.weather === 'mist' ? '#5dffc1' : '#ffc8e6';
      g.beginPath();
      if (reg.weather === 'sand') g.ellipse(f.x, f.y, 1.2, 0.25, 0, 0, Math.PI * 2);
      else g.arc(f.x, f.y, reg.weather === 'mist' ? 0.8 : 0.45, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // Node glows
    for (const n of nodes) {
      if (!n.open) continue;
      const rr = 5 + Math.sin(t * 3 + n.x) * 1.5;
      const glow = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, rr + 3);
      glow.addColorStop(0, n.color + 'aa');
      glow.addColorStop(1, n.color + '00');
      g.fillStyle = glow;
      g.beginPath(); g.arc(n.x, n.y, rr + 3, 0, Math.PI * 2); g.fill();
    }
    // Birds
    g.strokeStyle = '#1a1a22';
    g.lineWidth = 0.5;
    for (const b of this.birds) {
      const f = Math.sin(t * 10 + b.y) * 0.8;
      for (const o of [0, 5, 9]) {
        const bx = b.x - Math.sign(b.vx) * o, by = b.y + (o ? 2 : 0);
        g.beginPath(); g.moveTo(bx - 1.4, by - f); g.lineTo(bx, by + 0.6); g.lineTo(bx + 1.4, by - f); g.stroke();
      }
    }
    // Clouds with shadows
    for (const c of this.clouds) {
      for (const [ox, oy, alpha, col] of [[5, 9, 0.14, '#000'], [0, 0, 0.82, '#f4f8ff']] as const) {
        g.globalAlpha = alpha;
        g.fillStyle = col;
        for (const [dx, dy, rr] of [[0, 0, 0.5], [0.35, -0.15, 0.4], [-0.35, 0.05, 0.35]] as const) {
          g.beginPath();
          g.ellipse(c.x + dx * c.w + ox, c.y + dy * c.w + oy, c.w * rr, c.w * rr * 0.55, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
}
