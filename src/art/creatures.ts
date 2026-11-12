// Shaded, animated pixel creatures drawn procedurally on the low-res canvas.
// Original designs built from generic archetypes (soldiers, crab, wolf, bird, rock golem, toad,
// dragon, larva, serpent, furball, ghost). Local coords: feet at (0, 0), facing +x.
import { shade } from './color';
import { DESIGN_SVG } from './mobDesign';
import { EXTRA_SVG } from './mobExtra';
import { REGION_SVG } from './mobRegion';

type G = CanvasRenderingContext2D;
const OUT = '#120e18';
/** HD mode: smooth vector primitives instead of pixel rows (set by drawCreature). */
let smooth = false;

function rect(g: G, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  if (smooth) { g.fillRect(x, y, Math.max(1, w), Math.max(1, h)); return; }
  g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

/** Filled ellipse: pixel-exact rows, or a smooth path in HD mode. */
function ell(g: G, cx: number, cy: number, rx: number, ry: number, c: string): void {
  g.fillStyle = c;
  if (smooth) {
    g.beginPath();
    g.ellipse(cx, cy, Math.max(0.3, rx), Math.max(0.3, ry), 0, 0, Math.PI * 2);
    g.fill();
    return;
  }
  const R = Math.max(0.5, ry);
  for (let y = -Math.round(ry); y <= Math.round(ry); y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (R * R))));
    g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
}

/** Ellipse with outline, lower shading band and a highlight: the basic "shaded blob". */
function blob(g: G, cx: number, cy: number, rx: number, ry: number, base: string, light = 0.35, dark = -0.3): void {
  if (smooth) {
    ell(g, cx, cy, rx + 0.7, ry + 0.7, OUT);
    const grad = g.createLinearGradient(0, cy - ry, 0, cy + ry);
    grad.addColorStop(0, shade(base, light * 0.6));
    grad.addColorStop(0.55, base);
    grad.addColorStop(1, shade(base, dark));
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(cx, cy, Math.max(0.3, rx), Math.max(0.3, ry), 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha *= 0.7;
    ell(g, cx - rx * 0.3, cy - ry * 0.45, Math.max(0.5, rx * 0.3), Math.max(0.3, ry * 0.18), shade(base, light + 0.2));
    g.globalAlpha /= 0.7;
    return;
  }
  ell(g, cx, cy, rx + 1, ry + 1, OUT);
  ell(g, cx, cy, rx, ry, base);
  g.fillStyle = shade(base, dark);
  const R = Math.max(0.5, ry);
  for (let y = Math.round(ry * 0.35); y <= Math.round(ry); y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (R * R))));
    g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
  }
  ell(g, cx - rx * 0.3, cy - ry * 0.4, Math.max(1, rx * 0.35), Math.max(0.5, ry * 0.25), shade(base, light));
}

function poly(g: G, pts: [number, number][], c: string): void {
  g.fillStyle = c;
  g.beginPath();
  const q = (v: number) => (smooth ? v : Math.round(v));
  pts.forEach(([x, y], i) => (i ? g.lineTo(q(x), q(y)) : g.moveTo(q(x), q(y))));
  g.closePath();
  g.fill();
}

function leg(g: G, x: number, y: number, len: number, w: number, c: string): void {
  rect(g, x - 1, y - len - 1, w + 2, len + 1, OUT);
  rect(g, x, y - len, w, len, c);
}

function eye(g: G, x: number, y: number, glow: string): void {
  rect(g, x, y, 1, 1, glow);
  g.globalAlpha = 0.35;
  rect(g, x - 1, y, 3, 1, glow);
  g.globalAlpha = 1;
}

// ---------- Minions ----------

