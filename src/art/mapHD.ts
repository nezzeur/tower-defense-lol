// HD painted battle maps: textured ground, paved lanes, brush, water, rocks, trees and decorative
// turrets. Drawn once per map at full resolution (W x H logical px).
import { COLS, ROWS } from '../data/maps';
import type { MapDef, MapStyle } from '../types';
import { featureTiles, pathGeometry } from './mapArt';
import { shade } from './pixel';

type G = CanvasRenderingContext2D;

function rng(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function seedOf(id: string): number {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 2147483647;
  return h;
}

interface Look {
  ground: [string, string, string];
  lane: string;
  stone: string;
  curb: string;
  brush: string;
  water?: string;
  tree: [string, string, string];
  rock: string;
}

const LOOKS: Record<MapStyle, Look> = {
  rift: { ground: ['#4f8a42', '#5e9a4c', '#437a3a'], lane: '#8c7b5e', stone: '#a49478', curb: '#5e5444', brush: '#2e6a34', water: '#2f6f8f', tree: ['#1f4a26', '#2f6b34', '#4f8f45'], rock: '#7d7a72' },
  jungle: { ground: ['#3d6a3a', '#487a42', '#33593a'], lane: '#6e6048', stone: '#857659', curb: '#4a4232', brush: '#24572c', water: '#25607e', tree: ['#14331c', '#1e4a28', '#357a3e'], rock: '#5f6660' },
  bridge: { ground: ['#2a3a50', '#33465f', '#223044'], lane: '#7d7f86', stone: '#9a9ca3', curb: '#4a4d55', brush: '#2b3a4a', tree: ['#2f4f5a', '#3f6a75', '#e8f2f8'], rock: '#8e9aa6' },
  tundra: { ground: ['#dfe9f0', '#eef5f9', '#c9d8e3'], lane: '#93a8b8', stone: '#b4c5d2', curb: '#6f8596', brush: '#a9c0cf', water: '#7fb6d6', tree: ['#244a4a', '#2f6060', '#f4fbff'], rock: '#9fb0be' },
  desert: { ground: ['#d6b273', '#e2c088', '#c49c5c'], lane: '#b8935a', stone: '#d4b07a', curb: '#8a6a3a', brush: '#a08a4a', water: '#3d9ac2', tree: ['#3f6f2f', '#4f8a3a', '#7cba55'], rock: '#b08a52' },
  demacia: { ground: ['#6fae5a', '#7cbb66', '#5e9a4c'], lane: '#cfd3da', stone: '#e8eaee', curb: '#8d94a0', brush: '#3f7f3a', water: '#4f9fd0', tree: ['#2f6b34', '#3f8f45', '#6fbf5a'], rock: '#d6d9df' },
  noxus: { ground: ['#7a5048', '#86594f', '#6a443d'], lane: '#55505a', stone: '#6b6670', curb: '#2e2a33', brush: '#5a2a2a', water: '#ff5a2a', tree: ['#2a1a1e', '#3a2428', '#5a3438'], rock: '#5a3a34' },
  ionia: { ground: ['#7fbf6a', '#8ac874', '#6aa858'], lane: '#c9a87a', stone: '#d8bb8e', curb: '#8a6a48', brush: '#4f9a4a', water: '#5fc6e6', tree: ['#d86fa8', '#ff9ed2', '#ffd1e8'], rock: '#9aa49a' },
  piltover: { ground: ['#b9ab8e', '#c4b698', '#a99c80'], lane: '#8a8f98', stone: '#a9aeb7', curb: '#4a4f58', brush: '#4f8a3a', water: '#3fb6d6', tree: ['#2f6b34', '#3f8f45', '#6fbf5a'], rock: '#8a6a48' },
  haunted: { ground: ['#2c403c', '#344a45', '#24352f'], lane: '#46524f', stone: '#5c6a66', curb: '#2c3533', brush: '#1f3a33', water: '#1b5a4a', tree: ['#151b1c', '#232b2c', '#3dffb5'], rock: '#3a4643' },
};

function ground(g: G, look: Look, W: number, H: number, r: () => number): void {
  g.fillStyle = look.ground[0];
  g.fillRect(0, 0, W, H);
  // Large soft color variation
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H, rad = 60 + r() * 140;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, look.ground[r() < 0.5 ? 1 : 2] + '99');
    grad.addColorStop(1, look.ground[0] + '00');
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Fine grass / grain strokes
  for (let i = 0; i < 5000; i++) {
    const x = r() * W, y = r() * H;
    g.strokeStyle = shade(look.ground[0], (r() - 0.5) * 0.35);
    g.globalAlpha = 0.35;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4);
    g.stroke();
  }
  g.globalAlpha = 1;
}

