// Drawing what is not a unit: portal, nexus, range rings, banners, the ultimate cut-in, energy bolts.
import { splashImage } from '../art/champArt';
import { FEATURE_INFO } from '../art/mapArt';
import { shade } from '../art/color';
import { drawGlow } from '../art/glow';
import type { FeatureKind } from '../types';
import { CUTIN, H, TILE, W } from './model';
import type { Battle } from './battle';

export function drawTileTip(g: CanvasRenderingContext2D, c: number, r: number, f: FeatureKind): void {
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

export function rangeRing(bt: Battle, g: CanvasRenderingContext2D, x: number, y: number, range: number, color: string): void {
  g.strokeStyle = color;
  g.fillStyle = 'rgba(10,200,185,0.06)';
  g.lineWidth = 2;
  g.setLineDash([8, 6]);
  g.lineDashOffset = -bt.clock * 14;
  g.beginPath();
  g.arc(x, y, range * TILE, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.setLineDash([]);
}

export function drawPortal(bt: Battle, g: CanvasRenderingContext2D, x: number, y: number): void {
  g.save();
  g.translate(x, y);
  const pulse = 1 + Math.sin(bt.clock * 3) * 0.08;
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
    g.rotate(bt.clock * 1.5 + i * 2.1);
    g.beginPath();
    g.arc(0, 0, 13 + i * 4, 0, Math.PI * 0.8);
    g.stroke();
  }
  g.restore();
}

export function drawNexus(bt: Battle, g: CanvasRenderingContext2D, x: number, y: number): void {
  const color = bt.nexusHurt > 0 ? '#ff5a5a' : bt.map.theme.accent;
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
  g.ellipse(0, 6, 26, 8, 0, bt.clock * 2, bt.clock * 2 + Math.PI * 1.3);
  g.stroke();
  g.globalAlpha = 1;
  // Floating hextech crystal
  const fy = Math.sin(bt.clock * 2) * 3 - 12;
  g.shadowColor = color;
  g.shadowBlur = 26 + Math.sin(bt.clock * 4) * 6;
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
export function drawCutin(g: CanvasRenderingContext2D, c: { id: string; name: string; champ: string; color: string; t: number }): void {
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
export function drawBanner(g: CanvasRenderingContext2D, b: { text: string; sub: string; t: number; color: string }): void {
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

/** Jagged bolt of energy between two points; it is redrawn with new kinks every frame, so it crackles. */
export function bolt(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, k: number): void {
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

export function seg(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}