function minion(g: G, ph: number, team: string): void {
  const step = Math.round(Math.sin(ph * Math.PI));
  leg(g, -3, 0 - Math.max(0, step), 4, 2, '#3a3f4a');
  leg(g, 1, 0 - Math.max(0, -step), 4, 2, '#3a3f4a');
  blob(g, 0, -7, 4, 3.5, team);
  rect(g, -2, -8, 4, 1, shade(team, 0.4));
  // Shield
  blob(g, -4, -7, 2, 3, shade(team, -0.25));
  rect(g, -5, -8, 1, 2, '#e0c068');
  // Helmet with visor and crest
  blob(g, 1, -12, 3, 2.5, '#8a93a3');
  rect(g, 1, -12, 3, 1, OUT);
  rect(g, 0, -16, 2, 2, team);
  // Sword
  const sw = Math.round(Math.sin(ph * Math.PI) * 1.5);
  for (let i = 0; i < 6; i++) rect(g, 4 + Math.floor(i / 2) + (sw > 0 ? 1 : 0), -8 - i, 1, 1, '#dfe4ea');
  rect(g, 3, -8, 3, 1, '#c8aa6e');
}

function caster(g: G, ph: number, t: number, team: string): void {
  const sway = Math.round(Math.sin(ph * Math.PI));
  // Robe
  ell(g, 0, -4, 5, 4, OUT);
  ell(g, 0, -4, 4, 3.5, shade(team, -0.2));
  blob(g, 0, -8, 3.5, 3.5, team);
  rect(g, -1 + sway, -1, 2, 1, OUT);
  // Hood and face shadow
  blob(g, 1, -12, 3, 3, shade(team, -0.35));
  rect(g, 2, -12, 2, 1, '#ffe27a');
  // Staff with glowing orb
  for (let i = 0; i < 12; i++) rect(g, 5, -2 - i, 1, 1, '#7a5230');
  const pulse = 0.6 + Math.sin(t * 6) * 0.4;
  g.globalAlpha = pulse * 0.5;
  ell(g, 5, -15, 3, 3, '#d9a3ff');
  g.globalAlpha = 1;
  ell(g, 5, -15, 1.5, 1.5, '#f3e2ff');
}

function cannon(g: G, ph: number, team: string): void {
  // Barrel
  rect(g, 3, -12, 9, 4, OUT);
  rect(g, 4, -11, 7, 2, '#3a3f4a');
  rect(g, 10, -12, 2, 4, '#2a2a2a');
  // Wagon
  rect(g, -8, -11, 13, 8, OUT);
  rect(g, -7, -10, 11, 6, team);
  rect(g, -7, -10, 11, 1, shade(team, 0.35));
  rect(g, -7, -5, 11, 1, shade(team, -0.35));
  rect(g, -5, -9, 1, 4, shade(team, -0.25));
  rect(g, 0, -9, 1, 4, shade(team, -0.25));
  // Gunner peeking out
  blob(g, -3, -13, 2, 2, '#8a93a3');
  // Wheels with turning spokes
  for (const wx of [-5, 2]) {
    ell(g, wx, -3, 3.5, 3.5, OUT);
    ell(g, wx, -3, 2.5, 2.5, '#6b4a2b');
    const a = ph * Math.PI;
    rect(g, wx + Math.round(Math.cos(a) * 2), -3 + Math.round(Math.sin(a) * 2), 1, 1, '#c8aa6e');
    rect(g, wx - Math.round(Math.cos(a) * 2), -3 - Math.round(Math.sin(a) * 2), 1, 1, '#c8aa6e');
    rect(g, wx, -3, 1, 1, '#2a1a10');
  }
}

function superMinion(g: G, ph: number, team: string): void {
  const step = Math.round(Math.sin(ph * Math.PI) * 1.5);
  leg(g, -5, -Math.max(0, step), 5, 3, '#2e323c');
  leg(g, 2, -Math.max(0, -step), 5, 3, '#2e323c');
  blob(g, 0, -11, 7, 6, team);
  // Shoulder spikes
  for (const sx of [-7, 6]) poly(g, [[sx - 1, -15], [sx + 2, -15], [sx + 0.5, -20]], '#e0c068');
  // Fists
  blob(g, -8, -8, 2.5, 2.5, '#5c6370');
  blob(g, 8, -8 + step, 2.5, 2.5, '#5c6370');
  // Horned helmet
  blob(g, 1, -18, 4, 3, '#5c6370');
  rect(g, 2, -18, 3, 1, '#ff5a5a');
  poly(g, [[-3, -20], [-1, -19], [-4, -24]], '#efe6d6');
  poly(g, [[5, -20], [3, -19], [6, -24]], '#efe6d6');
}

