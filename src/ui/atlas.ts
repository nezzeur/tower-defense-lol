import { FEATURE_INFO } from '../art/mapArt';
import { buildWorld, NODE_PX, REGION_OF, REGIONS, S, WH, WorldAnim, WW, type Region } from '../art/worldArt';
import { MATERIALS } from '../data/loot';
import { MAPS, MAP_BY_ID } from '../data/maps';
import { matChip } from './inventory';
import { enemyName, isArena, isUnlocked, pct, rewardChance, rewardFor, stars, teamSlots, unlockReason } from '../game';
import { store } from '../save';
import { esc, mapThumb, portrait, starRow, ui } from './common';
import { render } from './index';

let selectedRegion: string | null | undefined;
let worldAnim: WorldAnim | null = null;
let worldRaf = 0;

let worldDataUrl = '';
function worldUrl(): string {
  if (!worldDataUrl) worldDataUrl = buildWorld().base.toDataURL('image/jpeg', 0.9);
  return worldDataUrl;
}

/** Highest unlocked map not yet completed: where the player should go next. */
function currentMap(): string {
  return [...MAPS].reverse().find((m) => isUnlocked(m) && (store.data.best[m.id] ?? 0) < m.waves)?.id ?? MAPS[0].id;
}

function regionStars(r: Region): number {
  return r.maps.reduce((n, id) => n + stars(id), 0);
}

function mapCard(id: string, cur: string): string {
  const m = MAP_BY_ID[id], open = isUnlocked(m), best = store.data.best[m.id] ?? 0, rw = rewardFor(m.id);
  const done = best >= m.waves;
  return `<div class="level-card ${open ? '' : 'locked'} ${id === cur ? 'cur' : ''}" style="--a:${m.theme.accent}">
    <div class="level-thumb">${mapThumb(id)}${open ? '' : '<div class="lock-veil">🔒</div>'}${id === cur ? '<span class="cur-tag">En cours</span>' : ''}${isArena(m) ? '<span class="arena-tag">⚔ Arène</span>' : ''}</div>
    <div class="level-body">
      <div class="level-title"><b>${esc(m.name)}</b>${done ? '<span class="done">✔</span>' : ''}</div>
      <div class="muted small">${esc(m.subtitle)}</div>
      <div class="feat-icons">${(m.lanes?.length ? '<span title="Plusieurs voies">⇉</span>' : '') + [...new Set((m.features ?? []).map((f) => f.kind))].map((k) => `<span title="${esc(FEATURE_INFO[k].name)}">${FEATURE_INFO[k].icon}</span>`).join('')}</div>
      ${open ? `${starRow(stars(m.id))}<div class="small">Record <b>${best}</b>/${m.waves} · Boss : ${esc(enemyName(m.finalBoss))}</div>`
        : `<div class="lock small">🔒 ${esc(unlockReason(m) ?? '')}</div>`}
      <div class="level-foot">
        ${rw ? `<span class="reward-chip" title="Chance que le boss final lâche ce champion à chaque victoire.">${portrait(rw, 22, !store.data.owned.includes(rw.id))}${store.data.owned.includes(rw.id) ? esc(rw.name) : `Butin du boss · ${pct(rewardChance(m.id))}`}</span>` : '<span></span>'}
        <button class="btn start" data-map="${id}" ${open ? '' : 'disabled'}>Jouer ▶</button>
      </div>
    </div>
  </div>`;
}

