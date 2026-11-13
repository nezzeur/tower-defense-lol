import { mobImage } from './art/mobArt';
import { splashImage, squareImage } from './art/champArt';
import { FEATURE_INFO, featureTiles, landmarkTiles, LH, LW, pathGeometry, spawnMote, terrainAt, type Mote } from './art/mapArt';
import { drawMapHD } from './art/mapHD';
import { CREATURE_HEIGHT, drawCreature } from './art/creatures';
import { shade } from './art/color';
import { angDiff, drawGlow } from './art/glow';
import { drawHero, drawShot, hasTrail, HERO_HEAD, heroLook, impactColors, lightColor, SHOT_ARC, SHOT_SPEED, type Shot } from './art/heroes';
import { Vfx } from './art/vfx';
import type { MapLight } from './art/regionArt';
import { sfx } from './audio';
import { ENEMIES } from './data/enemies';
import { BOON_AUTO_DELAY, BOON_BY_ID, BOON_CHANCE, rollBoons, type BoonDef } from './data/boons';
import { MAT_BY_ID, rollLoot } from './data/loot';
import { teamSynergies, type SynStat } from './data/synergies';
import { COLS, ROWS } from './data/maps';
import {
  buildWave, champ, computeStats, endlessHp, endlessUnlocked, goldScale, hpScale, level, MAX_LIVES, START_LIVES, teamSlots, ultRank, waveBonus,
  type Spawn,
} from './game';
import { persist, store } from './save';
import type { ChampionDef, EnemyDef, FeatureKind, MapDef, Priority, Stats } from './types';

export const TILE = 48;
export const W = COLS * TILE;
export const H = ROWS * TILE;
const STEP = 1 / 60;
/** Seconds a champion takes to drop onto its tile, and the moment its feet touch the ground. */
const SPAWN = 0.38, LAND = SPAWN * 0.7;
/** Saved teams per map. */
export const TEAM_SLOTS = 3;
/** Seconds the ultimate cut-in stays on screen. */
const CUTIN = 1.15;

interface Burn { dps: number; t: number; src: Tower | null }

export interface Enemy {
  uid: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  s: number;
  x: number;
  y: number;
  slowPct: number;
  slowT: number;
  stunT: number;
  burns: Burn[];
  dead: boolean;
  hitFlash: number;
  lane: number;
  /** Facing (-1 left, 1 right) and walk animation phase, render only. */
  face: number;
  phase: number;
  /** Render only: knock-back offset (px), squash (0..1) and game seconds since it spawned. */
  kx: number;
  ky: number;
  sq: number;
  born: number;
  /** Direct hits its shield still blocks. */
  shield: number;
  /** Render only: seconds of healing glow left. */
  healed: number;
  /** Seconds before its special move is ready again. */
  abT: number;
  /** Seconds left of a charge, of intangibility, and of a borrowed speed boost (with its multiplier). */
  chargeT: number;
  phaseT: number;
  hasteT: number;
  haste: number;
}

export interface Tower {
  def: ChampionDef;
  c: number;
  r: number;
  x: number;
  y: number;
  stats: Stats;
  cd: number;
  hits: number;
  runStacks: number;
  ramp: number;
  angle: number;
  flash: number;
  kills: number;
  /** Damage dealt this run (for the damage meter). */
  dmgDone: number;
  /** Active ultimate: seconds left before it can be cast again. */
  ultCd: number;
  /** Temporary ultimate buffs (attack speed / damage fractions). */
  buffs: { t: number; rate: number; dmg: number }[];
  priority: Priority;
  // Render only (attack animation); nothing below feeds back into the simulation.
  /** Smoothed aim angle and facing side. */
  aim: number;
  face: 1 | -1;
  /** Attack beat: 0 rest, -1 wound back, +1 follow-through (eased toward its target every frame). */
  sw: number;
  /** Game seconds since the last attack, and the attack interval at that moment. */
  since: number;
  period: number;
  /** Had a target at its last attack check. */
  engaged: boolean;
  /** Enemy the champion keeps facing between attacks. */
  tgt: Enemy | null;
  /** Real seconds since it was placed / since its last ultimate. */
  born: number;
  ultT: number;
  /** Seconds left frozen by a boss: the champion cannot attack. */
  stunT: number;
}

/** Global knob on ultimate damage multipliers (bursts, control hits, executes), tuned with scripts/sim.ts. */
export const TUNE = { ult: 0.25 };

export const PRIORITIES: Record<Priority, { name: string; desc: string }> = {
  first: { name: 'Premier', desc: 'Le plus avancé vers le nexus' },
  last: { name: 'Dernier', desc: 'Le moins avancé' },
  strong: { name: 'Plus fort', desc: 'Le plus de PV' },
  weak: { name: 'Plus faible', desc: 'Le moins de PV' },
  close: { name: 'Proche', desc: 'Le plus proche du champion' },
};

interface Proj {
  x: number;
  y: number;
  target: Enemy;
  tower: Tower;
  dmgMult: number;
  chainLeft: number;
  hit: Set<number>;
  trail: { x: number; y: number }[];
  /** Pixels per second, and distance to the target when it was fired (for lobbed arcs). */
  speed: number;
  d0: number;
  /** Bounce shots: where this hop started (a bolt of energy links it to the projectile). */
  ox?: number;
  oy?: number;
}

interface Fx {
  kind: 'beam' | 'ring' | 'text' | 'boom' | 'laser' | 'zap' | 'whirl' | 'storm' | 'strike' | 'pillar';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r?: number;
  t: number;
  max: number;
  color: string;
  text?: string;
  /** Font size of a text effect (default 15). */
  size?: number;
}

export type SpellId = 'smite' | 'heal' | 'exhaust';
export const SPELLS: Record<SpellId, { name: string; icon: string; cd: number; desc: string }> = {
  smite: { name: 'Châtiment', icon: '⚡', cd: 60, desc: '20 % des PV max en dégâts bruts sur l\'ennemi le plus résistant' },
  exhaust: { name: 'Fatigue', icon: '🌀', cd: 45, desc: 'Ralentit tous les ennemis de 60 % pendant 3 s' },
  heal: { name: 'Soins', icon: '💚', cd: 120, desc: '+5 vies' },
};

export interface BattleEvents {
  /** Something the side panel shows changed (placement, selection, wave). */
  onChange: () => void;
  onEnd: (win: boolean, wave: number) => void;
}

export class Battle {
  readonly canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private bg!: HTMLCanvasElement;
  private pts: { x: number; y: number }[] = [];
  /** Longest lane length (pixels); used by the balance bot. */
  pathLen = 0;
  private pathTiles = new Set<string>();
  private lanes: { pts: { x: number; y: number }[]; cum: number[]; len: number }[] = [];
  private features = new Map<string, FeatureKind>();
  private blocked = new Set<string>();
  private turrets: { x: number; y: number; cd: number }[] = [];
  private spawnCount = 0;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  private projs: Proj[] = [];
  private fx: Fx[] = [];
  private queue: Spawn[] = [];
  private spawnT = 0;
  private uid = 0;
  private autoT = -1;
  private raf = 0;
  private timer = 0;
  private last = 0;
  private lastFrame = 0;
  private acc = 0;
  private saveT = 0;
  private autoUltT = 0;

  wave = 0;
  /** Run statistics shown in the HUD. */
  runKills = 0;
  runGold = 0;
  runTime = 0;
  /** More run statistics for the end screen. */
  ultCasts = 0;
  livesLost = 0;
  epicKills = 0;
  bestHit = 0;
  /** Materials looted this run (id -> amount). */
  runLoot: Record<string, number> = {};
  waveTotal = 0;
  lives = START_LIVES;
  waveActive = false;
  over = false;
  paused = false;
  spellCd: Record<SpellId, number> = { smite: 0, heal: 0, exhaust: 0 };
  selectedRoster: string | null = null;
  selectedTower: Tower | null = null;
  /** Enemy whose info panel is open. */
  selectedEnemy: Enemy | null = null;
  /** Team-wide region synergy bonuses (fractions), refreshed whenever the team changes. */
  syn: Partial<Record<SynStat, number>> = {};
  private hover: { c: number; r: number } | null = null;
  /** Pointer position on the board (canvas px), for aiming. */
  private mouse: { x: number; y: number } | null = null;
  /** Champion whose ultimate is being aimed: the next click on the board casts it there. */
  aiming: Tower | null = null;
  /** Blessings picked this run (id -> stacks) and the three currently on offer, if any. */
  boons: Record<string, number> = {};
  boonOffer: BoonDef[] | null = null;
  private boonT = 0;

  // Visual-only state (skipped headless)
  /** Particles, lights, ground marks and dying monsters; null in headless runs. */
  private vfx: Vfx | null = null;
  /** Real seconds the simulation stays frozen to give a big hit some weight. */
  private hitStop = 0;
  private lastStop = 0;
  /** 0..1 darkening of the ground during an ultimate or a boss death. */
  private dim = 0;
  private readonly calm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private motes: Mote[] = [];
  /** Light sources painted into the map (braziers, crystals, lanterns...) and centres of its water tiles. */
  private mapLights: MapLight[] = [];
  private waterTiles: { x: number; y: number }[] = [];
  private clock = 0;
  private shake = 0;
  private nexusHurt = 0;
  private banner: { text: string; sub: string; t: number; color: string } | null = null;
  /** Ultimate cut-in: a band with the champion's art that sweeps across the top of the board. */
  private cutin: { id: string; name: string; champ: string; color: string; t: number } | null = null;
  private readonly visual: boolean;