// ---------- Jungle ----------

function crab(g: G, ph: number): void {
  const base = '#4fd1c5';
  for (let i = 0; i < 3; i++) {
    const k = Math.round(Math.sin(ph * Math.PI * 2 + i * 2));
    rect(g, -6 + i * 2, -2 + (k > 0 ? -1 : 0), 1, 3, '#2b6f6a');
    rect(g, 2 + i * 2, -2 + (k < 0 ? -1 : 0), 1, 3, '#2b6f6a');
  }
  blob(g, 0, -5, 7, 4, base);
  rect(g, -3, -7, 2, 1, shade(base, 0.5));
  rect(g, 2, -6, 2, 1, shade(base, 0.5));
  // Claws and eye stalks
  blob(g, 8, -4, 2, 1.5, shade(base, -0.15));
  rect(g, 4, -11, 1, 3, OUT);
  rect(g, 6, -10, 1, 2, OUT);
  rect(g, 4, -12, 1, 1, '#ffffff');
  rect(g, 6, -11, 1, 1, '#ffffff');
}

function wolf(g: G, ph: number): void {
  const fur = '#4b5070', a = ph * Math.PI;
  const legs: [number, number][] = [[-5, Math.sin(a)], [-3, -Math.sin(a)], [3, -Math.sin(a)], [5, Math.sin(a)]];
  for (const [lx, s] of legs) leg(g, lx, -Math.max(0, Math.round(s)), 4, 1, shade(fur, -0.2));
  // Tail
  poly(g, [[-6, -8], [-11, -11 + Math.round(Math.sin(a * 2))], [-10, -8], [-6, -6]], OUT);
  poly(g, [[-6, -8], [-10, -10 + Math.round(Math.sin(a * 2))], [-9, -8], [-6, -7]], fur);
  blob(g, 0, -7, 6, 3, fur);
  rect(g, -3, -5, 6, 1, shade(fur, 0.25));
  // Head, snout, ears
  blob(g, 7, -9, 3, 2.5, fur);
  rect(g, 9, -9, 3, 2, OUT);
  rect(g, 9, -9, 2, 1, shade(fur, 0.2));
  poly(g, [[5, -11], [6, -15], [7, -11]], OUT);
  poly(g, [[7, -11], [9, -14], [9, -10]], OUT);
  eye(g, 8, -10, '#9be7ff');
}

function raptor(g: G, ph: number, t: number): void {
  const plume = '#e8553c', a = ph * Math.PI;
  leg(g, -1, -Math.max(0, Math.round(Math.sin(a))), 4, 1, '#e0b040');
  leg(g, 1, -Math.max(0, Math.round(-Math.sin(a))), 4, 1, '#e0b040');
  // Tail feathers
  poly(g, [[-3, -7], [-8, -10], [-7, -6]], shade(plume, -0.3));
  blob(g, 0, -7, 4, 3, plume);
  // Neck and head with beak and crest
  rect(g, 3, -12, 2, 4, plume);
  blob(g, 5, -13, 2.5, 2, plume);
  rect(g, 7, -13, 3, 1, '#ffd84a');
  rect(g, 7, -12, 2, 1, shade('#ffd84a', -0.3));
  rect(g, 4, -16, 1, 2, '#ffd84a');
  rect(g, 5, -17, 1, 2, '#ff9d3a');
  rect(g, 6, -14, 1, 1, OUT);
  // Flapping wing
  const flap = Math.round(Math.sin(t * 14) * 2);
  blob(g, -1, -8 - flap, 3, 1.5, shade(plume, -0.25));
}

