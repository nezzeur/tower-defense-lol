// A battle on one map: board state, placement, saved teams, wave flow, game modes and the main loop.
// The simulation runs headless for the balance bot; its sibling modules hold combat, monsters, ultimates, input and rendering.
// Members are public so those modules can work on the battle; code outside src/battle should stick to the methods the UI uses.
import { featureTiles, landmarkTiles, pathGeometry, terrainAt, type Mote } from '../art/mapArt';
import { drawMapHD } from '../art/mapHD';
import { Vfx } from '../art/vfx';
import type { MapLight } from '../art/regionArt';
import { sfx } from '../audio';
import { ENEMIES } from '../data/enemies';
import { BOON_AUTO_DELAY, BOON_BY_ID, BOON_CHANCE, BOON_MAX, rollBoons, type BoonDef } from '../data/boons';
import { teamSynergies, type SynStat } from '../data/synergies';
import { COLS, ROWS } from '../data/maps';
import { buildWave, champ, computeStats, endlessHp, endlessUnlocked, goldScale, hpScale, level, MAX_LIVES, START_LIVES, teamSlots, waveBonus, type Spawn, ENDLESS_LOOT, endlessWaveFactor } from '../game';
import { persist, store } from '../save';
import type { ChampionDef, FeatureKind, MapDef, Priority, Stats } from '../types';
import { type BattleEvents, type Enemy, type Fx, H, type Proj, SPELLS, STEP, type SpellId, TEAM_SLOTS, TILE, type Tower, W, fmtShort } from './model';
import { tileAtClient, enemyAtPoint, bindInput } from './input';
import { showBanner, boom } from './effects';
import { needsAim, aimRadius, requestUlt, castUlt, autoUlts } from './ultimates';
import { spawn, grip, updateEnemies, updateTurrets } from './enemies';
import { updateTowers, updateProjs, damage } from './combat';
import { animate, render } from './render';

export class Battle {
  readonly canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  bg!: HTMLCanvasElement;
  pts: { x: number; y: number }[] = [];
  /** Longest lane length (pixels); used by the balance bot. */
  pathLen = 0;
  pathTiles = new Set<string>();
  lanes: { pts: { x: number; y: number }[]; cum: number[]; len: number }[] = [];
  features = new Map<string, FeatureKind>();
  blocked = new Set<string>();
  turrets: { x: number; y: number; cd: number }[] = [];
  spawnCount = 0;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projs: Proj[] = [];
  fx: Fx[] = [];
  queue: Spawn[] = [];
  spawnT = 0;
  uid = 0;
  autoT = -1;
  raf = 0;
  timer = 0;
  last = 0;
  lastFrame = 0;
  acc = 0;
  saveT = 0;
  autoUltT = 0;

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
  hover: { c: number; r: number } | null = null;
  /** Pointer position on the board (canvas px), for aiming. */
  mouse: { x: number; y: number } | null = null;
  /** Champion whose ultimate is being aimed: the next click on the board casts it there. */
  aiming: Tower | null = null;
  /** Blessings picked this run (id -> stacks) and the three currently on offer, if any. */
  boons: Record<string, number> = {};
  boonOffer: BoonDef[] | null = null;
  /** Champion just dropped by an endless boss; the HUD announces it then clears this. */
  newChampion: string | null = null;
  boonT = 0;

  // Visual-only state (skipped headless)
  /** Particles, lights, ground marks and dying monsters; null in headless runs. */
  vfx: Vfx | null = null;
  /** Real seconds the simulation stays frozen to give a big hit some weight. */
  hitStop = 0;
  lastStop = 0;
  /** 0..1 darkening of the ground during an ultimate or a boss death. */
  dim = 0;
  readonly calm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  motes: Mote[] = [];
  /** Light sources painted into the map (braziers, crystals, lanterns...) and centres of its water tiles. */
  mapLights: MapLight[] = [];
  waterTiles: { x: number; y: number }[] = [];
  clock = 0;
  shake = 0;
  nexusHurt = 0;
  banner: { text: string; sub: string; t: number; color: string } | null = null;
  /** Ultimate cut-in: a band with the champion's art that sweeps across the top of the board. */
  cutin: { id: string; name: string; champ: string; color: string; t: number } | null = null;
  readonly visual: boolean;

