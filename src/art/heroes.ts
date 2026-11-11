// Original vector champions for the battle board: a small body per role, a weapon per champion,
// and the official portrait (loaded at runtime) as the head. Also draws each champion's projectile.
import type { Role } from '../types';
import { shade } from './color';

type G = CanvasRenderingContext2D;

export type Weapon =
  | 'bow' | 'crossbow' | 'gun' | 'rifle' | 'twin' | 'rocket' | 'blowgun' | 'cards' | 'staff' | 'orb' | 'bomb'
  | 'sword' | 'axe' | 'blades' | 'hammer' | 'none';
export type Shot = 'arrow' | 'bolt' | 'orb' | 'bullet' | 'rocket' | 'bomb' | 'dart' | 'shuriken' | 'card' | 'slash' | 'star';
export type Element = 'ice' | 'fire' | 'poison' | 'spark' | 'magic' | 'shadow';

export interface HeroLook { weapon: Weapon; shot: Shot; element: Element }

const L = (weapon: Weapon, shot: Shot, element: Element): HeroLook => ({ weapon, shot, element });

export const HERO_LOOK: Record<string, HeroLook> = {
  ashe: L('bow', 'arrow', 'ice'),
  lux: L('staff', 'orb', 'magic'),
  annie: L('orb', 'orb', 'fire'),
  caitlyn: L('rifle', 'bullet', 'spark'),
  jinx: L('rocket', 'rocket', 'fire'),
  teemo: L('blowgun', 'dart', 'poison'),
  tf: L('cards', 'card', 'spark'),
  gangplank: L('gun', 'bomb', 'fire'),
  soraka: L('staff', 'star', 'magic'),
  vayne: L('crossbow', 'bolt', 'spark'),
  ziggs: L('bomb', 'bomb', 'fire'),
  kogmaw: L('none', 'orb', 'poison'),
  yasuo: L('sword', 'slash', 'magic'),
  heimer: L('hammer', 'bolt', 'spark'),
  brand: L('orb', 'orb', 'fire'),
  morgana: L('orb', 'orb', 'shadow'),
  zed: L('blades', 'shuriken', 'shadow'),
  missfortune: L('twin', 'bullet', 'spark'),
  nasus: L('axe', 'slash', 'spark'),
  veigar: L('staff', 'orb', 'shadow'),
  anivia: L('none', 'orb', 'ice'),
  malzahar: L('orb', 'orb', 'shadow'),
  garen: L('sword', 'slash', 'spark'),
  darius: L('axe', 'slash', 'fire'),
  ahri: L('orb', 'orb', 'magic'),
  jayce: L('hammer', 'bolt', 'spark'),
};

const DEFAULT_LOOK: Record<Role, HeroLook> = {
  Tireur: L('bow', 'arrow', 'spark'),
  Mage: L('staff', 'orb', 'magic'),
  Combattant: L('sword', 'slash', 'spark'),
  Support: L('staff', 'star', 'magic'),
  Assassin: L('blades', 'shuriken', 'shadow'),
};

export const heroLook = (id: string, role: Role): HeroLook => HERO_LOOK[id] ?? DEFAULT_LOOK[role];

/** Two particle colours for an impact of this element (magic uses the champion's own colour). */
export function impactColors(el: Element, color: string): [string, string] {
  switch (el) {
    case 'ice': return ['#e8f7ff', '#8fd3ff'];
    case 'fire': return ['#ffb347', '#ff5a2a'];
    case 'poison': return ['#c6f56a', '#5aa02c'];
    case 'spark': return ['#fff3b0', '#ffd84a'];
    case 'shadow': return ['#b07cd8', '#3a1f52'];
    default: return [color, '#ffffff'];
  }
}

const GOLD = '#c8aa6e', GOLD_DARK = '#785a28', STEEL = '#cfd6e0', STEEL_DARK = '#6c7686', WOOD = '#7a5230', INK = '#010a13';