function krug(g: G, ph: number, t: number, base = '#8a7f73', crack = '#ff8a3d', big = 1): void {
  const s = big, a = ph * Math.PI;
  leg(g, -3 * s, -Math.max(0, Math.round(Math.sin(a))), 3 * s, 2 * s, shade(base, -0.3));
  leg(g, 2 * s, -Math.max(0, Math.round(-Math.sin(a))), 3 * s, 2 * s, shade(base, -0.3));
  blob(g, 0, -8 * s, 6 * s, 5.5 * s, base, 0.25, -0.35);
  // Rock facets and glowing cracks
  ell(g, -2 * s, -10 * s, 2 * s, 1.5 * s, shade(base, -0.15));
  ell(g, 3 * s, -6 * s, 2 * s, 1.5 * s, shade(base, -0.15));
  g.globalAlpha = 0.7 + Math.sin(t * 3) * 0.3;
  rect(g, -1 * s, -7 * s, 3 * s, 1, crack);
  rect(g, 1 * s, -6 * s, 1, 2 * s, crack);
  rect(g, -4 * s, -9 * s, 1, 2 * s, crack);
  g.globalAlpha = 1;
  // Arms
  blob(g, -7 * s, -6 * s + Math.round(Math.sin(a)), 2 * s, 2.5 * s, base);
  blob(g, 7 * s, -6 * s - Math.round(Math.sin(a)), 2 * s, 2.5 * s, base);
  eye(g, 2 * s, -11 * s, crack);
  eye(g, 4 * s, -11 * s, crack);
}

function gromp(g: G, ph: number): void {
  const skin = '#4f9a5a';
  const hop = Math.max(0, Math.sin(ph * Math.PI));
  const squash = 1 - hop * 0.2, lift = Math.round(hop * 3);
  // Back legs folded
  blob(g, -7, -2 - lift, 3, 2, shade(skin, -0.2));
  blob(g, 6, -2 - lift, 3, 2, shade(skin, -0.2));
  blob(g, 0, -6 - lift, 9, 5 * squash + hop, skin);
  ell(g, 1, -4 - lift, 6, 2.5, '#d8d08a');
  // Warts
  for (const [wx, wy] of [[-5, -9], [-2, -10], [4, -9], [-6, -6]]) rect(g, wx, wy - lift, 1, 1, shade(skin, -0.35));
  // Eyes on top
  for (const ex of [-3, 3]) {
    blob(g, ex, -12 - lift, 2, 2, skin);
    rect(g, ex - 1, -13 - lift, 2, 2, '#ffd84a');
    rect(g, ex, -13 - lift, 1, 1, OUT);
  }
  rect(g, 3, -6 - lift, 5, 1, OUT);
}

function drake(g: G, t: number, base = '#ff6b35'): void {
  const flap = Math.sin(t * 9);
  const wy = Math.round(flap * 6);
  // Far wing
  poly(g, [[-2, -16], [-12, -26 - wy], [-6, -15]], shade(base, -0.45));
  // Tail
  poly(g, [[-6, -14], [-16, -10], [-17, -12], [-6, -16]], OUT);
  poly(g, [[-6, -14], [-15, -11], [-6, -15]], shade(base, -0.2));
  poly(g, [[-16, -11], [-19, -13], [-17, -9]], '#ffd84a');
  blob(g, 0, -14, 7, 4, base);
  ell(g, 1, -12, 5, 1.5, '#ffd08a');
  // Neck and head
  blob(g, 6, -18, 2.5, 3, base);
  blob(g, 9, -21, 3.5, 2.5, base);
  rect(g, 11, -20, 3, 1, OUT);
  poly(g, [[8, -23], [6, -27], [9, -24]], '#efe6d6');
  poly(g, [[10, -23], [10, -27], [11, -23]], '#efe6d6');
  eye(g, 10, -22, '#fff27a');
  // Near wing
  poly(g, [[0, -16], [-6, -30 - wy], [6, -18]], OUT);
  poly(g, [[0, -16], [-5, -28 - wy], [5, -18]], shade(base, -0.2));
  // Legs tucked
  rect(g, -2, -10, 2, 2, shade(base, -0.4));
  rect(g, 3, -10, 2, 2, shade(base, -0.4));
}