  /** headless: no canvas, input or animation loop; drive it with step() (balance simulation). */
  constructor(readonly map: MapDef, readonly ev: BattleEvents, headless = false) {
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
    bindInput(this);
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

  buildPath(): void {
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

  posAt(s: number, lane = 0): { x: number; y: number } {
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
  statsAt(def: ChampionDef, c: number, r: number): Stats {
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

  saveLayout(): void {
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

  restoreLayout(): void {
    for (const p of store.data.layouts[this.map.id] ?? []) {
      if (store.data.owned.includes(p.id)) this.place(p.id, p.c, p.r);
    }
  }

  // ---------- Input ----------

  /** Placement preview while dragging from outside the canvas. */
  previewAt(cx: number, cy: number): void {
    this.hover = tileAtClient(this, cx, cy);
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
  dragging: Tower | null = null;

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

  /**
   * Scale of "% of max HP" damage. In endless mode it shrinks as the waves grow, otherwise such damage would
   * ignore the mode's whole difficulty curve (it kills in a fixed number of hits whatever the HP).
   */
  pctHpScale(): number {
    return this.endless && this.wave > this.map.waves ? 1 / endlessWaveFactor(this.endlessWave()) : 1;
  }

  /** Blessings taken this run. */
  boonCount(): number {
    return Object.values(this.boons).reduce((n, v) => n + v, 0);
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
    const final = this.wave === this.map.waves || (this.endless && this.endlessWave() % ENDLESS_LOOT.bossEvery === 0);
    showBanner(this, final ? 'BOSS' : this.endless ? `Infini · vague ${this.endlessWave()}` : `Vague ${this.wave}`, final ? ENEMIES[this.map.finalBoss].name
      : this.wave % 10 === 0 ? 'Monstre épique en approche' : this.wave % 5 === 0 ? 'Carapateurs !' : '', final ? '#c084fc' : '#f0e6d2');
    this.ev.onChange();
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
      damage(this, target, target.maxHp * 0.2 * this.pctHpScale(), null, true);
      boom(this, target.x, target.y, 34, '#ffd84a', 0.4);
      this.vfx?.light(target.x, target.y - 40, 60, '#ffd84a', 0.7, 0.3);
    } else if (id === 'exhaust') {
      if (!alive.length) return;
      for (const e of alive) { const k = grip(e); if (k > 0) { e.slowPct = Math.max(e.slowPct, 0.6 * k); e.slowT = Math.max(e.slowT, 3); } }
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
      showBanner(this, `${b.icon} ${b.name}`, b.desc, '#0ac8b9');
      const end = this.pts[this.pts.length - 1];
      for (const t of this.towers) this.fx.push({ kind: 'pillar', x: t.x, y: t.y + 12, t: 0, max: 0.9, color: '#0ac8b9' });
      if (b.special) this.fx.push({ kind: 'pillar', x: end.x, y: end.y + 14, t: 0, max: 1, color: '#6be08a' });
    }
    if (store.data.auto) this.autoT = 1;
    this.ev.onChange();
  }

  // ---------- Loop ----------

  /** Runs the simulation up to `now`; shared by the display loop and the background timer. */
  advance(now: number): void {
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
  tick = (): void => {
    const now = performance.now();
    if (now - this.lastFrame < 150) return;
    this.advance(now);
    if (now - this.lastFrame > 500) render(this);
  };

  frame = (now: number): void => {
    const dt = Math.max(0, Math.min(0.1, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.advance(now);
    if (!this.paused) animate(this, dt, this.hitStop > 0 ? 0 : dt * store.data.speed);
    render(this);
    this.raf = requestAnimationFrame(this.frame);
  };

  step(dt: number): void {
    for (const k of Object.keys(this.spellCd) as SpellId[]) this.spellCd[k] = Math.max(0, this.spellCd[k] - dt);
    const charge = dt * (1 + (this.syn.ultCd ?? 0));
    for (const t of this.towers) t.ultCd = Math.max(0, t.ultCd - charge);
    if (store.data.autoUlt && this.waveActive && !this.over && (this.autoUltT -= dt) <= 0) { this.autoUltT = 0.5; autoUlts(this); }
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
        spawn(this, sp.id);
        this.spawnT += this.queue[0]?.delay ?? 0;
      }
    }

    updateEnemies(this, dt);
    updateTowers(this, dt);
    updateTurrets(this, dt);
    updateProjs(this, dt);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.max);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.selectedEnemy?.dead) this.selectedEnemy = null;

    if (this.waveActive && !this.queue.length && !this.enemies.length && !this.over) this.waveCleared();
  }

  waveCleared(): void {
    this.waveActive = false;
    const d = store.data;
    const bonus = waveBonus(this.map, this.wave);
    d.gold += bonus;
    this.runGold += bonus;
    if (this.wave !== this.map.waves) showBanner(this, this.endless ? `Infini · vague ${this.endlessWave()} repoussée` : `Vague ${this.wave} repoussée`, `+${fmtShort(bonus)} or`, '#f5c542');
    d.best[this.map.id] = Math.max(d.best[this.map.id] ?? 0, Math.min(this.wave, this.map.waves));
    if (this.endless) d.endless[this.map.id] = Math.max(d.endless[this.map.id] ?? 0, this.endlessWave());
    const heal = this.towers.reduce((n, t) => n + (t.stats.livesPerWave ?? 0), 0) + (this.boons.ward ?? 0) * (BOON_BY_ID.ward.value ?? 0);
    this.lives = Math.min(MAX_LIVES, this.lives + heal);
    persist();
    // Endless mode only: after any wave, a blessing may appear; the run then waits for the player's choice
    if (this.endless && this.endlessWave() > 0 && this.boonCount() < BOON_MAX && Math.random() < BOON_CHANCE) {
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
      // On screen the player chooses what comes next (replay, next map...); only the headless bot loops
      if (d.auto && !this.visual) this.autoT = 3;
    } else if (d.auto) {
      this.autoT = 1;
    }
    this.ev.onChange();
  }

  lose(): void {
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

  // ---------- Public API implemented in sibling modules ----------

  tileAtClient(cx: number, cy: number): { c: number; r: number } | null {
    return tileAtClient(this, cx, cy);
  }

  enemyAtPoint(x: number, y: number): Enemy | null {
    return enemyAtPoint(this, x, y);
  }

  castUlt(t: Tower, at?: { x: number; y: number }): boolean {
    return castUlt(this, t, at);
  }

  requestUlt(t: Tower): void {
    return requestUlt(this, t);
  }

  needsAim(t: Tower): boolean {
    return needsAim(t);
  }

  aimRadius(t: Tower): number {
    return aimRadius(t);
  }
}