function rr(g: G, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function glowOrb(g: G, x: number, y: number, r: number, color: string): void {
  const grad = g.createRadialGradient(x, y, 0, x, y, r * 2.2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r * 2.2, 0, Math.PI * 2);
  g.fill();
}

/** Weapon drawn along +x from the hand (origin). */
function drawWeapon(g: G, w: Weapon, color: string, clock: number, drawn: boolean): void {
  g.lineCap = 'round';
  switch (w) {
    case 'bow': {
      g.strokeStyle = WOOD; g.lineWidth = 2.6;
      g.beginPath(); g.arc(1, 0, 11, -1.15, 1.15); g.stroke();
      g.strokeStyle = color; g.lineWidth = 1.2;
      g.beginPath(); g.arc(1, 0, 11, -1.15, -0.75); g.stroke();
      g.beginPath(); g.arc(1, 0, 11, 0.75, 1.15); g.stroke();
      const sx = 1 + Math.cos(1.15) * 11, sy = Math.sin(1.15) * 11, pull = drawn ? -3 : 3;
      g.strokeStyle = '#e8eef5'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(sx, -sy); g.lineTo(sx + pull - 3, 0); g.lineTo(sx, sy); g.stroke();
      if (drawn) { g.strokeStyle = color; g.lineWidth = 1.6; g.beginPath(); g.moveTo(sx - 6, 0); g.lineTo(15, 0); g.stroke(); }
      break;
    }
    case 'crossbow':
      g.fillStyle = WOOD; rr(g, -2, -1.6, 15, 3.2, 1); g.fill();
      g.strokeStyle = STEEL; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(10, -7); g.quadraticCurveTo(14, 0, 10, 7); g.stroke();
      g.strokeStyle = '#e8eef5'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(10, -7); g.lineTo(5, 0); g.lineTo(10, 7); g.stroke();
      break;
    case 'gun':
      g.fillStyle = STEEL_DARK; rr(g, 0, -2, 12, 4, 1); g.fill();
      g.fillStyle = WOOD; rr(g, -1, 0, 4, 6, 1); g.fill();
      g.fillStyle = GOLD; g.fillRect(10, -2, 2, 4);
      break;
    case 'rifle':
      g.fillStyle = WOOD; rr(g, -6, -1.5, 9, 4.5, 1); g.fill();
      g.fillStyle = STEEL_DARK; rr(g, 1, -1.4, 19, 2.8, 1); g.fill();
      g.fillStyle = GOLD; g.fillRect(6, -3.6, 5, 2.2);
      g.fillStyle = color; g.fillRect(18, -1.4, 2, 2.8);
      break;
    case 'twin':
      for (const o of [-3.5, 3.5]) {
        g.fillStyle = STEEL_DARK; rr(g, 0, o - 1.6, 11, 3.2, 1); g.fill();
        g.fillStyle = GOLD; g.fillRect(9, o - 1.6, 2, 3.2);
      }
      break;
    case 'rocket':
      g.fillStyle = color; rr(g, -5, -4.5, 20, 9, 3); g.fill();
      g.fillStyle = INK; g.beginPath(); g.arc(15, 0, 3.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(8 + i * 2.4, -4.5); g.lineTo(9.2 + i * 2.4, -2); g.lineTo(10.4 + i * 2.4, -4.5); g.fill(); }
      g.fillStyle = STEEL_DARK; g.fillRect(-2, 4, 3, 4);
      break;
    case 'blowgun':
      g.strokeStyle = WOOD; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-2, 0); g.lineTo(15, 0); g.stroke();
      g.strokeStyle = color; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(3, 0); g.lineTo(5, 0); g.stroke();
      break;
    case 'cards':
      for (let i = -1; i <= 1; i++) {
        g.save(); g.translate(7, 0); g.rotate(i * 0.42);
        g.fillStyle = i === 0 ? color : '#f0e6d2'; rr(g, 0, -3, 9, 6, 1); g.fill();
        g.strokeStyle = GOLD_DARK; g.lineWidth = 0.8; g.stroke();
        g.restore();
      }
      break;
    case 'staff':
      g.strokeStyle = WOOD; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-8, 0); g.lineTo(13, 0); g.stroke();
      g.strokeStyle = GOLD; g.lineWidth = 1.6;
      g.beginPath(); g.arc(15, 0, 4.2, 0.9, Math.PI * 2 - 0.9); g.stroke();
      glowOrb(g, 15, 0, 2.6 + Math.sin(clock * 4) * 0.4, color);
      break;
    case 'orb':
      glowOrb(g, 11, Math.sin(clock * 3) * 1.5, 4 + Math.sin(clock * 5) * 0.5, color);
      break;
    case 'bomb':
      g.fillStyle = '#1b1f27'; g.beginPath(); g.arc(9, 0, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = STEEL_DARK; g.lineWidth = 1; g.stroke();
      g.strokeStyle = WOOD; g.lineWidth = 1.2; g.beginPath(); g.moveTo(12.5, -3.5); g.lineTo(15, -6); g.stroke();
      glowOrb(g, 15.5, -6.5, 1.2 + Math.random() * 0.6, '#ffb347');
      break;
    case 'sword':
      g.fillStyle = STEEL; g.beginPath(); g.moveTo(3, -2.4); g.lineTo(19, -1.6); g.lineTo(23, 0); g.lineTo(19, 1.6); g.lineTo(3, 2.4); g.closePath(); g.fill();
      g.strokeStyle = STEEL_DARK; g.lineWidth = 0.7; g.beginPath(); g.moveTo(4, 0); g.lineTo(21, 0); g.stroke();
      g.fillStyle = GOLD; rr(g, 1.5, -5, 2.6, 10, 1); g.fill();
      g.fillStyle = color; rr(g, -4, -1.3, 6, 2.6, 1); g.fill();
      break;
    case 'axe':
      g.strokeStyle = WOOD; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(-6, 0); g.lineTo(17, 0); g.stroke();
      g.fillStyle = STEEL; g.beginPath(); g.moveTo(11, -1); g.quadraticCurveTo(15, -11, 22, -8); g.quadraticCurveTo(19, -1, 22, 6); g.quadraticCurveTo(15, 9, 11, 1); g.closePath(); g.fill();
      g.strokeStyle = color; g.lineWidth = 1.2; g.stroke();
      break;
    case 'blades':
      for (const o of [-3, 3]) {
        g.fillStyle = STEEL; g.beginPath(); g.moveTo(1, o - 1.4); g.lineTo(13, o - 0.6); g.lineTo(16, o); g.lineTo(13, o + 0.6); g.lineTo(1, o + 1.4); g.closePath(); g.fill();
        g.fillStyle = color; g.fillRect(-1, o - 1.6, 2.4, 3.2);
      }
      break;
    case 'hammer':
      g.strokeStyle = STEEL_DARK; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(-5, 0); g.lineTo(13, 0); g.stroke();
      g.fillStyle = STEEL; rr(g, 11, -6, 9, 12, 2); g.fill();
      g.fillStyle = color; rr(g, 13, -3.5, 5, 7, 1); g.fill();
      break;
    case 'none':
      break;
  }
}

