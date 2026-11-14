// Original vector champions for the battle board: a small body per role, a weapon per champion,
// and the official portrait (loaded at runtime) as the head. Attacks are animated in three beats
// (wind-up, strike, recovery). Also draws each champion's projectile.
import type { Role } from '../types';
import { shade } from './color';
import { angDiff, drawGlow } from './glow';

type G = CanvasRenderingContext2D;

export type Weapon =
  | 'bow' | 'crossbow' | 'gun' | 'rifle' | 'twin' | 'rocket' | 'cannon' | 'blowgun' | 'cards' | 'staff' | 'orb' | 'bomb'
  | 'sword' | 'axe' | 'blades' | 'none';
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
  heimer: L('cannon', 'bolt', 'spark'),
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
  jayce: L('cannon', 'bolt', 'spark'),
  lillia: L('staff', 'orb', 'magic'),
};

const DEFAULT_LOOK: Record<Role, HeroLook> = {
  Tireur: L('bow', 'arrow', 'spark'),
  Mage: L('staff', 'orb', 'magic'),
  Combattant: L('sword', 'slash', 'spark'),
  Support: L('staff', 'star', 'magic'),
  Assassin: L('blades', 'shuriken', 'shadow'),
};

export const heroLook = (id: string, role: Role): HeroLook => HERO_LOOK[id] ?? DEFAULT_LOOK[role];

/** Projectile speed in tiles per second. */
export const SHOT_SPEED: Record<Shot, number> = {
  arrow: 17, bolt: 20, orb: 12.5, bullet: 26, rocket: 11.5, bomb: 10.5, dart: 18, shuriken: 17, card: 15, slash: 34, star: 13,
};
/** Height of a lobbed shot's arc, as a fraction of its flight distance. */
export const SHOT_ARC: Partial<Record<Shot, number>> = { bomb: 0.3, arrow: 0.05, star: 0.1, card: 0.04 };

const IMPACT: Record<Exclude<Element, 'magic'>, [string, string]> = {
  ice: ['#e8f7ff', '#8fd3ff'],
  fire: ['#ffb347', '#ff5a2a'],
  poison: ['#c6f56a', '#5aa02c'],
  spark: ['#fff3b0', '#ffd84a'],
  shadow: ['#b07cd8', '#3a1f52'],
};
const LIGHT: Record<Exclude<Element, 'magic'>, string> = { ice: '#8fd3ff', fire: '#ff8a3d', poison: '#a6e84a', spark: '#ffd070', shadow: '#b07cd8' };
/** Colour of the light an attack of this element casts on its surroundings. */
export const lightColor = (el: Element, color: string): string => (el === 'magic' ? color : LIGHT[el]);
const magicPairs = new Map<string, [string, string]>();

/** Two colours for the particles and light of this element (magic uses the champion's own colour). */
export function impactColors(el: Element, color: string): [string, string] {
  if (el !== 'magic') return IMPACT[el];
  let pair = magicPairs.get(color);
  if (!pair) magicPairs.set(color, pair = [color, '#ffffff']);
  return pair;
}

const GOLD = '#c8aa6e', GOLD_DARK = '#785a28', STEEL = '#cfd6e0', STEEL_DARK = '#6c7686', WOOD = '#7a5230', INK = '#010a13';
const MELEE = new Set<Weapon>(['sword', 'axe', 'blades']);
const GUNLIKE = new Set<Weapon>(['gun', 'rifle', 'twin', 'rocket', 'cannon', 'crossbow', 'blowgun']);

