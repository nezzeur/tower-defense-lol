// Champion balance probe: each champion alone, at the same level, on the same maps. Reports the wave it reaches.
// Usage: npx tsx scripts/champs.ts [level=45] [mapIndex,...=6,13,20]
import { Battle, TILE } from '../src/battle';
import { CHAMPIONS } from '../src/data/champions';
import { COLS, MAPS, ROWS } from '../src/data/maps';
import { computeStats, champ } from '../src/game';
import { store } from '../src/save';

const lvl = Number(process.argv[2] ?? 45);
const maps = (process.argv[3] ?? '6,13,20').split(',').map(Number);

function solo(id: string, mi: number): number {
  const m = MAPS[mi];
  store.data.owned = [id];
  store.data.levels = { [id]: lvl };
  store.data.layouts = {};
  store.data.teams = {};
  store.data.stacks = {};
  store.data.equip = {};
  const b = new Battle(m, { onChange: () => {}, onEnd: () => {} }, true);
  const pts: { x: number; y: number }[] = [];
  for (const lane of [m.path, ...(m.lanes ?? [])]) for (let k = 1; k < lane.length; k++) {
    const [c0, r0] = lane[k - 1], [c1, r1] = lane[k], n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * 3;
    for (let j = 0; j < n; j++) pts.push({ x: (c0 + ((c1 - c0) * j) / n + 0.5) * TILE, y: (r0 + ((r1 - r0) * j) / n + 0.5) * TILE });
  }
  const range = computeStats(champ(id)).range * TILE;
  let best: { c: number; r: number; n: number } | null = null;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (!b.canPlace(c, r)) continue;
    const n = pts.filter((p) => Math.hypot(p.x - (c + 0.5) * TILE, p.y - (r + 0.5) * TILE) <= range).length;
    if (!best || n > best.n) best = { c, r, n };
  }
  if (best) b.place(id, best.c, best.r);
  b.startWave();
  while (!b.over) {
    b.step(1 / 30);
    for (const t of b.towers) if (b.ultReady(t)) b.castUlt(t);
    if (!b.waveActive && !b.over) b.startWave();
  }
  return b.wave;
}

const rows = CHAMPIONS.map((c) => {
  // Average of two tries per map: crits and stuns are random
  const waves = maps.map((mi) => (solo(c.id, mi) + solo(c.id, mi)) / 2);
  return { id: c.id, role: c.role, rarity: c.rarity, how: c.endless ? 'infini' : c.reward ? 'boss' : 'coffre', waves, avg: waves.reduce((a, b) => a + b, 0) / waves.length };
}).sort((a, b) => b.avg - a.avg);
for (const r of rows) console.log(`${r.id.padEnd(12)} ${r.role.padEnd(10)} r${r.rarity} ${r.how.padEnd(6)} ${r.avg.toFixed(1).padStart(5)}  [${r.waves.map((w) => w.toFixed(0)).join(' ')}]`);
