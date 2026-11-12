// Region dressing for the battle maps: ground details, set pieces and colour grading that give each
// region of Runeterra its own mood. Everything here is painted once into the map's background;
// the lights it returns are animated at runtime by the battle renderer.
import type { MapStyle } from '../types';

type G = CanvasRenderingContext2D;
type R = () => number;

/** A light source painted into the map; the battle renderer makes it glow and flicker. */
export interface MapLight { x: number; y: number; r: number; color: string; flicker: number }

function glow(g: G, x: number, y: number, rad: number, color: string, a: number): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, color + Math.round(a * 255).toString(16).padStart(2, '0'));
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}

function ell(g: G, x: number, y: number, rx: number, ry: number, fill: string): void {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

function poly(g: G, pts: number[], fill: string): void {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
}

/** Runs `draw` at up to `n` random spots that lie on open ground. */
function scatter(n: number, W: number, H: number, r: R, open: (x: number, y: number) => boolean, draw: (x: number, y: number) => void): void {
  for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
    const x = 16 + r() * (W - 32), y = 16 + r() * (H - 32);
    if (!open(x, y)) continue;
    i++;
    draw(x, y);
  }
}

/** Ground details under everything else: drifts, cracks, crops, petals... */
export function dressGround(g: G, style: MapStyle, W: number, H: number, r: R, open: (x: number, y: number) => boolean, lights: MapLight[]): void {
  g.lineCap = 'round';
  switch (style) {
    case 'rift':
    case 'jungle': {
      // Mossy shade, ferns and clover
      scatter(46, W, H, r, open, (x, y) => ell(g, x, y, 26 + r() * 30, 14 + r() * 14, 'rgba(22,58,30,0.22)'));
      scatter(70, W, H, r, open, (x, y) => {
        g.strokeStyle = r() < 0.5 ? '#7fc46a' : '#3f8a44';
        g.lineWidth = 1.6;
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.42;
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 8, x + Math.cos(a) * 11, y + Math.sin(a) * 7);
          g.stroke();
        }
      });
      // Worn flagstones of the old Rift, half buried
      scatter(16, W, H, r, open, (x, y) => {
        g.save();
        g.translate(x, y);
        g.rotate((r() - 0.5) * 0.6);
        g.fillStyle = 'rgba(150,150,140,0.5)';
        g.beginPath(); g.roundRect(-11, -7, 22, 14, 3); g.fill();
        g.strokeStyle = 'rgba(40,60,40,0.5)'; g.lineWidth = 1; g.stroke();
        g.restore();
      });
      break;
    }
    case 'demacia': {
      // Golden wheat, white and blue flowers, pale paving stones
      scatter(34, W, H, r, open, (x, y) => {
        for (let i = 0; i < 16; i++) {
          const wx = x + (r() - 0.5) * 34, wy = y + (r() - 0.5) * 18;
          g.strokeStyle = r() < 0.5 ? '#e9cc66' : '#c9a23c';
          g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + 1.5, wy - 8 - r() * 4); g.stroke();
          ell(g, wx + 1.5, wy - 10, 1.4, 2.6, '#f4de8a');
        }
      });
      scatter(40, W, H, r, open, (x, y) => {
        for (let i = 0; i < 6; i++) ell(g, x + (r() - 0.5) * 22, y + (r() - 0.5) * 12, 2.2, 2.2, r() < 0.6 ? '#ffffff' : '#8fc0ff');
      });
      scatter(18, W, H, r, open, (x, y) => {
        g.save();
        g.translate(x, y);
        g.rotate((r() - 0.5) * 0.3);
        g.fillStyle = 'rgba(238,240,244,0.62)';
        g.beginPath(); g.roundRect(-13, -8, 26, 16, 2); g.fill();
        g.strokeStyle = 'rgba(140,150,165,0.6)'; g.lineWidth = 1; g.stroke();
        g.restore();
      });
      break;
    }
    case 'tundra':
    case 'bridge': {
      // Snow drifts with a blue shadow, sheets of ice with cracks
      scatter(44, W, H, r, open, (x, y) => {
        const rx = 22 + r() * 26, ry = 8 + r() * 7;
        ell(g, x + 3, y + 4, rx, ry, 'rgba(120,160,200,0.3)');
        ell(g, x, y, rx, ry, 'rgba(255,255,255,0.85)');
        ell(g, x - rx * 0.25, y - ry * 0.35, rx * 0.45, ry * 0.35, '#ffffff');
      });
      scatter(16, W, H, r, open, (x, y) => {
        const rx = 18 + r() * 16, ry = 9 + r() * 6;
        ell(g, x, y, rx, ry, 'rgba(160,215,240,0.7)');
        ell(g, x - rx * 0.3, y - ry * 0.3, rx * 0.4, ry * 0.25, 'rgba(255,255,255,0.7)');
        g.strokeStyle = 'rgba(255,255,255,0.8)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x - rx * 0.6, y); g.lineTo(x - 2, y - 2); g.lineTo(x + 3, y + 3); g.lineTo(x + rx * 0.6, y + 1);
        g.moveTo(x - 2, y - 2); g.lineTo(x + 2, y - ry * 0.7);
        g.stroke();
      });
      break;
    }
    case 'noxus': {
      // Scorched ash and cracks of lava that glow through the rock
      scatter(40, W, H, r, open, (x, y) => ell(g, x, y, 24 + r() * 30, 12 + r() * 14, 'rgba(20,8,10,0.3)'));
      scatter(15, W, H, r, open, (x, y) => {
        const pts: number[] = [x, y];
        let a = r() * Math.PI * 2, px = x, py = y;
        for (let i = 0; i < 4; i++) {
          a += (r() - 0.5) * 1.5;
          px += Math.cos(a) * (12 + r() * 12);
          py += Math.sin(a) * (7 + r() * 8);
          pts.push(px, py);
        }
        const line = (w: number, c: string) => {
          g.strokeStyle = c; g.lineWidth = w; g.lineJoin = 'round';
          g.beginPath(); g.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
          g.stroke();
        };
        glow(g, pts[4], pts[5], 46, '#ff5a1a', 0.3);
        line(7, '#1a0c0b');
        line(3, '#ff6a2a');
        line(1.2, '#ffd98a');
        lights.push({ x: pts[4], y: pts[5], r: 44, color: '#ff6a2a', flicker: 0.6 });
      });
      break;
    }
    case 'ionia': {
      // Soft moss, carpets of fallen petals, stepping stones
      scatter(30, W, H, r, open, (x, y) => ell(g, x, y, 24 + r() * 26, 12 + r() * 12, 'rgba(160,225,150,0.25)'));
      scatter(46, W, H, r, open, (x, y) => {
        for (let i = 0; i < 12; i++) {
          g.save();
          g.translate(x + (r() - 0.5) * 36, y + (r() - 0.5) * 18);
          g.rotate(r() * Math.PI);
          ell(g, 0, 0, 2.6, 1.3, r() < 0.5 ? '#ffc4e0' : '#ff9ed2');
          g.restore();
        }
      });
      scatter(10, W, H, r, open, (x, y) => {
        const a = r() * Math.PI;
        for (let i = -1; i <= 1; i++) {
          const sx = x + Math.cos(a) * i * 20, sy = y + Math.sin(a) * i * 11;
          ell(g, sx + 1.5, sy + 2, 8, 5, 'rgba(0,0,0,0.25)');
          ell(g, sx, sy, 8, 5, '#b9c2b6');
          ell(g, sx - 2, sy - 1.5, 4, 2, '#dfe6dc');
        }
      });
      break;
    }
    default:
      break;
  }
}