export function mapsScreen(): string {
  const cur = currentMap();
  if (selectedRegion === undefined) selectedRegion = REGION_OF[cur];
  const firstMap = (r: Region) => Math.min(...r.maps.map((id) => MAPS.findIndex((m) => m.id === id)));
  const playable = REGIONS.filter((r) => r.maps.length).sort((a, b) => firstMap(a) - firstMap(b));
  const anyOpen = (r: Region) => r.maps.some((id) => isUnlocked(MAP_BY_ID[id]));
  const segs = MAPS.slice(1).map((to, i) => {
    const a = NODE_PX[MAPS[i].id], b = NODE_PX[to.id];
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${isUnlocked(to) ? 'open' : ''}"/>`;
  }).join('');
  const nodes = MAPS.map((m) => {
    const open = isUnlocked(m), done = (store.data.best[m.id] ?? 0) >= m.waves, n = NODE_PX[m.id];
    return `<button class="node ${open ? '' : 'locked'} ${done ? 'done' : ''} ${m.id === cur ? 'cur' : ''}"
      data-region="${REGION_OF[m.id]}" style="left:${(n.x / WW) * 100}%;top:${(n.y / WH) * 100}%;--a:${m.theme.accent}" title="${esc(m.name)}">
      <span class="pin">${open ? (done ? '★' : MAPS.filter((x) => x.region === m.region).indexOf(m) + 1) : '🔒'}</span><span class="label">${esc(m.name)}</span></button>`;
  }).join('');
  const labels = REGIONS.map((r) => `<div class="region-label ${r.maps.length ? '' : 'deco'} ${r.id === selectedRegion ? 'on' : ''}"
    style="left:${(r.lx / WW) * 100}%;top:${(r.ly / WH) * 100}%;--c:${r.color}">${esc(r.name)}</div>`).join('');

  const reg = REGIONS.find((r) => r.id === selectedRegion);
  const panel = reg
    ? `<div class="region-head" style="--c:${reg.color}">
        <button class="btn small-btn" data-region="">← Vue d'ensemble</button>
        <h2>${esc(reg.name)}</h2><p class="muted">${esc(reg.desc)}</p>
        <div class="progress"><div style="width:${(regionStars(reg) / (reg.maps.length * 5)) * 100}%"></div></div>
        <div class="small">${regionStars(reg)} / ${reg.maps.length * 5} ★</div>
        <div class="small muted" style="margin-top:8px">Butin propre à la région</div>
        <div class="mat-row">${MATERIALS.filter((m) => m.region === reg.id).map((m) => matChip(m, String(store.data.mats[m.id] ?? 0))).join('')}</div>
      </div>
      <div class="level-list">${reg.maps.map((id) => mapCard(id, cur)).join('')}</div>`
    : `<div class="region-head"><h2>Runeterra</h2><p class="muted">Choisis une région à explorer.</p></div>
      <div class="region-list">${playable.map((r) => `
        <button class="region-card ${anyOpen(r) ? '' : 'locked'}" data-region="${r.id}" style="--c:${r.color}">
          <b>${esc(r.name)}</b><span class="small muted">${r.maps.length} carte(s) · ${regionStars(r)}/${r.maps.length * 5} ★</span>
          <div class="progress"><div style="width:${(regionStars(r) / (r.maps.length * 5)) * 100}%"></div></div>
          ${r.maps.includes(cur) ? '<span class="cur-tag">Objectif actuel</span>' : ''}
        </button>`).join('')}</div>`;

  return `<div class="atlas">
    <div class="world" id="world">
      <div class="cam" id="cam">
        <img class="world-img" src="${worldUrl()}" alt="">
        <canvas class="world-anim" id="world-anim" width="${WW * S}" height="${WH * S}"></canvas>
        <svg class="routes" viewBox="0 0 ${WW} ${WH}" preserveAspectRatio="none">${segs}</svg>
        ${labels}${nodes}
      </div>
      <div class="world-hud"><span>★ ${stars()}</span><span>${teamSlots()} emplacements</span></div>
    </div>
    <aside class="panel region-panel">${panel}</aside>
  </div>`;
}

/** Starts the animated layer and frames the camera on the selected region. */
export function mountWorld(): void {
  const world = buildWorld();
  const canvas = document.getElementById('world-anim') as HTMLCanvasElement | null;
  if (!canvas) return;
  if (!worldAnim) worldAnim = new WorldAnim(world);
  const g = canvas.getContext('2d')!;
  const nodes = MAPS.map((m) => ({ ...NODE_PX[m.id], color: m.theme.accent, open: isUnlocked(m) }));
  cancelAnimationFrame(worldRaf);
  let last = performance.now();
  const loop = (now: number) => {
    if (!canvas.isConnected) return;
    worldAnim!.update(Math.min(0.1, (now - last) / 1000));
    last = now;
    worldAnim!.draw(g, now / 1000, selectedRegion ?? null, nodes);
    worldRaf = requestAnimationFrame(loop);
  };
  worldRaf = requestAnimationFrame(loop);
  document.getElementById('world')!.addEventListener('click', worldClick);
  frameCamera(false);
}

export function selectRegion(id: string | null): void {
  selectedRegion = id;
  const panel = document.querySelector('.region-panel');
  if (!panel) return render();
  // Swap the panel and glide the camera without rebuilding the world
  const tmp = document.createElement('div');
  tmp.innerHTML = mapsScreen();
  panel.replaceWith(tmp.querySelector('.region-panel')!);
  document.querySelectorAll('.region-label').forEach((l, i) => l.classList.toggle('on', REGIONS[i].id === selectedRegion));
  frameCamera(true);
}

/** Clicking land on the world map selects that region (playable ones only). */
function worldClick(e: MouseEvent): void {
  const cam = document.getElementById('cam');
  if (!cam || (e.target as HTMLElement).closest('button')) return;
  const r = cam.getBoundingClientRect();
  const x = Math.floor(((e.clientX - r.left) / r.width) * WW), y = Math.floor(((e.clientY - r.top) / r.height) * WH);
  const id = buildWorld().mask[y * WW + x];
  const reg = id ? REGIONS[id - 1] : null;
  if (reg?.maps.length) selectRegion(reg.id);
  else if (!id) selectRegion(null);
}

window.addEventListener('resize', () => { if (ui.screen === 'maps') frameCamera(false); });

function frameCamera(animate = true): void {
  const box = document.getElementById('world'), cam = document.getElementById('cam');
  if (!box || !cam) return;
  const i = REGIONS.findIndex((r) => r.id === selectedRegion);
  const W0 = box.clientWidth, H0 = box.clientHeight, k = W0 / WW;
  let s = 1, tx = 0, ty = 0;
  if (i >= 0) {
    const bb = buildWorld().bbox[i];
    const bw = (bb.x1 - bb.x0 + 40) * k, bh = (bb.y1 - bb.y0 + 40) * k;
    s = Math.min(2.4, Math.max(1.2, Math.min(W0 / bw, H0 / bh)));
    const cx = ((bb.x0 + bb.x1) / 2) * k, cy = ((bb.y0 + bb.y1) / 2) * k;
    tx = Math.min(0, Math.max(W0 - W0 * s, W0 / 2 - cx * s));
    ty = Math.min(0, Math.max(H0 - H0 * s, H0 / 2 - cy * s));
  }
  cam.style.transition = animate ? '' : 'none';
  cam.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  cam.style.setProperty('--inv', String(1 / s));
}

