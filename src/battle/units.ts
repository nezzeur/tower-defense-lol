// Drawing the units on the board: monsters with their status marks, champions with their badges.
import { mobImage } from '../art/mobArt';
import { squareImage } from '../art/champArt';
import { CREATURE_HEIGHT, drawCreature } from '../art/creatures';
import { drawGlow } from '../art/glow';
import { drawHero, HERO_HEAD, heroLook } from '../art/heroes';
import { level, ultRank } from '../game';
import { type Enemy, SPAWN, TILE, type Tower, initials } from './model';
import { burst } from './effects';
import type { Battle } from './battle';

export function drawEnemy(bt: Battle, g: CanvasRenderingContext2D, e: Enemy): void {
  const d = e.def;
  const fly = !!d.fly || d.id.startsWith('drake') || d.id === 'fallenking' || d.id === 'spiritguard';
  const epic = d.shape === 'boss';
  const h = (CREATURE_HEIGHT[d.id] ?? 16) * 3, w = h * 0.9;
  // Drawn where the last blow shoved it; the simulation keeps the true position
  const x = e.x + e.kx, gy = e.y + 15 + e.ky;
  // Flyers hover above the lane; their shadow stays on the ground
  const lift = d.fly ? 14 + Math.sin(bt.clock * 4 + e.uid) * 3 : 0;
  const y = gy - lift;
  const moving = e.stunT <= 0;
  const ph = moving ? e.phase : 0;
  // Steps out of the portal: grows and fades in over the first moments
  const born = Math.min(1, e.born / 0.3), grow = 0.55 + 0.45 * (1 - (1 - born) * (1 - born));
  if (epic) {
    // Epic monsters and bosses carry an aura of their own colour
    g.globalCompositeOperation = 'screen';
    drawGlow(g, x, y - h / 2, w * (d.boss ? 0.85 : 0.7), d.color, (d.boss ? 0.45 : 0.3) + Math.sin(bt.clock * 3) * 0.08);
    g.globalCompositeOperation = 'source-over';
  }
  if (d.heal) {
    // Healing field: a soft green circle that pulses outward
    const hr = d.heal.radius * TILE, pulse = (bt.clock * 0.7 + e.uid * 0.37) % 1;
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
  if (e === bt.selectedEnemy) {
    const pulse = 1 + Math.sin(bt.clock * 5) * 0.06;
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
  const breathe = 1 + Math.sin(bt.clock * 2.6 + e.uid) * 0.012;
  g.scale((1 + e.sq * 0.14) * grow * (fly ? 1 + Math.sin(bt.clock * 13 + e.uid) * 0.03 : 1), (1 - e.sq * 0.16) * grow * breathe);
  if (born < 1) g.globalAlpha *= born;
  if (e.phaseT > 0) g.globalAlpha *= 0.35 + Math.sin(bt.clock * 18) * 0.1;
  if (custom) {
    const ih = h, iw = (custom.naturalWidth / custom.naturalHeight) * ih;
    if (e.hitFlash > 0) g.filter = 'brightness(2.2)';
    if (e.face < 0) g.scale(-1, 1);
    g.drawImage(custom, -iw / 2, -ih, iw, ih);
  } else {
    drawCreature(g, d.id, 0, 0, e.face, ph, bt.clock, d.color, e.hitFlash > 0, 3);
  }
  g.restore();
  if (e.chargeT > 0 || e.hasteT > 0) {
    // Rushing: streaks of wind trail behind
    g.strokeStyle = e.chargeT > 0 ? '#ffffff' : '#bfe9ff';
    g.lineWidth = 2;
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const ly = y - h * (0.15 + i * 0.2), off = ((bt.clock * 9 + i * 0.37) % 1) * 22;
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
    if (Math.random() < 0.12) bt.vfx?.embers(x, y - h * 0.4, 1, '#6be08a', '#d8ffe0', w * 0.3);
  }
  if (e.shield > 0) {
    // Shield: a bubble of light around the monster
    const pulse = 1 + Math.sin(bt.clock * 4 + e.uid) * 0.04;
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
      const a = bt.clock * 5 + (i * Math.PI * 2) / 3;
      g.beginPath();
      g.arc(x + Math.cos(a) * 12, y - h - 8 + Math.sin(a) * 3, 2.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (e.burns.length && Math.random() < 0.35) burst(bt, x + (Math.random() - 0.5) * w * 0.6, y - h * 0.5, Math.random() < 0.5 ? '#ffb347' : '#ff5a2a', 1, 34, 2);
  // Health bar: dark frame coloured by tier, gradient fill, segments
  const bw = Math.max(30, Math.min(110, w * 0.95)), pct = Math.max(0, Math.min(1, e.hp / e.maxHp));
  // Tall monsters near the top edge keep their bar (and the pips above it) inside the board
  const by = Math.max(16, y - h - 11);
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

export function drawTower(bt: Battle, g: CanvasRenderingContext2D, t: Tower): void {
  const lvl = level(t.def.id), rank = ultRank(lvl);
  const sel = t === bt.selectedTower;
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
    g.shadowBlur = 8 + Math.sin(bt.clock * 6) * 4;
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
    g.lineDashOffset = -bt.clock * 20;
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
    clock: bt.clock, seed: t.c * 1.7 + t.r,
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