// ---------- Set pieces (feet at x, y) ----------

function shadow(g: G, x: number, y: number, rx: number): void {
  ell(g, x + 2, y + 1, rx, rx * 0.36, 'rgba(0,0,0,0.3)');
}

function mushrooms(g: G, x: number, y: number, lights: MapLight[]): void {
  glow(g, x, y - 6, 28, '#5ff0e0', 0.35);
  for (const [dx, s] of [[-7, 0.8], [1, 1.25], [8, 0.7]] as const) {
    g.fillStyle = '#dff7f2';
    g.fillRect(x + dx - 1.2 * s, y - 8 * s, 2.4 * s, 8 * s);
    g.fillStyle = '#39c7b6';
    g.beginPath(); g.ellipse(x + dx, y - 8 * s, 6 * s, 4 * s, 0, Math.PI, 0); g.fill();
    ell(g, x + dx - 1.5 * s, y - 9.6 * s, 1.4 * s, 0.9 * s, '#c9fff7');
  }
  lights.push({ x, y: y - 6, r: 30, color: '#5ff0e0', flicker: 0.25 });
}

function runeStone(g: G, x: number, y: number, lights: MapLight[]): void {
  shadow(g, x, y, 12);
  poly(g, [x - 9, y, x - 7, y - 20, x - 1, y - 27, x + 7, y - 21, x + 9, y], '#6f7682');
  poly(g, [x - 7, y - 20, x - 1, y - 27, x + 1, y - 2, x - 9, y], '#8b93a0');
  glow(g, x, y - 13, 22, '#5fd0ff', 0.45);
  g.strokeStyle = '#bff0ff'; g.lineWidth = 1.6; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x - 3, y - 19); g.lineTo(x + 3, y - 15); g.lineTo(x - 3, y - 11); g.lineTo(x + 3, y - 7); g.stroke();
  lights.push({ x, y: y - 13, r: 30, color: '#5fd0ff', flicker: 0.2 });
}