function grub(g: G, ph: number, t: number, base = '#8e44ad', scale = 1): void {
  const segs: [number, number, number][] = [[-7, 2.5, 3], [-4, 3.5, 2], [0, 4.5, 1], [5, 5, 0]];
  for (const [sx, r, i] of segs) {
    const wob = Math.round(Math.sin(ph * Math.PI + i) * scale);
    blob(g, sx * scale, -(r + 1) * scale - wob, r * scale, r * scale, i ? base : shade(base, 0.1));
    poly(g, [[sx * scale - 1, -(2 * r + 1) * scale - wob], [sx * scale + 1, -(2 * r + 1) * scale - wob], [sx * scale, -(2 * r + 4) * scale - wob]], '#e056fd');
  }
  // Mandibles and glowing eyes
  rect(g, 9 * scale, -4 * scale, 2 * scale, 1, OUT);
  rect(g, 9 * scale, -2 * scale, 2 * scale, 1, OUT);
  g.globalAlpha = 0.7 + Math.sin(t * 5) * 0.3;
  eye(g, 7 * scale, -7 * scale, '#ff4df0');
  eye(g, 9 * scale, -6 * scale, '#ff4df0');
  g.globalAlpha = 1;
}

// ---------- Bosses ----------

function riftBeast(g: G, ph: number, t: number, base: string): void {
  const a = ph * Math.PI;
  for (const [lx, s] of [[-9, 1], [-4, -1], [4, -1], [9, 1]] as const) leg(g, lx, -Math.max(0, Math.round(Math.sin(a) * s * 2)), 6, 3, shade(base, -0.4));
  blob(g, 0, -16, 13, 9, base);
  // Shell plates
  for (const px0 of [-8, -2, 4]) ell(g, px0, -21, 3, 2, shade(base, 0.2));
  // Giant eye on its back
  ell(g, -1, -22, 5, 4, OUT);
  ell(g, -1, -22, 4, 3, '#f4f0ff');
  const look = Math.round(Math.sin(t * 1.5) * 1.5);
  ell(g, -1 + look, -22, 2, 2, '#8e44ad');
  rect(g, -1 + look, -22, 1, 1, OUT);
  // Claws
  poly(g, [[11, -12], [17, -16], [15, -10]], '#efe6d6');
  poly(g, [[11, -8], [17, -8], [14, -5]], '#efe6d6');
  eye(g, 10, -15, '#ff5a5a');
}

function baron(g: G, t: number): void {
  const base = '#6a2c91', sway = Math.sin(t * 1.5) * 2;
  // Body rising out of the ground
  const segs: [number, number, number][] = [[-10, -6, 7], [-6, -14, 8], [0, -22, 8.5], [5 + sway * 0.5, -30, 8]];
  ell(g, -8, -1, 12, 3, 'rgba(0,0,0,0.35)');
  for (const [sx, sy, r] of segs) {
    blob(g, sx, sy, r, r * 0.9, base);
    poly(g, [[sx - 2, sy - r], [sx + 2, sy - r], [sx, sy - r - 5]], '#d6a4ff');
  }
  // Head
  const hx = 12 + sway, hy = -36;
  blob(g, hx, hy, 9, 6.5, shade(base, 0.08));
  poly(g, [[hx - 6, hy - 5], [hx - 10, hy - 14], [hx - 3, hy - 6]], '#efe6d6');
  poly(g, [[hx - 1, hy - 6], [hx - 2, hy - 15], [hx + 2, hy - 6]], '#efe6d6');
  // Open maw with teeth
  const open = 2 + Math.round((Math.sin(t * 2) + 1) * 1.5);
  rect(g, hx + 2, hy + 1, 8, open + 1, '#2a0a1a');
  for (let i = 0; i < 4; i++) rect(g, hx + 3 + i * 2, hy + 1, 1, 1, '#ffffff');
  g.globalAlpha = 0.8 + Math.sin(t * 4) * 0.2;
  eye(g, hx + 3, hy - 2, '#ff4df0');
  eye(g, hx + 6, hy - 3, '#ff4df0');
  g.globalAlpha = 1;
}