  /** headless: no canvas, input or animation loop; drive it with step() (balance simulation). */
  constructor(readonly map: MapDef, private ev: BattleEvents, headless = false) {
    this.visual = !headless;
    if (headless) {
      this.buildPath();
      this.restoreLayout();
      return;
    }
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'battle-canvas';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    this.buildPath();
    this.bg = document.createElement('canvas');
    this.bg.width = W * dpr;
    this.bg.height = H * dpr;
    const bgc = this.bg.getContext('2d')!;
    bgc.scale(dpr, dpr);
    this.mapLights = drawMapHD(bgc, this.map, W, H, TILE);
    // Soft vignette baked into the terrain: frames the board and lets the lights stand out.
    const vg = bgc.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.75);
    vg.addColorStop(0, 'rgba(1,10,19,0)');
    vg.addColorStop(1, 'rgba(1,10,19,0.4)');
    bgc.fillStyle = vg;
    bgc.fillRect(0, 0, W, H);
    this.vfx = new Vfx();
    this.restoreLayout();
    this.bindInput();
    this.last = this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.timer = window.setInterval(this.tick, 50);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    persist();
  }

  // ---------- Path ----------

  private buildPath(): void {
    const geo = pathGeometry(this.map, TILE);
    this.pts = geo.pts;
    this.pathTiles = geo.tiles;
    this.lanes = geo.lanes.map((pts) => {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      return { pts, cum, len: cum[cum.length - 1] };
    });
    this.pathLen = Math.max(...this.lanes.map((l) => l.len));
    this.features = featureTiles(this.map);
    this.blocked = landmarkTiles(this.map);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if ('TR~'.includes(terrainAt(this.map, c, r))) this.blocked.add(`${c},${r}`);
    }
    this.waterTiles = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!this.pathTiles.has(`${c},${r}`) && (terrainAt(this.map, c, r) === '~' || this.features.get(`${c},${r}`) === 'river')) {
        this.waterTiles.push({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE });
      }
    }
    this.turrets = (this.map.features ?? []).filter((f) => f.kind === 'turret')
      .map((f) => ({ x: (f.c + 0.5) * TILE, y: (f.r + 0.5) * TILE, cd: 0 }));
  }

  private posAt(s: number, lane = 0): { x: number; y: number } {
    const { pts, cum } = this.lanes[lane];
    for (let i = 1; i < pts.length; i++) {
      if (s <= cum[i]) {
        const a = pts[i - 1], b = pts[i];
        const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
    }
    return pts[pts.length - 1];
  }

  featureAt(c: number, r: number): FeatureKind | undefined {
    return this.features.get(`${c},${r}`);
  }

  /** Champion stats including the bonus of the tile it stands on. */
  private statsAt(def: ChampionDef, c: number, r: number): Stats {
    const s = computeStats(def);
    const f = this.featureAt(c, r);
    if (f === 'blue') s.rate *= 1.25;
    if (f === 'red') { s.dmg *= 1.1; s.burn = s.burn ? { mult: s.burn.mult + 0.25, dur: s.burn.dur } : { mult: 0.25, dur: 3 }; }
    if (f === 'brush') s.dmg *= 1.2;
    if (terrainAt(this.map, c, r) === 'H') s.range += 0.6;
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if (this.featureAt(c + dc, r + dr) === 'dragon') { s.dmg *= 1.15; dc = dr = 2; }
    }
    const ember = (this.boons.ember ?? 0) * (BOON_BY_ID.ember.value ?? 0);
    if (ember) s.burn = s.burn ? { mult: s.burn.mult + ember, dur: s.burn.dur } : { mult: ember, dur: 3 };
    const sy = this.syn;
    if (sy.dmg) s.dmg *= 1 + sy.dmg;
    if (sy.rate) s.rate *= 1 + sy.rate;
    if (sy.range) s.range *= 1 + sy.range;
    if (sy.slow && s.slow) s.slow.pct += sy.slow;
    if (sy.splash && s.type === 'splash') s.splash *= 1 + sy.splash;
    return s;
  }

  // ---------- Placement ----------

  canPlace(c: number, r: number): boolean {
    const f = this.featureAt(c, r);
    return c >= 0 && r >= 0 && c < COLS && r < ROWS && !this.pathTiles.has(`${c},${r}`) && f !== 'river' && f !== 'turret' && f !== 'dragon'
      && !this.blocked.has(`${c},${r}`)
      && !this.towers.some((t) => t.c === c && t.r === r);
  }

  slotsLeft(): number {
    return teamSlots() - this.towers.length;
  }

  place(id: string, c: number, r: number): boolean {
    if (!this.canPlace(c, r) || this.slotsLeft() <= 0 || this.towers.some((t) => t.def.id === id)) return false;
    const def = champ(id);
    const t: Tower = {
      def, c, r, x: (c + 0.5) * TILE, y: (r + 0.5) * TILE, stats: this.statsAt(def, c, r), cd: 0.3,
      hits: 0, runStacks: 0, ramp: 0, angle: 0, flash: 0, kills: 0, dmgDone: 0,
      ultCd: def.active.cd, buffs: [], priority: store.data.priorities[id] ?? 'first',
      aim: 0, face: 1, sw: 0, since: 9, period: 1, engaged: false, tgt: null, born: 0, ultT: 9, stunT: 0,
    };
    this.towers.push(t);
    this.refreshStats();
    this.saveLayout();
    if (this.visual) sfx('place');
    return true;
  }

  remove(t: Tower): void {
    this.towers = this.towers.filter((x) => x !== t);
    if (this.selectedTower === t) this.selectedTower = null;
    this.refreshStats();
    this.saveLayout();
  }

  /** Recomputes region synergies, then every champion's stats. */
  refreshStats(): void {
    this.syn = {};
    for (const a of teamSynergies(this.towers.map((x) => x.def.region))) {
      if (a.tier) this.syn[a.def.stat] = (this.syn[a.def.stat] ?? 0) + a.value;
    }
    // Blessings of the run feed the same team-wide channels
    for (const [id, n] of Object.entries(this.boons)) {
      const b = BOON_BY_ID[id];
      if (b?.stat) this.syn[b.stat] = (this.syn[b.stat] ?? 0) + (b.value ?? 0) * n;
    }
    for (const t of this.towers) t.stats = this.statsAt(t.def, t.c, t.r);
  }

  setPriority(t: Tower, p: Priority): void {
    t.priority = p;
    if (p === 'first') delete store.data.priorities[t.def.id]; else store.data.priorities[t.def.id] = p;
    persist();
  }

  private saveLayout(): void {
    const layout = this.towers.map((t) => ({ id: t.def.id, c: t.c, r: t.r }));
    store.data.layouts[this.map.id] = layout;
    (store.data.teams[this.map.id] ??= [])[this.teamSlot()] = layout;
    persist();
  }

  /** Saved team in use on this map (0..TEAM_SLOTS-1). */
  teamSlot(): number {
    return store.data.teamSlot[this.map.id] ?? 0;
  }

  /** Swaps the whole board for another saved team (between waves only). */
  switchTeam(slot: number): boolean {
    if (this.waveActive || slot === this.teamSlot() || slot < 0 || slot >= TEAM_SLOTS) return false;
    this.saveLayout();
    store.data.teamSlot[this.map.id] = slot;
    const next = store.data.teams[this.map.id]?.[slot] ?? [];
    this.towers = [];
    this.selectedTower = null;
    this.aiming = null;
    for (const p of next) if (store.data.owned.includes(p.id)) this.place(p.id, p.c, p.r);
    this.refreshStats();
    this.saveLayout();
    this.ev.onChange();
    return true;
  }

  private restoreLayout(): void {
    for (const p of store.data.layouts[this.map.id] ?? []) {
      if (store.data.owned.includes(p.id)) this.place(p.id, p.c, p.r);
    }
  }

  // ---------- Input ----------

  /** Tile under a client point, or null outside the board. */
  tileAtClient(cx: number, cy: number): { c: number; r: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (cx < rect.left || cy < rect.top || cx > rect.right || cy > rect.bottom) return null;
    const x = ((cx - rect.left) / rect.width) * W;
    const y = ((cy - rect.top) / rect.height) * H;
    return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
  }

  /** Canvas-space point under a client point (no bounds check). */
  private pointAtClient(cx: number, cy: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((cx - rect.left) / rect.width) * W, y: ((cy - rect.top) / rect.height) * H };
  }

  /** Front-most living enemy whose sprite covers a canvas point. */
  enemyAtPoint(x: number, y: number): Enemy | null {
    let best: Enemy | null = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const h = Math.max(30, (CREATURE_HEIGHT[e.def.id] ?? 16) * 3), w = Math.max(30, h * 0.9), base = e.y + 15;
      if (Math.abs(x - e.x) <= w / 2 && y >= base - h && y <= base + 8 && (!best || e.y > best.y)) best = e;
    }
    return best;
  }

  /** Placement preview while dragging from outside the canvas. */
  previewAt(cx: number, cy: number): void {
    this.hover = this.tileAtClient(cx, cy);
  }

  moveTower(t: Tower, c: number, r: number): boolean {
    if (!this.canPlace(c, r)) return false;
    t.c = c;
    t.r = r;
    t.x = (c + 0.5) * TILE;
    t.y = (r + 0.5) * TILE;
    t.stats = this.statsAt(t.def, c, r);
    t.born = 0;
    this.saveLayout();
    return true;
  }

  /** Places a champion, or moves it if it is already on the board. */
  dropChampion(id: string, c: number, r: number): boolean {
    const existing = this.towers.find((t) => t.def.id === id);
    const ok = existing ? this.moveTower(existing, c, r) : this.place(id, c, r);
    if (ok) this.selectedTower = existing ?? this.towers[this.towers.length - 1];
    this.selectedRoster = null;
    this.ev.onChange();
    return ok;
  }

  /** Champion being dragged on the board (moving only happens by press-and-drag). */
  private dragging: Tower | null = null;

  private bindInput(): void {
    let drag: { t: Tower; x: number; y: number } | null = null;
    const cv = this.canvas;
    const cursor = () => {
      const t = this.hover && this.towers.find((x) => x.c === this.hover!.c && x.r === this.hover!.r);
      cv.style.cursor = this.aiming ? 'crosshair' : this.dragging ? 'grabbing' : t ? 'grab' : this.selectedRoster ? 'copy' : 'default';
    };
    cv.addEventListener('pointermove', (e) => {
      this.hover = this.tileAtClient(e.clientX, e.clientY);
      this.mouse = this.pointAtClient(e.clientX, e.clientY);
      if (drag && !this.dragging && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
        this.dragging = drag.t;
        this.selectedTower = drag.t;
        this.selectedEnemy = null;
        this.ev.onChange();
      }
      cursor();
    });
    cv.addEventListener('pointerleave', () => { if (!this.dragging) this.hover = null; cv.style.cursor = 'default'; });
    cv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const tile = this.tileAtClient(e.clientX, e.clientY);
      const t = tile && this.towers.find((x) => x.c === tile.c && x.r === tile.r);
      if (t) {
        drag = { t, x: e.clientX, y: e.clientY };
        cv.setPointerCapture(e.pointerId);
      }
    });
    cv.addEventListener('pointerup', (e) => {
      if (this.dragging) {
        const tile = this.tileAtClient(e.clientX, e.clientY);
        if (tile) this.moveTower(this.dragging, tile.c, tile.r);
        this.selectedTower = this.dragging;
        this.dragging = null;
        this.ev.onChange();
      } else {
        this.clickTile(e);
      }
      drag = null;
      cursor();
    });
    cv.addEventListener('pointercancel', () => { drag = null; this.dragging = null; cursor(); this.ev.onChange(); });
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.aiming = null;
      this.selectedRoster = null;
      this.selectedTower = null;
      this.selectedEnemy = null;
      this.ev.onChange();
    });
  }

  /** Click: select a champion, place the one picked in the team bar, or clear the selection. */
  private clickTile(e: PointerEvent): void {
    if (e.button !== 0) return;
    const tile = this.tileAtClient(e.clientX, e.clientY);
    if (!tile) return;
    if (this.aiming) {
      // Aimed ultimate: it lands where the player clicked
      // (stays armed when there is nothing on the board to hit yet)
      if (this.castUlt(this.aiming, this.pointAtClient(e.clientX, e.clientY))) this.aiming = null;
      this.ev.onChange();
      return;
    }
    const { c, r } = tile;
    const hit = this.towers.find((t) => t.c === c && t.r === r);
    if (this.selectedRoster && !hit) {
      this.dropChampion(this.selectedRoster, c, r);
      return;
    }
    const pt = this.pointAtClient(e.clientX, e.clientY);
    const foe = hit ? null : this.enemyAtPoint(pt.x, pt.y);
    this.selectedTower = hit ?? null;
    this.selectedEnemy = foe;
    this.selectedRoster = null;
    this.ev.onChange();
  }

  // ---------- Flow ----------

  /** Enemies of the current wave still to spawn or alive. */
  waveRemaining(): number {
    return this.queue.length + this.enemies.length;
  }

  /** Composition of the next wave (enemy id -> count). */
  nextWave(): { id: string; n: number }[] {
    if (this.wave >= this.map.waves && !this.endless) return [];
    const counts = new Map<string, number>();
    for (const sp of buildWave(this.map, this.wave + 1)) counts.set(sp.id, (counts.get(sp.id) ?? 0) + 1);
    return [...counts].map(([id, n]) => ({ id, n }));
  }

  /** Boss challenge: the run starts directly at the final wave. */
  bossMode = false;
  /** Endless mode: the run starts after the map's last wave and only ends when the nexus falls. */
  endless = false;

  /** Average level of the champions on the board. */
  teamLevel(): number {
    return this.towers.length ? this.towers.reduce((n, t) => n + level(t.def.id), 0) / this.towers.length : 1;
  }

  /** Enemy HP multiplier of the current wave (endless waves also scale with the team's level). */
  waveHp(): number {
    return this.endless && this.wave > this.map.waves ? endlessHp(this.map, this.endlessWave(), this.teamLevel()) : hpScale(this.map, this.wave);
  }

  /** Waves survived in the current endless run. */
  endlessWave(): number {
    return Math.max(0, this.wave - this.map.waves);
  }

  canChallengeBoss(): boolean {
    return (store.data.best[this.map.id] ?? 0) >= this.map.waves - 1;
  }

  startWave(): void {
    if (this.waveActive || this.over || this.boonOffer) return;
    if (this.bossMode && this.wave === 0) this.wave = this.map.waves - 1;
    if (this.endless && this.wave === 0) this.wave = this.map.waves;
    this.wave++;
    this.queue = buildWave(this.map, this.wave);
    this.waveTotal = this.queue.length;
    this.spawnT = 0;
    this.waveActive = true;
    this.autoT = -1;
    if (this.visual) sfx('wave');
    const final = this.wave === this.map.waves || (this.endless && this.endlessWave() % 10 === 0);
    this.showBanner(final ? 'BOSS' : this.endless ? `Infini · vague ${this.endlessWave()}` : `Vague ${this.wave}`, final ? ENEMIES[this.map.finalBoss].name
      : this.wave % 10 === 0 ? 'Monstre épique en approche' : this.wave % 5 === 0 ? 'Carapateurs !' : '', final ? '#c084fc' : '#f0e6d2');
    this.ev.onChange();
  }

  private showBanner(text: string, sub: string, color: string): void {
    if (this.visual) this.banner = { text, sub, t: 0, color };
  }

  private burst(x: number, y: number, color: string, n: number, speed: number, size = 2.5): void {
    this.vfx?.burst(x, y, color, n, speed, size);
  }

  /** Explosion: flash and shockwave, plus (when visible) debris, smoke, a mark on the ground and a light. */
  private boom(x: number, y: number, r: number, color: string, max: number, src: Tower | null = null): void {
    this.fx.push({ kind: 'boom', x, y, r, t: 0, max, color });
    if (!this.vfx) return;
    this.vfx.explosion(x, y, r, color, src ? heroLook(src.def.id, src.def.role).element : 'magic');
    if (r >= 90) this.shake = Math.max(this.shake, Math.min(8, r / 16));
  }

  /** Freezes the simulation for a few frames (hit-stop). Never headless, at high speed or with reduced motion. */
  private stop(sec: number): void {
    if (!this.vfx || this.vfx.low || this.calm || store.data.speed > 2) return;
    const now = performance.now();
    if (now - this.lastStop < 350) return;
    this.lastStop = now;
    this.hitStop = Math.max(this.hitStop, sec);
  }

  /** Picks the mode of the next run without launching it (resets the board if a run is under way or over). */
  setMode(mode: 'normal' | 'boss' | 'endless'): void {
    if (this.wave > 0 || this.over || this.waveActive) { this.restart(mode === 'boss', mode === 'endless'); return; }
    this.endless = mode === 'endless' && endlessUnlocked(this.map.id);
    this.bossMode = mode === 'boss' && this.canChallengeBoss();
    this.ev.onChange();
  }

  mode(): 'normal' | 'boss' | 'endless' {
    return this.endless ? 'endless' : this.bossMode ? 'boss' : 'normal';
  }

  restart(bossMode = false, endless = false): void {
    this.endless = endless && endlessUnlocked(this.map.id);
    this.bossMode = !this.endless && bossMode && this.canChallengeBoss();
    this.enemies = [];
    this.projs = [];
    this.fx = [];
    this.queue = [];
    this.wave = 0;
    this.lives = START_LIVES;
    this.waveActive = false;
    this.over = false;
    this.spellCd = { smite: 0, heal: 0, exhaust: 0 };
    this.selectedEnemy = null;
    for (const t of this.towers) {
      t.ultCd = t.def.active.cd; t.buffs = []; t.runStacks = 0; t.ramp = 0; t.hits = 0; t.cd = 0.3; t.dmgDone = 0; t.kills = 0;
      t.engaged = false; t.tgt = null; t.since = 9;
    }
    this.vfx?.clear();
    this.runKills = this.runGold = this.runTime = 0;
    this.ultCasts = this.livesLost = this.epicKills = this.bestHit = 0;
    this.runLoot = {};
    this.boons = {};
    this.boonOffer = null;
    this.aiming = null;
    this.refreshStats();
    this.spawnCount = 0;
    for (const tu of this.turrets) tu.cd = 0;
    store.data.runs++;
    if (store.data.auto) this.autoT = 1.5;
    this.ev.onChange();
  }

  castSpell(id: SpellId): void {
    if (this.spellCd[id] > 0 || this.over) return;
    const alive = this.enemies.filter((e) => !e.dead);
    if (id === 'smite') {
      if (!alive.length) return;
      const target = alive.reduce((a, b) => (b.hp > a.hp ? b : a));
      this.damage(target, target.maxHp * 0.2, null, true);
      this.boom(target.x, target.y, 34, '#ffd84a', 0.4);
      this.vfx?.light(target.x, target.y - 40, 60, '#ffd84a', 0.7, 0.3);
    } else if (id === 'exhaust') {
      if (!alive.length) return;
      for (const e of alive) { const k = this.grip(e); if (k > 0) { e.slowPct = Math.max(e.slowPct, 0.6 * k); e.slowT = Math.max(e.slowT, 3); } }
    } else {
      this.lives = Math.min(MAX_LIVES, this.lives + 5);
    }
    this.spellCd[id] = SPELLS[id].cd;
    if (this.visual) sfx(id === 'heal' ? 'upgrade' : 'ult');
  }

  // ---------- Active ultimates ----------

  ultReady(t: Tower): boolean {
    return !this.over && t.ultCd <= 0;
  }

  /** Centre of the densest group of enemies within radius tiles (ties go to the one furthest along). */
  private densest(list: Enemy[], radius: number): { x: number; y: number } {
    const r = radius * TILE;
    let best = list[0], bn = -1;
    for (const a of list) {
      let n = 0;
      for (const b of list) if (Math.hypot(a.x - b.x, a.y - b.y) <= r) n++;
      if (n > bn || (n === bn && a.s > best.s)) { best = a; bn = n; }
    }
    return { x: best.x, y: best.y };
  }

  private addBurn(e: Enemy, dps: number, dur: number, src: Tower): void {
    if (e.dead || e.def.fireproof) return;
    if (e.burns.length >= 6) e.burns.shift();
    e.burns.push({ dps, t: dur, src });
  }

  /** True when this ultimate lands on a spot the player can choose (area blasts and area control). */
  needsAim(t: Tower): boolean {
    const fx = t.def.active.fx;
    return fx.kind === 'burst' || (fx.kind === 'control' && !!fx.radius);
  }

  /** Radius (px) of the area an aimed ultimate covers. */
  aimRadius(t: Tower): number {
    const fx = t.def.active.fx;
    return ((fx.kind === 'burst' || fx.kind === 'control') && fx.radius ? fx.radius : 0) * TILE;
  }

  /**
   * Ultimate button or key: aimed ultimates first show their target circle (a click on the board casts there,
   * pressing again lets the game pick the densest group); the others fire at once.
   */
  requestUlt(t: Tower): void {
    if (!this.ultReady(t)) return;
    if (this.needsAim(t) && this.aiming !== t) { this.aiming = t; this.selectedRoster = null; this.ev.onChange(); return; }
    this.aiming = null;
    this.castUlt(t);
    this.ev.onChange();
  }

  /** Takes one of the offered blessings (or a random one) and lets the run go on. */
  pickBoon(id?: string): void {
    const offer = this.boonOffer;
    if (!offer) return;
    const b = offer.find((x) => x.id === id) ?? offer[Math.floor(Math.random() * offer.length)];
    this.boonOffer = null;
    this.boons[b.id] = (this.boons[b.id] ?? 0) + 1;
    if (b.special === 'lives') this.lives = Math.min(MAX_LIVES, this.lives + (b.value ?? 0));
    this.refreshStats();
    if (this.visual) {
      sfx('upgrade');
      this.showBanner(`${b.icon} ${b.name}`, b.desc, '#0ac8b9');
      const end = this.pts[this.pts.length - 1];
      for (const t of this.towers) this.fx.push({ kind: 'pillar', x: t.x, y: t.y + 12, t: 0, max: 0.9, color: '#0ac8b9' });
      if (b.special) this.fx.push({ kind: 'pillar', x: end.x, y: end.y + 14, t: 0, max: 1, color: '#6be08a' });
    }
    if (store.data.auto) this.autoT = 1;
    this.ev.onChange();
  }

  /** Casts the champion's active ultimate (at a chosen spot when aimed); false when it is on cooldown or has nothing to act on. */
  castUlt(t: Tower, at?: { x: number; y: number }): boolean {
    if (!this.ultReady(t)) return false;
    const u = t.def.active, fx = u.fx;
    const alive = this.enemies.filter((e) => !e.dead);
    const dmg = (t.stats.dmg + t.runStacks) * TUNE.ult;
    const vis = this.visual;
    if (fx.kind === 'gold') {
      if (!this.waveActive) return false;
      const g = Math.max(1, Math.round(waveBonus(this.map, Math.max(1, this.wave)) * fx.mult));
      store.data.gold += g;
      this.runGold += g;
      if (vis) {
        this.fx.push({ kind: 'text', x: t.x, y: t.y - 40, t: 0, max: 1.2, color: '#f5c542', text: `+${fmtShort(g)}`, size: 20 });
        this.fx.push({ kind: 'pillar', x: t.x, y: t.y + 12, t: 0, max: 0.9, color: '#f5c542' });
        this.vfx!.coins(t.x, t.y - 30, 26, t.y + 14);
        this.vfx!.sparks(t.x, t.y - 20, -Math.PI / 2, 2.4, 14, 260, '#fff3b0', 1.6, t.y + 14);
      }
    } else if (fx.kind === 'lives') {
      if (this.lives >= MAX_LIVES) return false;
      this.lives = Math.min(MAX_LIVES, this.lives + fx.n);
      const end = this.pts[this.pts.length - 1];
      if (vis) {
        this.fx.push({ kind: 'ring', x: end.x, y: end.y, r: 70, t: 0, max: 0.9, color: '#6be08a' });
        this.fx.push({ kind: 'pillar', x: end.x, y: end.y + 14, t: 0, max: 1.1, color: '#6be08a' });
        this.fx.push({ kind: 'pillar', x: t.x, y: t.y + 12, t: 0, max: 0.8, color: '#6be08a' });
        this.fx.push({ kind: 'text', x: end.x, y: end.y - 50, t: 0, max: 1.2, color: '#6be08a', text: `+${fx.n} ♥`, size: 20 });
        this.vfx!.embers(end.x, end.y - 10, 18, '#6be08a', '#ffffff', 22);
        this.vfx!.light(end.x, end.y, 150, '#6be08a', 0.7, 0.7);
      }
    } else if (!alive.length) {
      return false;
    } else if (fx.kind === 'burst') {
      const c = at ?? this.densest(alive, fx.radius), r = fx.radius * TILE;
      for (const e of alive) {
        if (Math.hypot(e.x - c.x, e.y - c.y) > r + e.def.size) continue;
        this.damage(e, dmg * fx.mult, t, false);
        if (fx.burn) this.addBurn(e, dmg * fx.burn.mult, fx.burn.dur, t);
      }
      if (vis) {
        this.boom(c.x, c.y, r * 1.15, t.def.color, 0.6, t);
        this.fx.push({ kind: 'ring', x: c.x, y: c.y, r: r * 1.3, t: 0, max: 0.7, color: '#ffffff' });
        this.burst(c.x, c.y, t.def.color, 30, 220, 3.5);
        this.shake = Math.max(this.shake, 7);
        // Barrage: shots rain down across the area for half a second
        const col = lightColor(heroLook(t.def.id, t.def.role).element, t.def.color);
        for (let i = 0; i < 11; i++) {
          const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r, delay = 0.04 + i * 0.045;
          const sx = c.x + Math.cos(a) * d, sy = c.y + Math.sin(a) * d * 0.8;
          this.fx.push({ kind: 'strike', x: sx, y: sy, t: -delay, max: 0.2, color: col });
          this.fx.push({ kind: 'boom', x: sx, y: sy, r: 22 + r * 0.22, t: -delay - 0.18, max: 0.32, color: i % 3 ? col : '#ffffff' });
        }
      }
    } else if (fx.kind === 'control') {
      const c = fx.radius ? at ?? this.densest(alive, fx.radius) : null, r = (fx.radius ?? 0) * TILE;
      for (const e of alive) {
        if (c && Math.hypot(e.x - c.x, e.y - c.y) > r + e.def.size) continue;
        const k = this.grip(e);
        if (fx.slow && k > 0) { e.slowPct = Math.max(e.slowPct, fx.slow * k); e.slowT = Math.max(e.slowT, fx.slowDur ?? 3); }
        if (fx.stun && k > 0) e.stunT = Math.max(e.stunT, fx.stun * k * (e.def.boss ? 0.3 : 1));
        if (fx.mult) this.damage(e, dmg * fx.mult, t, false);
      }
      if (vis) {
        const cx = c?.x ?? W / 2, cy = c?.y ?? H / 2, rr = c ? r * 1.2 : W * 0.6;
        this.fx.push({ kind: 'ring', x: cx, y: cy, r: rr, t: 0, max: 0.8, color: t.def.color });
        this.fx.push({ kind: 'boom', x: cx, y: cy, r: rr * 0.8, t: 0, max: 0.5, color: t.def.color });
        this.vfx!.light(cx, cy, rr * 1.6, t.def.color, 0.6, 0.45);
        this.shake = Math.max(this.shake, 3);
        const look = heroLook(t.def.id, t.def.role), col = lightColor(look.element, t.def.color);
        // Waves rolling out, and a bolt binding every monster caught in it
        for (let i = 1; i <= 2; i++) this.fx.push({ kind: 'ring', x: cx, y: cy, r: rr, t: -i * 0.14, max: 0.8, color: i % 2 ? '#ffffff' : t.def.color });
        if (look.element === 'ice') this.fx.push({ kind: 'storm', x: cx, y: cy, r: Math.min(rr, 260), t: 0, max: 1.1, color: t.def.color });
        let bound = 0;
        for (const e of alive) {
          if (bound >= 14 || (c && Math.hypot(e.x - c.x, e.y - c.y) > r + e.def.size)) continue;
          bound++;
          this.fx.push({ kind: 'zap', x: c ? cx : t.x, y: (c ? cy : t.y) - 8, x2: e.x, y2: e.y - 8, t: 0, max: 0.4, color: col });
          this.vfx!.impact(look.element, t.def.color, e.x, e.y - 8, 0, 2, e.y + 15);
        }
      }
    } else if (fx.kind === 'buff') {
      const r = (fx.radius ?? 0) * TILE;
      for (const o of this.towers) {
        if (fx.scope === 'self' && o !== t) continue;
        if (fx.scope === 'near' && Math.hypot(o.x - t.x, o.y - t.y) > r) continue;
        o.buffs.push({ t: fx.dur, rate: fx.rate ?? 0, dmg: fx.dmg ?? 0 });
        if (vis) {
          this.fx.push({ kind: 'ring', x: o.x, y: o.y, r: 44, t: 0, max: 0.8, color: t.def.color });
          this.fx.push({ kind: 'pillar', x: o.x, y: o.y + 12, t: o === t ? 0 : -0.12, max: 1, color: t.def.color });
          this.vfx!.embers(o.x, o.y - 4, 12, t.def.color, '#ffffff', 12);
          if (o !== t) this.fx.push({ kind: 'zap', x: t.x, y: t.y - 16, x2: o.x, y2: o.y - 16, t: 0, max: 0.3, color: t.def.color });
        }
      }
      if (vis && fx.scope === 'near') this.fx.push({ kind: 'ring', x: t.x, y: t.y, r, t: 0, max: 0.6, color: t.def.color });
    } else {
      const target = alive.reduce((a, b) => (b.hp > a.hp ? b : a));
      const boss = target.def.boss ? t.stats.bossMult ?? 1 : 1;
      this.damage(target, dmg * fx.mult * boss, t, false);
      this.damage(target, target.maxHp * fx.pct * (target.def.boss ? 0.5 : 1), t, true);
      if (vis) {
        this.fx.push({ kind: 'beam', x: t.x, y: t.y - 14, x2: target.x, y2: target.y, t: 0, max: 0.3, color: t.def.color });
        this.boom(target.x, target.y, 50, t.def.color, 0.45, t);
        this.burst(target.x, target.y, t.def.color, 18, 180, 3);
        this.shake = Math.max(this.shake, 6);
        // Judgement from above: a column of light slams down on the target
        this.fx.push({ kind: 'laser', x: target.x + 30, y: target.y - 420, x2: target.x, y2: target.y, t: 0, max: 0.45, color: t.def.color });
        this.fx.push({ kind: 'ring', x: target.x, y: target.y, r: 90, t: 0, max: 0.6, color: '#ffffff' });
        this.fx.push({ kind: 'ring', x: target.x, y: target.y, r: 130, t: -0.1, max: 0.7, color: t.def.color });
        this.vfx!.shards(target.x, target.y, 12, '#3a3128', 300, target.y + 15, 'debris');
        this.stop(0.09);
      }
    }
    t.ultCd = u.cd;
    this.ultCasts++;
    t.flash = 0.3;
    t.ultT = 0;
    if (vis) {
      const band = !this.vfx!.low && store.data.speed <= 4;
      // The name floats above the champion only when the cut-in band is not shown
      if (!band) this.fx.push({ kind: 'text', x: t.x, y: t.y - 62, t: 0, max: 1.3, color: '#ffd84a', text: u.name, size: 17 });
      sfx('ult');
      // The ground darkens for a moment so the ultimate's light carries
      this.dim = 1;
      this.vfx!.light(t.x, t.y - 20, 150, t.def.color, 0.75, 0.6);
      this.vfx!.embers(t.x, t.y - 6, 14, t.def.color, '#ffffff', 14);
      this.stop(0.06);
      if (band) this.cutin = { id: t.def.id, name: u.name, champ: t.def.name, color: t.def.color, t: 0 };
    }
    return true;
  }

  /** Auto-cast (option): fires ready ultimates only when they have something worthwhile to hit. */
  private autoUlts(): void {
    const alive = this.enemies.filter((e) => !e.dead);
    const big = alive.some((e) => e.def.boss || e.def.shape === 'boss');
    for (const t of this.towers) {
      if (t.ultCd > 0) continue;
      const k = t.def.active.fx.kind;
      const worth = k === 'gold' ? true
        : k === 'lives' ? this.lives <= MAX_LIVES - 3
        // Executes wait for the epic monster or boss on the waves that have one.
        : k === 'execute' ? big || (alive.length > 0 && this.wave % 10 !== 0 && this.wave !== this.map.waves && !(this.endless && this.endlessWave() % 10 === 0))
        : k === 'buff' ? this.inRange(t).length >= 2 || (big && this.inRange(t).length > 0)
        : big || alive.length >= 5;
      if (worth) this.castUlt(t);
    }
  }

  private sortTargets(list: Enemy[], t: Tower): Enemy[] {
    // Distance left to the nexus: lanes differ in length, so raw progress is not comparable.
    const left = (e: Enemy) => this.lanes[e.lane].len - e.s;
    switch (t.priority) {
      case 'last': return list.sort((a, b) => left(b) - left(a));
      case 'strong': return list.sort((a, b) => b.hp - a.hp);
      case 'weak': return list.sort((a, b) => a.hp - b.hp);
      case 'close': {
        const d = (e: Enemy) => Math.hypot(e.x - t.x, e.y - t.y);
        return list.sort((a, b) => d(a) - d(b));
      }
      default: return list.sort((a, b) => left(a) - left(b));
    }
  }

  // ---------- Loop ----------

  /** Runs the simulation up to `now`; shared by the display loop and the background timer. */
  private advance(now: number): void {
    const dt = Math.max(0, Math.min(1.5, (now - this.last) / 1000));
    this.last = now;
    if (this.paused) return;
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    this.acc += dt * store.data.speed;
    let steps = 0;
    while (this.acc >= STEP && steps < 1200) { this.step(STEP); this.acc -= STEP; steps++; }
    if (steps >= 1200) this.acc = 0;
  }

  // The display loop drives the simulation, so movement is as smooth as the screen allows. Browsers pause
  // requestAnimationFrame in a background tab but still fire throttled timers: the timer takes over there,
  // which keeps auto-farm going.
  private tick = (): void => {
    const now = performance.now();
    if (now - this.lastFrame < 150) return;
    this.advance(now);
    if (now - this.lastFrame > 500) this.render();
  };

  private frame = (now: number): void => {
    const dt = Math.max(0, Math.min(0.1, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.advance(now);
    if (!this.paused) this.animate(dt, this.hitStop > 0 ? 0 : dt * store.data.speed);
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  step(dt: number): void {
    for (const k of Object.keys(this.spellCd) as SpellId[]) this.spellCd[k] = Math.max(0, this.spellCd[k] - dt);
    const charge = dt * (1 + (this.syn.ultCd ?? 0));
    for (const t of this.towers) t.ultCd = Math.max(0, t.ultCd - charge);
    if (store.data.autoUlt && this.waveActive && !this.over && (this.autoUltT -= dt) <= 0) { this.autoUltT = 0.5; this.autoUlts(); }
    if (this.boonOffer && store.data.auto && (this.boonT -= dt) <= 0) this.pickBoon();
    if (this.aiming && (!this.towers.includes(this.aiming) || !this.ultReady(this.aiming))) this.aiming = null;
    this.saveT += dt;
    if (this.saveT > 10) { this.saveT = 0; persist(); }

    if (this.autoT >= 0) {
      this.autoT -= dt;
      if (this.autoT < 0) {
        if (this.over) this.restart(false, this.endless);
        else this.startWave();
      }
    }
    if (this.over) return;
    if (this.waveActive) this.runTime += dt;

    // Spawning
    if (this.waveActive && this.queue.length) {
      this.spawnT -= dt;
      while (this.queue.length && this.spawnT <= 0) {
        const sp = this.queue.shift()!;
        this.spawn(sp.id);
        this.spawnT += this.queue[0]?.delay ?? 0;
      }
    }

    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateTurrets(dt);
    this.updateProjs(dt);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.max);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.selectedEnemy?.dead) this.selectedEnemy = null;

    if (this.waveActive && !this.queue.length && !this.enemies.length && !this.over) this.waveCleared();
  }

  /** Spawns a monster at the start of the next lane, or at a given point of a lane (splitting monsters). */
  private spawn(id: string, at?: { s: number; lane: number }): void {
    const def = ENEMIES[id];
    const hp = def.hp * this.waveHp();
    const lane = at ? at.lane : this.spawnCount++ % this.lanes.length;
    const s0 = at?.s ?? 0;
    const p = this.posAt(s0, lane);
    this.enemies.push({
      uid: ++this.uid, def, hp, maxHp: hp, s: s0, x: p.x, y: p.y, lane,
      slowPct: 0, slowT: 0, stunT: 0, burns: [], dead: false, hitFlash: 0, face: 1, phase: Math.random() * 6,
      kx: 0, ky: 0, sq: 0, born: at ? 0.2 : 0, shield: def.shield ?? 0, healed: 0,
      abT: (def.ability?.cd ?? 0) * 0.6, chargeT: 0, phaseT: 0, hasteT: 0, haste: 1,
    });
    store.data.bestiary[id] ??= 0;
  }

  /** How much of a slow or stun gets through this monster's tenacity (0 = immune). */
  private grip(e: Enemy): number {
    return 1 - (e.def.tenacity ?? 0);
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      for (const b of e.burns) {
        b.t -= dt;
        this.damage(e, b.dps * dt, b.src, true);
      }
      e.burns = e.burns.filter((b) => b.t > 0);
      if (e.dead) continue;
      if (e.def.regen && !e.burns.length && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.def.regen * dt);
        e.healed = 0.3;
      }
      if (e.def.heal && e.stunT <= 0) {
        // Healers mend everyone around them (not each other, not bosses)
        const hr = e.def.heal.radius * TILE;
        for (const o of this.enemies) {
          if (o === e || o.dead || o.def.boss || o.def.heal || o.hp >= o.maxHp || Math.hypot(o.x - e.x, o.y - e.y) > hr) continue;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * e.def.heal.pct * dt);
          o.healed = 0.3;
        }
      }
      if (e.slowT > 0) e.slowT -= dt; else e.slowPct = 0;
      if (e.stunT > 0) { e.stunT -= dt; continue; }
      if (e.def.ability && (e.abT -= dt) <= 0) { e.abT = e.def.ability.cd; this.useAbility(e); }
      if (e.phaseT > 0) e.phaseT -= dt;
      if (e.hasteT > 0) e.hasteT -= dt;
      const charging = e.chargeT > 0;
      if (charging) e.chargeT -= dt;
      const river = !e.def.fly && this.featureAt(Math.floor(e.x / TILE), Math.floor(e.y / TILE)) === 'river' ? 0.8 : 1;
      const pace = (charging && e.def.ability?.kind === 'charge' ? e.def.ability.mult : 1 - e.slowPct) * (e.hasteT > 0 ? e.haste : 1);
      e.s += e.def.speed * TILE * pace * river * dt;
      const p = this.posAt(e.s, e.lane);
      if (Math.abs(p.x - e.x) > 0.01) e.face = p.x > e.x ? 1 : -1;
      e.phase += dt * e.def.speed * 8 * (1 - e.slowPct);
      e.x = p.x;
      e.y = p.y;
      if (e.s >= this.lanes[e.lane].len) {
        this.lives -= e.def.leak;
        this.livesLost += e.def.leak;
        if (this.visual) sfx('lifeLost');
        this.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 40, t: 0, max: 0.5, color: '#ff4d4d' });
        this.nexusHurt = 0.5;
        this.shake = Math.max(this.shake, e.def.boss ? 10 : 3);
        this.burst(e.x, e.y, '#ff5a5a', e.def.boss ? 30 : 8, 120);
        this.vfx?.light(e.x, e.y, e.def.boss ? 170 : 80, '#ff4d4d', 0.7, 0.4);
        if (e.def.boss) this.stop(0.1);
        // A boss that reaches the nexus walks the lane again instead of vanishing.
        if (e.def.boss) e.s = 0; else e.dead = true;
        if (this.lives <= 0 && !this.over) this.lose();
      }
    }
  }

  /** Allied map turrets: steady damage scaled to the wave, on the closest enemy in range. */
  private updateTurrets(dt: number): void {
    for (const tu of this.turrets) {
      tu.cd -= dt;
      if (tu.cd > 0) continue;
      let best: Enemy | null = null, bd = 3.2 * TILE;
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - tu.x, e.y - tu.y);
        if (!e.dead && d < bd) { bd = d; best = e; }
      }
      if (!best) { tu.cd = 0.1; continue; }
      tu.cd = 1.4;
      this.damage(best, ENEMIES.melee.hp * this.waveHp() * 0.25, null, false);
      if (this.vfx) {
        this.fx.push({ kind: 'beam', x: tu.x, y: tu.y - 40, x2: best.x, y2: best.y, t: 0, max: 0.18, color: '#7fd8ff' });
        this.vfx.impact('spark', '#7fd8ff', best.x, best.y - 6, Math.atan2(best.y - tu.y + 40, best.x - tu.x), 1, best.y + 15);
        this.vfx.light(tu.x, tu.y - 40, 34, '#7fd8ff', 0.55, 0.12);
      }
    }
  }

  private inRange(t: Tower, range = t.stats.range): Enemy[] {
    const r = range * TILE;
    return this.enemies.filter((e) => !e.dead && Math.hypot(e.x - t.x, e.y - t.y) <= r + e.def.size);
  }

  /** A boss or epic monster uses its special move. */
  private useAbility(e: Enemy): void {
    const ab = e.def.ability!, v = this.vfx;
    switch (ab.kind) {
      case 'summon':
        for (let i = 0; i < ab.n; i++) this.spawn(ab.id, { s: Math.max(0, e.s - 14 - i * 12), lane: e.lane });
        v?.wisps(e.x, e.y - 20, 8, e.def.color);
        break;
      case 'charge':
        e.chargeT = ab.dur;
        e.slowPct = 0;
        v?.smoke(e.x, e.y + 12, 6, 9, '#b9b2a3');
        break;
      case 'shield':
        e.shield = ab.hits;
        break;
      case 'freeze': {
        const r = ab.radius * TILE;
        for (const t of this.towers) {
          if (Math.hypot(t.x - e.x, t.y - e.y) > r) continue;
          t.stunT = Math.max(t.stunT, ab.dur);
          t.engaged = false;
          if (v) { this.fx.push({ kind: 'pillar', x: t.x, y: t.y + 12, t: 0, max: 0.7, color: '#8fd3ff' }); v.shards(t.x, t.y - 10, 6, '#e8f7ff', 140, t.y + 14); }
        }
        if (v) this.fx.push({ kind: 'storm', x: e.x, y: e.y, r, t: 0, max: 0.9, color: '#8fd3ff' });
        break;
      }
      case 'rally': {
        const r = ab.radius * TILE;
        for (const o of this.enemies) {
          if (o.dead || Math.hypot(o.x - e.x, o.y - e.y) > r) continue;
          o.hasteT = ab.dur;
          o.haste = ab.mult;
        }
        break;
      }
      case 'phase':
        e.phaseT = ab.dur;
        e.burns = [];
        break;
      case 'mend': {
        const r = ab.radius * TILE;
        for (const o of this.enemies) {
          if (o.dead || Math.hypot(o.x - e.x, o.y - e.y) > r) continue;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * ab.pct * (o.def.boss ? 0.5 : 1));
          o.healed = 0.8;
        }
        break;
      }
    }
    if (!v) return;
    // Every special move is announced: its name above the monster, a wave of its colour, a flash
    this.fx.push({ kind: 'text', x: e.x, y: e.y - (CREATURE_HEIGHT[e.def.id] ?? 16) * 3 - 26, t: 0, max: 1.4, color: '#ff9d5c', text: ab.name, size: 15 });
    const reach = 'radius' in ab ? ab.radius * TILE : 60;
    this.fx.push({ kind: 'ring', x: e.x, y: e.y, r: reach, t: 0, max: 0.6, color: e.def.color });
    v.light(e.x, e.y - 20, reach * 1.4, e.def.color, 0.6, 0.4);
    this.shake = Math.max(this.shake, e.def.boss ? 5 : 2.5);
    sfx('ult');
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      t.flash = Math.max(0, t.flash - dt);
      if (t.stunT > 0) { t.stunT -= dt; t.cd = Math.max(t.cd, 0.2); continue; }
      if (t.buffs.length) { for (const b of t.buffs) b.t -= dt; t.buffs = t.buffs.filter((b) => b.t > 0); }
      const s = t.stats;
      const rate = s.rate * (1 + t.ramp) * (1 + t.buffs.reduce((n, b) => n + b.rate, 0));
      t.cd -= dt;
      if (t.cd > 0) continue;
      const targets = this.sortTargets(this.inRange(t), t);
      if (!targets.length) {
        if (s.ramp) t.ramp = Math.max(0, t.ramp - dt * 0.5);
        t.cd = 0;
        t.engaged = false;
        t.tgt = null;
        continue;
      }
      t.cd = 1 / rate;
      t.flash = 0.12;
      const first = targets[0];
      t.since = 0;
      t.period = t.cd;
      t.engaged = true;
      t.tgt = first;
      t.angle = Math.atan2(first.y - t.y, first.x - t.x);
      if (s.ramp) t.ramp = Math.min(s.ramp.max, t.ramp + s.ramp.perHit);

      switch (s.type) {
        case 'single':
        case 'splash':
          this.shoot(t, first, 0);
          break;
        case 'chain':
          this.shoot(t, first, s.targets - 1);
          break;
        case 'multi':
          for (const e of targets.slice(0, s.targets)) this.shoot(t, e, 0);
          break;
        case 'aura':
          for (const e of targets) this.hit(t, e, 1);
          if (this.vfx) this.auraFx(t, s.range * TILE);
          break;
        case 'pierce': {
          const len = s.range * TILE * 1.15;
          const x2 = t.x + Math.cos(t.angle) * len, y2 = t.y + Math.sin(t.angle) * len;
          for (const e of this.enemies) {
            if (!e.dead && distToSeg(e.x, e.y, t.x, t.y, x2, y2) < TILE * 0.45 + e.def.size) this.hit(t, e, 1);
          }
          if (this.vfx) this.laserFx(t, x2, y2, len);
          break;
        }
      }
    }
  }

  private shoot(t: Tower, target: Enemy, chainLeft: number): void {
    const look = heroLook(t.def.id, t.def.role);
    // The shot leaves from the weapon, not from the centre of the tile
    const x = t.x + Math.cos(t.angle) * 16, y = t.y - 10 + Math.sin(t.angle) * 12;
    this.projs.push({
      x, y, target, tower: t, dmgMult: 1, chainLeft, hit: new Set(), trail: [],
      speed: SHOT_SPEED[look.shot] * TILE, d0: Math.hypot(target.x - x, target.y - y),
    });
    if (!this.vfx) return;
    sfx('shot');
    this.vfx.light(x, y, 28, lightColor(look.element, t.def.color), 0.45, 0.09);
  }

  private updateProjs(dt: number): void {
    for (const p of this.projs) {
      const speed = p.speed;
      const dx = p.target.x - p.x, dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < speed * dt + 4) {
        p.x = p.target.x;
        p.y = p.target.y;
        if (this.vfx && p.ox !== undefined) {
          // The bolt of a bounce lingers for an instant after it lands
          const look = heroLook(p.tower.def.id, p.tower.def.role);
          this.fx.push({ kind: 'zap', x: p.ox, y: p.oy! - 8, x2: p.x, y2: p.y - 8, t: 0, max: 0.16, color: lightColor(look.element, p.tower.def.color) });
        }
        this.impact(p);
        p.chainLeft = -1;
      } else {
        if (this.visual) { p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 6) p.trail.shift(); }
        p.x += (dx / d) * speed * dt;
        p.y += (dy / d) * speed * dt;
      }
    }
    this.projs = this.projs.filter((p) => p.chainLeft >= 0);
  }

  private impact(p: Proj): void {
    const t = p.tower, s = t.stats;
    if (s.type === 'splash') {
      const r = s.splash * TILE;
      for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= r + e.def.size) this.hit(t, e, p.dmgMult);
      this.boom(p.x, p.y, r, t.def.color, 0.32, t);
      return;
    }
    if (!p.target.dead) this.hit(t, p.target, p.dmgMult);
    if (s.type === 'chain' && p.chainLeft > 0) {
      p.hit.add(p.target.uid);
      const next = this.enemies
        .filter((e) => !e.dead && !p.hit.has(e.uid) && Math.hypot(e.x - p.x, e.y - p.y) < 2.5 * TILE)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (next) {
        this.projs.push({
          x: p.x, y: p.y, target: next, tower: t, dmgMult: p.dmgMult * 0.8, chainLeft: p.chainLeft - 1, hit: p.hit, trail: [],
          speed: p.speed, d0: Math.hypot(next.x - p.x, next.y - p.y), ox: p.x, oy: p.y,
        });
      }
    }
  }

  private hit(t: Tower, e: Enemy, mult: number): void {
    if (this.visual) sfx('hit');
    const s = t.stats;
    t.hits++;
    if (e.shield > 0) {
      // The shield swallows the whole hit
      e.shield--;
      e.hitFlash = 0.08;
      if (this.vfx) {
        this.vfx.sparks(e.x, e.y - 10, Math.atan2(e.y - t.y, e.x - t.x) + Math.PI, 2.4, 6, 190, '#bfe9ff', 1.6, e.y + 15);
        this.fx.push({ kind: 'ring', x: e.x, y: e.y - 8, r: 22, t: 0, max: 0.25, color: '#bfe9ff' });
        if (e.shield === 0) this.fx.push({ kind: 'text', x: e.x, y: e.y - 30, t: 0, max: 0.7, color: '#bfe9ff', text: 'Bouclier brisé', size: 12 });
      }
      return;
    }
    let dmg = (s.dmg + t.runStacks) * mult;
    // Flyers slip out of area attacks
    if (e.def.fly && (s.type === 'splash' || s.type === 'aura')) dmg *= 0.5;
    let crit = false;
    if (s.everyN && t.hits % s.everyN.n === 0) { dmg *= s.everyN.mult; crit = true; }
    if (s.crit && Math.random() < s.crit.chance) { dmg *= s.crit.mult; crit = true; }
    if (e.def.boss && s.bossMult) dmg *= s.bossMult;
    if (e.def.boss && this.syn.boss) dmg *= 1 + this.syn.boss;
    if (t.buffs.length) dmg *= 1 + t.buffs.reduce((n, b) => n + b.dmg, 0);
    if (crit) this.fx.push({ kind: 'text', x: e.x, y: e.y - 18, t: 0, max: 0.8, color: '#ffd84a', text: fmtShort(dmg), size: 21 });
    if (this.vfx) this.hitFx(t, e, crit, dmg);
    this.damage(e, dmg, t, false);
    if (s.pctHp && t.hits % s.pctHp.every === 0) this.damage(e, e.maxHp * s.pctHp.pct, t, true);
    if (e.dead) return;
    e.hitFlash = 0.08;
    const grip = this.grip(e);
    if (s.slow && grip > 0 && s.slow.pct * grip >= e.slowPct) { e.slowPct = Math.min(0.8, s.slow.pct * grip); e.slowT = s.slow.dur; }
    if (s.stun && grip > 0 && Math.random() < s.stun.chance) e.stunT = Math.max(e.stunT, s.stun.dur * grip * (e.def.boss ? 0.3 : 1));
    if (s.burn && !e.def.fireproof) {
      if (e.burns.length >= 6) e.burns.shift();
      e.burns.push({ dps: (s.dmg + t.runStacks) * s.burn.mult, t: s.burn.dur, src: t });
    }
    if (s.goldHit && Math.random() < s.goldHit.chance) {
      const g = Math.max(1, Math.round(s.goldHit.amount * goldScale(this.map, this.wave)));
      store.data.gold += g;
      this.runGold += g;
      this.fx.push({ kind: 'text', x: e.x, y: e.y - 20, t: 0, max: 0.7, color: '#f5c542', text: `+${g}` });
    }
  }

  /** Piercing ray: a real laser from the weapon, with sparks along its path and a flare where it ends. */
  private laserFx(t: Tower, x2: number, y2: number, len: number): void {
    const v = this.vfx!, col = t.def.color;
    const x1 = t.x + Math.cos(t.angle) * 16, y1 = t.y - 10 + Math.sin(t.angle) * 12;
    this.fx.push({ kind: 'laser', x: x1, y: y1, x2, y2, t: 0, max: 0.3, color: col });
    for (let i = 0; i < 9; i++) {
      const u = Math.random();
      v.embers(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, 1, col, '#ffffff', 5);
    }
    v.sparks(x2, y2, t.angle, 1.6, 6, 180, '#ffffff', 1.5, y2 + 16);
    v.sparks(x1, y1, t.angle, 0.9, 4, 160, col, 1.5, y1 + 24);
    v.light(x1, y1, 46, col, 0.7, 0.2);
    v.light((x1 + x2) / 2, (y1 + y2) / 2, len * 0.6, col, 0.45, 0.24);
    v.light(x2, y2, 40, col, 0.55, 0.2);
  }

  /** Aura attack: a blizzard swirling around ice champions, a whirl of blades around the others. */
  private auraFx(t: Tower, r: number): void {
    const v = this.vfx!, ice = heroLook(t.def.id, t.def.role).element === 'ice';
    this.fx.push({ kind: ice ? 'storm' : 'whirl', x: t.x, y: t.y - 4, r, t: 0, max: ice ? 0.75 : 0.42, color: t.def.color });
    if (ice) {
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * 6.283, d = r * (0.25 + Math.random() * 0.75);
        v.embers(t.x + Math.cos(a) * d, t.y - 4 + Math.sin(a) * d, 1, '#e8f7ff', '#8fd3ff', 3);
      }
      v.light(t.x, t.y, r * 1.2, '#8fd3ff', 0.3, 0.4);
    } else {
      v.sparks(t.x, t.y - 6, 0, 6.283, 5, r * 3, '#ffffff', 1.4, t.y + 14);
      v.light(t.x, t.y, r * 1.1, t.def.color, 0.35, 0.2);
    }
  }

  /** Impact visuals: particles of the attacker's element, a flash of light and a shove away from the blow. */
  private hitFx(t: Tower, e: Enemy, crit: boolean, dmg: number): void {
    const look = heroLook(t.def.id, t.def.role);
    const dir = Math.atan2(e.y - t.y, e.x - t.x);
    const aura = t.stats.type === 'aura';
    this.vfx!.impact(look.element, t.def.color, e.x, e.y - 8, dir, crit ? 2 : aura ? 0.5 : 1, e.y + 15);
    // Heavier monsters barely move
    const heavy = e.def.boss ? 0.25 : e.def.shape === 'boss' ? 0.5 : 1;
    const k = Math.min(7, 2 + (dmg / e.maxHp) * 14) * heavy * (crit ? 1.6 : 1) * (aura ? 0.4 : 1);
    e.kx = Math.max(-11, Math.min(11, e.kx + Math.cos(dir) * k));
    e.ky = Math.max(-7, Math.min(7, e.ky + Math.sin(dir) * k * 0.6));
    e.sq = Math.min(1, e.sq + (crit ? 0.9 : 0.45) * heavy);
    if (crit) {
      this.shake = Math.max(this.shake, 2.5);
      this.stop(0.035);
    }
  }

  /** Death visuals: the body is knocked away and dissolves; epic monsters and bosses go out in a chain of blasts. */
  private deathFx(e: Enemy, src: Tower | null): void {
    const tier = e.def.boss ? 2 : e.def.shape === 'boss' ? 1 : 0;
    sfx(tier ? 'bossDeath' : 'death');
    const dir = src ? Math.atan2(e.y - src.y, e.x - src.x) : -Math.PI / 2;
    this.vfx!.death({
      id: e.def.id, img: mobImage(e.def.id), x: e.x + e.kx, y: e.y + 15 + e.ky, face: e.face, ph: e.phase, color: e.def.color,
      h: (CREATURE_HEIGHT[e.def.id] ?? 16) * 3, tier,
    }, dir, src ? heroLook(src.def.id, src.def.role).element : null, src?.def.color ?? e.def.color);
    if (!tier) return;
    this.shake = Math.max(this.shake, tier === 2 ? 12 : 6);
    this.stop(tier === 2 ? 0.16 : 0.08);
    this.dim = Math.max(this.dim, tier === 2 ? 1 : 0.5);
    const n = tier === 2 ? 7 : 3;
    for (let i = 0; i < n; i++) {
      this.fx.push({
        kind: 'boom', x: e.x + (Math.random() - 0.5) * 56, y: e.y - 6 - Math.random() * 54, r: 26 + Math.random() * 30,
        t: -i * 0.11, max: 0.4, color: i % 2 ? '#ffffff' : e.def.color,
      });
    }
    this.fx.push({ kind: 'ring', x: e.x, y: e.y, r: tier === 2 ? 190 : 110, t: 0, max: 0.8, color: '#ffffff' });
  }

  private damage(e: Enemy, amount: number, src: Tower | null, trueDmg: boolean): void {
    if (e.dead || e.phaseT > 0) return;
    const dealt = trueDmg ? amount : amount * (1 - Math.max(0, e.def.armor - (this.syn.armorShred ?? 0)));
    if (src) src.dmgDone += Math.min(dealt, Math.max(0, e.hp));
    if (dealt > this.bestHit) this.bestHit = dealt;
    e.hp -= dealt;
    if (e.hp <= 0) this.kill(e, src);
  }

  private kill(e: Enemy, src: Tower | null): void {
    e.dead = true;
    if (this.vfx) this.deathFx(e, src);
    const gold = Math.max(1, Math.round(e.def.gold * goldScale(this.map, this.wave) * (1 + (src?.stats.killGold ?? 0) + (this.syn.gold ?? 0))));
    store.data.gold += gold;
    store.data.kills++;
    store.data.bestiary[e.def.id] = (store.data.bestiary[e.def.id] ?? 0) + 1;
    if (e.def.shape === 'boss') this.epicKills++;
    this.runKills++;
    this.runGold += gold;
    if (e.def.boss || e.def.shape === 'boss') {
      this.fx.push({ kind: 'text', x: e.x, y: e.y - 24, t: 0, max: 1.2, color: '#f5c542', text: `+${fmtShort(gold)}` });
    }
    this.dropLoot(e);
    if (e.def.split && !this.over) {
      for (let i = 0; i < e.def.split.n; i++) this.spawn(e.def.split.id, { s: Math.max(0, e.s - i * 12), lane: e.lane });
    }
    if (!src) return;
    src.kills++;
    const ks = src.stats.killStack;
    if (ks) {
      if (ks.persistent) {
        store.data.stacks[src.def.id] = (store.data.stacks[src.def.id] ?? 0) + ks.amount;
        src.stats.dmg += ks.amount;
      } else {
        // Per-run stacks are a fraction of the champion's damage, so they keep their weight at high levels.
        src.runStacks += ks.amount * src.stats.dmg;
      }
    }
  }

  /** Loot roll for one kill: fixed chance per material rarity, straight into the inventory. */
  private dropLoot(e: Enemy): void {
    const loot = rollLoot(e.def, this.map.region ?? '');
    let row = 0;
    for (const [id, n] of Object.entries(loot)) {
      store.data.mats[id] = (store.data.mats[id] ?? 0) + n;
      this.runLoot[id] = (this.runLoot[id] ?? 0) + n;
      const m = MAT_BY_ID[id];
      if (!this.visual || m.rarity < 2) continue;
      this.fx.push({ kind: 'text', x: e.x, y: e.y - 30 - 16 * row++, t: 0, max: 1.4, color: LOOT_COLOR[m.rarity], text: `${m.icon} +${n}` });
      sfx('gold');
    }
  }

  private waveCleared(): void {
    this.waveActive = false;
    const d = store.data;
    const bonus = waveBonus(this.map, this.wave);
    d.gold += bonus;
    this.runGold += bonus;
    if (this.wave !== this.map.waves) this.showBanner(this.endless ? `Infini · vague ${this.endlessWave()} repoussée` : `Vague ${this.wave} repoussée`, `+${fmtShort(bonus)} or`, '#f5c542');
    d.best[this.map.id] = Math.max(d.best[this.map.id] ?? 0, Math.min(this.wave, this.map.waves));
    if (this.endless) d.endless[this.map.id] = Math.max(d.endless[this.map.id] ?? 0, this.endlessWave());
    const heal = this.towers.reduce((n, t) => n + (t.stats.livesPerWave ?? 0), 0) + (this.boons.ward ?? 0) * (BOON_BY_ID.ward.value ?? 0);
    this.lives = Math.min(MAX_LIVES, this.lives + heal);
    persist();
    // Endless mode only: after any wave, a blessing may appear; the run then waits for the player's choice
    if (this.endless && this.endlessWave() > 0 && Math.random() < BOON_CHANCE) {
      this.boonOffer = rollBoons();
      this.boonT = BOON_AUTO_DELAY;
      if (!this.visual) this.pickBoon();
    }
    if (this.boonOffer) {
      this.autoT = -1;
    } else if (this.endless) {
      // Endless: no victory, the next wave is always coming
      if (d.auto) this.autoT = 1;
    } else if (this.wave >= this.map.waves) {
      this.over = true;
      if (this.visual) sfx('victory');
      this.ev.onEnd(true, this.wave);
      if (d.auto) this.autoT = 3;
    } else if (d.auto) {
      this.autoT = 1;
    }
    this.ev.onChange();
  }

  private lose(): void {
    this.over = true;
    this.waveActive = false;
    this.queue = [];
    if (this.visual) sfx('defeat');
    persist();
    this.ev.onEnd(false, this.wave);
    if (store.data.auto) this.autoT = 2.5;
    this.ev.onChange();
  }

  /** Gold an enemy pays on a normal kill (the info panel shows it). */
  enemyReward(e: Enemy): number {
    return Math.max(1, Math.round(e.def.gold * goldScale(this.map, this.wave) * (1 + (this.syn.gold ?? 0))));
  }

  // ---------- Render (HD) ----------

  /** Attack beat a champion should be showing right now: 0 at rest, -1 wound back, +1 follow-through. */
  private swingOf(t: Tower): number {
    const per = t.period, strike = Math.min(0.09, per * 0.18), rec = Math.min(0.3, per * 0.36), wind = Math.min(0.26, per * 0.42);
    if (t.since < strike) { const k = t.since / strike; return -1 + 2 * (1 - (1 - k) * (1 - k)); }
    if (t.since < strike + rec) { const k = (t.since - strike) / rec; return 1 - k * k * (3 - 2 * k); }
    if (t.engaged && t.cd > 0 && t.cd < wind) { const k = 1 - t.cd / wind; return -(1 - (1 - k) * (1 - k)); }
    return 0;
  }

  /** Closest living enemy within `dist` pixels of a champion (visual use only). */
  private nearest(t: Tower, dist: number): Enemy | null {
    let best: Enemy | null = null, bd = dist;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /** How a projectile is drawn: lobbed shots rise above the straight line and tilt along their arc. */
  private shotPose(p: Proj, shot: Shot): { lift: number; ang: number } {
    const dx = p.target.x - p.x, dy = p.target.y - p.y;
    const ang = Math.atan2(dy, dx);
    const arc = SHOT_ARC[shot];
    if (!arc || p.d0 < 1) return { lift: 0, ang };
    const prog = Math.min(1, Math.max(0, 1 - Math.hypot(dx, dy) / p.d0));
    const tilt = Math.atan(Math.PI * arc * Math.cos(prog * Math.PI)) * (Math.cos(ang) >= 0 ? 1 : -1);
    return { lift: Math.sin(prog * Math.PI) * p.d0 * arc, ang: ang - tilt };
  }

  /** Advances visual-only state: real dt for ambience and poses, game dt for anything tied to the fight. */
  private animate(dt: number, gameDt: number): void {
    const v = this.vfx!;
    v.low = store.data.lowFx;
    this.clock += dt;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.dim = Math.max(0, this.dim - dt * 1.5);
    this.nexusHurt = Math.max(0, this.nexusHurt - dt);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 2) this.banner = null; }
    if (this.cutin) { this.cutin.t += dt; if (this.cutin.t > CUTIN) this.cutin = null; }

    // Champions: keep facing the current target, ease the attack pose, land with a puff of dust
    for (const t of this.towers) {
      t.since += gameDt;
      t.ultT += dt;
      const before = t.born;
      t.born += dt;
      if (before < LAND && t.born >= LAND) {
        v.smoke(t.x, t.y + 15, 5, 6, '#b9b2a3');
        this.fx.push({ kind: 'ring', x: t.x, y: t.y + 13, r: 26, t: 0, max: 0.3, color: '#f0e6d2' });
      }
      if (t.tgt?.dead) t.tgt = null;
      // Between targets the champion watches the nearest monster coming its way, so its first blow is already aimed
      const watch = t.tgt ?? this.nearest(t, t.stats.range * 1.7 * TILE);
      const want = watch ? Math.atan2(watch.y - (t.y - 10), watch.x - t.x) : t.angle;
      t.aim += angDiff(t.aim, want) * Math.min(1, dt * (t.since < 0.08 ? 40 : 14));
      const c = Math.cos(t.aim);
      if (Math.abs(c) > 0.18) t.face = c > 0 ? 1 : -1;
      t.sw += (this.swingOf(t) - t.sw) * Math.min(1, dt * 45);
    }
    // Monsters recover from the last shove
    const settle = Math.exp(-dt * 13), unsquash = Math.exp(-dt * 11);
    for (const e of this.enemies) {
      e.born += gameDt;
      e.healed = Math.max(0, e.healed - gameDt);
      e.kx *= settle;
      e.ky *= settle;
      e.sq *= unsquash;
    }
    // Projectiles leave a little of their element behind
    if (gameDt > 0) {
      for (const p of this.projs) {
        const look = heroLook(p.tower.def.id, p.tower.def.role);
        v.trail(look.element, look.shot, p.tower.def.color, p.x, p.y - this.shotPose(p, look.shot).lift);
      }
    }
    v.update(dt, gameDt);

    const style = this.map.theme.style;
    // Weather: heavy snow in the Freljord, petals in Ionia, embers in Noxus
    const amb = AMBIENT[style] ?? AMBIENT_DEFAULT;
    const cap = v.low ? 30 : amb.motes;
    for (let i = 0; i < 2; i++) if (this.motes.length < cap && Math.random() < amb.rate) this.motes.push(spawnMote(style));
    for (const m of this.motes) {
      m.life += dt;
      m.x += m.vx * dt + (style === 'rift' || style === 'tundra' ? Math.sin(m.life * 2) * 0.1 : 0);
      m.y += m.vy * dt;
    }
    this.motes = this.motes.filter((m) => m.life < m.max && m.x > -5 && m.x < LW + 5 && m.y > -5 && m.y < LH + 5);
  }

  private render(): void {
    const g = this.ctx, v = this.vfx!;
    g.save();
    if (this.shake > 0.05 && !this.calm) {
      // Smooth pseudo-noise rather than white noise: it reads as a jolt, not as flicker
      const c = this.clock, amp = this.shake * 1.5;
      g.translate(Math.sin(c * 71) * Math.cos(c * 37) * amp, Math.cos(c * 83) * Math.sin(c * 29) * amp);
    }
    g.clearRect(-20, -20, W + 40, H + 40);
    g.drawImage(this.bg, 0, 0, W, H);
    if (this.dim > 0.01) {
      // The ground darkens during an ultimate or a boss death; units stay bright on top of it
      g.fillStyle = '#01080f';
      g.globalAlpha = 0.45 * this.dim;
      g.fillRect(-20, -20, W + 40, H + 40);
      g.globalAlpha = 1;
    }
    // Water glints: little stars of light blinking on rivers and lakes
    const style = this.map.theme.style, amb = AMBIENT[style] ?? AMBIENT_DEFAULT;
    if (!v.low && this.waterTiles.length) {
      g.fillStyle = style === 'noxus' ? '#ffd27a' : '#ffffff';
      this.waterTiles.forEach((w, i) => {
        const a = Math.sin(this.clock * 1.7 + i * 2.4);
        if (a < 0.5) return;
        const k = (a - 0.5) / 0.5, x = w.x + Math.sin(i * 12.9) * 17, y = w.y + Math.cos(i * 7.3) * 15;
        g.globalAlpha = k * 0.85;
        g.fillRect(x - 6 * k, y - 0.7, 12 * k, 1.4);
        g.fillRect(x - 0.7, y - 3 * k, 1.4, 6 * k);
      });
      g.globalAlpha = 1;
    }
    v.drawDecals(g);

    const start = this.pts[0], end = this.pts[this.pts.length - 1];
    const px = Math.min(W - 20, Math.max(20, start.x)), py = Math.min(H - 20, Math.max(20, start.y));
    this.drawPortal(g, px, py);

    // Placement preview
    if (this.hover && (this.selectedRoster || this.dragging)) {
      const { c, r } = this.hover;
      const id = this.selectedRoster ?? this.dragging!.def.id;
      const onBoard = this.towers.some((t) => t.def.id === id);
      const ok = this.canPlace(c, r) && (onBoard || this.slotsLeft() > 0);
      g.fillStyle = ok ? 'rgba(10,200,185,0.22)' : 'rgba(255,60,60,0.28)';
      g.strokeStyle = ok ? 'rgba(10,200,185,0.8)' : 'rgba(255,80,80,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(c * TILE + 3, r * TILE + 3, TILE - 6, TILE - 6, 6);
      g.fill();
      g.stroke();
      if (ok) {
        this.rangeRing(g, (c + 0.5) * TILE, (r + 0.5) * TILE, this.statsAt(champ(id), c, r).range, 'rgba(10,200,185,0.7)');
        // Ghost of the champion under the cursor
        const img = squareImage(id);
        if (img) {
          g.save();
          g.globalAlpha = 0.75;
          g.beginPath();
          g.arc((c + 0.5) * TILE, (r + 0.5) * TILE - 4, 17, 0, Math.PI * 2);
          g.clip();
          g.drawImage(img, (c + 0.5) * TILE - 19, (r + 0.5) * TILE - 23, 38, 38);
          g.restore();
        }
      }
    }
    if (this.aiming && this.mouse) {
      // Aiming an ultimate: its area follows the pointer
      const t = this.aiming, r = this.aimRadius(t), m = this.mouse, pulse = 1 + Math.sin(this.clock * 6) * 0.03;
      g.globalCompositeOperation = 'lighter';
      drawGlow(g, m.x, m.y, r * 1.15, t.def.color, 0.3);
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = t.def.color;
      g.lineWidth = 2.5;
      g.setLineDash([10, 7]);
      g.lineDashOffset = -this.clock * 26;
      g.beginPath(); g.arc(m.x, m.y, r * pulse, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(m.x - 9, m.y); g.lineTo(m.x + 9, m.y); g.moveTo(m.x, m.y - 9); g.lineTo(m.x, m.y + 9);
      g.stroke();
      g.globalAlpha = 0.35;
      g.setLineDash([4, 6]);
      g.beginPath(); g.moveTo(t.x, t.y - 14); g.lineTo(m.x, m.y); g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
    }
    if (this.selectedTower && !this.dragging) this.rangeRing(g, this.selectedTower.x, this.selectedTower.y, this.selectedTower.stats.range, 'rgba(240,230,210,0.85)');

    // Everything standing on the board, back to front
    const units: { y: number; draw: () => void }[] = [
      ...this.enemies.map((e) => ({ y: e.y, draw: () => this.drawEnemy(g, e) })),
      ...v.corpses.map((c) => ({ y: c.y - 15, draw: () => v.drawCorpse(g, c, this.clock) })),
      ...this.towers.map((t) => ({ y: t.y, draw: () => { if (t === this.dragging) g.globalAlpha = 0.35; this.drawTower(g, t); g.globalAlpha = 1; } })),
      { y: end.y, draw: () => this.drawNexus(g, end.x, end.y) },
    ];
    units.sort((a, b) => a.y - b.y).forEach((u) => u.draw());

    // Projectiles: one shape per champion (arrow, bullet, orb, rocket...), soft trail for the glowing ones
    g.lineCap = 'round';
    for (const p of this.projs) {
      const col = p.tower.def.color, look = heroLook(p.tower.def.id, p.tower.def.role);
      if (p.trail.length && hasTrail(look.shot)) {
        g.strokeStyle = impactColors(look.element, col)[0];
        g.globalAlpha = 0.45;
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(p.trail[0].x, p.trail[0].y);
        for (const q of p.trail) g.lineTo(q.x, q.y);
        g.lineTo(p.x, p.y);
        g.stroke();
        g.globalAlpha = 1;
      }
      if (p.ox !== undefined) bolt(g, p.ox, p.oy! - 8, p.x, p.y - 8, lightColor(look.element, col), 1);
      const pose = this.shotPose(p, look.shot);
      drawShot(g, look, col, p.x, p.y, pose.ang, this.clock, pose.lift);
    }

    // Beams, shockwaves and blasts
    for (const f of this.fx) {
      if (f.t < 0 || f.kind === 'text') continue;
      const k = Math.max(0, 1 - f.t / f.max);
      if (f.kind === 'beam') {
        // Wide soft halo, coloured body, white-hot core
        g.strokeStyle = f.color;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = k * 0.3;
        g.lineWidth = 26 * k + 8;
        seg(g, f.x, f.y, f.x2!, f.y2!);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = k * 0.95;
        g.lineWidth = 9 * k + 3;
        seg(g, f.x, f.y, f.x2!, f.y2!);
        g.strokeStyle = '#ffffff';
        g.globalAlpha = k;
        g.lineWidth = 3.5 * k + 1;
        seg(g, f.x, f.y, f.x2!, f.y2!);
      } else if (f.kind === 'ring') {
        const rr = f.r! * (0.55 + 0.45 * (1 - k * k));
        g.strokeStyle = f.color;
        g.globalAlpha = k * 0.3;
        g.lineWidth = 10 * k + 2;
        g.beginPath();
        g.arc(f.x, f.y, rr, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = k;
        g.lineWidth = 2.6 * k + 0.8;
        g.stroke();
      } else if (f.kind === 'strike') {
        // A shot falling from the sky onto its landing point
        const u = 1 - k, hx = f.x + 70 * (1 - u), hy = f.y - 300 * (1 - u);
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = f.color;
        g.globalAlpha = 0.5;
        g.lineWidth = 7;
        seg(g, hx + 16, hy - 68, hx, hy);
        g.strokeStyle = '#ffffff';
        g.globalAlpha = 0.95;
        g.lineWidth = 2.4;
        seg(g, hx + 9, hy - 38, hx, hy);
        drawGlow(g, hx, hy, 13, f.color, 1);
        g.globalCompositeOperation = 'source-over';
      } else if (f.kind === 'pillar') {
        // Column of light rising from the ground
        const u = 1 - k, a = Math.sin(Math.PI * Math.min(1, u * 1.05)), hgt = 70 + 60 * Math.min(1, u * 3);
        g.globalCompositeOperation = 'lighter';
        drawGlow(g, f.x, f.y - hgt * 0.8, 30, f.color, a * 0.9, hgt);
        drawGlow(g, f.x, f.y - hgt * 0.8, 9, '#ffffff', a * 0.9, hgt);
        drawGlow(g, f.x, f.y, 34, '#ffffff', a * 0.7, 10);
        g.globalAlpha = k;
        g.strokeStyle = f.color;
        g.lineWidth = 2.5;
        g.beginPath();
        g.ellipse(f.x, f.y, 14 + u * 36, (14 + u * 36) * 0.36, 0, 0, Math.PI * 2);
        g.stroke();
        g.globalCompositeOperation = 'source-over';
      } else if (f.kind === 'zap') {
        bolt(g, f.x, f.y, f.x2!, f.y2!, f.color, k);
      } else if (f.kind === 'laser') {
        // Flares up in a few frames, then thins out
        const u = 1 - k, wdt = u < 0.18 ? 0.35 + (u / 0.18) * 0.65 : k / 0.82;
        const dx = f.x2! - f.x, dy = f.y2! - f.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = f.color;
        g.globalAlpha = 0.22 * wdt;
        g.lineWidth = 26 * wdt;
        seg(g, f.x, f.y, f.x2!, f.y2!);
        g.globalAlpha = 0.5 * wdt;
        g.lineWidth = 11 * wdt;
        seg(g, f.x, f.y, f.x2!, f.y2!);
        // Two strands of light twisting around the ray
        g.lineWidth = 1.6;
        g.globalAlpha = 0.8 * wdt;
        for (const sgn of [1, -1]) {
          g.beginPath();
          for (let i = 0; i <= 48; i++) {
            const q = i / 48, o = Math.sin(q * 20 - this.clock * 34) * sgn * (3 + 5 * wdt) * Math.sin(q * Math.PI);
            g.lineTo(f.x + dx * q + nx * o, f.y + dy * q + ny * o);
          }
          g.stroke();
        }
        g.globalCompositeOperation = 'source-over';
        g.strokeStyle = '#ffffff';
        g.globalAlpha = Math.min(1, wdt * 1.3);
        g.lineWidth = 4 * wdt + 0.8;
        seg(g, f.x, f.y, f.x2!, f.y2!);
        g.globalCompositeOperation = 'lighter';
        drawGlow(g, f.x, f.y, 8 + 9 * wdt, '#ffffff', wdt);
        drawGlow(g, f.x, f.y, 18 + 12 * wdt, f.color, wdt * 0.7);
        drawGlow(g, f.x2!, f.y2!, 20 + 16 * wdt, f.color, wdt * 0.8);
        g.globalCompositeOperation = 'source-over';
      } else if (f.kind === 'whirl') {
        // Blades sweeping a full turn: bright leading edge, fading wake
        const u = 1 - k, spin = u * 7.2 + f.x * 0.01, R = f.r!;
        g.globalCompositeOperation = 'lighter';
        drawGlow(g, f.x, f.y, R * 1.05, f.color, 0.16 * k);
        g.lineCap = 'round';
        for (let b = 0; b < 2; b++) {
          const lead = spin + b * Math.PI;
          // Wake: slices that thin out and fade behind the blade
          g.globalCompositeOperation = 'source-over';
          g.lineCap = 'butt';
          g.strokeStyle = f.color;
          for (let j = 0; j < 14; j++) {
            const q = 1 - j / 14;
            g.globalAlpha = k * q * q * 0.8;
            g.lineWidth = 3 + 10 * q;
            g.beginPath();
            g.arc(f.x, f.y, R * 0.88, lead - (j + 1) * 0.13 - 0.01, lead - j * 0.13);
            g.stroke();
          }
          g.globalCompositeOperation = 'lighter';
          g.lineCap = 'round';
          g.strokeStyle = '#ffffff';
          g.globalAlpha = k;
          g.lineWidth = 3.5;
          g.beginPath();
          g.arc(f.x, f.y, R * 0.93, lead - 0.5, lead);
          g.stroke();
          g.globalAlpha = k * 0.55;
          g.lineWidth = 1.8;
          g.beginPath();
          g.arc(f.x, f.y, R * 0.55, lead + 0.4, lead + 1.6);
          g.stroke();
          drawGlow(g, f.x + Math.cos(lead) * R * 0.93, f.y + Math.sin(lead) * R * 0.93, 12, '#ffffff', k);
        }
        g.globalCompositeOperation = 'source-over';
      } else if (f.kind === 'storm') {
        // Blizzard: frost haze with streaks of wind circling at different speeds
        const u = 1 - k, R = f.r!, a = Math.sin(Math.PI * Math.min(1, u * 1.15)) ;
        drawGlow(g, f.x, f.y, R * 1.1, '#d8f1ff', 0.3 * a);
        g.globalCompositeOperation = 'lighter';
        g.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const rr = R * (0.28 + i * 0.115), sp = (i % 2 ? 1 : -0.7) * (3.2 + i * 0.5), a0 = i * 2.4 + this.clock * sp;
          g.strokeStyle = i % 3 ? '#e8f7ff' : '#8fd3ff';
          g.globalAlpha = a * (0.55 - i * 0.04);
          g.lineWidth = 2.6 - i * 0.2;
          g.beginPath();
          g.arc(f.x, f.y, rr, a0, a0 + 1.5);
          g.stroke();
          g.beginPath();
          g.arc(f.x, f.y, rr, a0 + Math.PI, a0 + Math.PI + 1.1);
          g.stroke();
        }
        g.globalAlpha = a * 0.7;
        g.strokeStyle = '#ffffff';
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(f.x, f.y, R * (0.6 + 0.4 * u), 0, Math.PI * 2);
        g.stroke();
        g.globalCompositeOperation = 'source-over';
      } else {
        // Blast: fireball that swells fast then fades, with a shockwave racing ahead of it
        const u = 1 - k, rr = f.r! * (0.35 + 0.65 * (1 - (1 - u) ** 3));
        g.globalCompositeOperation = 'lighter';
        drawGlow(g, f.x, f.y, rr * 1.3, f.color, k * 0.95);
        drawGlow(g, f.x, f.y, rr * 0.75 * (1 - u * 0.5), '#ffffff', k * k);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = k * 0.85;
        g.strokeStyle = '#ffffff';
        g.lineWidth = 3 * k + 0.6;
        g.beginPath();
        g.arc(f.x, f.y, rr * 1.08, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    v.drawParticles(g);

    // Drifting cloud shadows, smoke or snow squalls pass over the whole scene
    if (!v.low && amb.cloud) {
      for (let i = 0; i < 3; i++) {
        const x = ((this.clock * amb.wind + i * 470) % (W + 640)) - 320;
        drawGlow(g, x, H * (0.18 + 0.32 * i) + Math.sin(this.clock * 0.2 + i) * 30, 270, amb.cloud, amb.cloudA, 140);
      }
    }

    // Light pass: everything that glows brightens the ground and whoever stands next to it
    if (!v.low) {
      g.globalCompositeOperation = 'screen';
      const c = this.clock;
      this.mapLights.forEach((l, i) => {
        const fl = 1 + Math.sin(c * 11 + i * 7) * Math.sin(c * 5.3 + i) * 0.22 * l.flicker;
        drawGlow(g, l.x, l.y, l.r * fl, l.color, 0.5 * fl);
      });
      if (style === 'demacia' || style === 'rift' || style === 'jungle') {
        // Shafts of sunlight slanting across the field
        for (let i = 0; i < 3; i++) {
          g.save();
          g.translate(W * (0.16 + 0.3 * i) + Math.sin(c * 0.25 + i) * 30, -60);
          g.rotate(0.45);
          drawGlow(g, 0, 340, 62, '#fff1c0', (style === 'demacia' ? 0.13 : 0.07) + 0.04 * Math.sin(c * 0.6 + i * 2), 470);
          g.restore();
        }
      } else if (style === 'tundra' || style === 'bridge') {
        // Aurora rippling along the top of the map
        for (let i = 0; i < 4; i++) {
          drawGlow(g, W * (0.1 + 0.27 * i) + Math.sin(c * 0.3 + i) * 60, 12, 200, i % 2 ? '#7fffd4' : '#8fb8ff', 0.2 + 0.08 * Math.sin(c * 0.8 + i * 1.7), 50);
        }
      } else if (style === 'noxus') {
        // The forges breathe: a red glow pulsing from below
        drawGlow(g, W / 2, H + 30, W * 0.62, '#ff4a1a', 0.16 + 0.05 * Math.sin(c * 1.3), 160);
      } else if (style === 'ionia') {
        // Spirit lights wandering over the land
        for (let i = 0; i < 6; i++) {
          const x = W * (0.5 + 0.44 * Math.sin(c * 0.11 * (1 + i * 0.13) + i * 2.1)), y = H * (0.5 + 0.42 * Math.sin(c * 0.09 * (1 + i * 0.17) + i * 1.3));
          drawGlow(g, x, y, 24 + Math.sin(c * 2 + i) * 4, i % 2 ? '#7ff0e0' : '#ffb8e0', 0.55);
          drawGlow(g, x, y, 6, '#ffffff', 0.9);
        }
      }
      for (const p of this.projs) {
        const look = heroLook(p.tower.def.id, p.tower.def.role);
        if (look.shot === 'slash') continue;
        drawGlow(g, p.x, p.y, look.shot === 'bullet' ? 16 : 26, lightColor(look.element, p.tower.def.color), 0.5);
      }
      for (const e of this.enemies) {
        if (e.burns.length) drawGlow(g, e.x, e.y - 6, 24 + Math.sin(this.clock * 23 + e.uid) * 4, '#ff8a3d', 0.32);
      }
      for (const t of this.towers) {
        if (t.ultCd <= 0) drawGlow(g, t.x, t.y + 10, 32, '#ffd84a', 0.24 + Math.sin(this.clock * 6) * 0.08);
      }
      drawGlow(g, end.x, end.y - 12, 62 + Math.sin(this.clock * 2) * 6, this.nexusHurt > 0 ? '#ff5a5a' : this.map.theme.accent, 0.4);
      drawGlow(g, px, py, 48 + Math.sin(this.clock * 3) * 4, '#ff5a5a', 0.32);
      v.drawLights(g);
      g.globalCompositeOperation = 'source-over';
    }

    // Ambient motes (spawned in low-res space, drawn x3)
    for (const m of this.motes) {
      if (m.blink && Math.sin(m.life * 6) < -0.2) continue;
      const a = Math.min(1, m.life, m.max - m.life) * 0.8;
      if (m.blink && !v.low) {
        g.globalCompositeOperation = 'lighter';
        drawGlow(g, m.x * 3, m.y * 3, 8, m.color, a);
        g.globalCompositeOperation = 'source-over';
      }
      g.globalAlpha = a;
      g.fillStyle = m.color;
      g.beginPath();
      // Petals tumble, snowflakes come in several sizes
      if (style === 'ionia') g.ellipse(m.x * 3, m.y * 3, 3.4, 1.6, m.life * 2.2 + m.max, 0, Math.PI * 2);
      else g.arc(m.x * 3, m.y * 3, m.blink ? 2.2 : 1.2 + (m.max % 3) * 0.5, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // Damage numbers and labels: they pop in, then drift up and fade
    g.textAlign = 'center';
    g.lineJoin = 'round';
    for (const f of this.fx) {
      if (f.kind !== 'text' || f.t < 0) continue;
      const k = 1 - f.t / f.max;
      const pop = f.t < 0.12 ? 1.5 - (f.t / 0.12) * 0.5 : 1;
      g.globalAlpha = Math.max(0, Math.min(1, k * 1.6));
      g.font = `800 ${Math.round((f.size ?? 15) * pop)}px "Source Sans 3", system-ui, sans-serif`;
      const y = f.y - (1 - k) * 24;
      g.lineWidth = 3.5;
      g.strokeStyle = 'rgba(1,10,19,0.85)';
      g.strokeText(f.text!, f.x, y);
      g.fillStyle = f.color;
      g.fillText(f.text!, f.x, y);
      g.globalAlpha = 1;
    }
    g.restore();
    if (this.cutin) this.drawCutin(g, this.cutin);
    if (this.banner) this.drawBanner(g, this.banner);
    if (this.hover) {
      const f = this.featureAt(this.hover.c, this.hover.r);
      if (f) this.drawTileTip(g, this.hover.c, this.hover.r, f);
    }
  }

  private drawTileTip(g: CanvasRenderingContext2D, c: number, r: number, f: FeatureKind): void {
    const info = FEATURE_INFO[f];
    g.font = '700 13px Cinzel, serif';
    const tw = Math.max(g.measureText(info.name).width, (g.font = '500 12px "Source Sans 3", system-ui, sans-serif', g.measureText(info.desc).width)) + 20;
    const x = Math.min(W - tw - 6, Math.max(6, (c + 0.5) * TILE - tw / 2)), y = r * TILE > 70 ? r * TILE - 52 : (r + 1) * TILE + 6;
    g.fillStyle = 'rgba(15,36,64,0.95)';
    g.fillRect(x, y, tw, 44);
    g.strokeStyle = info.color;
    g.lineWidth = 2;
    g.strokeRect(x, y, tw, 44);
    g.textAlign = 'left';
    g.fillStyle = info.color;
    g.font = '700 13px Cinzel, serif';
    g.fillText(info.name, x + 10, y + 18);
    g.fillStyle = '#e6edf6';
    g.font = '500 12px "Source Sans 3", system-ui, sans-serif';
    g.fillText(info.desc, x + 10, y + 35);
  }

  private rangeRing(g: CanvasRenderingContext2D, x: number, y: number, range: number, color: string): void {
    g.strokeStyle = color;
    g.fillStyle = 'rgba(10,200,185,0.06)';
    g.lineWidth = 2;
    g.setLineDash([8, 6]);
    g.lineDashOffset = -this.clock * 14;
    g.beginPath();
    g.arc(x, y, range * TILE, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.setLineDash([]);
  }

  private drawPortal(g: CanvasRenderingContext2D, x: number, y: number): void {
    g.save();
    g.translate(x, y);
    const pulse = 1 + Math.sin(this.clock * 3) * 0.08;
    const grad = g.createRadialGradient(0, 0, 2, 0, 0, 26 * pulse);
    grad.addColorStop(0, 'rgba(255,90,90,0.9)');
    grad.addColorStop(0.5, 'rgba(160,20,40,0.5)');
    grad.addColorStop(1, 'rgba(80,0,20,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ff8a8a';
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      g.rotate(this.clock * 1.5 + i * 2.1);
      g.beginPath();
      g.arc(0, 0, 13 + i * 4, 0, Math.PI * 0.8);
      g.stroke();
    }
    g.restore();
  }

  private drawNexus(g: CanvasRenderingContext2D, x: number, y: number): void {
    const color = this.nexusHurt > 0 ? '#ff5a5a' : this.map.theme.accent;
    g.save();
    g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath();
    g.ellipse(0, 18, 28, 9, 0, 0, Math.PI * 2);
    g.fill();
    // Stone platform with gold trim
    const plat = g.createLinearGradient(0, 6, 0, 20);
    plat.addColorStop(0, '#5b6474');
    plat.addColorStop(1, '#2a303b');
    g.fillStyle = plat;
    g.beginPath();
    g.ellipse(0, 13, 24, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#c8aa6e';
    g.lineWidth = 2;
    g.stroke();
    // Rotating rune ring
    g.strokeStyle = color;
    g.globalAlpha = 0.7;
    g.beginPath();
    g.ellipse(0, 6, 26, 8, 0, this.clock * 2, this.clock * 2 + Math.PI * 1.3);
    g.stroke();
    g.globalAlpha = 1;
    // Floating hextech crystal
    const fy = Math.sin(this.clock * 2) * 3 - 12;
    g.shadowColor = color;
    g.shadowBlur = 26 + Math.sin(this.clock * 4) * 6;
    const cg = g.createLinearGradient(-12, fy - 24, 12, fy + 18);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.35, color);
    cg.addColorStop(1, shade(color, -0.45));
    g.fillStyle = cg;
    g.beginPath();
    g.moveTo(0, fy - 26);
    g.lineTo(13, fy - 2);
    g.lineTo(0, fy + 18);
    g.lineTo(-13, fy - 2);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, fy - 26);
    g.lineTo(0, fy + 18);
    g.moveTo(-13, fy - 2);
    g.lineTo(13, fy - 2);
    g.stroke();
    g.restore();
  }

  /** Ultimate cut-in: slanted band with the champion's splash art, the ultimate's name and a streak of light. */
  private drawCutin(g: CanvasRenderingContext2D, c: { id: string; name: string; champ: string; color: string; t: number }): void {
    const inK = Math.min(1, c.t / 0.16), outK = Math.min(1, Math.max(0, (CUTIN - c.t) / 0.22));
    const ease = 1 - (1 - inK) ** 3;
    const bw = W * 0.56, bh = 66, y0 = 6, skew = 24;
    const x0 = -bw * (1 - ease) - (1 - outK) * 40;
    g.save();
    g.globalAlpha = Math.min(1, inK * 1.5) * outK;
    const shape = (pad: number) => {
      g.beginPath();
      g.moveTo(x0 - 20, y0 - pad); g.lineTo(x0 + bw + pad, y0 - pad); g.lineTo(x0 + bw - skew + pad, y0 + bh + pad); g.lineTo(x0 - 20, y0 + bh + pad);
      g.closePath();
    };
    // Coloured edge, then the art clipped to the band
    shape(3);
    g.fillStyle = c.color;
    g.fill();
    shape(0);
    g.fillStyle = '#010a13';
    g.fill();
    g.save();
    g.clip();
    const img = splashImage(c.id);
    if (img) {
      const iw = bw * 1.08, ih = (img.naturalHeight / img.naturalWidth) * iw;
      // Slow push across the art while the band is up
      g.drawImage(img, x0 + bw - iw + c.t * 14, y0 - ih * 0.2, iw, ih);
    }
    const shadeL = g.createLinearGradient(x0, 0, x0 + bw, 0);
    shadeL.addColorStop(0, 'rgba(1,10,19,0.95)');
    shadeL.addColorStop(0.45, 'rgba(1,10,19,0.55)');
    shadeL.addColorStop(1, 'rgba(1,10,19,0)');
    g.fillStyle = shadeL;
    g.fillRect(x0 - 20, y0, bw + 40, bh);
    // Streak of light sweeping across as it arrives
    const sweep = x0 + (c.t / 0.5) * (bw + 200) - 100;
    if (c.t < 0.5) {
      g.globalCompositeOperation = 'lighter';
      drawGlow(g, sweep, y0 + bh / 2, 90, '#ffffff', 0.5, bh);
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
    g.textAlign = 'left';
    g.lineJoin = 'round';
    g.font = '700 22px Cinzel, serif';
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(1,10,19,0.9)';
    const tx = Math.max(22, x0 + 26);
    g.strokeText(c.name, tx, y0 + 34);
    g.fillStyle = '#f0e6d2';
    g.fillText(c.name, tx, y0 + 34);
    g.font = '700 12px "Source Sans 3", system-ui, sans-serif';
    g.fillStyle = c.color;
    g.fillText(c.champ.toUpperCase().split('').join(' '), tx + 2, y0 + 54);
    g.fillStyle = '#c8aa6e';
    g.fillRect(tx, y0 + 40, 150, 1.5);
    g.restore();
  }

  /** Wave notification docked at the bottom of the board. */
  private drawBanner(g: CanvasRenderingContext2D, b: { text: string; sub: string; t: number; color: string }): void {
    const inT = Math.min(1, b.t / 0.2), outT = Math.min(1, Math.max(0, (2 - b.t) / 0.4));
    const a = Math.min(inT, outT);
    g.font = '700 16px Cinzel, serif';
    const text = b.sub ? `${b.text} · ${b.sub}` : b.text;
    const bw = Math.round(g.measureText(text).width + 44), bh = 34;
    const x = Math.round((W - bw) / 2), y = Math.round(H - bh - 12 + (1 - inT) * 16);
    g.globalAlpha = a;
    const bgGrad = g.createLinearGradient(0, y, 0, y + bh);
    bgGrad.addColorStop(0, 'rgba(10,20,40,0.95)');
    bgGrad.addColorStop(1, 'rgba(1,10,19,0.95)');
    g.fillStyle = bgGrad;
    g.beginPath();
    g.moveTo(x + 10, y); g.lineTo(x + bw - 10, y); g.lineTo(x + bw, y + bh / 2); g.lineTo(x + bw - 10, y + bh); g.lineTo(x + 10, y + bh); g.lineTo(x, y + bh / 2);
    g.closePath();
    g.fill();
    g.strokeStyle = '#c8aa6e';
    g.lineWidth = 1.5;
    g.stroke();
    g.textAlign = 'center';
    g.fillStyle = b.color === '#f0e6d2' ? '#f0e6d2' : b.color;
    g.fillText(text, W / 2, y + 22);
    g.globalAlpha = 1;
  }

  private drawEnemy(g: CanvasRenderingContext2D, e: Enemy): void {
    const d = e.def;
    const fly = !!d.fly || d.id.startsWith('drake') || d.id === 'fallenking' || d.id === 'spiritguard';
    const epic = d.shape === 'boss';
    const h = (CREATURE_HEIGHT[d.id] ?? 16) * 3, w = h * 0.9;
    // Drawn where the last blow shoved it; the simulation keeps the true position
    const x = e.x + e.kx, gy = e.y + 15 + e.ky;
    // Flyers hover above the lane; their shadow stays on the ground
    const lift = d.fly ? 14 + Math.sin(this.clock * 4 + e.uid) * 3 : 0;
    const y = gy - lift;
    const moving = e.stunT <= 0;
    const ph = moving ? e.phase : 0;
    // Steps out of the portal: grows and fades in over the first moments
    const born = Math.min(1, e.born / 0.3), grow = 0.55 + 0.45 * (1 - (1 - born) * (1 - born));
    if (epic) {
      // Epic monsters and bosses carry an aura of their own colour
      g.globalCompositeOperation = 'screen';
      drawGlow(g, x, y - h / 2, w * (d.boss ? 0.85 : 0.7), d.color, (d.boss ? 0.45 : 0.3) + Math.sin(this.clock * 3) * 0.08);
      g.globalCompositeOperation = 'source-over';
    }
    if (d.heal) {
      // Healing field: a soft green circle that pulses outward
      const hr = d.heal.radius * TILE, pulse = (this.clock * 0.7 + e.uid * 0.37) % 1;
      g.strokeStyle = '#6be08a';
      g.lineWidth = 1.5;
      g.globalAlpha = 0.22;
      g.beginPath(); g.ellipse(x, gy - 8, hr, hr * 0.8, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 0.4 * (1 - pulse);
      g.beginPath(); g.ellipse(x, gy - 8, hr * pulse, hr * 0.8 * pulse, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
    }
    // Soft shadow, lighter and smaller under flyers
    drawGlow(g, x + 2, gy + 1, w * (fly ? 0.34 : 0.46) * grow, '#000000', (fly ? 0.3 : 0.55) * born, Math.max(4, w * 0.13) * grow);
    if (e === this.selectedEnemy) {
      const pulse = 1 + Math.sin(this.clock * 5) * 0.06;
      g.strokeStyle = '#ffd84a';
      g.lineWidth = 2.5;
      g.beginPath();
      g.ellipse(x, gy, w * 0.5 * pulse, Math.max(6, w * 0.15) * pulse, 0, 0, Math.PI * 2);
      g.stroke();
      g.globalCompositeOperation = 'lighter';
      drawGlow(g, x, gy, w * 0.6, '#ffd84a', 0.35, Math.max(8, w * 0.2));
      g.globalCompositeOperation = 'source-over';
    }
    if (e.slowPct > 0) {
      // Frost on the ground with a few ice crystals
      g.fillStyle = 'rgba(143,211,255,0.22)';
      g.strokeStyle = 'rgba(200,236,255,0.9)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.ellipse(x, gy, w * 0.46, Math.max(5, w * 0.13), 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#e8f7ff';
      for (let i = 0; i < 3; i++) {
        const cx = x + (i - 1) * w * 0.3, cy = gy + (i === 1 ? 3 : 0), ch = 5 + e.slowPct * 6;
        g.beginPath();
        g.moveTo(cx, cy - ch); g.lineTo(cx + 2.2, cy); g.lineTo(cx - 2.2, cy);
        g.closePath();
        g.fill();
      }
    }
    // The body: sways as it walks, leans into its stride, squashes when hit and springs back
    const custom = mobImage(d.id);
    const stride = moving ? Math.sin(ph * Math.PI) : 0;
    g.save();
    g.translate(x, y);
    if (!fly && !epic) g.rotate(stride * 0.045 + e.face * 0.03 * (moving ? 1 : 0));
    const breathe = 1 + Math.sin(this.clock * 2.6 + e.uid) * 0.012;
    g.scale((1 + e.sq * 0.14) * grow * (fly ? 1 + Math.sin(this.clock * 13 + e.uid) * 0.03 : 1), (1 - e.sq * 0.16) * grow * breathe);
    if (born < 1) g.globalAlpha *= born;
    if (e.phaseT > 0) g.globalAlpha *= 0.35 + Math.sin(this.clock * 18) * 0.1;
    if (custom) {
      const ih = h, iw = (custom.naturalWidth / custom.naturalHeight) * ih;
      if (e.hitFlash > 0) g.filter = 'brightness(2.2)';
      if (e.face < 0) g.scale(-1, 1);
      g.drawImage(custom, -iw / 2, -ih, iw, ih);
    } else {
      drawCreature(g, d.id, 0, 0, e.face, ph, this.clock, d.color, e.hitFlash > 0, 3);
    }
    g.restore();
    if (e.chargeT > 0 || e.hasteT > 0) {
      // Rushing: streaks of wind trail behind
      g.strokeStyle = e.chargeT > 0 ? '#ffffff' : '#bfe9ff';
      g.lineWidth = 2;
      g.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const ly = y - h * (0.15 + i * 0.2), off = ((this.clock * 9 + i * 0.37) % 1) * 22;
        g.globalAlpha = 0.55 * (1 - off / 22);
        g.beginPath(); g.moveTo(x - e.face * (w * 0.45 + off), ly); g.lineTo(x - e.face * (w * 0.45 + off + 16), ly); g.stroke();
      }
      g.globalAlpha = 1;
    }
    if (e.healed > 0) {
      // Being healed: a green shimmer over the body
      g.globalCompositeOperation = 'lighter';
      drawGlow(g, x, y - h * 0.45, w * 0.5, '#6be08a', 0.5 * Math.min(1, e.healed / 0.3));
      g.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.12) this.vfx?.embers(x, y - h * 0.4, 1, '#6be08a', '#d8ffe0', w * 0.3);
    }
    if (e.shield > 0) {
      // Shield: a bubble of light around the monster
      const pulse = 1 + Math.sin(this.clock * 4 + e.uid) * 0.04;
      g.globalCompositeOperation = 'lighter';
      drawGlow(g, x, y - h * 0.45, w * 0.62 * pulse, '#8fd8ff', 0.22, h * 0.62 * pulse);
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = 'rgba(191,233,255,0.85)';
      g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(x, y - h * 0.45, w * 0.5 * pulse, h * 0.56 * pulse, 0, 0, Math.PI * 2); g.stroke();
    }
    if (e.stunT > 0) {
      g.fillStyle = '#ffd84a';
      for (let i = 0; i < 3; i++) {
        const a = this.clock * 5 + (i * Math.PI * 2) / 3;
        g.beginPath();
        g.arc(x + Math.cos(a) * 12, y - h - 8 + Math.sin(a) * 3, 2.5, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (e.burns.length && Math.random() < 0.35) this.burst(x + (Math.random() - 0.5) * w * 0.6, y - h * 0.5, Math.random() < 0.5 ? '#ffb347' : '#ff5a2a', 1, 34, 2);
    // Health bar: dark frame coloured by tier, gradient fill, segments
    const bw = Math.max(30, Math.min(110, w * 0.95)), pct = Math.max(0, Math.min(1, e.hp / e.maxHp)), by = y - h - 11;
    g.fillStyle = d.boss ? '#c084fc' : epic ? '#c8aa6e' : '#010a13';
    g.beginPath(); g.roundRect(x - bw / 2 - 2.5, by - 2.5, bw + 5, 9, 3); g.fill();
    g.fillStyle = '#010a13';
    g.beginPath(); g.roundRect(x - bw / 2 - 1.5, by - 1.5, bw + 3, 7, 2.5); g.fill();
    if (pct > 0) {
      const fill = g.createLinearGradient(0, by, 0, by + 4);
      const [c0, c1] = d.boss ? ['#d9a8ff', '#8a3fd6'] : pct < 0.3 ? ['#ffb347', '#d1622a'] : ['#ff7a7a', '#c22e2e'];
      fill.addColorStop(0, c0);
      fill.addColorStop(1, c1);
      g.fillStyle = fill;
      g.beginPath(); g.roundRect(x - bw / 2, by, bw * pct, 4, 1.5); g.fill();
    }
    g.fillStyle = 'rgba(1,10,19,0.55)';
    for (let i = 1; i < 4; i++) g.fillRect(x - bw / 2 + (bw * i) / 4, by, 1, 4);
    // Pips above the bar: shield charges (pale blue squares), then slow, burn, stun
    const pips: [string, boolean][] = [];
    for (let i = 0; i < e.shield; i++) pips.push(['#bfe9ff', true]);
    if (e.slowPct > 0) pips.push(['#8fd3ff', false]);
    if (e.burns.length) pips.push(['#ff8a3d', false]);
    if (e.stunT > 0) pips.push(['#ffd84a', false]);
    pips.forEach(([col, square], i) => {
      const px = x - (pips.length - 1) * 4 + i * 8, py = by - 7;
      g.fillStyle = '#010a13';
      if (square) { g.fillRect(px - 3.6, py - 3.6, 7.2, 7.2); g.fillStyle = col; g.fillRect(px - 2.4, py - 2.4, 4.8, 4.8); return; }
      g.beginPath(); g.moveTo(px, py - 4); g.lineTo(px + 4, py); g.lineTo(px, py + 4); g.lineTo(px - 4, py); g.closePath(); g.fill();
      g.fillStyle = col;
      g.beginPath(); g.moveTo(px, py - 2.6); g.lineTo(px + 2.6, py); g.lineTo(px, py + 2.6); g.lineTo(px - 2.6, py); g.closePath(); g.fill();
    });
  }

  private drawTower(g: CanvasRenderingContext2D, t: Tower): void {
    const lvl = level(t.def.id), rank = ultRank(lvl);
    const sel = t === this.selectedTower;
    const fx = t.x, fy = t.y + 13; // feet, on the base plate
    const headY = fy - HERO_HEAD;
    // Hextech base plate on a soft shadow
    drawGlow(g, fx + 2, fy + 3, 27, '#000000', 0.6, 9.5);
    const plate = g.createLinearGradient(0, fy - 5, 0, fy + 6);
    plate.addColorStop(0, '#1e2a3a');
    plate.addColorStop(1, '#0a1428');
    g.fillStyle = plate;
    g.beginPath();
    g.ellipse(fx, fy, 18, 6, 0, 0, Math.PI * 2);
    g.fill();
    if (sel || rank > 0) { g.shadowColor = sel ? '#0ac8b9' : rank >= 3 ? '#ffd84a' : '#c8aa6e'; g.shadowBlur = sel ? 12 : 4 + rank * 3; }
    g.strokeStyle = sel ? '#0ac8b9' : '#c8aa6e';
    g.lineWidth = sel ? 2 : 1.5;
    g.stroke();
    g.shadowBlur = 0;
    // Active ultimate: charge arc on the plate, pulsing ring + R badge when ready
    const u = t.def.active;
    if (t.ultCd <= 0) {
      g.strokeStyle = '#ffd84a';
      g.shadowColor = '#ffd84a';
      g.shadowBlur = 8 + Math.sin(this.clock * 6) * 4;
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(fx, fy, 22, 8, 0, 0, Math.PI * 2);
      g.stroke();
      g.shadowBlur = 0;
    } else {
      g.strokeStyle = 'rgba(10,200,185,0.85)';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(fx, fy, 22, 8, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t.ultCd / u.cd));
      g.stroke();
    }
    if (t.buffs.length) {
      g.strokeStyle = 'rgba(255,216,74,0.7)';
      g.lineWidth = 3;
      g.setLineDash([4, 4]);
      g.lineDashOffset = -this.clock * 20;
      g.beginPath();
      g.ellipse(fx, fy, 26, 10, 0, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    // The champion: small body per role, weapon aimed at the target, official portrait as the head
    const per = t.period, strike = Math.min(0.09, per * 0.18), wind = Math.min(0.26, per * 0.42);
    drawHero(g, {
      x: fx, y: fy - 1, aim: t.aim, face: t.face, swing: t.sw,
      charge: t.engaged && t.cd > 0 && t.cd < wind ? 1 - t.cd / wind : 0,
      flash: Math.max(0, 1 - t.since / (strike + 0.07)),
      ult: t.ultT < 0.7 ? t.ultT / 0.7 : 0,
      spawn: Math.min(1, t.born / SPAWN),
      clock: this.clock, seed: t.c * 1.7 + t.r,
      img: squareImage(t.def.id), initials: initials(t.def.name), color: t.def.color, role: t.def.role,
      look: heroLook(t.def.id, t.def.role),
      frame: sel ? '#0ac8b9' : ['', '#c8aa6e', '#4a8fd8', '#c084fc'][t.def.rarity],
    });
    if (t.stunT > 0) {
      // Frozen by a boss: encased in ice until it thaws
      g.globalCompositeOperation = 'lighter';
      drawGlow(g, fx, fy - 22, 26, '#8fd3ff', 0.55, 34);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(200,236,255,0.35)';
      g.strokeStyle = 'rgba(232,247,255,0.9)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(fx - 15, fy + 2); g.lineTo(fx - 18, fy - 26); g.lineTo(fx - 6, fy - 50); g.lineTo(fx + 8, fy - 52); g.lineTo(fx + 18, fy - 28); g.lineTo(fx + 15, fy + 2);
      g.closePath();
      g.fill();
      g.stroke();
    }
    // Level badge
    g.fillStyle = '#010a13';
    g.beginPath();
    g.arc(fx + 17, fy + 1, 8.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#c8aa6e';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = '#f0e6d2';
    g.font = '700 9px "Source Sans 3", system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(String(lvl), fx + 17, fy + 4);
    if (t.ultCd <= 0) {
      g.fillStyle = '#ffd84a';
      g.beginPath();
      g.arc(fx - 17, fy + 1, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#010a13';
      g.font = '800 9px "Source Sans 3", system-ui, sans-serif';
      g.fillText('R', fx - 17, fy + 4);
    }
    const x = fx, y = headY, R = 12;
    // Ult rank gems
    for (let i = 0; i < rank; i++) {
      const sx = x - (rank - 1) * 7 + i * 14, sy = y - R - 9;
      g.fillStyle = '#010a13';
      g.beginPath();
      g.moveTo(sx, sy - 5); g.lineTo(sx + 5, sy); g.lineTo(sx, sy + 5); g.lineTo(sx - 5, sy);
      g.closePath();
      g.fill();
      g.fillStyle = rank >= 3 ? '#ffd84a' : '#0ac8b9';
      g.beginPath();
      g.moveTo(sx, sy - 3.5); g.lineTo(sx + 3.5, sy); g.lineTo(sx, sy + 3.5); g.lineTo(sx - 3.5, sy);
      g.closePath();
      g.fill();
    }
  }
}

/** Weather per map style: number of drifting motes, and what passes overhead (cloud shadow, smoke, snow squall). */
interface Ambient { motes: number; rate: number; cloud: string; cloudA: number; wind: number }
const AMBIENT_DEFAULT: Ambient = { motes: 50, rate: 0.2, cloud: '', cloudA: 0, wind: 0 };
const AMBIENT: Partial<Record<MapDef['theme']['style'], Ambient>> = {
  rift: { motes: 50, rate: 0.2, cloud: '#000000', cloudA: 0.16, wind: 14 },
  jungle: { motes: 60, rate: 0.3, cloud: '#000000', cloudA: 0.2, wind: 10 },
  demacia: { motes: 40, rate: 0.15, cloud: '#000000', cloudA: 0.12, wind: 16 },
  tundra: { motes: 150, rate: 0.6, cloud: '#ffffff', cloudA: 0.16, wind: 46 },
  bridge: { motes: 150, rate: 0.6, cloud: '#ffffff', cloudA: 0.14, wind: 46 },
  noxus: { motes: 90, rate: 0.4, cloud: '#1a0606', cloudA: 0.26, wind: 9 },
  ionia: { motes: 90, rate: 0.35, cloud: '#000000', cloudA: 0.1, wind: 12 },
  haunted: { motes: 60, rate: 0.3, cloud: '#06201a', cloudA: 0.22, wind: 8 },
};

const LOOT_COLOR = ['', '#a09b8c', '#4a8fd8', '#c084fc', '#ffb347'];

/** Jagged bolt of energy between two points; it is redrawn with new kinks every frame, so it crackles. */
function bolt(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, k: number): void {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
  if (d < 2) return;
  const n = Math.max(2, Math.round(d / 12)), nx = -dy / d, ny = dx / d;
  const pts: number[] = [x1, y1];
  for (let i = 1; i < n; i++) {
    const q = i / n, o = (Math.random() - 0.5) * 16 * Math.sin(q * Math.PI);
    pts.push(x1 + dx * q + nx * o, y1 + dy * q + ny * o);
  }
  pts.push(x2, y2);
  const path = () => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); };
  g.lineJoin = 'round';
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = color;
  g.globalAlpha = 0.35 * k;
  g.lineWidth = 9;
  path();
  g.globalAlpha = 0.8 * k;
  g.lineWidth = 3.5;
  path();
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = '#ffffff';
  g.globalAlpha = k;
  g.lineWidth = 1.4;
  path();
  g.globalAlpha = 1;
}

function seg(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export function initials(name: string): string {
  const parts = name.replace(/'/g, '').split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

function fmtShort(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toString();
}
