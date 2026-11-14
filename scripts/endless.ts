// Endless-mode probe: a fixed endgame team at a given level, headless, on chosen maps.
// Usage: npx tsx scripts/endless.ts [level=95] [mapIndex,mapIndex,...]   env NOBOON=1 skips blessings, CAP=<waves>
import { Battle, TILE } from '../src/battle';
import { ITEMS } from '../src/data/items';
import { COLS, MAPS, ROWS } from '../src/data/maps';
import { computeStats, champ } from '../src/game';
import { store } from '../src/save';

const lvl = Number(process.argv[2] ?? 95);
const maps = (process.argv[3] ?? '0,10,17,25,34').split(',').map(Number);
const cap = Number(process.env.CAP ?? 300);
const team = ['brand', 'teemo', 'malzahar', 'annie', 'lux', 'ziggs', 'jayce', 'ashe'];
store.data.owned = [...team];
for (const id of team) store.data.levels[id] = lvl;
for (const m of MAPS) store.data.best[m.id] = m.waves;
store.data.items = ITEMS.filter((i) => !i.craft).map((i) => i.id);
['rabadon', 'botrk', 'ie', 'liandry', 'runaan', 'guinsoo', 'rylai', 'mejai'].forEach((it, i) => { store.data.equip[team[i]] = it; });

for (const i of maps) {
  const m = MAPS[i];
  const b = new Battle(m, { onChange: () => {}, onEnd: () => {} }, true);
  for (const t of [...b.towers]) b.remove(t);
  // Greedy placement: each champion on the free tile that covers the most of the lanes
  const pts: { x: number; y: number }[] = [];
  for (const lane of [m.path, ...(m.lanes ?? [])]) for (let k = 1; k < lane.length; k++) {
    const [c0, r0] = lane[k - 1], [c1, r1] = lane[k], n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * 3;
    for (let j = 0; j < n; j++) pts.push({ x: (c0 + ((c1 - c0) * j) / n + 0.5) * TILE, y: (r0 + ((r1 - r0) * j) / n + 0.5) * TILE });
  }
  for (const id of team) {
    const range = computeStats(champ(id)).range * TILE;
    let best: { c: number; r: number; n: number } | null = null;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      if (!b.canPlace(c, r)) continue;
      const n = pts.filter((p) => Math.hypot(p.x - (c + 0.5) * TILE, p.y - (r + 0.5) * TILE) <= range).length;
      if (!best || n > best.n) best = { c, r, n };
    }
    if (best) b.place(id, best.c, best.r);
  }
  b.setMode('endless');
  b.startWave();
  let lost = 0;
  while (!b.over && b.endlessWave() < cap) {
    b.step(1 / 30);
    if (process.env.NOBOON && Object.keys(b.boons).length) { b.boons = {}; b.refreshStats(); }
    for (const t of b.towers) if (b.ultReady(t)) b.castUlt(t);
    if (!b.waveActive && !b.over) { lost = b.livesLost; b.startWave(); }
  }
  const boons = Object.entries(b.boons).map(([k, v]) => `${k}${v}`).join(' ');
  console.log(`${m.name.padEnd(22)} lvl ${lvl} -> ${String(Math.max(0, b.endlessWave() - 1)).padStart(3)} waves  lives ${b.lives} lost ${lost}  [${boons}]`);
}
