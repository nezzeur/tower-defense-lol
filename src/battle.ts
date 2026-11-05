import { mobImage } from './art/mobArt';
import { squareImage } from './art/champArt';
import { FEATURE_INFO, featureTiles, LH, LW, pathGeometry, spawnMote, type Mote } from './art/mapArt';
import { drawMapHD } from './art/mapHD';
import { CREATURE_HEIGHT, drawCreature } from './art/creatures';
import { shade } from './art/pixel';
import { ENEMIES } from './data/enemies';
import { COLS, ROWS } from './data/maps';
import {
  buildWave, champ, computeStats, goldScale, hpScale, level, MAX_LIVES, START_LIVES, teamSlots, ultRank, waveBonus,
  type Spawn,
} from './game';
import { persist, store } from './save';
import type { ChampionDef, EnemyDef, FeatureKind, MapDef, Stats } from './types';

export const TILE = 48;
export const W = COLS * TILE;
export const H = ROWS * TILE;
const STEP = 1 / 60;

interface Burn { dps: number; t: number; src: Tower | null }

interface Enemy {
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
}

interface Proj {
  x: number;
  y: number;
  target: Enemy;
  tower: Tower;
  dmgMult: number;
  chainLeft: number;
  hit: Set<number>;
  trail: { x: number; y: number }[];
}

interface Particle { x: number; y: number; vx: number; vy: number; t: number; max: number; size: number; color: string }

interface Fx {
  kind: 'beam' | 'ring' | 'text' | 'boom';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r?: number;
  t: number;
  max: number;
  color: string;
  text?: string;
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

  wave = 0;
  /** Run statistics shown in the HUD. */
  runKills = 0;
  runGold = 0;
  runTime = 0;
  waveTotal = 0;
  lives = START_LIVES;
  waveActive = false;
  over = false;
  paused = false;
  spellCd: Record<SpellId, number> = { smite: 0, heal: 0, exhaust: 0 };
  selectedRoster: string | null = null;
  selectedTower: Tower | null = null;
  private hover: { c: number; r: number } | null = null;

