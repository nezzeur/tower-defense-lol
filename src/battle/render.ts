// The frame: visual-only animation state (poses, weather, lights) and the order everything is drawn in.
import { squareImage } from '../art/champArt';
import { LH, LW, spawnMote } from '../art/mapArt';
import { angDiff, drawGlow } from '../art/glow';
import { drawShot, hasTrail, heroLook, impactColors, lightColor, SHOT_ARC, type Shot } from '../art/heroes';
import { champ } from '../game';
import { store } from '../save';
import type { MapDef } from '../types';
import { CUTIN, type Enemy, H, type Proj, LAND, TILE, type Tower, W } from './model';
import { aimRadius } from './ultimates';
import type { Battle } from './battle';
import { drawEnemy, drawTower } from './units';
import { drawTileTip, rangeRing, drawPortal, drawNexus, drawCutin, drawBanner, bolt, seg } from './scenery';

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

/** Attack beat a champion should be showing right now: 0 at rest, -1 wound back, +1 follow-through. */
export function swingOf(t: Tower): number {
  const per = t.period, strike = Math.min(0.09, per * 0.18), rec = Math.min(0.3, per * 0.36), wind = Math.min(0.26, per * 0.42);
  if (t.since < strike) { const k = t.since / strike; return -1 + 2 * (1 - (1 - k) * (1 - k)); }
  if (t.since < strike + rec) { const k = (t.since - strike) / rec; return 1 - k * k * (3 - 2 * k); }
  if (t.engaged && t.cd > 0 && t.cd < wind) { const k = 1 - t.cd / wind; return -(1 - (1 - k) * (1 - k)); }
  return 0;
}