function strokePath(g: G, pts: { x: number; y: number }[]): void {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.stroke();
}

function lane(g: G, look: Look, pts: { x: number; y: number }[], tile: number, style: MapStyle, r: () => number): void {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // Soft outer shadow, curb, then the paved surface
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 18;
  g.strokeStyle = look.curb;
  g.lineWidth = tile * 1.02;
  strokePath(g, pts);
  g.restore();
  g.strokeStyle = look.lane;
  g.lineWidth = tile * 0.86;
  strokePath(g, pts);
  // Cobblestones
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y), nx = (b.x - a.x) / len, ny = (b.y - a.y) / len;
    for (let d = 0; d < len; d += 9) {
      for (let k = -2; k <= 2; k++) {
        if (r() < 0.25) continue;
        const off = k * tile * 0.17 + (r() - 0.5) * 4;
        const x = a.x + nx * d - ny * off, y = a.y + ny * d + nx * off;
        const w = 5 + r() * 4, h = 4 + r() * 3;
        g.fillStyle = shade(look.stone, (r() - 0.5) * 0.25);
        g.strokeStyle = shade(look.lane, -0.35);
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(x, y, w / 2, h / 2, Math.atan2(ny, nx) + (r() - 0.5) * 0.4, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    }
  }
  // Inner edge highlight
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  g.lineWidth = 2;
  g.save();
  g.translate(0, -tile * 0.4);
  strokePath(g, pts);
  g.restore();
  if (style === 'bridge') {
    // Stone balustrade along the bridge
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y), nx = (b.x - a.x) / len, ny = (b.y - a.y) / len;
      for (const side of [-1, 1]) {
        g.strokeStyle = '#c3c7cf';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(a.x - ny * tile * 0.5 * side, a.y + nx * tile * 0.5 * side);
        g.lineTo(b.x - ny * tile * 0.5 * side, b.y + nx * tile * 0.5 * side);
        g.stroke();
        for (let d = 0; d < len; d += 24) {
          g.fillStyle = '#d6d9df';
          g.fillRect(a.x + nx * d - ny * tile * 0.5 * side - 3, a.y + ny * d + nx * tile * 0.5 * side - 3, 6, 6);
        }
      }
    }
  }
}

function tree(g: G, x: number, y: number, s: number, c: [string, string, string]): void {
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(x + s * 0.25, y + s * 0.55, s * 0.95, s * 0.4, 0, 0, Math.PI * 2);
  g.fill();
  for (const [dx, dy, rr, col] of [[-0.4, 0.05, 0.55, 0], [0.4, 0.1, 0.55, 0], [0, -0.3, 0.65, 1], [-0.15, -0.5, 0.35, 2]] as const) {
    const cx = x + dx * s, cy = y + dy * s, rad = rr * s;
    const grad = g.createRadialGradient(cx - rad * 0.3, cy - rad * 0.4, rad * 0.1, cx, cy, rad);
    grad.addColorStop(0, shade(c[col], 0.25));
    grad.addColorStop(1, c[col]);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.fill();
  }
}