function rr(g: G, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** Additive glow (light). Leaves the blend mode back on the default. */
function glow(g: G, x: number, y: number, r: number, color: string, a = 1): void {
  g.globalCompositeOperation = 'lighter';
  drawGlow(g, x, y, r, color, a);
  g.globalCompositeOperation = 'source-over';
}

/** What the weapon is doing right now. */
interface WeaponPose {
  /** 0..1 wound back (bow string drawn, arm cocked). */
  back: number;
  /** 0..1 follow-through after the strike. */
  fwd: number;
  /** 0..1 building up before the attack. */
  charge: number;
  /** 1 at the instant of the attack, fading to 0. */
  flash: number;
}

/** Weapon drawn along +x from the hand (origin). */
function drawWeapon(g: G, w: Weapon, color: string, clock: number, a: WeaponPose): void {
  switch (w) {
    case 'bow': {
      const bend = 1 + a.back * 0.12, cx = 1 - a.back * 1.5;
      g.strokeStyle = WOOD; g.lineWidth = 2.6;
      g.beginPath(); g.arc(cx, 0, 11, -1.15 * bend, 1.15 * bend); g.stroke();
      g.strokeStyle = color; g.lineWidth = 1.3;
      g.beginPath(); g.arc(cx, 0, 11, -1.15 * bend, -0.75 * bend); g.stroke();
      g.beginPath(); g.arc(cx, 0, 11, 0.75 * bend, 1.15 * bend); g.stroke();
      const tx = cx + Math.cos(1.15 * bend) * 11, ty = Math.sin(1.15 * bend) * 11;
      const mid = tx - 1 - a.back * 7 + a.flash * 2; // string: pulled back, then snaps past its rest
      g.strokeStyle = '#e8eef5'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(tx, -ty); g.lineTo(mid, 0); g.lineTo(tx, ty); g.stroke();
      if (a.back > 0.12) {
        // Nocked arrow, its tip glowing as the shot charges
        g.strokeStyle = color; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(mid, 0); g.lineTo(mid + 17, 0); g.stroke();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.moveTo(mid + 20.5, 0); g.lineTo(mid + 15.5, -2.4); g.lineTo(mid + 15.5, 2.4); g.closePath(); g.fill();
        glow(g, mid + 19, 0, 4 + a.charge * 5, color, 0.35 + a.charge * 0.5);
      }
      break;
    }
    case 'crossbow': {
      g.fillStyle = WOOD; rr(g, -2, -1.6, 15, 3.2, 1); g.fill();
      g.strokeStyle = STEEL; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(10, -7); g.quadraticCurveTo(14 - a.back * 2, 0, 10, 7); g.stroke();
      const mid = 5 - a.back * 3 + a.flash * 4;
      g.strokeStyle = '#e8eef5'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(10, -7); g.lineTo(mid, 0); g.lineTo(10, 7); g.stroke();
      if (a.flash < 0.3) { g.strokeStyle = color; g.lineWidth = 1.5; g.beginPath(); g.moveTo(mid, 0); g.lineTo(15, 0); g.stroke(); }
      break;
    }
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
      g.strokeStyle = INK; g.lineWidth = 0.8; g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(15, 0, 3.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(8 + i * 2.4, -4.5); g.lineTo(9.2 + i * 2.4, -2); g.lineTo(10.4 + i * 2.4, -4.5); g.fill(); }
      g.fillStyle = STEEL_DARK; g.fillRect(-2, 4, 3, 4);
      break;
    case 'cannon':
      // Hextech blaster: steel barrel, glowing cell that brightens as it charges
      g.fillStyle = STEEL_DARK; rr(g, -4, -3.4, 12, 6.8, 2); g.fill();
      g.fillStyle = STEEL; rr(g, 6, -2.4, 12, 4.8, 1.2); g.fill();
      g.fillStyle = GOLD; g.fillRect(4.5, -3.8, 2.4, 7.6);
      g.fillStyle = color; rr(g, -2, -1.6, 5, 3.2, 1); g.fill();
      glow(g, 0.5, 0, 4 + a.charge * 5, color, 0.4 + a.charge * 0.5);
      break;
    case 'blowgun':
      g.strokeStyle = WOOD; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-2, 0); g.lineTo(15, 0); g.stroke();
      g.strokeStyle = color; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(3, 0); g.lineTo(5, 0); g.stroke();
      break;
    case 'cards':
      for (let i = -1; i <= 1; i++) {
        g.save(); g.translate(7, 0); g.rotate(i * (0.42 + a.charge * 0.3));
        g.fillStyle = i === 0 ? color : '#f0e6d2'; rr(g, 0, -3, 9, 6, 1); g.fill();
        g.strokeStyle = GOLD_DARK; g.lineWidth = 0.8; g.stroke();
        g.restore();
      }
      if (a.charge > 0) glow(g, 12, 0, 5 + a.charge * 5, color, a.charge * 0.7);
      break;
    case 'staff':
      g.strokeStyle = WOOD; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-8, 0); g.lineTo(13, 0); g.stroke();
      g.strokeStyle = GOLD; g.lineWidth = 1.6;
      g.beginPath(); g.arc(15, 0, 4.2, 0.9, Math.PI * 2 - 0.9); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(15, 0, 1.8 + a.charge * 1.2, 0, Math.PI * 2); g.fill();
      glow(g, 15, 0, 7 + Math.sin(clock * 4) * 1 + a.charge * 8 + a.flash * 9, color, 0.75);
      break;
    case 'orb': {
      const r = Math.max(1.2, 4 + Math.sin(clock * 5) * 0.5 + a.charge * 2.6 - a.fwd * 3);
      const oy = Math.sin(clock * 3) * 1.5;
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(11, oy, r * 0.45, 0, Math.PI * 2); g.fill();
      glow(g, 11, oy, r * 2.4 + a.flash * 6, color, 0.9);
      break;
    }
    case 'bomb':
      if (a.fwd > 0.45) break; // already thrown
      g.fillStyle = '#1b1f27'; g.beginPath(); g.arc(9, 0, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = STEEL_DARK; g.lineWidth = 1; g.stroke();
      g.strokeStyle = WOOD; g.lineWidth = 1.2; g.beginPath(); g.moveTo(12.5, -3.5); g.lineTo(15, -6); g.stroke();
      glow(g, 15.5, -6.5, 3 + Math.random() * 1.5 + a.charge * 3, '#ffb347', 0.9);
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
    case 'none':
      break;
  }
}