function furball(g: G, ph: number): void {
  const bounce = Math.round(Math.abs(Math.sin(ph * Math.PI)) * 3);
  const y = -14 - bounce;
  rect(g, -6, -2, 4, 2, '#5a4030');
  rect(g, 3, -2, 4, 2, '#5a4030');
  blob(g, 0, y, 13, 11, '#f4f4f8', 0.2, -0.12);
  // Fluffy edge
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    rect(g, Math.round(Math.cos(a) * 13.5), Math.round(y + Math.sin(a) * 11.5), 1, 1, i % 2 ? OUT : '#ffffff');
  }
  // Horns, crown, face
  poly(g, [[-8, y - 8], [-12, y - 14], [-6, y - 10]], '#a07850');
  poly(g, [[8, y - 8], [12, y - 14], [6, y - 10]], '#a07850');
  rect(g, -4, y - 14, 9, 3, '#ffd84a');
  for (const cx of [-4, 0, 4]) rect(g, cx, y - 16, 1, 2, '#ffd84a');
  for (const ex of [-5, 3]) { ell(g, ex, y - 2, 2, 2.5, OUT); rect(g, ex - 1, y - 3, 1, 1, '#ffffff'); }
  rect(g, -2, y + 3, 5, 3, '#ff8fb0');
  rect(g, 0, y + 5, 1, 1, shade('#ff8fb0', -0.3));
}

function golem(g: G, ph: number, t: number, base: string, accent: string): void {
  const a = ph * Math.PI, step = Math.round(Math.sin(a) * 2);
  leg(g, -6, -Math.max(0, step), 8, 4, shade(base, -0.35));
  leg(g, 3, -Math.max(0, -step), 8, 4, shade(base, -0.35));
  blob(g, 0, -20, 11, 10, base, 0.25, -0.35);
  ell(g, -4, -24, 3, 2, shade(base, -0.15));
  ell(g, 4, -16, 3, 2, shade(base, -0.15));
  // Accent shards / plates
  poly(g, [[-9, -26], [-7, -36], [-4, -27]], accent);
  poly(g, [[5, -28], [8, -38], [10, -27]], accent);
  // Arms
  blob(g, -13, -16 + step, 4, 6, base);
  blob(g, 13, -16 - step, 4, 6, base);
  // Head
  blob(g, 1, -32, 5, 4, shade(base, 0.1));
  g.globalAlpha = 0.75 + Math.sin(t * 3) * 0.25;
  eye(g, 2, -33, accent);
  eye(g, 4, -33, accent);
  rect(g, -2, -21, 5, 1, accent);
  g.globalAlpha = 1;
}