function pine(g: G, x: number, y: number, s: number, c: [string, string, string]): void {
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(x + s * 0.2, y + s * 0.5, s * 0.6, s * 0.22, 0, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 3; i++) {
    const w = s * (0.75 - i * 0.18), top = y - s * (0.1 + i * 0.4);
    g.fillStyle = i % 2 ? c[1] : c[0];
    g.beginPath();
    g.moveTo(x, top - s * 0.5);
    g.lineTo(x + w, top + s * 0.35);
    g.lineTo(x - w, top + s * 0.35);
    g.closePath();
    g.fill();
    g.fillStyle = c[2];
    g.beginPath();
    g.moveTo(x, top - s * 0.5);
    g.lineTo(x + w * 0.4, top - s * 0.08);
    g.lineTo(x - w * 0.4, top - s * 0.08);
    g.closePath();
    g.fill();
  }
}

function rock(g: G, x: number, y: number, s: number, base: string, r: () => number): void {
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(x + s * 0.15, y + s * 0.35, s * 0.75, s * 0.25, 0, 0, Math.PI * 2);
  g.fill();
  const pts: [number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    pts.push([x + Math.cos(a) * s * (0.5 + r() * 0.2), y + Math.sin(a) * s * (0.4 + r() * 0.3)]);
  }
  pts.push([x + s * 0.6, y + s * 0.3], [x - s * 0.6, y + s * 0.3]);
  const grad = g.createLinearGradient(x, y - s * 0.5, x, y + s * 0.3);
  grad.addColorStop(0, shade(base, 0.3));
  grad.addColorStop(1, shade(base, -0.35));
  g.fillStyle = grad;
  g.beginPath();
  pts.forEach(([px0, py0], i) => (i ? g.lineTo(px0, py0) : g.moveTo(px0, py0)));
  g.closePath();
  g.fill();
  g.strokeStyle = shade(base, -0.5);
  g.lineWidth = 1;
  g.stroke();
}

function brush(g: G, x: number, y: number, s: number, c: string, r: () => number): void {
  g.fillStyle = shade(c, -0.25);
  g.beginPath();
  g.ellipse(x, y, s, s * 0.55, 0, 0, Math.PI * 2);
  g.fill();
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const bx = x + (r() - 0.5) * s * 1.8, by = y + (r() - 0.5) * s * 0.9;
    g.strokeStyle = shade(c, (r() - 0.3) * 0.5);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(bx, by + 4);
    g.quadraticCurveTo(bx + (r() - 0.5) * 6, by - 6, bx + (r() - 0.5) * 8, by - 10 - r() * 6);
    g.stroke();
  }
}

function water(g: G, look: Look, x: number, y: number, rx: number, ry: number): void {
  const grad = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  grad.addColorStop(0, shade(look.water!, 0.15));
  grad.addColorStop(1, shade(look.water!, -0.25));
  g.fillStyle = shade(look.curb, -0.2);
  g.beginPath();
  g.ellipse(x, y + 3, rx + 4, ry + 4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.ellipse(x - rx * 0.2 + i * 6, y - ry * 0.2 + i * 5, rx * 0.35, ry * 0.12, 0, 0, Math.PI);
    g.stroke();
  }
}

function turret(g: G, x: number, y: number, crystal: string): void {
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.beginPath();
  g.ellipse(x + 4, y + 6, 18, 7, 0, 0, Math.PI * 2);
  g.fill();
  const grad = g.createLinearGradient(x - 10, 0, x + 10, 0);
  grad.addColorStop(0, '#6b7280');
  grad.addColorStop(0.5, '#a3abb8');
  grad.addColorStop(1, '#4b5563');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x - 12, y + 4);
  g.lineTo(x - 8, y - 30);
  g.lineTo(x + 8, y - 30);
  g.lineTo(x + 12, y + 4);
  g.closePath();
  g.fill();
  g.fillStyle = '#c8aa6e';
  g.fillRect(x - 11, y - 33, 22, 5);
  g.fillRect(x - 13, y + 1, 26, 4);
  g.shadowColor = crystal;
  g.shadowBlur = 14;
  g.fillStyle = crystal;
  g.beginPath();
  g.moveTo(x, y - 50);
  g.lineTo(x + 7, y - 38);
  g.lineTo(x, y - 32);
  g.lineTo(x - 7, y - 38);
  g.closePath();
  g.fill();
  g.shadowBlur = 0;
}