/** Distance from the hand to the muzzle / tip, for the firing flash. */
const TIP: Record<Weapon, number> = {
  bow: 14, crossbow: 15, gun: 13, rifle: 21, twin: 12, rocket: 17, cannon: 19, blowgun: 16, cards: 16, staff: 16, orb: 12, bomb: 10,
  sword: 22, axe: 20, blades: 16, none: 8,
};

/** Star-shaped burst at the muzzle, k: 1 at the shot, fading to 0. */
function muzzle(g: G, x: number, k: number, color: string): void {
  g.globalCompositeOperation = 'lighter';
  drawGlow(g, x + 2, 0, 5 + 9 * k, color, k);
  const prev = g.globalAlpha;
  g.globalAlpha = prev * k;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(x, -1.5); g.lineTo(x + 4, -5 * k - 1.5); g.lineTo(x + 3.2, -1.2); g.lineTo(x + 11 * k + 4, 0);
  g.lineTo(x + 3.2, 1.2); g.lineTo(x + 4, 5 * k + 1.5); g.lineTo(x, 1.5);
  g.closePath();
  g.fill();
  g.globalAlpha = prev;
  g.globalCompositeOperation = 'source-over';
}

export interface HeroPose {
  /** Feet position (centre). */
  x: number;
  y: number;
  /** Smoothed aim angle (radians) and facing side. */
  aim: number;
  face: 1 | -1;
  /** Attack beat: 0 at rest, -1 fully wound back, +1 end of the follow-through. */
  swing: number;
  /** 0..1 while the attack builds up (glows grow). */
  charge: number;
  /** 1 at the instant of the attack, fading to 0 (muzzle flash, blade trail). */
  flash: number;
  /** 0 when idle, else 0..1 progress of the ultimate pose. */
  ult: number;
  /** 0..1 progress of the drop onto the board (1 = settled). */
  spawn: number;
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
  const { face, look } = p, w = look.weapon;
  const s = p.swing, back = Math.max(0, -s), fwd = Math.max(0, s);
  const ultK = p.ult > 0 && p.ult < 1 ? Math.sin(Math.PI * p.ult) : 0;
  const bob = Math.sin(p.clock * 2.2 + p.seed) * 0.9;
  const dark = shade(p.color, -0.45), mid = shade(p.color, -0.2), light = shade(p.color, 0.25);
  const robe = p.role === 'Mage' || p.role === 'Support';
  const wide = p.role === 'Combattant';
  const hw = wide ? 9.5 : robe ? 7.5 : 7;
  const waist = -10, top = -23 + bob;

