// Pointer input on the board: picking tiles and monsters, press-and-drag to move a champion, aimed ultimates.
import { CREATURE_HEIGHT } from '../art/creatures';
import { type Enemy, H, TILE, type Tower, W } from './model';
import { castUlt } from './ultimates';
import type { Battle } from './battle';

/** Tile under a client point, or null outside the board. */
export function tileAtClient(bt: Battle, cx: number, cy: number): { c: number; r: number } | null {
  const rect = bt.canvas.getBoundingClientRect();
  if (cx < rect.left || cy < rect.top || cx > rect.right || cy > rect.bottom) return null;
  const x = ((cx - rect.left) / rect.width) * W;
  const y = ((cy - rect.top) / rect.height) * H;
  return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
}

/** Canvas-space point under a client point (no bounds check). */
export function pointAtClient(bt: Battle, cx: number, cy: number): { x: number; y: number } {
  const rect = bt.canvas.getBoundingClientRect();
  return { x: ((cx - rect.left) / rect.width) * W, y: ((cy - rect.top) / rect.height) * H };
}

/** Front-most living enemy whose sprite covers a canvas point. */
export function enemyAtPoint(bt: Battle, x: number, y: number): Enemy | null {
  let best: Enemy | null = null;
  for (const e of bt.enemies) {
    if (e.dead) continue;
    const h = Math.max(30, (CREATURE_HEIGHT[e.def.id] ?? 16) * 3), w = Math.max(30, h * 0.9), base = e.y + 15;
    if (Math.abs(x - e.x) <= w / 2 && y >= base - h && y <= base + 8 && (!best || e.y > best.y)) best = e;
  }
  return best;
}

export function bindInput(bt: Battle): void {
  let drag: { t: Tower; x: number; y: number } | null = null;
  const cv = bt.canvas;
  const cursor = () => {
    const t = bt.hover && bt.towers.find((x) => x.c === bt.hover!.c && x.r === bt.hover!.r);
    cv.style.cursor = bt.aiming ? 'crosshair' : bt.dragging ? 'grabbing' : t ? 'grab' : bt.selectedRoster ? 'copy' : 'default';
  };
  cv.addEventListener('pointermove', (e) => {
    bt.hover = tileAtClient(bt, e.clientX, e.clientY);
    bt.mouse = pointAtClient(bt, e.clientX, e.clientY);
    if (drag && !bt.dragging && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
      bt.dragging = drag.t;
      bt.selectedTower = drag.t;
      bt.selectedEnemy = null;
      bt.ev.onChange();
    }
    cursor();
  });
  cv.addEventListener('pointerleave', () => { if (!bt.dragging) bt.hover = null; cv.style.cursor = 'default'; });
  cv.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const tile = tileAtClient(bt, e.clientX, e.clientY);
    const t = tile && bt.towers.find((x) => x.c === tile.c && x.r === tile.r);
    if (t) {
      drag = { t, x: e.clientX, y: e.clientY };
      cv.setPointerCapture(e.pointerId);
    }
  });
  cv.addEventListener('pointerup', (e) => {
    if (bt.dragging) {
      const tile = tileAtClient(bt, e.clientX, e.clientY);
      if (tile) bt.moveTower(bt.dragging, tile.c, tile.r);
      bt.selectedTower = bt.dragging;
      bt.dragging = null;
      bt.ev.onChange();
    } else {
      clickTile(bt, e);
    }
    drag = null;
    cursor();
  });
  cv.addEventListener('pointercancel', () => { drag = null; bt.dragging = null; cursor(); bt.ev.onChange(); });
  cv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    bt.aiming = null;
    bt.selectedRoster = null;
    bt.selectedTower = null;
    bt.selectedEnemy = null;
    bt.ev.onChange();
  });
}

/** Click: select a champion, place the one picked in the team bar, or clear the selection. */
export function clickTile(bt: Battle, e: PointerEvent): void {
  if (e.button !== 0) return;
  const tile = tileAtClient(bt, e.clientX, e.clientY);
  if (!tile) return;
  if (bt.aiming) {
    // Aimed ultimate: it lands where the player clicked
    // (stays armed when there is nothing on the board to hit yet)
    if (castUlt(bt, bt.aiming, pointAtClient(bt, e.clientX, e.clientY))) bt.aiming = null;
    bt.ev.onChange();
    return;
  }
  const { c, r } = tile;
  const hit = bt.towers.find((t) => t.c === c && t.r === r);
  if (bt.selectedRoster && !hit) {
    bt.dropChampion(bt.selectedRoster, c, r);
    return;
  }
  const pt = pointAtClient(bt, e.clientX, e.clientY);
  const foe = hit ? null : enemyAtPoint(bt, pt.x, pt.y);
  bt.selectedTower = hit ?? null;
  bt.selectedEnemy = foe;
  bt.selectedRoster = null;
  bt.ev.onChange();
}