function pillar(g: G, x: number, y: number, broken: boolean): void {
  shadow(g, x, y, 12);
  const h = broken ? 20 : 34;
  g.fillStyle = '#c9ced8'; g.fillRect(x - 9, y - 5, 18, 5);
  const grad = g.createLinearGradient(x - 6, 0, x + 6, 0);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.6, '#e4e7ee'); grad.addColorStop(1, '#aab1be');
  g.fillStyle = grad;
  g.fillRect(x - 6, y - 5 - h, 12, h);
  g.strokeStyle = 'rgba(120,130,150,0.5)'; g.lineWidth = 1;
  for (const dx of [-2, 2]) { g.beginPath(); g.moveTo(x + dx, y - 6); g.lineTo(x + dx, y - 4 - h); g.stroke(); }
  if (broken) poly(g, [x - 6, y - 5 - h, x - 2, y - 9 - h, x + 1, y - 4 - h, x + 6, y - 8 - h, x + 6, y - 5 - h], '#e4e7ee');
  else { g.fillStyle = '#e2c15a'; g.fillRect(x - 8, y - 9 - h, 16, 4); g.fillStyle = '#f7e08e'; g.fillRect(x - 8, y - 9 - h, 16, 1.5); }
}

function flowerBush(g: G, x: number, y: number, r: R): void {
  shadow(g, x, y, 13);
  for (let i = 0; i < 5; i++) ell(g, x + (i - 2) * 5, y - 6 - (i % 2) * 3, 7, 6, i % 2 ? '#3f8f45' : '#2f7a3a');
  for (let i = 0; i < 9; i++) ell(g, x + (r() - 0.5) * 24, y - 6 - r() * 8, 1.9, 1.9, r() < 0.5 ? '#ffffff' : '#7fb4ff');
}

function iceCrystals(g: G, x: number, y: number, lights: MapLight[]): void {
  glow(g, x, y - 12, 34, '#8fd8ff', 0.4);
  for (const [dx, h, lean] of [[-8, 16, -0.25], [0, 28, 0.05], [8, 19, 0.3]] as const) {
    const tx = x + dx + lean * h;
    const grad = g.createLinearGradient(x + dx - 5, y - h, x + dx + 5, y);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.45, '#9fdcff'); grad.addColorStop(1, '#3f8fc8');
    poly(g, [x + dx - 5, y, tx - 3, y - h * 0.7, tx, y - h, tx + 3, y - h * 0.7, x + dx + 5, y], '#000');
    g.fillStyle = grad; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + dx - 1, y - 2); g.lineTo(tx, y - h); g.stroke();
  }
  lights.push({ x, y: y - 12, r: 38, color: '#8fd8ff', flicker: 0.15 });
}

function deadTree(g: G, x: number, y: number): void {
  shadow(g, x, y, 10);
  g.strokeStyle = '#4a3a34'; g.lineCap = 'round';
  g.lineWidth = 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y - 22); g.stroke();
  g.lineWidth = 2.2;
  for (const [a, l, h] of [[-0.9, 12, 14], [0.8, 14, 18], [-0.3, 9, 22]] as const) {
    g.beginPath(); g.moveTo(x + 1, y - h); g.lineTo(x + 1 + Math.sin(a) * l, y - h - Math.cos(a) * l); g.stroke();
  }
  g.strokeStyle = '#ffffff'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(x - 1.5, y - 20); g.lineTo(x - 1.5, y - 4); g.stroke();
}