/** Distance from the hand to the muzzle / tip, for the firing flash. */
const TIP: Record<Weapon, number> = {
  bow: 14, crossbow: 14, gun: 13, rifle: 21, twin: 12, rocket: 17, blowgun: 16, cards: 16, staff: 16, orb: 12, bomb: 10,
  sword: 22, axe: 20, blades: 16, hammer: 20, none: 8,
};

export interface HeroPose {
  /** Feet position (centre). */
  x: number;
  y: number;
  /** Aim angle (radians). */
  angle: number;
  /** 0..1 right after an attack. */
  recoil: number;
  clock: number;
  /** Phase offset so champions do not breathe in sync. */
  seed: number;
  img: HTMLImageElement | null;
  initials: string;
  color: string;
  role: Role;
  look: HeroLook;
  /** Frame colour of the head (rarity / selection). */
  frame: string;
}

/** Height of the head centre above the feet (for badges drawn by the caller). */
export const HERO_HEAD = 33;

export function drawHero(g: G, p: HeroPose): void {
  const face = Math.cos(p.angle) >= 0 ? 1 : -1;
  const bob = Math.sin(p.clock * 2.2 + p.seed) * 0.9;
  const dark = shade(p.color, -0.45), mid = shade(p.color, -0.2), light = shade(p.color, 0.25);
  const robe = p.role === 'Mage' || p.role === 'Support';
  const wide = p.role === 'Combattant';
  const hw = wide ? 9.5 : robe ? 7.5 : 7;
  const top = -23 + bob, waist = -10;

  g.save();
  g.translate(p.x, p.y);
  g.lineJoin = 'round';

  // Cape / scarf behind the body
  if (wide || p.role === 'Assassin') {
    const sway = Math.sin(p.clock * 2.6 + p.seed) * 2;
    g.fillStyle = wide ? dark : '#1b1f27';
    g.beginPath();
    g.moveTo(-face * 4, top + 2);
    g.quadraticCurveTo(-face * (13 + sway), top + 10, -face * (11 + sway), -2);
    g.lineTo(-face * 3, -5);
    g.closePath();
    g.fill();
  }

  // Legs or robe
  if (robe) {
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(-hw + 1, waist - 2); g.lineTo(hw - 1, waist - 2); g.lineTo(hw + 2.5, 0); g.lineTo(-hw - 2.5, 0);
    g.closePath(); g.fill();
    g.fillStyle = GOLD_DARK; g.fillRect(-hw - 2.5, -2, hw * 2 + 5, 2);
  } else {
    g.fillStyle = '#232a36';
    rr(g, -5.5, waist - 1, 4.5, 9, 1.5); g.fill();
    rr(g, 1, waist - 1, 4.5, 9, 1.5); g.fill();
    g.fillStyle = dark;
    rr(g, -6.5, -3.5, 6, 3.5, 1.2); g.fill();
    rr(g, 0.5, -3.5, 6, 3.5, 1.2); g.fill();
  }

  // Back arm
  g.strokeStyle = mid; g.lineWidth = 3.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-face * (hw - 1.5), top + 4); g.lineTo(-face * (hw + 1), top + 11); g.stroke();

  // Torso
  const body = g.createLinearGradient(0, top, 0, waist);
  body.addColorStop(0, light);
  body.addColorStop(1, mid);
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(-hw, top + 2); g.quadraticCurveTo(0, top - 2, hw, top + 2);
  g.lineTo(hw - 1.5, waist); g.lineTo(-hw + 1.5, waist);
  g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
  // Chest trim + belt
  g.strokeStyle = GOLD; g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(-3, top + 2.5); g.lineTo(0, top + 7); g.lineTo(3, top + 2.5); g.stroke();
  g.fillStyle = GOLD_DARK; g.fillRect(-hw + 1.5, waist - 2.2, hw * 2 - 3, 2.2);
  g.fillStyle = GOLD; g.fillRect(-1.5, waist - 2.6, 3, 3);
  if (wide) {
    for (const s of [-1, 1]) {
      g.fillStyle = STEEL; g.beginPath(); g.ellipse(s * hw, top + 3, 4.6, 3.6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = GOLD_DARK; g.lineWidth = 0.9; g.stroke();
    }
  }
  if (p.role === 'Support') {
    g.strokeStyle = 'rgba(255,240,180,0.9)'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(0, -HERO_HEAD - 13 + bob, 7, 2.2, 0, 0, Math.PI * 2); g.stroke();
  }

  // Head: official portrait in a framed medallion
  const hy = -HERO_HEAD + bob, R = 11;
  g.fillStyle = INK; g.beginPath(); g.arc(0, hy, R + 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = p.frame; g.beginPath(); g.arc(0, hy, R + 1.5, 0, Math.PI * 2); g.fill();
  g.save();
  g.beginPath(); g.arc(0, hy, R, 0, Math.PI * 2); g.clip();
  if (p.img) {
    const s = R * 2.3;
    g.drawImage(p.img, -s / 2, hy - s / 2, s, s);
  } else {
    g.fillStyle = p.color; g.fillRect(-R, hy - R, R * 2, R * 2);
    g.fillStyle = INK; g.font = 'bold 10px "Source Sans 3", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(p.initials, 0, hy + 0.5);
    g.textBaseline = 'alphabetic';
  }
  if (p.recoil > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(1, p.recoil) * 0.3})`; g.fillRect(-R, hy - R, R * 2, R * 2); }
  g.restore();

  // Weapon arm, aimed at the target
  const sx = face * (hw - 2), sy = top + 5;
  const kick = Math.min(1, p.recoil) * 3.5;
  const hx = sx + Math.cos(p.angle) * (7 - kick), hyy = sy + Math.sin(p.angle) * (7 - kick) * 0.8;
  g.strokeStyle = mid; g.lineWidth = 3.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hyy); g.stroke();
  g.save();
  g.translate(hx, hyy);
  g.rotate(p.angle);
  if (face < 0) g.scale(1, -1);
  drawWeapon(g, p.look.weapon, p.color, p.clock, p.recoil <= 0);
  if (p.recoil > 0.35 && p.look.weapon !== 'none') {
    const [c1] = impactColors(p.look.element, p.color);
    g.globalAlpha = Math.min(1, p.recoil);
    glowOrb(g, TIP[p.look.weapon], 0, 3.2, c1);
    g.globalAlpha = 1;
  }
  g.restore();
  g.fillStyle = '#f2c9a0'; g.beginPath(); g.arc(hx, hyy, 2, 0, Math.PI * 2); g.fill();

  g.restore();
}

/** Draws one projectile at (x, y) heading along `ang`. */
export function drawShot(g: G, look: HeroLook, color: string, x: number, y: number, ang: number, clock: number): void {
  const [c1, c2] = impactColors(look.element, color);
  g.save();
  g.translate(x, y);
  g.lineCap = 'round';
  switch (look.shot) {
    case 'arrow':
      g.rotate(ang);
      g.shadowColor = c2; g.shadowBlur = 8;
      g.strokeStyle = c1; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-11, 0); g.lineTo(4, 0); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(8, 0); g.lineTo(2, -3.2); g.lineTo(2, 3.2); g.closePath(); g.fill();
      g.strokeStyle = c2; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-11, 0); g.lineTo(-14, -3); g.moveTo(-11, 0); g.lineTo(-14, 3); g.stroke();
      break;
    case 'bolt':
      g.rotate(ang);
      g.shadowColor = color; g.shadowBlur = 10;
      g.strokeStyle = color; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-8, 0); g.lineTo(5, 0); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-6, 0); g.lineTo(6, 0); g.stroke();
      break;
    case 'bullet':
      g.rotate(ang);
      g.shadowColor = c2; g.shadowBlur = 6;
      g.strokeStyle = c2; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(-12, 0); g.lineTo(2, 0); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-3, 0); g.lineTo(4, 0); g.stroke();
      break;
    case 'rocket':
      g.rotate(ang);
      glowOrb(g, -9, 0, 3 + Math.random() * 1.5, '#ffb347');
      g.fillStyle = color; rr(g, -7, -3, 12, 6, 2.5); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(9, 0); g.lineTo(4.5, -3); g.lineTo(4.5, 3); g.closePath(); g.fill();
      g.fillStyle = INK; g.fillRect(-7, -4.5, 3, 1.5); g.fillRect(-7, 3, 3, 1.5);
      break;
    case 'bomb':
      g.fillStyle = '#1b1f27'; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = STEEL_DARK; g.lineWidth = 1; g.stroke();
      glowOrb(g, Math.cos(clock * 18) * 5, Math.sin(clock * 18) * 5, 1.6, '#ffb347');
      break;
    case 'dart':
      g.rotate(ang);
      g.shadowColor = c2; g.shadowBlur = 6;
      g.strokeStyle = c1; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(-8, 0); g.lineTo(6, 0); g.stroke();
      g.fillStyle = '#e84057'; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-12, -3); g.lineTo(-12, 3); g.closePath(); g.fill();
      break;
    case 'shuriken':
      g.rotate(clock * 22);
      g.shadowColor = color; g.shadowBlur = 8;
      g.fillStyle = STEEL;
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 2.4 : 7.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill();
      g.fillStyle = color; g.beginPath(); g.arc(0, 0, 1.6, 0, Math.PI * 2); g.fill();
      break;
    case 'card':
      g.rotate(clock * 16);
      g.shadowColor = color; g.shadowBlur = 8;
      g.fillStyle = color; rr(g, -3.5, -5, 7, 10, 1.2); g.fill();
      g.strokeStyle = '#f0e6d2'; g.lineWidth = 1; g.stroke();
      break;
    case 'slash':
      g.rotate(ang);
      g.shadowColor = color; g.shadowBlur = 10;
      g.strokeStyle = color; g.lineWidth = 4;
      g.beginPath(); g.arc(-8, 0, 12, -0.85, 0.85); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(-8, 0, 12, -0.6, 0.6); g.stroke();
      break;
    case 'star':
      g.rotate(clock * 6);
      g.shadowColor = color; g.shadowBlur = 10;
      g.fillStyle = '#ffffff';
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? 2.6 : 6.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill();
      g.strokeStyle = color; g.lineWidth = 1.2; g.stroke();
      break;
    default: {
      // orb: glowing sphere, darker core for shadow magic
      glowOrb(g, 0, 0, 4.2, look.element === 'magic' ? color : c1);
      if (look.element === 'shadow') { g.fillStyle = '#1a0f24'; g.beginPath(); g.arc(0, 0, 2.4, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = c2; g.globalAlpha = 0.7; g.lineWidth = 1;
      g.beginPath(); g.ellipse(0, 0, 6.5, 2.6, clock * 6, 0, Math.PI * 2); g.stroke();
      break;
    }
  }
  g.restore();
}

/** Shots that keep the soft coloured trail behind them. */
export const hasTrail = (s: Shot): boolean => s === 'orb' || s === 'rocket' || s === 'bolt' || s === 'star' || s === 'bomb';