  // Drop onto the board, then a short squash on landing
  const sp = p.spawn;
  const drop = sp < 0.7 ? -((1 - sp / 0.7) ** 2) * 44 : 0;
  const squash = sp >= 0.7 && sp < 1 ? Math.sin(((sp - 0.7) / 0.3) * Math.PI) * 0.16 : 0;

  g.save();
  g.translate(p.x, p.y + drop - ultK * 7);
  if (sp < 0.5) g.globalAlpha *= sp / 0.5;
  if (squash) g.scale(1 + squash * 0.7, 1 - squash);
  const A = g.globalAlpha;
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // Ultimate: a column of light rises behind the champion
  if (ultK > 0) {
    g.globalCompositeOperation = 'lighter';
    drawGlow(g, 0, -24, 30, p.color, ultK * 0.95, 62);
    drawGlow(g, 0, -1, 32, '#ffffff', ultK * 0.55, 9);
    g.globalCompositeOperation = 'source-over';
  }

  // Cape / scarf behind the body, pulled by the swing
  if (wide || p.role === 'Assassin') {
    const sway = Math.sin(p.clock * 2.6 + p.seed) * 2 + s * 3.5;
    g.fillStyle = wide ? dark : '#1b1f27';
    g.beginPath();
    g.moveTo(-face * 4, top + 2);
    g.quadraticCurveTo(-face * (13 + sway), top + 10, -face * (11 + sway), -2);
    g.lineTo(-face * 3, -5);
    g.closePath();
    g.fill();
  }

  // Legs or robe (planted: only the upper body moves with the attack)
  if (robe) {
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(-hw + 1, waist - 2); g.lineTo(hw - 1, waist - 2); g.lineTo(hw + 2.5, 0); g.lineTo(-hw - 2.5, 0);
    g.closePath(); g.fill();
    g.fillStyle = GOLD_DARK; g.fillRect(-hw - 2.5, -2, hw * 2 + 5, 2);
  } else {
    const step = wide ? 1.5 + fwd * 1.5 : fwd; // front foot slides forward on the strike
    g.fillStyle = '#232a36';
    rr(g, -5.5 - (face < 0 ? step : 0), waist - 1, 4.5, 9, 1.5); g.fill();
    rr(g, 1 + (face > 0 ? step : 0), waist - 1, 4.5, 9, 1.5); g.fill();
    g.fillStyle = dark;
    rr(g, -6.5 - (face < 0 ? step : 0), -3.5, 6, 3.5, 1.2); g.fill();
    rr(g, 0.5 + (face > 0 ? step : 0), -3.5, 6, 3.5, 1.2); g.fill();
  }

  // Upper body: leans back on the wind-up, into the blow on the strike
  g.save();
  g.translate(0, waist);
  g.rotate(face * s * 0.13 * (1 - ultK));
  g.translate(Math.cos(p.aim) * fwd * 2.2, -waist);

  // Back arm counterbalances the weapon arm
  g.strokeStyle = mid; g.lineWidth = 3.6;
  g.beginPath(); g.moveTo(-face * (hw - 1.5), top + 4); g.lineTo(-face * (hw + 1 + back * 2), top + 11 - ultK * 12); g.stroke();

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
    for (const sd of [-1, 1]) {
      g.fillStyle = STEEL; g.beginPath(); g.ellipse(sd * hw, top + 3, 4.6, 3.6, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = GOLD_DARK; g.lineWidth = 0.9; g.stroke();
    }
  }
  if (p.role === 'Support') {
    g.strokeStyle = 'rgba(255,240,180,0.9)'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(0, -HERO_HEAD - 13 + bob, 7, 2.2, 0, 0, Math.PI * 2); g.stroke();
  }