function brazier(g: G, x: number, y: number, lights: MapLight[]): void {
  shadow(g, x, y, 12);
  glow(g, x, y - 26, 44, '#ff7a2a', 0.5);
  g.strokeStyle = '#1c1719'; g.lineWidth = 2.6; g.lineCap = 'round';
  for (const dx of [-7, 0, 7]) { g.beginPath(); g.moveTo(x + dx, y); g.lineTo(x + dx * 0.4, y - 16); g.stroke(); }
  poly(g, [x - 11, y - 22, x + 11, y - 22, x + 7, y - 14, x - 7, y - 14], '#2a2326');
  g.fillStyle = '#7a1c1c'; g.fillRect(x - 11, y - 23, 22, 2.5);
  poly(g, [x - 8, y - 22, x - 5, y - 33, x - 2, y - 26, x + 1, y - 38, x + 4, y - 27, x + 7, y - 32, x + 8, y - 22], '#ff6a1a');
  poly(g, [x - 4, y - 22, x - 2, y - 28, x + 1, y - 32, x + 3, y - 27, x + 5, y - 22], '#ffd27a');
  lights.push({ x, y: y - 26, r: 62, color: '#ff8a3d', flicker: 1 });
}

function warBanner(g: G, x: number, y: number): void {
  shadow(g, x, y, 8);
  g.fillStyle = '#1c1719'; g.fillRect(x - 1.5, y - 42, 3, 42);
  poly(g, [x - 1, y - 45, x + 2, y - 50, x + 5, y - 45], '#3a3136');
  poly(g, [x + 2, y - 41, x + 20, y - 41, x + 20, y - 16, x + 11, y - 22, x + 2, y - 16], '#8a1420');
  poly(g, [x + 2, y - 41, x + 20, y - 41, x + 20, y - 38, x + 2, y - 38], '#b3283a');
  poly(g, [x + 11, y - 35, x + 15, y - 30, x + 11, y - 25, x + 7, y - 30], '#16090c');
}

function stoneLantern(g: G, x: number, y: number, lights: MapLight[]): void {
  shadow(g, x, y, 11);
  glow(g, x, y - 20, 36, '#ffcf7a', 0.45);
  g.fillStyle = '#8f988f'; g.fillRect(x - 7, y - 4, 14, 4);
  g.fillStyle = '#a7b0a6'; g.fillRect(x - 3, y - 15, 6, 11);
  g.fillStyle = '#8f988f'; g.fillRect(x - 7, y - 25, 14, 10);
  g.fillStyle = '#fff0b8'; g.fillRect(x - 4, y - 23, 8, 6);
  poly(g, [x - 12, y - 25, x, y - 34, x + 12, y - 25], '#6f786f');
  ell(g, x, y - 35, 2, 2, '#6f786f');
  lights.push({ x, y: y - 20, r: 46, color: '#ffcf7a', flicker: 0.35 });
}

function bamboo(g: G, x: number, y: number, r: R): void {
  shadow(g, x, y, 12);
  for (const dx of [-7, -2, 4, 9]) {
    const h = 34 + r() * 16, lean = (r() - 0.5) * 6;
    g.strokeStyle = '#5fae4a'; g.lineWidth = 3; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(x + dx, y); g.lineTo(x + dx + lean, y - h); g.stroke();
    g.strokeStyle = '#2f6a2a'; g.lineWidth = 1;
    for (let k = 9; k < h; k += 9) { const q = k / h; g.beginPath(); g.moveTo(x + dx + lean * q - 2, y - k); g.lineTo(x + dx + lean * q + 2, y - k); g.stroke(); }
    for (let i = 0; i < 3; i++) {
      g.save();
      g.translate(x + dx + lean, y - h + i * 5);
      g.rotate(-0.6 + i * 0.7);
      ell(g, 6, 0, 7, 1.8, '#8fd06a');
      g.restore();
    }
  }
}