function ghostKing(g: G, t: number, base = '#3dd6a3', crown = true): void {
  const y = -22 + Math.round(Math.sin(t * 2) * 2);
  g.globalAlpha = 0.9;
  // Wispy tail
  for (let i = 0; i < 4; i++) {
    const wx = Math.round(Math.sin(t * 3 + i) * 2);
    ell(g, wx - i, y + 9 + i * 3, 6 - i * 1.3, 2, shade(base, -0.1 - i * 0.1));
  }
  blob(g, 0, y, 9, 10, base, 0.4, -0.25);
  g.globalAlpha = 1;
  if (crown) {
    rect(g, -5, y - 12, 11, 3, '#ffd84a');
    for (const cx of [-5, -1, 3, 5]) rect(g, cx, y - 15, 1, 3, '#ffd84a');
    rect(g, 0, y - 11, 1, 1, '#ff5a5a');
  } else {
    // Spirit ears and a floating lotus
    poly(g, [[-7, y - 7], [-5, y - 16], [-2, y - 9]], shade(base, 0.2));
    poly(g, [[7, y - 7], [5, y - 16], [2, y - 9]], shade(base, 0.2));
    ell(g, 0, y - 13, 3, 1.2, '#fff0f6');
  }
  // Hollow eyes and sword
  rect(g, -3, y - 3, 2, 3, OUT);
  rect(g, 2, y - 3, 2, 3, OUT);
  eye(g, -2, y - 2, '#bfffe9');
  eye(g, 3, y - 2, '#bfffe9');
  for (let i = 0; i < 14; i++) rect(g, 10, y - 8 + i, 1, 1, '#cfe9e0');
  rect(g, 8, y + 3, 5, 1, '#ffd84a');
}

/** Height (low-res px) above the feet, for HP bars and effects. */
export const CREATURE_HEIGHT: Record<string, number> = {
  melee: 16, caster: 17, cannon: 14, super: 24, scuttle: 12, wolf: 15, raptor: 17, krug: 16, gromp: 16,
  drake: 30, herald: 14, riftherald: 28, baron: 50, poroking: 34, colossus: 40, sentinel: 40, fallenking: 40,
  petricite: 40, warbeast: 28, spiritguard: 40, automaton: 40,
  dem_minion: 16, dem_golem: 23, dem_hound: 15, dem_wing: 15, drake_mountain: 30,
  frl_minion: 16, frl_wolf: 15, frl_troll: 26, frl_shaman: 17, drake_ocean: 30,
  nox_minion: 16, nox_hound: 15, nox_basilisk: 20, nox_mage: 17,
  ion_minion: 16, ion_fox: 15, ion_crane: 16, ion_treant: 26, ion_wisp: 11, drake_cloud: 30,
};

/** scale > 1 draws the creature in HD (smooth vector mode) at that size multiplier. */
export function drawCreature(g: G, id: string, x: number, y: number, facing: number, ph: number, t: number, team: string, flash: boolean, scale = 1): void {
  const spr = sprite(id);
  if (spr) { drawSprite(g, spr, id, x, y, facing, ph, t, flash, scale); return; }
  g.save();
  smooth = scale > 1;
  g.translate(smooth ? x : Math.round(x), smooth ? y : Math.round(y));
  if (smooth) g.scale(scale, scale);
  if (facing < 0) g.scale(-1, 1);
  if (flash) g.filter = 'brightness(2.4)';
  switch (id) {
    case 'melee': minion(g, ph, team); break;
    case 'caster': caster(g, ph, t, team); break;
    case 'cannon': cannon(g, ph, team); break;
    case 'super': superMinion(g, ph, team); break;
    case 'scuttle': crab(g, ph); break;
    case 'wolf': wolf(g, ph); break;
    case 'raptor': raptor(g, ph, t); break;
    case 'krug': krug(g, ph, t); break;
    case 'gromp': gromp(g, ph); break;
    case 'drake': drake(g, t); break;
    case 'herald': grub(g, ph, t); break;
    case 'riftherald': riftBeast(g, ph, t, '#5b3a9e'); break;
    case 'baron': baron(g, t); break;
    case 'poroking': furball(g, ph); break;
    case 'colossus': golem(g, ph, t, '#9fc4dc', '#dff4ff'); break;
    case 'sentinel': golem(g, ph, t, '#c9a35a', '#4fe0ff'); break;
    case 'fallenking': ghostKing(g, t); break;
    case 'petricite': golem(g, ph, t, '#dfe5ee', '#ffd84a'); break;
    case 'warbeast': riftBeast(g, ph, t, '#8a1c2a'); break;
    case 'spiritguard': ghostKing(g, t, '#ff9ed2', false); break;
    case 'automaton': golem(g, ph, t, '#c9a35a', '#3fe0d0'); break;
    default: minion(g, ph, team);
  }
  smooth = false;
  g.restore();
}

