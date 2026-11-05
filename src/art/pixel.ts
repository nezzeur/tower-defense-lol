// Tiny pixel-art sprite system. Sprites are string grids; each letter maps to a palette color,
// '.' is transparent. Everything is drawn on a low-res canvas and upscaled without smoothing.
import type { Role } from '../types';

export type Palette = Record<string, string>;
export type Sprite = string[];

type G = CanvasRenderingContext2D;

export function drawSprite(g: G, spr: Sprite, x: number, y: number, pal: Palette, flip = false): void {
  const w = spr[0].length;
  for (let r = 0; r < spr.length; r++) {
    const row = spr[r];
    for (let c = 0; c < w; c++) {
      const ch = row[c];
      if (ch === '.' || !pal[ch]) continue;
      g.fillStyle = pal[ch];
      g.fillRect(Math.round(x + (flip ? w - 1 - c : c)), Math.round(y + r), 1, 1);
    }
  }
}

/** Draws a sprite anchored at its bottom-center (feet) position. */
export function drawAt(g: G, spr: Sprite, x: number, y: number, pal: Palette, flip = false): void {
  drawSprite(g, spr, Math.round(x - spr[0].length / 2), Math.round(y - spr.length), pal, flip);
}

export function px(g: G, x: number, y: number, color: string, w = 1, h = 1): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Crisp 1px circle outline (midpoint algorithm). */
export function pixelCircle(g: G, cx: number, cy: number, r: number, color: string, dashed = 0): void {
  g.fillStyle = color;
  let x = Math.round(r), y = 0, err = 1 - x, i = 0;
  cx = Math.round(cx);
  cy = Math.round(cy);
  while (x >= y) {
    if (!dashed || Math.floor(i / 3) % 2 === dashed % 2) {
      for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) g.fillRect(cx + a, cy + b, 1, 1);
    }
    i++;
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const SH = 'rgba(0,0,0,0.3)';

// ---------- Props ----------

export const TREE: Sprite = [
  '......KKKK......',
  '....KKGGGGKK....',
  '...KGGgGGGGGK...',
  '..KGGGGGGgGGGK..',
  '..KGgGGGGGGGGK..',
  '.KGGGGGgGGGGGGK.',
  '.KGGgGGGGGGgGGK.',
  '.KGGGGGGGGGGGGK.',
  '..KGGGGgGGGGGK..',
  '..KdGGGGGGGGdK..',
  '...KddGGGGddK...',
  '....KKdddKK.....',
  '......KTTK......',
  '......KTTK......',
  '.....KTTTTK.....',
  '....SSSSSSSS....',
];

export const PINE: Sprite = [
  '.....KK.....',
  '....KgGK....',
  '....KGGK....',
  '...KgGGGK...',
  '...KGGGGK...',
  '..KgGGGGGK..',
  '..KGGGGGdK..',
  '.KgGGGGGGGK.',
  '.KGGGGGGGdK.',
  'KgGGGGGGGGdK',
  'KddGGGGGGddK',
  '.KKKKTTKKKK.',
  '.....TT.....',
  '....SSSS....',
];

export const ROCK: Sprite = [
  '...KKKK...',
  '..KRRrrK..',
  '.KRRRRrRK.',
  'KRRRRRRRRK',
  'KdRRRRRRdK',
  '.KddddddK.',
  '..SSSSSS..',
];

export const BUSH: Sprite = [
  '..KK..KKK...',
  '.KGGKKGgGK..',
  'KGgGGGGGGGK.',
  'KGGGGGgGGGK.',
  'KdGGGGGGGdK.',
  '.KKKKKKKKK..',
  '..SSSSSSS...',
];

export const CRYSTAL: Sprite = [
  '...K...',
  '..KCK..',
  '..KcK..',
  '.KCcCK.',
  '.KCCcK.',
  'KCCCcCK',
  'KCcCCCK',
  '.KCCCK.',
  '..KKK..',
  '..SSS..',
];

export const PILLAR: Sprite = [
  'KKKKKKKK',
  'KPPPPPPK',
  '.KPpPPK.',
  '.KPpPPK.',
  '.KPpPPK.',
  '.KPpPPK.',
  '.KPpPPK.',
  '.KPpPPK.',
  '.KPpPPK.',
  '.KPpPPK.',
  'KPPPPPPK',
  'KddddddK',
  'KKKKKKKK',
  '.SSSSSS.',
];
export const PILLAR_BROKEN: Sprite = ['..KK.K..', '.KPpKPK.', ...PILLAR.slice(6)];

export const PALM: Sprite = [
  '..KK....KKK..',
  '.KGGK..KGGGK.',
  'KGGgGKKGgGGGK',
  '.KGGGGGGGGK..',
  'KGgGKTTKGGgGK',
  'KGK.KTK..KGK.',
  '....KTK......',
  '.....KTK.....',
  '.....KTK.....',
  '.....KTTK....',
  '......KTK....',
  '......KTK....',
  '.....KTTTK...',
  '....SSSSSS...',
];

export const DEAD_TREE: Sprite = [
  'K.....K...K.',
  '.K...K...K..',
  '.KK.K...KK..',
  '..KKK..KK...',
  '...KK.KK..K.',
  '....KKK..K..',
  '....KKK.K...',
  '....KKKK....',
  '.....KK.....',
  '.....KK.....',
  '....KKKK....',
  '...SSSSSS...',
];

export const GRAVE: Sprite = [
  '..KKKK..',
  '.KggGGK.',
  'KgGKGGGK',
  'KGKKKGGK',
  'KGGKGGGK',
  'KGGKGGGK',
  'KGGGGGGK',
  'KddddddK',
  'KKKKKKKK',
  '.SSSSSS.',
];

export const MUSHROOM: Sprite = [
  '.KKKK.',
  'KMmMMK',
  'KMMMMK',
  '.KWWK.',
  '..WW..',
  '.SSSS.',
];

export const propPal = (p: Palette): Palette => ({ S: SH, ...p });

// ---------- Minions ----------

const MINION_TOP = [
  '....KKKK....',
  '...KHHHHK...',
  '..KHHHHHHK.W',
  '..KHEHHEHK.W',
  '..KBBBBBBK.W',
  '.KBBbBBBBBKW',
  '.KBBBBBBBBKK',
  '..KBBBBBBK..',
];
export const MINION: Sprite[] = [
  [...MINION_TOP, '...KK..KK...'],
  [...MINION_TOP, '..KK....KK..'],
];

const CASTER_TOP = MINION_TOP.map((r, i) => (i === 1 ? '...KHHHHK.O.' : r.replace(/W/g, 'w')));
export const CASTER: Sprite[] = [
  [...CASTER_TOP, '...KK..KK...'],
  [...CASTER_TOP, '..KK....KK..'],
];

const CANNON_TOP = [
  '..KKKKKKKKK...',
  '.KBBBBBBBBBKKK',
  '.KBbBBBBBBBGGG',
  '.KBBBBBBBBBKKK',
  '.KBBBBBBBBBK..',
  '..KKKKKKKKK...',
];
export const CANNON: Sprite[] = [
  [...CANNON_TOP, '.KWWK...KWWK..', 'KWwwWK.KWwwWK.', '.KWWK...KWWK..'],
  [...CANNON_TOP, '.KwWK...KwWK..', 'KWWwWK.KWWwWK.', '.KWwK...KWwK..'],
];

const SUPER_TOP = [
  '...K.KKKK.K...',
  '...KKHHHHKK...',
  '..KHHHHHHHHK..',
  '..KHEEHHEEHK..',
  '.KBBBBBBBBBBK.',
  'KBBbBBBBBBBBBK',
  'KBBBBBBBBBBBBK',
  'KBBBBBBBBBBBBK',
  '.KBBBBBBBBBBK.',
  '..KBBBBBBBBK..',
];
export const SUPER: Sprite[] = [
  [...SUPER_TOP, '...KKK..KKK...'],
  [...SUPER_TOP, '..KKK....KKK..'],
];

const CRAB_TOP = [
  '...KKKKKK...',
  '..KCCCCCCK..',
  '.KCcCCCCCCK.',
  '.KCCEECEECK.',
  'KKKKKKKKKKKK',
];
export const CRAB: Sprite[] = [
  [...CRAB_TOP, 'K.K.K..K.K.K'],
  [...CRAB_TOP, '.K.K.KK.K.K.'],
];

const BOSS_TOP = [
  '.KK..................KK.',
  '.KHK................KHK.',
  '..KHK..............KHK..',
  '..KHHK....KKKK....KHHK..',
  '...KHHKKKKBBBBKKKKHHK...',
  '....KKBBBBBBBBBBBBKK....',
  '...KBBBBBBBBBBBBBBBBK...',
  '..KBBbBBBBBBBBBBBBBBBK..',
  '..KBBBBYYBBBBBBYYBBBBK..',
  '.KBBBBBYYBBBBBBYYBBBBBK.',
  '.KBBBBBBBBBBBBBBBBBBBBK.',
  '.KBBBBBBBBBBBBBBBBBBBBK.',
  '.KBBBBBBKWKWKWKWKBBBBBK.',
  '.KBBBBBBBKKKKKKKBBBBBBK.',
  '..KBBBBBBBBBBBBBBBBBBK..',
  '..KdBBBBBBBBBBBBBBBBdK..',
  '...KddBBBBBBBBBBBBddK...',
  '....KKddddddddddddKK....',
];
export const BOSS: Sprite[] = [
  [...BOSS_TOP, '.....KdK..KdK.KdK.......', '.....KKK..KKK.KKK.......'],
  [...BOSS_TOP, '......KdK.KdK..KdK......', '......KKK.KKK..KKK......'],
];

export function enemyPal(color: string, flash: boolean): Palette {
  const c = flash ? '#ffffff' : color;
  return {
    K: '#1a1420', B: c, b: shade(c.startsWith('#') ? c : '#ffffff', 0.35), d: shade(c.startsWith('#') ? c : '#ffffff', -0.35),
    H: '#5c6370', E: '#ffe27a', Y: '#ffec7a', W: '#c9ccd2', w: '#8a6239', O: '#e6c2ff', G: '#2a2a2a',
    C: c, c: shade(c.startsWith('#') ? c : '#ffffff', 0.3),
  };
}

// ---------- Champion chibis (generic, by role) ----------

const BODY = [
  '...KKKK...',
  '..KHHHHK..',
  '.KHHHHHHK.',
  '.KHSSSSHK.',
  '.KSESSESK.',
  '.KSSSSSSK.',
  '..KKCCKK..',
  '.KSCCCCSK.',
  '.KKCcCCKK.',
  '..KCCCCK..',
  '..KCKKCK..',
  '..KK..KK..',
];
const HOOD = BODY.map((r, i) => (i < 3 ? r : r)).map((r, i) => (i === 3 ? '.KHSSSSHK.' : i === 4 ? '.KHESSEHK.' : r));

export function chibiPal(color: string, role: Role): Palette {
  return {
    K: '#14101a', S: '#f2c9a0', E: '#1a1420',
    H: role === 'Assassin' ? '#2a2233' : shade(color, -0.35),
    C: color, c: shade(color, -0.3),
  };
}

/**
 * Draws a role chibi with its weapon. frame 0 = idle, 1 = attacking.
 * (x, y) is the feet position; the sprite is ~14px tall.
 */
export function drawChibi(g: G, role: Role, color: string, x: number, y: number, flip: boolean, attacking: boolean, t: number): void {
  const pal = chibiPal(color, role);
  const body = role === 'Assassin' ? HOOD : BODY;
  const bx = Math.round(x - 5), by = Math.round(y - 12);
  // Shadow
  px(g, bx + 1, by + 12, 'rgba(0,0,0,0.3)', 8, 1);
  drawSprite(g, body, bx, by, pal, flip);
  const dir = flip ? -1 : 1;
  const hx = flip ? bx + 1 : bx + 9; // weapon hand column
  const lift = attacking ? -1 : 0;
  const W = '#d6dbe3', Wd = '#8a6239', glow = shade(color, 0.5);
  switch (role) {
    case 'Mage':
      // Pointed hat and a staff with glowing orb
      px(g, bx + 3, by - 1, pal.H, 4, 1);
      px(g, bx + 4, by - 2, pal.H, 2, 1);
      px(g, bx + (flip ? 4 : 5), by - 3, pal.H, 1, 1);
      for (let i = 0; i < 9; i++) px(g, hx + dir, by + 3 + i + lift, Wd);
      px(g, hx + dir - 1, by + 1 + lift, glow, 3, 2);
      if (attacking || Math.sin(t * 4) > 0.6) px(g, hx + dir, by + lift, '#ffffff');
      break;
    case 'Tireur':
      // Bow held in front
      for (let i = 0; i < 7; i++) px(g, hx + dir * (i === 0 || i === 6 ? 0 : 1), by + 4 + i, Wd);
      for (let i = 1; i < 6; i++) px(g, hx - dir * (attacking ? 1 : 0), by + 4 + i, '#e8e2d0');
      if (attacking) px(g, hx + dir * 2, by + 7, W, 1, 1);
      break;
    case 'Combattant':
      // Sword raised when attacking
      if (attacking) { for (let i = 0; i < 6; i++) px(g, hx + dir * (1 + Math.floor(i / 2)), by + 6 - i, W); }
      else { for (let i = 0; i < 6; i++) px(g, hx + dir, by + 3 + i, W); }
      px(g, hx, by + 8 + (attacking ? -2 : 0), '#c8aa6e', 2, 1);
      break;
    case 'Support':
      // Floating halo and a wand with a sparkle
      px(g, bx + 3, by - 2 + Math.round(Math.sin(t * 3)), '#ffe9a8', 4, 1);
      for (let i = 0; i < 5; i++) px(g, hx + dir, by + 5 + i, Wd);
      px(g, hx + dir, by + 4 + lift, glow);
      if (attacking) px(g, hx + dir * 2, by + 3, '#ffffff');
      break;
    case 'Assassin':
      // Twin daggers
      px(g, hx + dir, by + 7 + lift, W, 1, 3);
      px(g, (flip ? bx + 9 : bx) - dir, by + 7, W, 1, 3);
      break;
  }
}

// ---------- Nexus and portal ----------

export const NEXUS: Sprite = [
  '....KK....',
  '...KCCK...',
  '..KCcCCK..',
  '..KCcCCK..',
  '.KCCcCCCK.',
  '.KCCCCCCK.',
  '.KCCCCCdK.',
  '..KCCCdK..',
  '..KCCdK...',
  '...KdK....',
  '....K.....',
];
export const NEXUS_BASE: Sprite = [
  '..KKKKKKKKKK..',
  '.KPPPPPPPPPPK.',
  'KPppPPPPPPppPK',
  'KddddddddddddK',
  '.KKKKKKKKKKKK.',
];

// ---------- Jungle creatures and bosses (original designs, by archetype) ----------
// Letters: K outline, B body, b highlight, d shade, E eye, Y accent, W wing/fur shade, T tongue, C crown.

const WOLF_TOP = [
  '...........KK.',
  '..........KBBK',
  'KK.......KBBEK',
  'KBKKKKKKKBBBBK',
  '.KBBBBBBBBBBK.',
  '.KBbBBBBBBBK..',
  '.KdBBBBBBBdK..',
];
export const WOLF: Sprite[] = [
  [...WOLF_TOP, '..KK.KK.KK.KK.'],
  [...WOLF_TOP, '.KK.KK...KK.KK'],
];

const RAPTOR_BASE = [
  '....KKK...',
  '...KBBBK..',
  '..KBEBBYK.',
  '.KBBbBBKY.',
  'KWBBBBBK..',
  '.KWBBBK...',
  '..KKKK....',
];
export const RAPTOR: Sprite[] = [
  [...RAPTOR_BASE, '...K.K....'],
  [...RAPTOR_BASE.map((r, i) => (i === 4 ? 'KBWBBBBK..' : i === 5 ? '.KBWBBK...' : r)), '..K...K...'],
];

const KRUG_TOP = [
  '....KKKKK.....',
  '...KBBBBBK....',
  '..KBBbBBBBK...',
  '..KBEBBEBBK...',
  '.KKBBBBBBBKK..',
  'KBBKBBdBBKBBK.',
  'KBdKBBBBBKBdK.',
  '.KK.KBBBBK.KK.',
  '....KBBdBK....',
];
export const KRUG: Sprite[] = [
  [...KRUG_TOP, '....KBK.KBK...', '....KKK.KKK...'],
  [...KRUG_TOP, '...KBK..KBK...', '...KKK...KKK..'],
];

const GROMP_TOP = [
  '...KK.....KK....',
  '..KEEK...KEEK...',
  '..KBBKKKKKBBK...',
  '.KBBBBBBBBBBBK..',
  'KBBbBBBBBBBBBBK.',
  'KBBBBBYYYYBBBBK.',
  'KBBBBYYYYYYBBBK.',
  '.KBBBYYYYYYBBK..',
  '..KKBBBBBBBBKK..',
];
export const GROMP: Sprite[] = [
  [...GROMP_TOP, '.KBBK.....KBBK..', '.KKKK.....KKKK..'],
  [...GROMP_TOP, 'KBBK.......KBBK.', 'KKKK.......KKKK.'],
];

const DRAGON_BODY = [
  '.....KDDDDDDDDDDK.....',
  '......KDDK..KDDK.KK...',
  '......KKK...KKK..KDK..',
  '...................KK.',
];
export const DRAGON: Sprite[] = [
  [
    '..........KK..........',
    '.........KBBK.........',
    '....K...KBBBBK...K....',
    '...KWK.KBEBBBK..KWK...',
    '..KWWWKBBBBBBKKKWWWK..',
    '.KWWWWWKBBBBBBKWWWWWK.',
    'KWWWWKBBBBBBBBBKWWWWK.',
    '.KWWKBBBBbBBBBBBKWWK..',
    '..KKKBBBBBBBBBBBBKK...',
    ...DRAGON_BODY.map((r) => r.replace(/D/g, 'B')),
  ],
  [
    '..KK......KK......KK..',
    '.KWWK....KBBK....KWWK.',
    '.KWWWK..KBBBBK..KWWWK.',
    '..KWWWKKBEBBBKKKWWWK..',
    '...KWWWBBBBBBKKWWWK...',
    '....KWWKBBBBBBKWWK....',
    '.....KBBBBBBBBBK......',
    '....KBBBBbBBBBBBK.....',
    '...KBBBBBBBBBBBBBK....',
    ...DRAGON_BODY.map((r) => r.replace(/D/g, 'B')),
  ],
];

const WORM_BASE = [
  '........KKKKKK..........',
  '......KKBBBBBBKK........',
  '.....KBBBBBBBBBBK.......',
  '....KBBEEBBBBEEBBK......',
  '....KBBEEBBBBEEBBK......',
  '....KBBBBBBBBBBBBK......',
  '....KBBBKYKYKYBBBK......',
  '.....KBBBKKKKKBBK.......',
  '.....KBBBBBBBBBBK.......',
  '......KBbBBBBbBK........',
  '......KBBBBBBBBK........',
  '.......KBBBBBBK.........',
  '.......KBbBBbBK.........',
  '......KBBBBBBBBK........',
  '.....KBBBBBBBBBBK.......',
];
export const WORM: Sprite[] = [
  [...WORM_BASE, '....KdddddddddddK.......', '....KKKKKKKKKKKKKK......'],
  [...WORM_BASE.map((r, i) => (i > 8 && i < 13 ? '.' + r.slice(0, -1) : r)), '....KdddddddddddK.......', '....KKKKKKKKKKKKKK......'],
];

const FUR_BASE = [
  '.....KKKKKKKK.....',
  '...KKBBBBBBBBKK...',
  '..KBBBBBBBBBBBBK..',
  '.KBBBKKBBBBKKBBBK.',
  '.KBBBKEBBBBKEBBBK.',
  'KBBBBBBBBBBBBBBBBK',
  'KBBBBBBBTTTTBBBBBK',
  'KBBBBBBBTTTTBBBBBK',
  'KBBWBBBBBBBBBBWBBK',
  '.KBBBBBBBBBBBBBBK.',
  '..KKBBBBBBBBBBKK..',
];
export const FURBALL: Sprite[] = [
  [...FUR_BASE, '....KKK....KKK....'],
  [...FUR_BASE, '...KKK......KKK...'],
];

const GHOST_TOP = [
  '....C.C.C.C.....',
  '....CCCCCCC.....',
  '...KKBBBBBBKK...',
  '..KBBBBBBBBBBK..',
  '.KBBKKBBBBKKBBK.',
  '.KBBKEBBBBKEBBK.',
  '.KBBBBBBBBBBBBK.',
  '.KBBBBBKKBBBBBK.',
  'KWWKBBBBBBBBKWWK',
  'KWK.KBBBBBBK.KWK',
  '....KBBBBBBK....',
  '...KBBBBBBBBK...',
  '...KBBbBBbBBK...',
];
export const GHOST: Sprite[] = [
  [...GHOST_TOP, '..KBB.KBBK.BBK..', '..KK...KK...KK..'],
  [...GHOST_TOP, '..KB.KBBBBK.BK..', '..K...KKKK...K..'],
];

export function monsterPal(color: string, flash: boolean): Palette {
  const c = flash ? '#ffffff' : color;
  const base = c.startsWith('#') ? c : '#ffffff';
  return {
    K: '#14101a', B: c, b: shade(base, 0.35), d: shade(base, -0.35), W: shade(base, -0.25),
    E: '#ff3b3b', Y: '#f2e2a0', T: '#ff8fb0', C: '#ffd84a',
  };
}