function torii(g: G, x: number, y: number): void {
  shadow(g, x, y, 20);
  g.fillStyle = '#b3282a';
  g.fillRect(x - 16, y - 38, 4, 38);
  g.fillRect(x + 12, y - 38, 4, 38);
  g.fillRect(x - 19, y - 31, 38, 3.5);
  poly(g, [x - 24, y - 44, x + 24, y - 44, x + 21, y - 38, x - 21, y - 38], '#8a1c20');
  poly(g, [x - 26, y - 47, x + 26, y - 47, x + 24, y - 44, x - 24, y - 44], '#2a1f22');
  g.fillStyle = '#3a2a2a'; g.fillRect(x - 17, y - 3, 6, 3); g.fillRect(x + 11, y - 3, 6, 3);
}

/** A set piece typical of the region for one free spot, or null to leave the default decor. */
export function regionProp(g: G, style: MapStyle, x: number, y: number, r: R, lights: MapLight[]): (() => void) | null {
  const k = r();
  const lit = lights.length < 26;
  switch (style) {
    case 'rift':
    case 'jungle':
      if (k < 0.2 && lit) return () => mushrooms(g, x, y, lights);
      if (k < 0.34 && lit) return () => runeStone(g, x, y, lights);
      return null;
    case 'demacia':
      if (k < 0.2) return () => pillar(g, x, y, r() < 0.4);
      if (k < 0.5) return () => flowerBush(g, x, y, r);
      return null;
    case 'tundra':
    case 'bridge':
      if (k < 0.3 && lit) return () => iceCrystals(g, x, y, lights);
      if (k < 0.48) return () => deadTree(g, x, y);
      return null;
    case 'noxus':
      if (k < 0.24 && lit) return () => brazier(g, x, y, lights);
      if (k < 0.5) return () => warBanner(g, x, y);
      return null;
    case 'ionia':
      if (k < 0.2 && lit) return () => stoneLantern(g, x, y, lights);
      if (k < 0.42) return () => bamboo(g, x, y, r);
      if (k < 0.5) return () => torii(g, x, y);
      return null;
    default:
      return null;
  }
}

/** Final colour grade: the light and haze that set the region's mood. */
export function grade(g: G, style: MapStyle, W: number, H: number): void {
  const wash = (x: number, y: number, rad: number, c0: string, c1: string) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  };
  let dark = 0.22;
  switch (style) {
    case 'demacia':
      wash(W * 0.3, H * 0.15, W * 0.8, 'rgba(255,244,205,0.26)', 'rgba(255,244,205,0)');
      dark = 0.14;
      break;
    case 'tundra':
    case 'bridge':
      g.fillStyle = 'rgba(120,170,220,0.10)';
      g.fillRect(0, 0, W, H);
      wash(W * 0.5, 0, W * 0.7, 'rgba(190,255,235,0.16)', 'rgba(190,255,235,0)');
      dark = 0.2;
      break;
    case 'noxus':
      g.fillStyle = 'rgba(60,8,10,0.16)';
      g.fillRect(0, 0, W, H);
      wash(W * 0.5, H * 1.1, W * 0.75, 'rgba(255,90,30,0.22)', 'rgba(255,90,30,0)');
      dark = 0.36;
      break;
    case 'ionia':
      wash(W * 0.3, H * 0.2, W * 0.75, 'rgba(255,225,240,0.2)', 'rgba(255,225,240,0)');
      wash(W * 0.9, H * 0.9, W * 0.5, 'rgba(120,230,220,0.12)', 'rgba(120,230,220,0)');
      dark = 0.16;
      break;
    case 'rift':
    case 'jungle':
      wash(W * 0.35, H * 0.25, W * 0.7, 'rgba(255,240,190,0.18)', 'rgba(255,240,190,0)');
      wash(W * 0.85, H * 0.85, W * 0.5, 'rgba(60,150,190,0.10)', 'rgba(60,150,190,0)');
      dark = 0.26;
      break;
    default:
      wash(W * 0.35, H * 0.25, W * 0.7, 'rgba(255,240,200,0.16)', 'rgba(255,240,200,0)');
  }
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${dark})`);
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
}

/** Tint used by the runtime for water glints on this style of map. */
export const waterGlint = (style: MapStyle): string => (style === 'noxus' ? '#ffd27a' : '#ffffff');