  // Visual-only state (skipped headless)
  private parts: Particle[] = [];
  private motes: Mote[] = [];
  private clock = 0;
  private shake = 0;
  private nexusHurt = 0;
  private banner: { text: string; sub: string; t: number; color: string } | null = null;
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
    drawMapHD(bgc, this.map, W, H, TILE);
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
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if (this.featureAt(c + dc, r + dr) === 'dragon') { s.dmg *= 1.15; dc = dr = 2; }
    }
    return s;
  }

  // ---------- Placement ----------

  canPlace(c: number, r: number): boolean {
    const f = this.featureAt(c, r);
    return c >= 0 && r >= 0 && c < COLS && r < ROWS && !this.pathTiles.has(`${c},${r}`) && f !== 'river' && f !== 'turret' && f !== 'dragon'
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
    };
    this.towers.push(t);
    this.saveLayout();
    return true;
  }

  remove(t: Tower): void {
    this.towers = this.towers.filter((x) => x !== t);
    if (this.selectedTower === t) this.selectedTower = null;
    this.saveLayout();
  }

  refreshStats(): void {
    for (const t of this.towers) t.stats = this.statsAt(t.def, t.c, t.r);
  }

  private saveLayout(): void {
    store.data.layouts[this.map.id] = this.towers.map((t) => ({ id: t.def.id, c: t.c, r: t.r }));
    persist();
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

  private bindInput(): void {
    let drag: { t: Tower; x: number; y: number; moved: boolean } | null = null;
    const cv = this.canvas;
    cv.addEventListener('pointermove', (e) => {
      this.hover = this.tileAtClient(e.clientX, e.clientY);
      if (drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
        drag.moved = true;
        this.selectedTower = drag.t;
      }
    });
    cv.addEventListener('pointerleave', () => { this.hover = null; });
    cv.addEventListener('pointerdown', (e) => {
      const tile = this.tileAtClient(e.clientX, e.clientY);
      const t = tile && this.towers.find((x) => x.c === tile.c && x.r === tile.r);
      if (t && e.button === 0) {
        drag = { t, x: e.clientX, y: e.clientY, moved: false };
        cv.setPointerCapture(e.pointerId);
      }
    });
    cv.addEventListener('pointerup', (e) => {
      if (drag?.moved) {
        const tile = this.tileAtClient(e.clientX, e.clientY);
        if (tile) this.moveTower(drag.t, tile.c, tile.r);
        this.selectedTower = drag.t;
        this.ev.onChange();
      } else {
        this.clickTile(e);
      }
      drag = null;
    });
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.selectedRoster = null;
      this.selectedTower = null;
      this.ev.onChange();
    });
  }

  private clickTile(e: PointerEvent): void {
    if (e.button !== 0) return;
    const tile = this.tileAtClient(e.clientX, e.clientY);
    if (!tile) return;
    const { c, r } = tile;
    const hit = this.towers.find((t) => t.c === c && t.r === r);
    if (this.selectedRoster && !hit) {
      this.dropChampion(this.selectedRoster, c, r);
      return;
    }
    if (this.selectedTower && !hit && this.canPlace(c, r)) this.moveTower(this.selectedTower, c, r);
    else {
      this.selectedTower = hit ?? null;
      this.selectedRoster = null;
    }
    this.ev.onChange();
  }

  // ---------- Flow ----------

  /** Enemies of the current wave still to spawn or alive. */
  waveRemaining(): number {
    return this.queue.length + this.enemies.length;
  }

  /** Composition of the next wave (enemy id -> count). */
  nextWave(): { id: string; n: number }[] {
    if (this.wave >= this.map.waves) return [];
    const counts = new Map<string, number>();
    for (const sp of buildWave(this.map, this.wave + 1)) counts.set(sp.id, (counts.get(sp.id) ?? 0) + 1);
    return [...counts].map(([id, n]) => ({ id, n }));
  }

  /** Boss challenge: the run starts directly at the final wave. */
  bossMode = false;

  canChallengeBoss(): boolean {
    return (store.data.best[this.map.id] ?? 0) >= this.map.waves - 1;
  }

  startWave(): void {
    if (this.waveActive || this.over) return;
    if (this.bossMode && this.wave === 0) this.wave = this.map.waves - 1;
    this.wave++;
    this.queue = buildWave(this.map, this.wave);
    this.waveTotal = this.queue.length;
    this.spawnT = 0;
    this.waveActive = true;
    this.autoT = -1;
    const final = this.wave === this.map.waves;
    this.showBanner(final ? 'BOSS' : `Vague ${this.wave}`, final ? ENEMIES[this.map.finalBoss].name
      : this.wave % 10 === 0 ? 'Monstre épique en approche' : this.wave % 5 === 0 ? 'Carapateurs !' : '', final ? '#c084fc' : '#f0e6d2');
    this.ev.onChange();
  }

  private showBanner(text: string, sub: string, color: string): void {
    if (this.visual) this.banner = { text, sub, t: 0, color };
  }

  private burst(x: number, y: number, color: string, n: number, speed: number, size = 2.5): void {
    if (!this.visual || this.parts.length > 600) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, t: 0, max: 0.35 + Math.random() * 0.35, size: size * (0.6 + Math.random() * 0.6), color });
    }
  }

  restart(bossMode = false): void {
    this.bossMode = bossMode && this.canChallengeBoss();
    this.enemies = [];
    this.projs = [];
    this.fx = [];
    this.queue = [];
    this.wave = 0;
    this.lives = START_LIVES;
    this.waveActive = false;
    this.over = false;
    this.spellCd = { smite: 0, heal: 0, exhaust: 0 };
    for (const t of this.towers) { t.runStacks = 0; t.ramp = 0; t.hits = 0; t.cd = 0.3; t.dmgDone = 0; t.kills = 0; }
    this.runKills = this.runGold = this.runTime = 0;
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
      this.fx.push({ kind: 'boom', x: target.x, y: target.y, r: 30, t: 0, max: 0.4, color: '#ffd84a' });
    } else if (id === 'exhaust') {
      if (!alive.length) return;
      for (const e of alive) { e.slowPct = Math.max(e.slowPct, 0.6); e.slowT = Math.max(e.slowT, 3); }
    } else {
      this.lives = Math.min(MAX_LIVES, this.lives + 5);
    }
    this.spellCd[id] = SPELLS[id].cd;
  }

  // ---------- Loop ----------

  // Simulation runs on a timer so auto-farm keeps going in a background tab (browsers pause
  // requestAnimationFrame there but still fire throttled timers); rendering stays on rAF.
  private tick = (): void => {
    const now = performance.now();
    const dt = Math.min(1.5, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) {
      this.acc += dt * store.data.speed;
      let steps = 0;
      while (this.acc >= STEP && steps < 1200) { this.step(STEP); this.acc -= STEP; steps++; }
      if (steps >= 1200) this.acc = 0;
    }
    if (now - this.lastFrame > 500) this.render();
  };

  private frame = (now: number): void => {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (!this.paused) this.animate(dt, dt * store.data.speed);
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  step(dt: number): void {
    for (const k of Object.keys(this.spellCd) as SpellId[]) this.spellCd[k] = Math.max(0, this.spellCd[k] - dt);
    this.saveT += dt;
    if (this.saveT > 10) { this.saveT = 0; persist(); }

    if (this.autoT >= 0) {
      this.autoT -= dt;
      if (this.autoT < 0) {
        if (this.over) this.restart();
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

    if (this.waveActive && !this.queue.length && !this.enemies.length && !this.over) this.waveCleared();
  }

  private spawn(id: string): void {
    const def = ENEMIES[id];
    const hp = def.hp * hpScale(this.map, this.wave);
    const lane = this.spawnCount++ % this.lanes.length;
    const p = this.posAt(0, lane);
    this.enemies.push({
      uid: ++this.uid, def, hp, maxHp: hp, s: 0, x: p.x, y: p.y, lane,
      slowPct: 0, slowT: 0, stunT: 0, burns: [], dead: false, hitFlash: 0, face: 1, phase: Math.random() * 6,
    });
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
      if (e.slowT > 0) e.slowT -= dt; else e.slowPct = 0;
      if (e.stunT > 0) { e.stunT -= dt; continue; }
      const river = this.featureAt(Math.floor(e.x / TILE), Math.floor(e.y / TILE)) === 'river' ? 0.8 : 1;
      e.s += e.def.speed * TILE * (1 - e.slowPct) * river * dt;
      const p = this.posAt(e.s, e.lane);
      if (Math.abs(p.x - e.x) > 0.01) e.face = p.x > e.x ? 1 : -1;
      e.phase += dt * e.def.speed * 8 * (1 - e.slowPct);
      e.x = p.x;
      e.y = p.y;
      if (e.s >= this.lanes[e.lane].len) {
        this.lives -= e.def.leak;
        this.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 40, t: 0, max: 0.5, color: '#ff4d4d' });
        this.nexusHurt = 0.5;
        this.shake = Math.max(this.shake, e.def.boss ? 10 : 3);
        this.burst(e.x, e.y, '#ff5a5a', e.def.boss ? 30 : 8, 120);
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
      this.damage(best, ENEMIES.melee.hp * hpScale(this.map, this.wave) * 0.25, null, false);
      if (this.visual) this.fx.push({ kind: 'beam', x: tu.x, y: tu.y - 40, x2: best.x, y2: best.y, t: 0, max: 0.18, color: '#7fd8ff' });
    }
  }

  private inRange(t: Tower, range = t.stats.range): Enemy[] {
    const r = range * TILE;
    return this.enemies.filter((e) => !e.dead && Math.hypot(e.x - t.x, e.y - t.y) <= r + e.def.size);
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      t.flash = Math.max(0, t.flash - dt);
      const s = t.stats;
      const rate = s.rate * (1 + t.ramp);
      t.cd -= dt;
      if (t.cd > 0) continue;
      const targets = this.inRange(t).sort((a, b) => b.s - a.s);
      if (!targets.length) {
        if (s.ramp) t.ramp = Math.max(0, t.ramp - dt * 0.5);
        t.cd = 0;
        continue;
      }
      t.cd = 1 / rate;
      t.flash = 0.12;
      const first = targets[0];
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
          this.fx.push({ kind: 'ring', x: t.x, y: t.y, r: s.range * TILE, t: 0, max: 0.35, color: t.def.color });
          break;
        case 'pierce': {
          const len = s.range * TILE * 1.15;
          const x2 = t.x + Math.cos(t.angle) * len, y2 = t.y + Math.sin(t.angle) * len;
          for (const e of this.enemies) {
            if (!e.dead && distToSeg(e.x, e.y, t.x, t.y, x2, y2) < TILE * 0.45 + e.def.size) this.hit(t, e, 1);
          }
          this.fx.push({ kind: 'beam', x: t.x, y: t.y, x2, y2, t: 0, max: 0.2, color: t.def.color });
          break;
        }
      }
    }
  }

  private shoot(t: Tower, target: Enemy, chainLeft: number): void {
    this.projs.push({ x: t.x, y: t.y, target, tower: t, dmgMult: 1, chainLeft, hit: new Set(), trail: [] });
  }

  private updateProjs(dt: number): void {
    const speed = 14 * TILE;
    for (const p of this.projs) {
      const dx = p.target.x - p.x, dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < speed * dt + 4) {
        p.x = p.target.x;
        p.y = p.target.y;
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
      this.fx.push({ kind: 'boom', x: p.x, y: p.y, r, t: 0, max: 0.25, color: t.def.color });
      return;
    }
    if (!p.target.dead) this.hit(t, p.target, p.dmgMult);
    if (s.type === 'chain' && p.chainLeft > 0) {
      p.hit.add(p.target.uid);
      const next = this.enemies
        .filter((e) => !e.dead && !p.hit.has(e.uid) && Math.hypot(e.x - p.x, e.y - p.y) < 2.5 * TILE)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (next) {
        this.projs.push({ x: p.x, y: p.y, target: next, tower: t, dmgMult: p.dmgMult * 0.8, chainLeft: p.chainLeft - 1, hit: p.hit, trail: [] });
      }
    }
  }

  private hit(t: Tower, e: Enemy, mult: number): void {
    const s = t.stats;
    t.hits++;
    let dmg = (s.dmg + t.runStacks) * mult;
    let crit = false;
    if (s.everyN && t.hits % s.everyN.n === 0) { dmg *= s.everyN.mult; crit = true; }
    if (s.crit && Math.random() < s.crit.chance) { dmg *= s.crit.mult; crit = true; }
    if (e.def.boss && s.bossMult) dmg *= s.bossMult;
    if (crit) this.fx.push({ kind: 'text', x: e.x, y: e.y - 14, t: 0, max: 0.6, color: '#ffd84a', text: fmtShort(dmg) });
    this.damage(e, dmg, t, false);
    if (s.pctHp && t.hits % s.pctHp.every === 0) this.damage(e, e.maxHp * s.pctHp.pct, t, true);
    if (e.dead) return;
    e.hitFlash = 0.08;
    if (this.visual && Math.random() < 0.5) this.burst(e.x, e.y, t.def.color, 2, 80, 2);
    if (s.slow && s.slow.pct >= e.slowPct) { e.slowPct = Math.min(0.8, s.slow.pct); e.slowT = s.slow.dur; }
    if (s.stun && Math.random() < s.stun.chance) e.stunT = Math.max(e.stunT, s.stun.dur * (e.def.boss ? 0.3 : 1));
    if (s.burn) {
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

  private damage(e: Enemy, amount: number, src: Tower | null, trueDmg: boolean): void {
    if (e.dead) return;
    const dealt = trueDmg ? amount : amount * (1 - e.def.armor);
    if (src) src.dmgDone += Math.min(dealt, Math.max(0, e.hp));
    e.hp -= dealt;
    if (e.hp <= 0) this.kill(e, src);
  }

  private kill(e: Enemy, src: Tower | null): void {
    e.dead = true;
    this.burst(e.x, e.y, e.def.color, e.def.shape === 'boss' ? 40 : 10, e.def.shape === 'boss' ? 200 : 110, e.def.shape === 'boss' ? 4 : 2.5);
    this.burst(e.x, e.y, '#ffd84a', e.def.shape === 'boss' ? 16 : 3, 70, 2);
    const gold = Math.max(1, Math.round(e.def.gold * goldScale(this.map, this.wave) * (1 + (src?.stats.killGold ?? 0))));
    store.data.gold += gold;
    store.data.kills++;
    this.runKills++;
    this.runGold += gold;
    if (e.def.boss || e.def.shape === 'boss') {
      this.fx.push({ kind: 'text', x: e.x, y: e.y - 24, t: 0, max: 1.2, color: '#f5c542', text: `+${fmtShort(gold)}` });
    }
    if (!src) return;
    src.kills++;
    const ks = src.stats.killStack;
    if (ks) {
      if (ks.persistent) {
        store.data.stacks[src.def.id] = (store.data.stacks[src.def.id] ?? 0) + ks.amount;
        src.stats.dmg += ks.amount;
      } else {
        src.runStacks += ks.amount;
      }
    }
  }

  private waveCleared(): void {
    this.waveActive = false;
    const d = store.data;
    const bonus = waveBonus(this.map, this.wave);
    d.gold += bonus;
    this.runGold += bonus;
    if (this.wave < this.map.waves) this.showBanner(`Vague ${this.wave} repoussée`, `+${fmtShort(bonus)} or`, '#f5c542');
    d.best[this.map.id] = Math.max(d.best[this.map.id] ?? 0, this.wave);
    const heal = this.towers.reduce((n, t) => n + (t.stats.livesPerWave ?? 0), 0);
    this.lives = Math.min(MAX_LIVES, this.lives + heal);
    persist();
    if (this.wave >= this.map.waves) {
      this.over = true;
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
    persist();
    this.ev.onEnd(false, this.wave);
    if (store.data.auto) this.autoT = 2.5;
    this.ev.onChange();
  }

  // ---------- Render (HD) ----------

  /** Advances visual-only state: real dt for ambience, game dt for combat particles. */
  private animate(dt: number, gameDt: number): void {
    this.clock += dt;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.nexusHurt = Math.max(0, this.nexusHurt - dt);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 2) this.banner = null; }
    for (const p of this.parts) {
      p.t += gameDt;
      p.x += p.vx * gameDt;
      p.y += p.vy * gameDt;
      p.vy += 260 * gameDt;
      p.vx *= 0.96;
    }
    this.parts = this.parts.filter((p) => p.t < p.max);
    const style = this.map.theme.style;
    const rate = style === 'jungle' ? 0.5 : style === 'haunted' ? 0.45 : 0.3;
    if (this.motes.length < 50 && Math.random() < rate) this.motes.push(spawnMote(style));
    for (const m of this.motes) {
      m.life += dt;
      m.x += m.vx * dt + (style === 'rift' || style === 'tundra' ? Math.sin(m.life * 2) * 0.1 : 0);
      m.y += m.vy * dt;
    }
    this.motes = this.motes.filter((m) => m.life < m.max && m.x > -5 && m.x < LW + 5 && m.y > -5 && m.y < LH + 5);
  }

  private render(): void {
    const g = this.ctx;
    g.save();
    if (this.shake > 0) g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    g.clearRect(-20, -20, W + 40, H + 40);
    g.drawImage(this.bg, 0, 0, W, H);

    const start = this.pts[0], end = this.pts[this.pts.length - 1];
    this.drawPortal(g, Math.min(W - 20, Math.max(20, start.x)), Math.min(H - 20, Math.max(20, start.y)));

    // Placement preview
    if (this.hover && (this.selectedRoster || this.selectedTower)) {
      const { c, r } = this.hover;
      const ok = this.canPlace(c, r) && (this.selectedTower || this.slotsLeft() > 0);
      g.fillStyle = ok ? 'rgba(10,200,185,0.22)' : 'rgba(255,60,60,0.28)';
      g.strokeStyle = ok ? 'rgba(10,200,185,0.8)' : 'rgba(255,80,80,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(c * TILE + 3, r * TILE + 3, TILE - 6, TILE - 6, 6);
      g.fill();
      g.stroke();
      if (ok) {
        const id = this.selectedRoster ?? this.selectedTower!.def.id;
        this.rangeRing(g, (c + 0.5) * TILE, (r + 0.5) * TILE, computeStats(champ(id)).range, 'rgba(10,200,185,0.7)');
      }
    }
    if (this.selectedTower) this.rangeRing(g, this.selectedTower.x, this.selectedTower.y, this.selectedTower.stats.range, 'rgba(240,230,210,0.85)');

    const units: { y: number; draw: () => void }[] = [
      ...this.enemies.map((e) => ({ y: e.y, draw: () => this.drawEnemy(g, e) })),
      ...this.towers.map((t) => ({ y: t.y, draw: () => this.drawTower(g, t) })),
      { y: end.y, draw: () => this.drawNexus(g, end.x, end.y) },
    ];
    units.sort((a, b) => a.y - b.y).forEach((u) => u.draw());

    // Projectiles with glowing trails
    g.lineCap = 'round';
    for (const p of this.projs) {
      const col = p.tower.def.color;
      if (p.trail.length) {
        g.strokeStyle = col;
        g.globalAlpha = 0.55;
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(p.trail[0].x, p.trail[0].y);
        for (const q of p.trail) g.lineTo(q.x, q.y);
        g.lineTo(p.x, p.y);
        g.stroke();
        g.globalAlpha = 1;
      }
      g.shadowColor = col;
      g.shadowBlur = 12;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }

    for (const f of this.fx) {
      const k = 1 - f.t / f.max;
      g.globalAlpha = Math.max(0, k);
      if (f.kind === 'beam') {
        g.shadowColor = f.color;
        g.shadowBlur = 20;
        g.strokeStyle = f.color;
        g.lineWidth = 12 * k + 3;
        g.beginPath();
        g.moveTo(f.x, f.y);
        g.lineTo(f.x2!, f.y2!);
        g.stroke();
        g.strokeStyle = '#ffffff';
        g.lineWidth = 3 * k + 1;
        g.stroke();
        g.shadowBlur = 0;
      } else if (f.kind === 'ring') {
        g.strokeStyle = f.color;
        g.lineWidth = 3 * k + 1;
        g.beginPath();
        g.arc(f.x, f.y, f.r! * (0.6 + 0.4 * (1 - k)), 0, Math.PI * 2);
        g.stroke();
      } else if (f.kind === 'boom') {
        const rr = f.r! * (0.4 + 0.6 * (1 - k));
        const grad = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.4, f.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = k * 0.8;
        g.fillStyle = grad;
        g.beginPath();
        g.arc(f.x, f.y, rr, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    for (const p of this.parts) {
      g.globalAlpha = 1 - p.t / p.max;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
    }
    // Ambient motes (spawned in low-res space, drawn x3)
    for (const m of this.motes) {
      if (m.blink && Math.sin(m.life * 6) < -0.2) continue;
      g.globalAlpha = Math.min(1, m.life, (m.max - m.life)) * 0.8;
      if (m.blink) { g.shadowColor = m.color; g.shadowBlur = 8; }
      g.fillStyle = m.color;
      g.beginPath();
      g.arc(m.x * 3, m.y * 3, m.blink ? 2.2 : 1.6, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }
    g.globalAlpha = 1;

    // Damage numbers
    g.textAlign = 'center';
    for (const f of this.fx) {
      if (f.kind !== 'text') continue;
      const k = 1 - f.t / f.max;
      g.globalAlpha = Math.max(0, k);
      g.font = '800 15px Inter, system-ui, sans-serif';
      const y = f.y - (1 - k) * 22;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.75)';
      g.strokeText(f.text!, f.x, y);
      g.fillStyle = f.color;
      g.fillText(f.text!, f.x, y);
      g.globalAlpha = 1;
    }
    g.restore();
    if (this.banner) this.drawBanner(g, this.banner);
    if (this.hover) {
      const f = this.featureAt(this.hover.c, this.hover.r);
      if (f) this.drawTileTip(g, this.hover.c, this.hover.r, f);
    }
  }

  private drawTileTip(g: CanvasRenderingContext2D, c: number, r: number, f: FeatureKind): void {
    const info = FEATURE_INFO[f];
    g.font = '700 13px Cinzel, serif';
    const tw = Math.max(g.measureText(info.name).width, (g.font = '500 12px Inter, sans-serif', g.measureText(info.desc).width)) + 20;
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
    g.font = '500 12px Inter, sans-serif';
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
    const fly = e.def.id === 'drake' || e.def.id === 'fallenking' || e.def.id === 'spiritguard';
    const h = (CREATURE_HEIGHT[e.def.id] ?? 16) * 3, w = h * 0.9;
    const x = e.x, y = e.y + 15;
    const ph = e.stunT > 0 ? 0 : e.phase;
    if (e.def.boss) {
      const aura = g.createRadialGradient(x, y - h / 2, 4, x, y - h / 2, w * 0.7);
      aura.addColorStop(0, e.def.color + '66');
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = aura;
      g.beginPath();
      g.arc(x, y - h / 2, w * 0.7, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = `rgba(0,0,0,${fly ? 0.2 : 0.35})`;
    g.beginPath();
    g.ellipse(x, y, w * 0.38, Math.max(4, w * 0.1), 0, 0, Math.PI * 2);
    g.fill();
    const custom = mobImage(e.def.id);
    if (custom) {
      const ih = h, iw = (custom.naturalWidth / custom.naturalHeight) * ih;
      g.save();
      if (e.hitFlash > 0) g.filter = 'brightness(2.2)';
      g.translate(x, y);
      if (e.face < 0) g.scale(-1, 1);
      g.drawImage(custom, -iw / 2, -ih, iw, ih);
      g.restore();
    } else {
      drawCreature(g, e.def.id, x, y, e.face, ph, this.clock, e.def.color, e.hitFlash > 0, 3);
    }
    if (e.slowPct > 0) {
      g.strokeStyle = 'rgba(143,211,255,0.85)';
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(x, y, w * 0.42, Math.max(5, w * 0.12), 0, 0, Math.PI * 2);
      g.stroke();
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
    if (e.burns.length && Math.random() < 0.3) this.burst(x + (Math.random() - 0.5) * w * 0.6, y - h * 0.6, '#ff8a3d', 1, 30, 1.8);
    // HP bar (LoL style: dark frame, segmented fill)
    const bw = Math.max(30, Math.min(110, w * 0.95)), pct = Math.max(0, e.hp / e.maxHp), by = y - h - 10;
    g.fillStyle = '#010a13';
    g.fillRect(x - bw / 2 - 1.5, by - 1.5, bw + 3, 7);
    g.fillStyle = e.def.boss ? '#a855f7' : '#d13a3a';
    g.fillRect(x - bw / 2, by, bw * pct, 4);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(x - bw / 2, by, bw * pct, 1.5);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    for (let i = 1; i < 4; i++) g.fillRect(x - bw / 2 + (bw * i) / 4, by, 1, 4);
  }

  private drawTower(g: CanvasRenderingContext2D, t: Tower): void {
    const lvl = level(t.def.id), rank = ultRank(lvl);
    const idle = Math.sin(this.clock * 2.2 + t.c) * 1.2;
    const recoil = t.flash > 0 ? (t.flash / 0.12) * 3 : 0;
    const x = t.x - Math.cos(t.angle) * recoil, y = t.y - 4 + idle - Math.sin(t.angle) * recoil;
    const R = 17;
    // Hextech base plate
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath();
    g.ellipse(t.x, t.y + 16, 19, 6, 0, 0, Math.PI * 2);
    g.fill();
    const plate = g.createLinearGradient(0, t.y + 8, 0, t.y + 18);
    plate.addColorStop(0, '#1e2a3a');
    plate.addColorStop(1, '#0a1428');
    g.fillStyle = plate;
    g.beginPath();
    g.ellipse(t.x, t.y + 13, 17, 5.5, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = t === this.selectedTower ? '#0ac8b9' : '#785a28';
    g.lineWidth = 1.5;
    g.stroke();
    // Gold ring frame
    if (rank > 0) { g.shadowColor = rank >= 3 ? '#ffd84a' : '#c8aa6e'; g.shadowBlur = 6 + rank * 4; }
    const ring = g.createLinearGradient(x, y - R - 4, x, y + R + 4);
    ring.addColorStop(0, '#f0e6d2');
    ring.addColorStop(0.45, '#c8aa6e');
    ring.addColorStop(1, '#785a28');
    g.fillStyle = '#010a13';
    g.beginPath();
    g.arc(x, y, R + 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = t === this.selectedTower ? '#0ac8b9' : ring;
    g.beginPath();
    g.arc(x, y, R + 3.5, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    // Portrait
    const img = squareImage(t.def.id);
    g.save();
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.clip();
    if (img) {
      const s = R * 2.25;
      g.drawImage(img, x - s / 2, y - s / 2, s, s);
    } else {
      g.fillStyle = t.def.color;
      g.fillRect(x - R, y - R, R * 2, R * 2);
      g.fillStyle = '#010a13';
      g.font = 'bold 13px Inter, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(initials(t.def.name), x, y + 1);
      g.textBaseline = 'alphabetic';
    }
    if (t.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${(t.flash / 0.12) * 0.35})`;
      g.fillRect(x - R, y - R, R * 2, R * 2);
    }
    g.restore();
    // Aim notch on the ring
    g.fillStyle = '#f0e6d2';
    g.beginPath();
    const ax = x + Math.cos(t.angle) * (R + 4), ay = y + Math.sin(t.angle) * (R + 4);
    g.arc(ax, ay, 2.6, 0, Math.PI * 2);
    g.fill();
    // Level badge
    g.fillStyle = '#010a13';
    g.beginPath();
    g.arc(x + 15, y + 15, 9, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#c8aa6e';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = '#f0e6d2';
    g.font = '700 9px Inter, sans-serif';
    g.textAlign = 'center';
    g.fillText(String(lvl), x + 15, y + 18);
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