/** Closest living enemy within `dist` pixels of a champion (visual use only). */
export function nearest(bt: Battle, t: Tower, dist: number): Enemy | null {
  let best: Enemy | null = null, bd = dist;
  for (const e of bt.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - t.x, e.y - t.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/** How a projectile is drawn: lobbed shots rise above the straight line and tilt along their arc. */
export function shotPose(p: Proj, shot: Shot): { lift: number; ang: number } {
  const dx = p.target.x - p.x, dy = p.target.y - p.y;
  const ang = Math.atan2(dy, dx);
  const arc = SHOT_ARC[shot];
  if (!arc || p.d0 < 1) return { lift: 0, ang };
  const prog = Math.min(1, Math.max(0, 1 - Math.hypot(dx, dy) / p.d0));
  const tilt = Math.atan(Math.PI * arc * Math.cos(prog * Math.PI)) * (Math.cos(ang) >= 0 ? 1 : -1);
  return { lift: Math.sin(prog * Math.PI) * p.d0 * arc, ang: ang - tilt };
}

/** Advances visual-only state: real dt for ambience and poses, game dt for anything tied to the fight. */
export function animate(bt: Battle, dt: number, gameDt: number): void {
  const v = bt.vfx!;
  v.low = store.data.lowFx;
  bt.clock += dt;
  bt.shake = Math.max(0, bt.shake - dt * 30);
  bt.dim = Math.max(0, bt.dim - dt * 1.5);
  bt.nexusHurt = Math.max(0, bt.nexusHurt - dt);
  if (bt.banner) { bt.banner.t += dt; if (bt.banner.t > 2) bt.banner = null; }
  if (bt.cutin) { bt.cutin.t += dt; if (bt.cutin.t > CUTIN) bt.cutin = null; }

  // Champions: keep facing the current target, ease the attack pose, land with a puff of dust
  for (const t of bt.towers) {
    t.since += gameDt;
    t.ultT += dt;
    const before = t.born;
    t.born += dt;
    if (before < LAND && t.born >= LAND) {
      v.smoke(t.x, t.y + 15, 5, 6, '#b9b2a3');
      bt.fx.push({ kind: 'ring', x: t.x, y: t.y + 13, r: 26, t: 0, max: 0.3, color: '#f0e6d2' });
    }
    if (t.tgt?.dead) t.tgt = null;
    // Between targets the champion watches the nearest monster coming its way, so its first blow is already aimed
    const watch = t.tgt ?? nearest(bt, t, t.stats.range * 1.7 * TILE);
    const want = watch ? Math.atan2(watch.y - (t.y - 10), watch.x - t.x) : t.angle;
    t.aim += angDiff(t.aim, want) * Math.min(1, dt * (t.since < 0.08 ? 40 : 14));
    const c = Math.cos(t.aim);
    if (Math.abs(c) > 0.18) t.face = c > 0 ? 1 : -1;
    t.sw += (swingOf(t) - t.sw) * Math.min(1, dt * 45);
  }
  // Monsters recover from the last shove
  const settle = Math.exp(-dt * 13), unsquash = Math.exp(-dt * 11);
  for (const e of bt.enemies) {
    e.born += gameDt;
    e.healed = Math.max(0, e.healed - gameDt);
    e.kx *= settle;
    e.ky *= settle;
    e.sq *= unsquash;
  }
  // Projectiles leave a little of their element behind
  if (gameDt > 0) {
    for (const p of bt.projs) {
      const look = heroLook(p.tower.def.id, p.tower.def.role);
      v.trail(look.element, look.shot, p.tower.def.color, p.x, p.y - shotPose(p, look.shot).lift);
    }
  }
  v.update(dt, gameDt);

  const style = bt.map.theme.style;
  // Weather: heavy snow in the Freljord, petals in Ionia, embers in Noxus
  const amb = AMBIENT[style] ?? AMBIENT_DEFAULT;
  const cap = v.low ? 30 : amb.motes;
  for (let i = 0; i < 2; i++) if (bt.motes.length < cap && Math.random() < amb.rate) bt.motes.push(spawnMote(style));
  for (const m of bt.motes) {
    m.life += dt;
    m.x += m.vx * dt + (style === 'rift' || style === 'tundra' ? Math.sin(m.life * 2) * 0.1 : 0);
    m.y += m.vy * dt;
  }
  bt.motes = bt.motes.filter((m) => m.life < m.max && m.x > -5 && m.x < LW + 5 && m.y > -5 && m.y < LH + 5);
}

export function render(bt: Battle): void {
  const g = bt.ctx, v = bt.vfx!;
  g.save();
  if (bt.shake > 0.05 && !bt.calm) {
    // Smooth pseudo-noise rather than white noise: it reads as a jolt, not as flicker
    const c = bt.clock, amp = bt.shake * 1.5;
    g.translate(Math.sin(c * 71) * Math.cos(c * 37) * amp, Math.cos(c * 83) * Math.sin(c * 29) * amp);
  }
  g.clearRect(-20, -20, W + 40, H + 40);
  g.drawImage(bt.bg, 0, 0, W, H);
  if (bt.dim > 0.01) {
    // The ground darkens during an ultimate or a boss death; units stay bright on top of it
    g.fillStyle = '#01080f';
    g.globalAlpha = 0.45 * bt.dim;
    g.fillRect(-20, -20, W + 40, H + 40);
    g.globalAlpha = 1;
  }
  // Water glints: little stars of light blinking on rivers and lakes
  const style = bt.map.theme.style, amb = AMBIENT[style] ?? AMBIENT_DEFAULT;
  if (!v.low && bt.waterTiles.length) {
    g.fillStyle = style === 'noxus' ? '#ffd27a' : '#ffffff';
    bt.waterTiles.forEach((w, i) => {
      const a = Math.sin(bt.clock * 1.7 + i * 2.4);
      if (a < 0.5) return;
      const k = (a - 0.5) / 0.5, x = w.x + Math.sin(i * 12.9) * 17, y = w.y + Math.cos(i * 7.3) * 15;
      g.globalAlpha = k * 0.85;
      g.fillRect(x - 6 * k, y - 0.7, 12 * k, 1.4);
      g.fillRect(x - 0.7, y - 3 * k, 1.4, 6 * k);
    });
    g.globalAlpha = 1;
  }
  v.drawDecals(g);

  const start = bt.pts[0], end = bt.pts[bt.pts.length - 1];
  const px = Math.min(W - 20, Math.max(20, start.x)), py = Math.min(H - 20, Math.max(20, start.y));
  drawPortal(bt, g, px, py);

  // Placement preview
  if (bt.hover && (bt.selectedRoster || bt.dragging)) {
    const { c, r } = bt.hover;
    const id = bt.selectedRoster ?? bt.dragging!.def.id;
    const onBoard = bt.towers.some((t) => t.def.id === id);
    const ok = bt.canPlace(c, r) && (onBoard || bt.slotsLeft() > 0);
    g.fillStyle = ok ? 'rgba(10,200,185,0.22)' : 'rgba(255,60,60,0.28)';
    g.strokeStyle = ok ? 'rgba(10,200,185,0.8)' : 'rgba(255,80,80,0.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(c * TILE + 3, r * TILE + 3, TILE - 6, TILE - 6, 6);
    g.fill();
    g.stroke();
    if (ok) {
      rangeRing(bt, g, (c + 0.5) * TILE, (r + 0.5) * TILE, bt.statsAt(champ(id), c, r).range, 'rgba(10,200,185,0.7)');
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
  if (bt.aiming && bt.mouse) {
    // Aiming an ultimate: its area follows the pointer
    const t = bt.aiming, r = aimRadius(t), m = bt.mouse, pulse = 1 + Math.sin(bt.clock * 6) * 0.03;
    g.globalCompositeOperation = 'lighter';
    drawGlow(g, m.x, m.y, r * 1.15, t.def.color, 0.3);
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = t.def.color;
    g.lineWidth = 2.5;
    g.setLineDash([10, 7]);
    g.lineDashOffset = -bt.clock * 26;
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
  if (bt.selectedTower && !bt.dragging) rangeRing(bt, g, bt.selectedTower.x, bt.selectedTower.y, bt.selectedTower.stats.range, 'rgba(240,230,210,0.85)');

  // Everything standing on the board, back to front
  const units: { y: number; draw: () => void }[] = [
    ...bt.enemies.map((e) => ({ y: e.y, draw: () => drawEnemy(bt, g, e) })),
    ...v.corpses.map((c) => ({ y: c.y - 15, draw: () => v.drawCorpse(g, c, bt.clock) })),
    ...bt.towers.map((t) => ({ y: t.y, draw: () => { if (t === bt.dragging) g.globalAlpha = 0.35; drawTower(bt, g, t); g.globalAlpha = 1; } })),
    { y: end.y, draw: () => drawNexus(bt, g, end.x, end.y) },
  ];
  units.sort((a, b) => a.y - b.y).forEach((u) => u.draw());

  // Projectiles: one shape per champion (arrow, bullet, orb, rocket...), soft trail for the glowing ones
  g.lineCap = 'round';
  for (const p of bt.projs) {
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
    const pose = shotPose(p, look.shot);
    drawShot(g, look, col, p.x, p.y, pose.ang, bt.clock, pose.lift);
  }

  // Beams, shockwaves and blasts
  for (const f of bt.fx) {
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
          const q = i / 48, o = Math.sin(q * 20 - bt.clock * 34) * sgn * (3 + 5 * wdt) * Math.sin(q * Math.PI);
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
        const rr = R * (0.28 + i * 0.115), sp = (i % 2 ? 1 : -0.7) * (3.2 + i * 0.5), a0 = i * 2.4 + bt.clock * sp;
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
      const x = ((bt.clock * amb.wind + i * 470) % (W + 640)) - 320;
      drawGlow(g, x, H * (0.18 + 0.32 * i) + Math.sin(bt.clock * 0.2 + i) * 30, 270, amb.cloud, amb.cloudA, 140);
    }
  }

  // Light pass: everything that glows brightens the ground and whoever stands next to it
  if (!v.low) {
    g.globalCompositeOperation = 'screen';
    const c = bt.clock;
    bt.mapLights.forEach((l, i) => {
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
    for (const p of bt.projs) {
      const look = heroLook(p.tower.def.id, p.tower.def.role);
      if (look.shot === 'slash') continue;
      drawGlow(g, p.x, p.y, look.shot === 'bullet' ? 16 : 26, lightColor(look.element, p.tower.def.color), 0.5);
    }
    for (const e of bt.enemies) {
      if (e.burns.length) drawGlow(g, e.x, e.y - 6, 24 + Math.sin(bt.clock * 23 + e.uid) * 4, '#ff8a3d', 0.32);
    }
    for (const t of bt.towers) {
      if (t.ultCd <= 0) drawGlow(g, t.x, t.y + 10, 32, '#ffd84a', 0.24 + Math.sin(bt.clock * 6) * 0.08);
    }
    drawGlow(g, end.x, end.y - 12, 62 + Math.sin(bt.clock * 2) * 6, bt.nexusHurt > 0 ? '#ff5a5a' : bt.map.theme.accent, 0.4);
    drawGlow(g, px, py, 48 + Math.sin(bt.clock * 3) * 4, '#ff5a5a', 0.32);
    v.drawLights(g);
    g.globalCompositeOperation = 'source-over';
  }

  // Ambient motes (spawned in low-res space, drawn x3)
  for (const m of bt.motes) {
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
  for (const f of bt.fx) {
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
  if (bt.cutin) drawCutin(g, bt.cutin);
  if (bt.banner) drawBanner(g, bt.banner);
  if (bt.hover) {
    const f = bt.featureAt(bt.hover.c, bt.hover.r);
    if (f) drawTileTip(g, bt.hover.c, bt.hover.r, f);
  }
}