function banner(g: G, x: number, y: number, cloth: string, trim: string): void {
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.ellipse(x + 3, y + 2, 7, 2.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6b5a3a'; g.fillRect(x - 1, y - 30, 2.5, 32);
  g.fillStyle = trim; g.beginPath(); g.arc(x + 0.2, y - 31, 2.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = cloth;
  g.beginPath(); g.moveTo(x + 1.5, y - 28); g.lineTo(x + 13, y - 28); g.lineTo(x + 13, y - 12); g.lineTo(x + 7, y - 15); g.lineTo(x + 1.5, y - 12); g.closePath(); g.fill();
  g.strokeStyle = trim; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = trim; g.beginPath(); g.arc(x + 7.2, y - 22, 2.2, 0, Math.PI * 2); g.fill();
}

function spikes(g: G, x: number, y: number): void {
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.ellipse(x + 2, y + 2, 12, 4, 0, 0, Math.PI * 2); g.fill();
  for (let i = -2; i <= 2; i++) {
    const h = 14 + (2 - Math.abs(i)) * 5;
    const grad = g.createLinearGradient(x + i * 4, y - h, x + i * 4, y);
    grad.addColorStop(0, '#c9ccd2'); grad.addColorStop(1, '#3a3640');
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(x + i * 4 - 2, y); g.lineTo(x + i * 4, y - h); g.lineTo(x + i * 4 + 2, y); g.closePath(); g.fill();
  }
  g.fillStyle = '#2e2a33'; g.fillRect(x - 11, y - 3, 22, 4);
}

function lantern(g: G, x: number, y: number, glow: string, brass: boolean): void {
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath(); g.ellipse(x + 2, y + 1, 6, 2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = brass ? '#8a6a3a' : '#5a3a28';
  g.fillRect(x - 1.2, y - (brass ? 30 : 18), 2.4, brass ? 30 : 18);
  const ly = y - (brass ? 33 : 21);
  const halo = g.createRadialGradient(x, ly, 0, x, ly, 16);
  halo.addColorStop(0, glow + 'aa'); halo.addColorStop(1, glow + '00');
  g.fillStyle = halo; g.fillRect(x - 16, ly - 16, 32, 32);
  g.fillStyle = brass ? '#c9a35a' : '#c0392b';
  g.fillRect(x - 4, ly - 4, 8, 8);
  g.fillStyle = glow; g.fillRect(x - 2.5, ly - 2.5, 5, 5);
}

function tiles(g: G, W: number, H: number, line: string): void {
  g.strokeStyle = line;
  g.lineWidth = 1;
  g.globalAlpha = 0.35;
  for (let x = 0; x < W; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.globalAlpha = 1;
}

function riverArea(g: G, x: number, y: number, w: number, h: number, look: Look, r: () => number): void {
  const grad = g.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, shade(look.water ?? '#4fa3c7', 0.1));
  grad.addColorStop(1, shade(look.water ?? '#4fa3c7', -0.2));
  g.fillStyle = shade(look.curb, -0.2);
  g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 1.2;
  for (let i = 0; i < (w * h) / 500; i++) {
    const sx = x + r() * w, sy = y + r() * h;
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + 5, sy - 2, sx + 10, sy); g.stroke();
  }
}

function buffPad(g: G, x: number, y: number, color: string, glyph: string): void {
  const halo = g.createRadialGradient(x, y, 2, x, y, 26);
  halo.addColorStop(0, color + 'aa');
  halo.addColorStop(1, color + '00');
  g.fillStyle = halo;
  g.fillRect(x - 26, y - 26, 52, 52);
  g.fillStyle = '#3a4252';
  g.beginPath(); g.ellipse(x, y + 2, 19, 13, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#c8aa6e';
  g.lineWidth = 2;
  g.stroke();
  g.strokeStyle = color;
  g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(x, y + 2, 14, 9, 0, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.fillStyle = color;
    g.fillRect(x + Math.cos(a) * 16 - 1, y + 2 + Math.sin(a) * 11 - 1, 2, 2);
  }
  g.font = '700 14px serif';
  g.textAlign = 'center';
  g.fillStyle = '#fff';
  g.shadowColor = color;
  g.shadowBlur = 10;
  g.fillText(glyph, x, y + 7);
  g.shadowBlur = 0;
}

function brushArea(g: G, x: number, y: number, w: number, h: number, c: string, r: () => number): void {
  g.fillStyle = shade(c, -0.3);
  g.beginPath(); g.roundRect(x + 2, y + 4, w - 4, h - 4, 10); g.fill();
  g.lineCap = 'round';
  for (let i = 0; i < (w * h) / 40; i++) {
    const bx = x + 4 + r() * (w - 8), by = y + 8 + r() * (h - 8);
    g.strokeStyle = shade(c, (r() - 0.3) * 0.5);
    g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(bx, by + 4); g.quadraticCurveTo(bx + (r() - 0.5) * 6, by - 6, bx + (r() - 0.5) * 8, by - 12 - r() * 6); g.stroke();
  }
}

function dragonPit(g: G, x: number, y: number, w: number, h: number): void {
  const cx = x + w / 2, cy = y + h / 2;
  g.fillStyle = '#4a4440';
  g.beginPath(); g.ellipse(cx, cy, w / 2 - 2, h / 2 - 4, 0, 0, Math.PI * 2); g.fill();
  const pit = g.createRadialGradient(cx, cy, 2, cx, cy, w / 2);
  pit.addColorStop(0, 'rgba(255,150,60,0.75)');
  pit.addColorStop(0.6, 'rgba(120,40,20,0.6)');
  pit.addColorStop(1, 'rgba(30,20,20,0.9)');
  g.fillStyle = pit;
  g.beginPath(); g.ellipse(cx, cy, w / 2 - 8, h / 2 - 9, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#c8aa6e';
  g.lineWidth = 2;
  g.beginPath(); g.ellipse(cx, cy, w / 2 - 2, h / 2 - 4, 0, 0, Math.PI * 2); g.stroke();
  // Claw marks
  g.strokeStyle = 'rgba(255,200,120,0.5)';
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx - 8 + i * 6, cy - 6); g.lineTo(cx + 4 + i * 6, cy + 8); g.stroke(); }
}

export function drawMapHD(g: G, map: MapDef, W: number, H: number, tile: number): void {
  const style = map.theme.style, look = LOOKS[style];
  const geo = pathGeometry(map, tile);
  const r = rng(seedOf(map.id));
  ground(g, look, W, H, r);
  if (style === 'piltover') tiles(g, W, H, shade(look.ground[0], -0.25));
  if (style === 'bridge') {
    // Abyss: dark chasm with mist and snowy cliffs top and bottom
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#dfe9f1');
    grad.addColorStop(0.1, '#5a6e86');
    grad.addColorStop(0.5, '#0e1724');
    grad.addColorStop(0.9, '#5a6e86');
    grad.addColorStop(1, '#dfe9f1');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) {
      const x = r() * W, y = H * (0.3 + r() * 0.4), rad = 60 + r() * 100;
      const m = g.createRadialGradient(x, y, 0, x, y, rad);
      m.addColorStop(0, 'rgba(120,150,190,0.12)');
      m.addColorStop(1, 'rgba(120,150,190,0)');
      g.fillStyle = m;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  const free = (c: number, row: number) => !geo.tiles.has(`${c},${row}`);
  const features = featureTiles(map);
  const nearLane = (c: number, row: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => geo.tiles.has(`${c + dc},${row + dr}`));
  // Water feature away from the lane
  if (look.water && style !== 'haunted') {
    for (let tries = 0; tries < 60; tries++) {
      const c = 2 + Math.floor(r() * (COLS - 4)), row = 2 + Math.floor(r() * (ROWS - 4));
      if ([-1, 0, 1].every((dc) => [-1, 0, 1].every((dr) => free(c + dc, row + dr)))) {
        water(g, look, (c + 0.5) * tile, (row + 0.5) * tile, tile * 1.3, tile * 0.75);
        if (style === 'noxus') {
          const lx = (c + 0.5) * tile, ly = (row + 0.5) * tile;
          const lg = g.createRadialGradient(lx, ly, 0, lx, ly, tile * 2);
          lg.addColorStop(0, 'rgba(255,120,40,0.35)'); lg.addColorStop(1, 'rgba(255,120,40,0)');
          g.fillStyle = lg; g.fillRect(lx - tile * 2, ly - tile * 2, tile * 4, tile * 4);
        }
        break;
      }
    }
  }
  if (style === 'haunted') {
    for (let i = 0; i < 5; i++) {
      const x = r() * W, y = r() * H;
      const m = g.createRadialGradient(x, y, 0, x, y, 60);
      m.addColorStop(0, 'rgba(61,255,181,0.18)');
      m.addColorStop(1, 'rgba(61,255,181,0)');
      g.fillStyle = m;
      g.fillRect(x - 60, y - 60, 120, 120);
    }
  }
  for (const f of map.features ?? []) {
    if (f.kind === 'river') riverArea(g, f.c * tile, f.r * tile, (f.w ?? 1) * tile, (f.h ?? 1) * tile, look, r);
  }
  for (const pts of geo.lanes) lane(g, look, pts, tile, style, r);
  for (const f of map.features ?? []) {
    const x = f.c * tile, y = f.r * tile, w = (f.w ?? 1) * tile, h = (f.h ?? 1) * tile;
    if (f.kind === 'brush') brushArea(g, x, y, w, h, look.brush, r);
    if (f.kind === 'dragon') dragonPit(g, x, y, w, h);
    if (f.kind === 'blue') buffPad(g, x + w / 2, y + h / 2, '#4fa8ff', '✦');
    if (f.kind === 'red') buffPad(g, x + w / 2, y + h / 2, '#ff5a3d', '✹');
  }

  // Props sorted by y for overlap
  const props: { y: number; draw: () => void }[] = [];
  for (let c = 0; c < COLS; c++) {
    for (let row = 0; row < ROWS; row++) {
      if (!free(c, row) || features.has(`${c},${row}`)) continue;
      const near = nearLane(c, row);
      if (r() > (near ? 0.22 : 0.5)) continue;
      const x = (c + 0.2 + r() * 0.6) * tile, y = (row + 0.35 + r() * 0.45) * tile, k = r();
      if (style === 'bridge') {
        if (row === 0 || row === ROWS - 1) props.push({ y, draw: () => pine(g, x, y, tile * 0.45, look.tree) });
        continue;
      }
      if (k > 0.86 && style === 'demacia') { props.push({ y, draw: () => banner(g, x, y, '#2f5fb0', '#f5d76e') }); continue; }
      if (k > 0.84 && style === 'noxus') { props.push({ y, draw: () => spikes(g, x, y) }); continue; }
      if (k > 0.86 && style === 'ionia') { props.push({ y, draw: () => lantern(g, x, y, '#ffb347', false) }); continue; }
      if (k > 0.8 && style === 'piltover') { props.push({ y, draw: () => lantern(g, x, y, '#7ff0e6', true) }); continue; }
      if (near && k < 0.5) props.push({ y, draw: () => brush(g, x, y, tile * 0.38, look.brush, r) });
      else if (k < 0.62) props.push({ y, draw: () => (style === 'tundra' ? pine(g, x, y, tile * 0.5, look.tree) : tree(g, x, y, tile * 0.42, look.tree)) });
      else if (k < 0.8) props.push({ y, draw: () => rock(g, x, y, tile * 0.38, look.rock, r) });
      else props.push({ y, draw: () => brush(g, x, y, tile * 0.32, look.brush, r) });
    }
  }
  props.sort((a, b) => a.y - b.y).forEach((p) => p.draw());

  // Allied turrets (functional, see Battle.updateTurrets)
  for (const f of map.features ?? []) if (f.kind === 'turret') turret(g, (f.c + 0.5) * tile, (f.r + 0.5) * tile + 14, map.theme.accent);

  // Warm light and vignette
  const light = g.createRadialGradient(W * 0.35, H * 0.25, 0, W * 0.35, H * 0.25, W * 0.7);
  light.addColorStop(0, 'rgba(255,240,200,0.16)');
  light.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = light;
  g.fillRect(0, 0, W, H);
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
}