  // Head: official portrait in a framed medallion. Champions without a weapon lunge with it.
  const hx0 = w === 'none' ? Math.cos(p.aim) * (fwd * 4 - back * 2) : 0;
  const hy = -HERO_HEAD + bob + (w === 'none' ? Math.sin(p.aim) * (fwd * 3 - back * 1.5) : 0), R = 11;
  g.fillStyle = INK; g.beginPath(); g.arc(hx0, hy, R + 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = p.frame; g.beginPath(); g.arc(hx0, hy, R + 1.5, 0, Math.PI * 2); g.fill();
  g.save();
  g.beginPath(); g.arc(hx0, hy, R, 0, Math.PI * 2); g.clip();
  if (p.img) {
    const sz = R * 2.3;
    g.drawImage(p.img, hx0 - sz / 2, hy - sz / 2, sz, sz);
  } else {
    g.fillStyle = p.color; g.fillRect(hx0 - R, hy - R, R * 2, R * 2);
    g.fillStyle = INK; g.font = 'bold 10px "Source Sans 3", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(p.initials, hx0, hy + 0.5);
    g.textBaseline = 'alphabetic';
  }
  if (p.flash > 0 || ultK > 0) {
    g.fillStyle = '#ffffff';
    g.globalAlpha = A * Math.min(0.6, p.flash * 0.25 + ultK * 0.5);
    g.fillRect(hx0 - R, hy - R, R * 2, R * 2);
    g.globalAlpha = A;
  }
  g.restore();
  if (w === 'none' && (p.charge > 0 || p.flash > 0)) {
    glow(g, hx0 + Math.cos(p.aim) * 12, hy + Math.sin(p.aim) * 10, 5 + p.charge * 7 + p.flash * 6, p.color, 0.5 + p.charge * 0.4);
  }

  // Weapon arm: where it points depends on the kind of weapon and on the beat of the attack
  const sx = face * (hw - 2), sy = top + 5;
  let wa = p.aim, reach = 7;
  if (MELEE.has(w)) { wa = p.aim + face * s * 1.25; reach = 7 + fwd * 2.5; }
  else if (w === 'bow') { wa = p.aim - face * 0.06 * back; reach = 8 + fwd * 1.5; }
  else if (GUNLIKE.has(w)) { wa = p.aim - face * (0.05 * back + 0.2 * fwd); reach = 7 - fwd * 3.5; }
  else if (w === 'staff') { wa = p.aim - face * 0.75 * back + face * 0.12 * fwd; reach = 7 + fwd * 3; }
  else if (w === 'orb') reach = 6 - 2 * back + 4 * fwd;
  else if (w === 'cards') { wa = p.aim + face * s * 0.7; reach = 7 + fwd * 2; }
  else if (w === 'bomb') { wa = p.aim + face * s * 1.1; reach = 7 + fwd * 2; }
  else reach = 5;
  if (ultK > 0) wa += angDiff(wa, -Math.PI / 2 + face * 0.3) * ultK; // weapon raised to the sky
  const hx = sx + Math.cos(wa) * reach, hyy = sy + Math.sin(wa) * reach * 0.85;

  // Blade trail: a bright crescent sweeping through the arc of the swing
  if (MELEE.has(w) && p.flash > 0) {
    const u = 1 - p.flash, span = 2.5;
    const a0 = p.aim - face * 1.25;
    const lead = a0 + face * span * Math.min(1, u * 2.4), tail = a0 + face * span * Math.max(0, Math.min(1, u * 2.4 - 0.55));
    const Rs = reach + (w === 'blades' ? 16 : 22);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = A * p.flash * 0.55;
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(sx, sy, Rs, tail, lead, face < 0);
    g.arc(sx, sy, Rs * 0.8, lead, tail, face > 0);
    g.closePath();
    g.fill();
    g.globalAlpha = A * p.flash;
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.8;
    g.beginPath(); g.arc(sx, sy, Rs, tail, lead, face < 0); g.stroke();
    g.globalAlpha = A;
    g.globalCompositeOperation = 'source-over';
  }

  g.strokeStyle = mid; g.lineWidth = 3.6;
  g.beginPath(); g.moveTo(sx, sy); g.lineTo(hx, hyy); g.stroke();
  g.save();
  g.translate(hx, hyy);
  g.rotate(wa);
  if (face < 0) g.scale(1, -1);
  drawWeapon(g, w, p.color, p.clock, { back, fwd, charge: p.charge, flash: p.flash });
  if (p.flash > 0.05 && (GUNLIKE.has(w) || w === 'bow')) {
    muzzle(g, TIP[w], w === 'bow' || w === 'blowgun' || w === 'crossbow' ? p.flash * 0.5 : p.flash, IMPACT_OR(look.element, p.color));
  }
  g.restore();
  g.fillStyle = '#f2c9a0'; g.beginPath(); g.arc(hx, hyy, 2, 0, Math.PI * 2); g.fill();

  g.restore(); // upper body

  // Ultimate: ring of light spreading from the feet
  if (p.ult > 0 && p.ult < 1) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = A * (1 - p.ult);
    g.strokeStyle = p.color; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, 0, 10 + p.ult * 34, (10 + p.ult * 34) * 0.38, 0, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = A;
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}

const IMPACT_OR = (el: Element, color: string): string => impactColors(el, color)[0];

/**
 * Draws one projectile heading along `ang`. (x, y) is its point on the ground line to the target;
 * `lift` raises it above that line (lobbed shots) while its shadow stays on the ground.
 */
export function drawShot(g: G, look: HeroLook, color: string, x: number, y: number, ang: number, clock: number, lift = 0): void {
  const [c1, c2] = impactColors(look.element, color);
  // Shadow on the ground gives the shot some height
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath();
  g.ellipse(x, y + 13, 5, 2, 0, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.translate(x, y - lift);
  g.lineCap = 'round';
  switch (look.shot) {
    case 'arrow':
      g.rotate(ang);
      glow(g, 2, 0, 9, c2, 0.8);
      g.strokeStyle = c2; g.lineWidth = 3; g.globalAlpha *= 0.35;
      g.beginPath(); g.moveTo(-26, 0); g.lineTo(-11, 0); g.stroke();   // motion streak
      g.globalAlpha /= 0.35;
      g.strokeStyle = c1; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-11, 0); g.lineTo(4, 0); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(8.5, 0); g.lineTo(2, -3.2); g.lineTo(2, 3.2); g.closePath(); g.fill();
      g.strokeStyle = c2; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-11, 0); g.lineTo(-14, -3); g.moveTo(-11, 0); g.lineTo(-14, 3); g.stroke();
      break;
    case 'bolt':
      g.rotate(ang);
      glow(g, 0, 0, 12, color, 0.9);
      g.strokeStyle = color; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-9, 0); g.lineTo(5, 0); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.7;
      g.beginPath(); g.moveTo(-6, 0); g.lineTo(6.5, 0); g.stroke();
      break;
    case 'bullet':
      g.rotate(ang);
      glow(g, 0, 0, 8, c2, 0.8);
      g.strokeStyle = c2; g.lineWidth = 2.4; g.globalAlpha *= 0.4;
      g.beginPath(); g.moveTo(-30, 0); g.lineTo(-10, 0); g.stroke();   // tracer
      g.globalAlpha /= 0.4;
      g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(-12, 0); g.lineTo(2, 0); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-3, 0); g.lineTo(4.5, 0); g.stroke();
      break;
    case 'rocket':
      g.rotate(ang);
      glow(g, -10, 0, 8 + Math.random() * 4, '#ffb347', 1);
      g.fillStyle = '#fff3b0'; g.beginPath(); g.moveTo(-7, -2); g.lineTo(-13 - Math.random() * 5, 0); g.lineTo(-7, 2); g.closePath(); g.fill();
      g.fillStyle = color; rr(g, -7, -3, 12, 6, 2.5); g.fill();
      g.strokeStyle = INK; g.lineWidth = 0.7; g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(9, 0); g.lineTo(4.5, -3); g.lineTo(4.5, 3); g.closePath(); g.fill();
      g.fillStyle = INK; g.fillRect(-7, -4.5, 3, 1.5); g.fillRect(-7, 3, 3, 1.5);
      break;
    case 'bomb':
      g.rotate(clock * 9);
      g.fillStyle = '#1b1f27'; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = STEEL_DARK; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-1.6, -1.8, 1.4, 0, Math.PI * 2); g.fill();
      glow(g, 5.5, -3, 4 + Math.random() * 2, '#ffb347', 1);
      break;
    case 'dart':
      g.rotate(ang);
      glow(g, 2, 0, 7, c2, 0.7);
      g.strokeStyle = c1; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(-8, 0); g.lineTo(6, 0); g.stroke();
      g.fillStyle = '#e84057'; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-12, -3); g.lineTo(-12, 3); g.closePath(); g.fill();
      break;
    case 'shuriken':
      glow(g, 0, 0, 11, color, 0.7);
      g.rotate(clock * 22);
      g.fillStyle = STEEL;
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 2.4 : 7.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill();
      g.fillStyle = color; g.beginPath(); g.arc(0, 0, 1.6, 0, Math.PI * 2); g.fill();
      break;
    case 'card':
      glow(g, 0, 0, 10, color, 0.7);
      g.rotate(clock * 16);
      g.fillStyle = color; rr(g, -3.5, -5, 7, 10, 1.2); g.fill();
      g.strokeStyle = '#f0e6d2'; g.lineWidth = 1; g.stroke();
      break;
    case 'slash':
      // Blade wave: a bright crescent with a fading wake
      g.rotate(ang);
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = color; g.lineWidth = 3; g.globalAlpha *= 0.3;
      g.beginPath(); g.arc(-26, 0, 12, -0.7, 0.7); g.stroke();
      g.globalAlpha /= 0.3;
      g.lineWidth = 4.5; g.globalAlpha *= 0.6;
      g.beginPath(); g.arc(-17, 0, 12, -0.8, 0.8); g.stroke();
      g.globalAlpha /= 0.6;
      g.lineWidth = 5;
      g.beginPath(); g.arc(-8, 0, 12, -0.9, 0.9); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      g.beginPath(); g.arc(-8, 0, 12, -0.7, 0.7); g.stroke();
      g.globalCompositeOperation = 'source-over';
      break;
    case 'star':
      glow(g, 0, 0, 13, color, 0.9);
      g.rotate(clock * 6);
      g.fillStyle = '#ffffff';
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? 2.6 : 6.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill();
      g.strokeStyle = color; g.lineWidth = 1.2; g.stroke();
      break;
    default: {
      // Orb: glowing sphere with an orbiting ring; a dark heart for shadow magic
      const base = look.element === 'magic' ? color : c1;
      glow(g, 0, 0, 13 + Math.sin(clock * 20) * 1.5, look.element === 'shadow' ? c1 : base, 0.95);
      g.fillStyle = look.element === 'shadow' ? '#1a0f24' : '#ffffff';
      g.beginPath(); g.arc(0, 0, look.element === 'shadow' ? 3 : 2.4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = look.element === 'shadow' ? c1 : c2; g.lineWidth = 1; g.globalAlpha *= 0.75;
      g.beginPath(); g.ellipse(0, 0, 6.5, 2.6, clock * 6, 0, Math.PI * 2); g.stroke();
      break;
    }
  }
  g.restore();
}

/** Shots that keep a soft coloured trail behind them (the ones flying along the ground line). */
export const hasTrail = (s: Shot): boolean => s === 'orb' || s === 'rocket' || s === 'bolt';