/** False while a creature's vector art is still being decoded (callers should not cache what they draw). */
export function creatureReady(id: string): boolean {
  return sprite(id) !== null || !(DESIGN_SVG[id] ?? EXTRA_SVG[id] ?? REGION_SVG[id]);
}

// ---------- Vector sprites (cartoon bestiary): SVG pre-rendered once per type to an offscreen canvas ----------
interface Sprite { cv: HTMLCanvasElement; k: number } // k = canvas px per SVG unit
const sprites = new Map<string, Sprite | null>();
/** Top of the artwork (SVG y) so the drawn height matches CREATURE_HEIGHT. Feet are at y=184. */
const TOP: Record<string, number> = {
  melee: 24, caster: 10, cannon: 34, super: 4, scuttle: 56, wolf: 32, raptor: 22, krug: 48, gromp: 42, drake: 28,
  herald: 78, riftherald: 16, baron: 18, poroking: 18, colossus: 8, sentinel: 6, fallenking: 16, petricite: 16,
  warbeast: 24, spiritguard: 14, automaton: 0,
  dem_minion: 24, dem_golem: 40, dem_hound: 44, dem_wing: 24, drake_mountain: 28,
  frl_minion: 24, frl_wolf: 44, frl_troll: 16, frl_shaman: 10, drake_ocean: 28,
  nox_minion: 24, nox_hound: 44, nox_basilisk: 30, nox_mage: 10,
  ion_minion: 24, ion_fox: 44, ion_crane: 24, ion_treant: 4, ion_wisp: 56, drake_cloud: 28,
};
const FLOATERS = new Set(['drake', 'fallenking', 'spiritguard', 'caster', 'dem_wing', 'ion_crane', 'ion_wisp', 'frl_shaman', 'nox_mage', 'drake_mountain', 'drake_ocean', 'drake_cloud']);
const RES = 6; // canvas px per low-res px of creature height

function sprite(id: string): Sprite | null {
  if (sprites.has(id)) return sprites.get(id)!;
  const body = DESIGN_SVG[id] ?? EXTRA_SVG[id] ?? REGION_SVG[id];
  if (!body || typeof document === 'undefined') { sprites.set(id, null); return null; }
  const top = TOP[id] ?? 20;
  const k = (RES * (CREATURE_HEIGHT[id] ?? 16)) / (184 - top);
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(240 * k);
  cv.height = Math.ceil(200 * k);
  const spr: Sprite = { cv, k };
  sprites.set(id, null); // null until the image is decoded -> procedural fallback meanwhile
  const img = new Image();
  img.onload = () => {
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    sprites.set(id, spr);
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="${cv.width}" height="${cv.height}">${body}</svg>`);
  return null;
}

function drawSprite(g: G, spr: Sprite, id: string, x: number, y: number, facing: number, ph: number, t: number, flash: boolean, scale: number): void {
  const unit = (CREATURE_HEIGHT[id] ?? 16) / (184 - (TOP[id] ?? 20)); // low-res px per SVG unit
  const s = unit * scale;
  const hover = FLOATERS.has(id);
  const bob = hover ? Math.sin(t * 3 + ph) * 2.2 - 3 : -Math.abs(Math.sin(ph * Math.PI)) * 1.6;
  g.save();
  g.translate(scale > 1 ? x : Math.round(x), (scale > 1 ? y : Math.round(y)) + bob * scale);
  if (facing < 0) g.scale(-1, 1);
  if (flash) g.filter = 'brightness(2.4)';
  g.imageSmoothingEnabled = true;
  g.drawImage(spr.cv, -120 * s, -184 * s, 240 * s, 200 * s);
  g.restore();
}
