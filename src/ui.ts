import { abilityIcons, itemIconUrl, loadingUrl, splashUrl, squareUrl } from './art/champArt';
import { CREATURE_HEIGHT, drawCreature } from './art/creatures';
import { ENEMIES } from './data/enemies';
import { FEATURE_INFO } from './art/mapArt';
import { drawMapHD } from './art/mapHD';
import { buildWorld, NODE_PX, REGION_OF, REGIONS, S, WH, WorldAnim, WW, type Region } from './art/worldArt';
import { Battle, initials, SPELLS, type SpellId, type Tower } from './battle';
import { CHAMPIONS } from './data/champions';
import { ITEMS, ITEM_BY_ID } from './data/items';
import { MAPS, MAP_BY_ID } from './data/maps';
import {
  champ, CHEST_CHOICES, isArena, unlockReason, chestPool, chestPrice, claimChest, EPIC_PITY, computeStats, enemyName, fmt, isUnlocked, level, levelCost, MAX_LEVEL, openChest,
  rewardFor, stars, teamSlots, tryLevelUp, ULT_LEVELS, ultRank,
} from './game';
import { exportSave, importSave, persist, resetSave, store } from './save';
import type { ChampionDef, MapDef, Stats } from './types';

type Screen = 'maps' | 'champions' | 'shop' | 'options' | 'battle';

const app = document.getElementById('app')!;
let screen: Screen = 'maps';
let battle: Battle | null = null;
let tick = 0;
let selectedChamp: string | null = null;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function portrait(def: ChampionDef, size = 44, locked = false): string {
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.34)}px;`
    + (locked ? '' : `background:${def.color};`);
  const img = locked ? '' : `<img src="${squareUrl(def.id)}" alt="" loading="lazy" onerror="this.remove()">`;
  return `<div class="portrait ${locked ? 'locked' : ''} r${def.rarity}" style="${style}"><span>${locked ? '?' : initials(def.name)}</span>${img}</div>`;
}

/** Tall card with the champion's loading-screen art. */
function artCard(def: ChampionDef, attrs: string, body: string, delay = 0): string {
  return `<button class="art-card r${def.rarity}" ${attrs} style="--d:${delay}ms;--c:${def.color}">
    <div class="art-img" style="background-image:url('${loadingUrl(def.id)}')"></div>
    <div class="art-body">${body}</div></button>`;
}

const previews = new Map<string, string>();
function mapPreview(id: string): string {
  let url = previews.get(id);
  if (!url) {
    const m = MAP_BY_ID[id];
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 288;
    const g = c.getContext('2d')!;
    g.scale(0.5, 0.5);
    drawMapHD(g, m, 960, 576, 48);
    url = c.toDataURL('image/jpeg', 0.85);
    previews.set(id, url);
  }
  return url;
}

function starRow(n: number, max = 5): string {
  return `<span class="stars">${'★'.repeat(n)}<span class="dim">${'★'.repeat(max - n)}</span></span>`;
}

export function statLines(s: Stats): string[] {
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const L = [
    `Dégâts <b>${fmt(s.dmg)}</b>`,
    `Vitesse <b>${s.rate.toFixed(2)}/s</b>`,
    `Portée <b>${s.range.toFixed(1)}</b>`,
  ];
  const typeName = { single: 'Cible unique', splash: `Zone (${s.splash.toFixed(1)})`, pierce: 'Rayon traversant',
    aura: 'Aura', multi: `${s.targets} cibles`, chain: `Rebond x${s.targets}` }[s.type];
  L.push(`Type <b>${typeName}</b>`);
  if (s.slow) L.push(`Ralentit <b>${pct(s.slow.pct)}</b>`);
  if (s.stun) L.push(`Étourdit <b>${pct(s.stun.chance)}</b> (${s.stun.dur}s)`);
  if (s.burn) L.push(`Brûlure <b>${fmt(s.dmg * s.burn.mult)}/s</b> (${s.burn.dur}s)`);
  if (s.crit) L.push(`Critique <b>${pct(s.crit.chance)}</b> x${s.crit.mult.toFixed(1)}`);
  if (s.everyN) L.push(`Tous les ${s.everyN.n} coups <b>x${s.everyN.mult.toFixed(1)}</b>`);
  if (s.pctHp) L.push(`<b>${(s.pctHp.pct * 100).toFixed(1)} %</b> PV max / ${s.pctHp.every} coup(s)`);
  if (s.goldHit) L.push(`Or par coup <b>${pct(s.goldHit.chance)}</b>`);
  if (s.killGold) L.push(`Or sur élim. <b>+${pct(s.killGold)}</b>`);
  if (s.livesPerWave) L.push(`Vies/vague <b>+${s.livesPerWave}</b>`);
  if (s.ramp) L.push(`Montée en puissance <b>+${pct(s.ramp.max)}</b>`);
  if (s.bossMult) L.push(`Contre boss <b>x${s.bossMult.toFixed(2)}</b>`);
  if (s.killStack) L.push(`Cumul/élim. <b>+${s.killStack.amount.toFixed(2)}</b>${s.killStack.persistent ? ' (permanent)' : ''}`);
  return L;
}

function itemSelect(def: ChampionDef): string {
  const cur = store.data.equip[def.id] ?? '';
  const opts = store.data.items.map((id) => {
    const holder = Object.entries(store.data.equip).find(([, it]) => it === id)?.[0];
    const note = holder && holder !== def.id ? ` (sur ${champ(holder).name})` : '';
    return `<option value="${id}" ${id === cur ? 'selected' : ''}>${ITEM_BY_ID[id].icon} ${esc(ITEM_BY_ID[id].name)}${esc(note)}</option>`;
  }).join('');
  return `<label class="item-sel">Objet
    <select data-equip="${def.id}"><option value="">— Aucun —</option>${opts}</select></label>`;
}

function equip(champId: string, itemId: string): void {
  for (const [c, it] of Object.entries(store.data.equip)) if (it === itemId) delete store.data.equip[c];
  if (itemId) store.data.equip[champId] = itemId; else delete store.data.equip[champId];
  persist();
}

function levelButtons(def: ChampionDef): string {
  const lvl = level(def.id);
  if (lvl >= MAX_LEVEL) return '<div class="muted">Niveau maximum</div>';
  return `<div class="row">
    <button class="btn gold" data-lvl="${def.id}" data-cost="${levelCost(lvl)}">Niveau ${lvl + 1} — ◆ ${fmt(levelCost(lvl))}</button>
    <button class="btn" data-lvl10="${def.id}" title="Monte de 10 niveaux tant que l'or suffit">+10</button>
  </div>`;
}

// ---------------------------------------------------------------- Shell

function header(): string {
  const tabs: [Screen, string][] = [['maps', 'Cartes'], ['champions', 'Champions'], ['shop', 'Boutique'], ['options', 'Options']];
  return `<header class="top">
    <div class="logo">RIFT<span>DEFENDERS</span></div>
    <nav>${tabs.map(([id, label]) => `<button class="tab ${screen === id ? 'on' : ''}" data-nav="${id}">${label}</button>`).join('')}</nav>
    <div class="wallet"><span class="gold">◆ <b id="h-gold">${fmt(store.data.gold)}</b></span>
      <span class="star-total">★ ${stars()}</span></div>
  </header>`;
}

export function render(): void {
  if (!store.data.owned.length) return renderStarter();
  if (screen === 'battle') return;
  const body = screen === 'maps' ? mapsScreen() : screen === 'champions' ? champsScreen()
    : screen === 'shop' ? shopScreen() : optionsScreen();
  app.innerHTML = header() + `<main class="screen">${body}</main>`;
  if (screen === 'maps') mountWorld();
}

function go(s: Screen): void {
  screen = s;
  render();
}

// ---------------------------------------------------------------- Starter

function renderStarter(): void {
  const starters = CHAMPIONS.filter((c) => c.starter);
  app.innerHTML = `<div class="starter">
    <div class="logo big">RIFT<span>DEFENDERS</span></div>
    <h2>Choisis ton premier champion</h2>
    <div class="starter-row">${starters.map((c, i) => artCard(c, `data-starter="${c.id}"`, `
        <h3>${esc(c.name)}</h3><div class="muted small">${esc(c.title)}</div>
        <div class="tag">${c.role} · ${c.region}</div>
        <p>${esc(c.passive)}</p>`, i * 120)).join('')}</div>
    <p class="muted small">Les autres champions s'obtiennent dans les coffres Hextech et en terminant des cartes.</p>
  </div>`;
}

// ---------------------------------------------------------------- Maps

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
        ${rw ? `<span class="reward-chip">${portrait(rw, 22, !store.data.owned.includes(rw.id))}${store.data.owned.includes(rw.id) ? esc(rw.name) : 'Récompense ???'}</span>` : '<span></span>'}
        <button class="btn start" data-map="${id}" ${open ? '' : 'disabled'}>Jouer ▶</button>
      </div>
    </div>
  </div>`;
}

function mapsScreen(): string {
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
function mountWorld(): void {
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

function selectRegion(id: string | null): void {
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

window.addEventListener('resize', () => { if (screen === 'maps') frameCamera(false); });

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

function mapThumb(id: string): string {
  return `<img src="${mapPreview(id)}" alt="">`;
}

// ---------------------------------------------------------------- Champions

const RARITY = ['', 'Commun', 'Rare', 'Épique'];
const ROLE_ICON: Record<string, string> = { Tireur: '🏹', Mage: '✨', Combattant: '⚔', Support: '✚', Assassin: '🗡' };
const coll = { role: '', region: '', owned: 'all' as 'all' | 'owned' | 'locked', sort: 'level' as 'level' | 'name' | 'rarity' };

function chip(attr: string, value: string, label: string, on: boolean): string {
  return `<button class="chip ${on ? 'on' : ''}" ${attr}="${value}">${label}</button>`;
}

function champsScreen(): string {
  const owned = store.data.owned;
  if (!selectedChamp || !owned.includes(selectedChamp)) selectedChamp = owned[0];
  const regions = [...new Set(CHAMPIONS.map((c) => c.region))].sort();
  let list = CHAMPIONS.filter((c) => (!coll.role || c.role === coll.role) && (!coll.region || c.region === coll.region)
    && (coll.owned === 'all' || (coll.owned === 'owned') === owned.includes(c.id)));
  list = [...list].sort((x, y) => {
    const ox = owned.includes(x.id) ? 0 : 1, oy = owned.includes(y.id) ? 0 : 1;
    if (ox !== oy) return ox - oy;
    if (coll.sort === 'name') return x.name.localeCompare(y.name);
    if (coll.sort === 'rarity') return y.rarity - x.rarity || level(y.id) - level(x.id);
    return level(y.id) - level(x.id) || y.rarity - x.rarity;
  });
  const totalLv = owned.reduce((n, id) => n + level(id), 0);
  const grid = list.map((c, i) => {
    const has = owned.includes(c.id);
    const src = c.reward ? `Récompense : ${MAP_BY_ID[c.reward].name}` : c.starter ? 'Champion de départ' : 'Coffre Hextech';
    const lvl = level(c.id), rank = ultRank(lvl);
    return `<button class="coll-card r${c.rarity} ${has ? '' : 'locked'} ${c.id === selectedChamp ? 'sel' : ''}"
      ${has ? `data-champ="${c.id}"` : 'disabled'} style="--d:${Math.min(i, 12) * 30}ms">
      <div class="coll-art" style="background-image:url('${loadingUrl(c.id)}')"></div>
      ${has ? `<span class="coll-lv">${lvl}</span><span class="coll-role" title="${c.role}">${ROLE_ICON[c.role]}</span>
        ${rank ? `<span class="coll-rank">${'◆'.repeat(rank)}</span>` : ''}` : '<span class="coll-lock">🔒</span>'}
      <div class="coll-body"><b>${has ? esc(c.name) : '???'}</b><span>${has ? `${c.role} · ${c.region}` : esc(src)}</span></div>
    </button>`;
  }).join('');
  return `<div class="coll-layout">
    <section>
      <div class="coll-head">
        <div><h2>Collection</h2><div class="muted small">${owned.length}/${CHAMPIONS.length} champions · ${totalLv} niveaux cumulés · ${store.data.items.length}/${ITEMS.length} objets</div>
          <div class="progress wide"><div style="width:${(owned.length / CHAMPIONS.length) * 100}%"></div></div></div>
      </div>
      <div class="filters">
        <div class="fgroup"><span>Rôle</span>${chip('data-cf-role', '', 'Tous', !coll.role)}${Object.keys(ROLE_ICON).map((r) => chip('data-cf-role', r, `${ROLE_ICON[r]} ${r}`, coll.role === r)).join('')}</div>
        <div class="fgroup"><span>Région</span>
          <select data-cf-region><option value="">Toutes</option>${regions.map((r) => `<option ${coll.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
          <span>Afficher</span>${chip('data-cf-owned', 'all', 'Tous', coll.owned === 'all')}${chip('data-cf-owned', 'owned', 'Possédés', coll.owned === 'owned')}${chip('data-cf-owned', 'locked', 'À débloquer', coll.owned === 'locked')}
          <span>Trier</span>${chip('data-cf-sort', 'level', 'Niveau', coll.sort === 'level')}${chip('data-cf-sort', 'rarity', 'Rareté', coll.sort === 'rarity')}${chip('data-cf-sort', 'name', 'Nom', coll.sort === 'name')}
        </div>
      </div>
      <div class="coll-grid">${grid || '<div class="muted">Aucun champion ne correspond aux filtres.</div>'}</div>
    </section>
    <aside class="panel coll-detail">${champDetail(champ(selectedChamp))}</aside>
  </div>`;
}

function champDetail(def: ChampionDef): string {
  const lvl = level(def.id);
  const s = computeStats(def);
  const next = lvl < MAX_LEVEL ? computeStats(def, lvl + 1) : null;
  const stacks = store.data.stacks[def.id];
  const maps = MAPS.filter((m) => store.data.layouts[m.id]?.some((p) => p.id === def.id));
  const item = store.data.equip[def.id] ? ITEM_BY_ID[store.data.equip[def.id]] : null;
  return `<div class="champ-card-hud r${def.rarity}">
      <div class="cc-splash tall" style="background-image:url('${splashUrl(def.id)}')">
        <span class="cc-lvl">${lvl}</span>
        <div class="cc-name"><h3>${esc(def.name)}</h3><span>${esc(def.title)}</span></div>
      </div>
      <div class="cc-tags"><span class="tagc role">${ROLE_ICON[def.role]} ${def.role}</span><span class="tagc">${def.region}</span>
        <span class="tagc rar r${def.rarity}">${RARITY[def.rarity]}</span></div>
    </div>
    <div class="lvl-block">
      <div class="lvl-line"><span>Niveau <b>${lvl}</b> / ${MAX_LEVEL}</span><span class="muted small">Ultime : ${ULT_LEVELS.map((l) => (lvl >= l ? `<b>${l}</b>` : l)).join(' · ')}</span></div>
      <div class="progress"><div style="width:${(lvl / MAX_LEVEL) * 100}%"></div></div>
      ${levelButtons(def)}
      ${next ? `<div class="next-lv small">Niveau suivant : dégâts <b>${fmt(s.dmg)}</b> → <b class="up">${fmt(next.dmg)}</b>${next.range !== s.range ? ` · portée → <b class="up">${next.range.toFixed(1)}</b>` : ''}</div>` : ''}
    </div>
    ${abilityRow(def)}
    <div class="hud-title">Statistiques</div>
    <div class="stat-grid">${statLines(s).map((l) => `<div>${l}</div>`).join('')}</div>
    ${stacks ? `<div class="run-line"><span>Cumuls permanents</span><b>+${stacks.toFixed(1)} dégâts</b></div>` : ''}
    <div class="hud-title">Équipement</div>
    <div class="equip-row">${item ? itemIcon(item, 44) : '<span class="item-slot empty">+</span>'}${itemSelect(def)}</div>
    <div class="hud-title">Déployé sur</div>
    <div class="deploy">${maps.length ? maps.map((m) => `<span class="tagc">${esc(m.name)}</span>`).join('') : '<span class="muted small">Aucune carte pour l\'instant</span>'}</div>`;
}

function itemIcon(it: (typeof ITEMS)[number], size = 44): string {
  return it.dd
    ? `<img class="item-img" src="${itemIconUrl(it.dd)}" alt="" style="width:${size}px;height:${size}px" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'item-img emoji',textContent:'${it.icon}'}))">`
    : `<span class="item-img emoji" style="width:${size}px;height:${size}px">${it.icon}</span>`;
}

// ---------------------------------------------------------------- Shop

let shopCat = '';

function shopScreen(): string {
  const pool = chestPool();
  const price = chestPrice();
  const offer = store.data.chestOffer;
  const pity = Math.max(0, EPIC_PITY - store.data.chestsSinceEpic);
  const byRar = [1, 2, 3].map((r) => pool.filter((c) => c.rarity === r).length);
  const wsum = byRar[0] * 6 + byRar[1] * 3 + byRar[2];
  const odds = [byRar[0] * 6, byRar[1] * 3, byRar[2]].map((w) => (wsum ? Math.round((w / wsum) * 100) : 0));
  const chestBody = offer
    ? `<div class="offer-h">Choisis ton champion</div>
       <div class="offer">${offer.map((id, i) => {
         const c = champ(id);
         return artCard(c, `data-claim="${id}"`, `<b>${esc(c.name)}</b>
           <div class="tag">${ROLE_ICON[c.role]} ${c.role} · <span class="rar r${c.rarity}">${RARITY[c.rarity]}</span></div>
           <div class="small muted">${esc(c.passive)}</div>`, i * 140);
       }).join('')}</div>`
    : pool.length
      ? `<div class="chest-actions">
           <button class="btn gold big" data-chest data-cost="${price}">Ouvrir le coffre — ◆ ${fmt(price)}</button>
           <div class="small muted">${pool.length} champion(s) restant(s) · le prix augmente à chaque champion obtenu</div>
         </div>`
      : '<div class="muted">Tous les champions des coffres sont débloqués !</div>';
  const cats = ['Dégâts', 'Vitesse', 'Utilitaire'];
  const items = ITEMS.filter((it) => !shopCat || it.category === shopCat).map((it, i) => {
    const has = store.data.items.includes(it.id);
    const holder = Object.entries(store.data.equip).find(([, x]) => x === it.id)?.[0];
    return `<div class="shop-item ${has ? 'owned' : ''}" style="--d:${i * 40}ms">
      <div class="si-icon">${itemIcon(it, 52)}</div>
      <div class="si-body"><b>${esc(it.name)}</b><span class="tagc">${it.category}</span><p>${esc(it.desc)}</p></div>
      <div class="si-side">${has
        ? `${holder ? `<div class="si-holder">${portrait(champ(holder), 28)}<span>${esc(champ(holder).name)}</span></div>` : '<div class="small owned">Possédé · libre</div>'}
           <select data-equip-item="${it.id}"><option value="">Équiper sur…</option>${store.data.owned.map((id) => `<option value="${id}" ${holder === id ? 'selected' : ''}>${esc(champ(id).name)}</option>`).join('')}</select>`
        : `<div class="si-price">◆ ${fmt(it.price)}</div><button class="btn gold" data-buy="${it.id}" data-cost="${it.price}">Acheter</button>`}</div>
    </div>`;
  }).join('');
  return `<div class="shop2">
    <section class="panel chest-panel">
      <div class="chest-visual"><div class="hex-chest"><span></span></div><div class="chest-glow"></div></div>
      <div class="chest-info">
        <h2>Coffre Hextech</h2>
        <p class="muted">Propose ${CHEST_CHOICES} champions que tu ne possèdes pas encore : tu en gardes un.</p>
        <div class="odds">
          <div class="odd r1"><span>Commun</span><b>${odds[0]} %</b><i>${byRar[0]} restant(s)</i></div>
          <div class="odd r2"><span>Rare</span><b>${odds[1]} %</b><i>${byRar[1]} restant(s)</i></div>
          <div class="odd r3"><span>Épique</span><b>${odds[2]} %</b><i>${byRar[2]} restant(s)</i></div>
        </div>
        <div class="pity"><span>Garantie épique</span>${[0, 1, 2].map((i) => `<i class="${i < store.data.chestsSinceEpic ? 'on' : ''}"></i>`).join('')}
          <b>${pity === 0 ? 'Prochain coffre : épique garanti' : `encore ${pity} coffre(s)`}</b></div>
        ${chestBody}
      </div>
    </section>
    <section>
      <div class="shop-head"><h2>Objets</h2>
        <div class="fgroup">${chip('data-sf', '', 'Tous', !shopCat)}${cats.map((c) => chip('data-sf', c, c, shopCat === c)).join('')}</div>
        <div class="muted small">${store.data.items.length}/${ITEMS.length} possédés · un objet par champion</div></div>
      <div class="shop-items">${items}</div>
    </section>
  </div>`;
}

// ---------------------------------------------------------------- Options

function optionsScreen(): string {
  const d = store.data;
  return `<div class="options">
    <section class="card"><h3>Sauvegarde</h3>
      <p class="muted small">Sauvegarde automatique dans le navigateur. Exporte régulièrement : vider les données du navigateur efface ta progression.</p>
      <div class="row"><button class="btn" data-export>Exporter</button><button class="btn" data-copy>Copier</button></div>
      <textarea id="save-out" readonly placeholder="Le code d'export apparaît ici"></textarea>
      <textarea id="save-in" placeholder="Colle un code RD1... ici"></textarea>
      <div class="row"><button class="btn" data-import>Importer</button><span id="save-msg" class="small"></span></div>
    </section>
    <section class="card"><h3>Statistiques</h3>
      <ul class="stat-list"><li>Éliminations <b>${fmt(d.kills)}</b></li><li>Parties <b>${d.runs}</b></li>
      <li>Coffres ouverts <b>${d.chestsOpened}</b></li><li>Étoiles <b>${stars()}</b></li></ul>
    </section>
    <section class="card danger"><h3>Zone dangereuse</h3>
      <button class="btn red" data-reset>Réinitialiser la progression</button></section>
    <p class="small muted">Rift Defenders est un projet de fan non officiel, gratuit et non commercial. Il n'est ni approuvé ni sponsorisé par Riot Games.
      League of Legends et les noms associés sont des marques de Riot Games, Inc.</p>
  </div>`;
}

// ---------------------------------------------------------------- Battle

function startBattle(mapId: string): void {
  const map = MAP_BY_ID[mapId];
  screen = 'battle';
  const speeds = [1, 2, 4, 8];
  app.innerHTML = `<div class="battle">
    <div class="bbar">
      <button class="btn" data-leave>← Cartes</button>
      <div class="bmap">${esc(map.name)}<small>${esc(REGIONS.find((r) => r.maps.includes(map.id))?.name ?? '')}</small></div>
      <div class="bstat">Vague <b id="b-wave">0</b>/${map.waves}</div>
      <div class="bstat lives">♥ <b id="b-lives">20</b></div>
      <div class="bstat gold">◆ <b id="b-gold">0</b></div>
      <div class="speed">${speeds.map((s) => `<button class="sp ${store.data.speed === s ? 'on' : ''}" data-speed="${s}">x${s}</button>`).join('')}</div>
      <label class="auto"><input type="checkbox" id="b-auto" ${store.data.auto ? 'checked' : ''}> Auto</label>
    </div>
    <div class="bmain">
      <aside class="hud-panel" id="wave-panel"></aside>
      <div class="board" id="board">
        <div class="overlay hidden" id="overlay"></div>
      </div>
      <aside class="hud-panel" id="details"></aside>
    </div>
    <div class="bfoot">
      <div class="spells">${(Object.keys(SPELLS) as SpellId[]).map((id) => `
        <button class="spell" data-spell="${id}" title="${esc(SPELLS[id].name)} : ${esc(SPELLS[id].desc)}">
          <span>${SPELLS[id].icon}</span><i id="cd-${id}"></i></button>`).join('')}</div>
      <div class="team-wrap">
        <div class="team-h"><span>Équipe</span><b id="b-slots"></b><span class="hint" id="b-hint"></span></div>
        <div class="team" id="team"></div>
      </div>
      <div class="go">
        <button class="btn boss hidden" id="b-boss" data-boss title="Commence directement à la vague ${map.waves}">Défier le boss ⚔</button>
        <button class="btn start" id="b-start" data-startwave>Lancer la vague ▶</button>
      </div>
    </div>
  </div>`;

  battle = new Battle(map, { onChange: renderSide, onEnd: showResult });
  document.getElementById('board')!.prepend(battle.canvas);
  if (store.data.auto) battle.startWave();
  renderSide();
  clearInterval(tick);
  tick = window.setInterval(refreshLive, 150);
}

function leaveBattle(): void {
  battle?.destroy();
  battle = null;
  clearInterval(tick);
  go('maps');
}

function renderSide(): void {
  const b = battle;
  if (!b) return;
  const ov = document.getElementById('overlay')!;
  if (!b.over) ov.classList.add('hidden');
  const details = document.getElementById('details')!;
  const t = b.selectedTower;
  details.innerHTML = t ? towerPanel(t) : mapInfoPanel(b);
  const placed = new Set(b.towers.map((x) => x.def.id));
  document.getElementById('b-slots')!.textContent = `${b.towers.length}/${teamSlots()}`;
  document.getElementById('team')!.innerHTML = store.data.owned.map((id) => {
    const def = champ(id);
    const sel = b.selectedRoster === id || b.selectedTower?.def.id === id;
    return `<button class="team-slot r${def.rarity} ${placed.has(id) ? 'placed' : ''} ${sel ? 'sel' : ''}" data-roster="${id}"
      title="${esc(def.name)} · ${def.role} — glisse-le sur la carte">
      <img src="${squareUrl(id)}" alt="" draggable="false" onerror="this.remove()"><span class="ini">${initials(def.name)}</span>
      <span class="lv">${level(id)}</span>${placed.has(id) ? '<span class="on-map">✓</span>' : ''}</button>`;
  }).join('');
  refreshLive();
}

const creatureIcons = new Map<string, string>();
/** Small rendered portrait of an enemy creature, for HUD lists. */
function creatureIcon(id: string): string {
  let url = creatureIcons.get(id);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = c.height = 72;
    const g = c.getContext('2d')!;
    const h = CREATURE_HEIGHT[id] ?? 16;
    drawCreature(g, id, 36, 64, 1, 0.3, 1, ENEMIES[id]?.color ?? '#888', false, Math.min(3, 54 / h));
    url = c.toDataURL();
    creatureIcons.set(id, url);
  }
  return `<img class="cicon" src="${url}" alt="" title="${esc(enemyName(id))}">`;
}

function abilityRow(def: ChampionDef): string {
  const icons = abilityIcons(def.id, () => { if (battle?.selectedTower?.def.id === def.id || screen === 'champions') battle ? renderSide() : render(); });
  const rank = ultRank(level(def.id));
  const ico = (src: string | undefined, fallback: string, cls: string) =>
    src ? `<img class="abil ${cls}" src="${src}" alt="">` : `<span class="abil ${cls} ph">${fallback}</span>`;
  return `<div class="abilities">
    <div class="ab">${ico(icons?.passive, 'P', 'p')}<div><b>${esc(icons?.passiveName ?? 'Passif')}</b><span>${esc(def.passive)}</span></div></div>
    <div class="ab ${rank ? '' : 'off'}">${ico(icons?.ult, 'R', 'r')}<div><b>${esc(def.ult.name)} <i>${ULT_LEVELS.map((l, i) => `<em class="${i < rank ? 'on' : ''}">${l}</em>`).join('')}</i></b><span>${esc(def.ult.desc)}</span></div></div>
  </div>`;
}

function towerPanel(t: Tower): string {
  const def = t.def, lvl = level(def.id);
  const share = battle ? t.dmgDone / Math.max(1, battle.towers.reduce((n, x) => n + x.dmgDone, 0)) : 0;
  return `<div class="champ-card-hud r${def.rarity}">
      <div class="cc-splash" style="background-image:url('${splashUrl(def.id)}')">
        <span class="cc-lvl">${lvl}</span>
        <div class="cc-name"><h3>${esc(def.name)}</h3><span>${esc(def.title)}</span></div>
      </div>
      <div class="cc-tags"><span class="tagc role">${def.role}</span><span class="tagc">${def.region}</span>
        <span class="tagc rar r${def.rarity}">${['', 'Commun', 'Rare', 'Épique'][def.rarity]}</span></div>
    </div>
    ${levelButtons(def)}
    ${abilityRow(def)}
    ${tileBonusLine(t)}
    <div class="stat-grid">${statLines(t.stats).map((l) => `<div>${l}</div>`).join('')}</div>
    <div class="run-line"><span>⚔ ${t.kills} élim.</span><span>✦ ${fmt(t.dmgDone)} dégâts</span><span>${Math.round(share * 100)} %</span></div>
    ${t.runStacks ? `<div class="small">Cumuls de partie : +${t.runStacks.toFixed(1)}</div>` : ''}
    ${itemSelect(def)}
    <div class="row"><button class="btn" data-deselect>Fermer</button><button class="btn red" data-remove>Retirer</button></div>`;
}

function tileBonusLine(t: Tower): string {
  const f = battle?.featureAt(t.c, t.r);
  const nearPit = battle && [-1, 0, 1].some((dc) => [-1, 0, 1].some((dr) => battle!.featureAt(t.c + dc, t.r + dr) === 'dragon'));
  const parts = [f && f !== 'dragon' ? FEATURE_INFO[f] : null, nearPit ? FEATURE_INFO.dragon : null].filter(Boolean) as (typeof FEATURE_INFO)[keyof typeof FEATURE_INFO][];
  return parts.map((i) => `<div class="tile-bonus" style="--c:${i.color}"><span>${i.icon}</span><div><b>${esc(i.name)}</b><span>${esc(i.desc)}</span></div></div>`).join('');
}

function featureList(m: MapDef): string {
  const kinds = [...new Set((m.features ?? []).map((f) => f.kind))];
  const lanes = 1 + (m.lanes?.length ?? 0);
  return `${lanes > 1 ? `<div class="mi-spell"><span>⇉</span><div><b>${lanes} voies</b><span class="small muted">Les ennemis arrivent par plusieurs chemins</span></div></div>` : ''}
    ${kinds.map((k) => `<div class="mi-spell"><span style="border-color:${FEATURE_INFO[k].color}">${FEATURE_INFO[k].icon}</span><div><b>${esc(FEATURE_INFO[k].name)}</b><span class="small muted">${esc(FEATURE_INFO[k].desc)}</span></div></div>`).join('')}`;
}

function mapInfoPanel(b: Battle): string {
  const m = b.map, rw = rewardFor(m.id), best = store.data.best[m.id] ?? 0;
  return `<div class="hud-card">
      <div class="hud-title">Carte</div>
      <div class="mi-thumb">${mapThumb(m.id)}</div>
      <div class="mi-row"><b>${esc(m.name)}</b>${starRow(stars(m.id))}</div>
      <div class="small muted">${esc(m.subtitle)} · record vague ${best}/${m.waves}</div>
    </div>
    <div class="hud-card">
      <div class="hud-title">Boss final</div>
      <div class="mi-boss">${creatureIcon(m.finalBoss)}<div><b>${esc(enemyName(m.finalBoss))}</b>
        <span class="small muted">Vague ${m.waves} · PV x${Math.round(ENEMIES[m.finalBoss].hp / ENEMIES.melee.hp)} d'un sbire</span></div></div>
      ${rw ? `<div class="mi-boss">${portrait(rw, 40, !store.data.owned.includes(rw.id))}<div><b>Récompense</b><span class="small muted">${store.data.owned.includes(rw.id) ? esc(rw.name) + ' (obtenu)' : 'Champion mystère'}</span></div></div>` : ''}
    </div>
    ${(b.map.features?.length || b.map.lanes?.length) ? `<div class="hud-card"><div class="hud-title">Particularités</div>${featureList(b.map)}</div>` : ''}
    <div class="hud-card">
      <div class="hud-title">Sorts d'invocateur</div>
      ${(Object.keys(SPELLS) as SpellId[]).map((id) => `<div class="mi-spell"><span>${SPELLS[id].icon}</span><div><b>${esc(SPELLS[id].name)}</b><span class="small muted">${esc(SPELLS[id].desc)} · ${SPELLS[id].cd}s</span></div></div>`).join('')}
    </div>
    <div class="hud-card tips">
      <div class="hud-title">Astuces</div>
      <p><b>Placer</b> : glisse un champion de la barre d'équipe (ou clique-le puis clique une case).</p><p><b>Améliorer</b> : clique un champion sur la carte, sa fiche s'ouvre à droite.</p><p><b>Déplacer</b> : maintiens le clic sur un champion et glisse-le.</p>
      <p>Raccourcis : <kbd>Espace</kbd> lancer la vague · <kbd>P</kbd> pause · <kbd>Échap</kbd> annuler.</p>
    </div>`;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60), s2 = Math.floor(sec % 60);
  return `${m}:${String(s2).padStart(2, '0')}`;
}

/** Left HUD column: wave progress, next wave, nexus, run stats, damage meter. */
function wavePanel(b: Battle): string {
  const m = b.map;
  const remaining = b.waveRemaining();
  const nextBoss = b.wave >= m.waves ? 0 : (Math.floor(b.wave / 10) + 1) * 10;
  const bossIn = nextBoss - b.wave;
  const next = b.nextWave();
  const total = Math.max(1, b.towers.reduce((n, t) => n + t.dmgDone, 0));
  const meter = [...b.towers].sort((x, y) => y.dmgDone - x.dmgDone).map((t) => `
    <div class="dm-row"><img src="${squareUrl(t.def.id)}" alt=""><div class="dm-bar"><div style="width:${(t.dmgDone / total) * 100}%;background:${t.def.color}"></div>
      <span>${esc(t.def.name)}</span><b>${fmt(t.dmgDone)}</b></div></div>`).join('');
  return `<div class="hud-card wave-card">
      <div class="hud-title">Vague</div>
      <div class="wave-big"><b>${b.wave}</b><span>/ ${m.waves}</span></div>
      <div class="bar"><div style="width:${(b.wave / m.waves) * 100}%"></div></div>
      ${b.waveActive ? `<div class="small">Ennemis restants <b>${remaining}</b> / ${b.waveTotal}</div>
        <div class="bar red"><div style="width:${(remaining / Math.max(1, b.waveTotal)) * 100}%"></div></div>` : '<div class="small muted">En attente du lancement</div>'}
      ${bossIn > 0 ? `<div class="boss-in">${nextBoss === m.waves ? 'Boss final' : 'Monstre épique'} dans <b>${bossIn}</b> vague${bossIn > 1 ? 's' : ''}</div>` : ''}
    </div>
    <div class="hud-card">
      <div class="hud-title">Prochaine vague</div>
      <div class="next-wave">${next.length ? next.map((x) => `<div class="nw">${creatureIcon(x.id)}<span>x${x.n}</span></div>`).join('') : '<span class="small muted">—</span>'}</div>
    </div>
    <div class="hud-card">
      <div class="hud-title">Nexus</div>
      <div class="lives-row"><span class="heart">♥</span><b>${Math.max(0, b.lives)}</b><div class="bar green"><div style="width:${(Math.max(0, b.lives) / 30) * 100}%"></div></div></div>
    </div>
    <div class="hud-card">
      <div class="hud-title">Partie</div>
      <div class="run-stats"><div><span>Éliminations</span><b>${b.runKills}</b></div><div><span>Or gagné</span><b>${fmt(b.runGold)}</b></div>
        <div><span>Durée</span><b>${fmtTime(b.runTime)}</b></div><div><span>Champions</span><b>${b.towers.length}/${teamSlots()}</b></div></div>
    </div>
    <div class="hud-card">
      <div class="hud-title">Dégâts</div>
      ${meter || '<span class="small muted">Place des champions pour voir leurs dégâts.</span>'}
    </div>`;
}

function refreshLive(): void {
  const gold = fmt(store.data.gold);
  const set = (id: string, v: string) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };
  set('h-gold', gold);
  set('b-gold', gold);
  document.querySelectorAll<HTMLButtonElement>('[data-cost]').forEach((btn) => {
    btn.disabled = store.data.gold < Number(btn.dataset.cost);
  });
  const b = battle;
  if (!b) return;
  const wp = document.getElementById('wave-panel');
  if (wp) wp.innerHTML = wavePanel(b);
  set('b-wave', String(b.wave));
  set('b-lives', String(Math.max(0, b.lives)));
  for (const id of Object.keys(SPELLS) as SpellId[]) {
    const cd = b.spellCd[id];
    set(`cd-${id}`, cd > 0 ? String(Math.ceil(cd)) : '');
    document.querySelector<HTMLButtonElement>(`[data-spell="${id}"]`)!.disabled = cd > 0 || b.over;
  }
  const start = document.getElementById('b-start') as HTMLButtonElement;
  start.disabled = b.waveActive || b.over;
  start.textContent = b.waveActive ? `Vague ${b.wave} en cours…` : `Lancer la vague ${b.wave + 1} ▶`;
  document.getElementById('b-boss')!.classList.toggle('hidden', b.wave !== 0 || b.waveActive || b.over || !b.canChallengeBoss());
  set('b-hint', !b.towers.length ? 'Place au moins un champion avant de lancer la vague.'
    : store.data.auto ? 'Mode auto : vagues et redémarrages automatiques.' : '');
}

function showResult(win: boolean, wave: number): void {
  const ov = document.getElementById('overlay');
  if (!ov || !battle) return;
  let reward = '';
  if (win) {
    const rw = rewardFor(battle.map.id);
    if (rw && !store.data.owned.includes(rw.id)) {
      store.data.owned.push(rw.id);
      persist();
      reward = `<div class="reward">${portrait(rw, 56)}<div>Nouveau champion : <b>${esc(rw.name)}</b></div></div>`;
    }
  }
  ov.innerHTML = `<div class="result ${win ? 'win' : 'lose'}">
    <h2>${win ? 'Victoire !' : 'Nexus détruit'}</h2>
    <p>${win ? `${esc(battle.map.name)} terminée !` : `Tu as tenu jusqu'à la vague ${wave}.`}</p>
    <p class="small muted">Ton or, tes niveaux et tes objets sont conservés.</p>
    ${reward}
    <div class="row"><button class="btn gold" data-restart>Rejouer</button>
      ${battle.canChallengeBoss() ? '<button class="btn boss" data-boss>Retenter le boss ⚔</button>' : ''}
      <button class="btn" data-leave>Changer de carte</button></div>
    ${store.data.auto ? '<p class="small muted">Mode auto : redémarrage automatique…</p>' : ''}
  </div>`;
  ov.classList.remove('hidden');
}

// ---------------------------------------------------------------- Events

function flash(msg: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function levelUp(id: string, times: number): void {
  let n = 0;
  while (n < times && tryLevelUp(id)) n++;
  if (!n) return;
  persist();
  const lvl = level(id);
  if (ULT_LEVELS.some((l) => lvl >= l && lvl - n < l)) flash(`${esc(champ(id).name)} : ultime renforcée (rang ${ultRank(lvl)}) !`);
  if (battle) { battle.refreshStats(); renderSide(); } else render();
}

app.addEventListener('click', (e) => {
  if (suppressClick) return;
  const el = (e.target as HTMLElement).closest<HTMLElement>('button, [data-nav]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const d = el.dataset;
  if (d.nav) return go(d.nav as Screen);
  if (d.starter) {
    store.data.owned.push(d.starter);
    persist();
    return go('maps');
  }
  if (d.map) return startBattle(d.map);
  if (d.region !== undefined) return selectRegion(d.region || null);
  if (d.champ) { selectedChamp = d.champ; return render(); }
  if (d.cfRole !== undefined) { coll.role = d.cfRole; return render(); }
  if (d.cfOwned) { coll.owned = d.cfOwned as typeof coll.owned; return render(); }
  if (d.cfSort) { coll.sort = d.cfSort as typeof coll.sort; return render(); }
  if (d.sf !== undefined) { shopCat = d.sf; return render(); }
  if (d.lvl) return levelUp(d.lvl, 1);
  if (d.lvl10) return levelUp(d.lvl10, 10);
  if (d.chest !== undefined) {
    const art = document.querySelector('.hex-chest');
    (el as HTMLButtonElement).disabled = true;
    art?.classList.add('opening');
    setTimeout(() => { openChest(); persist(); render(); }, 900);
    return;
  }
  if (d.claim) {
    const got = claimChest(d.claim);
    persist();
    if (got) flash(`${portrait(got, 40)}<div>Nouveau champion !<br><b>${esc(got.name)}</b> — ${esc(got.title)}</div>`);
    return render();
  }
  if (d.buy) {
    const it = ITEM_BY_ID[d.buy];
    if (store.data.gold >= it.price && !store.data.items.includes(it.id)) {
      store.data.gold -= it.price;
      store.data.items.push(it.id);
      persist();
      flash(`${it.icon} ${esc(it.name)} acheté`);
    }
    return render();
  }
  if (d.export !== undefined) { (document.getElementById('save-out') as HTMLTextAreaElement).value = exportSave(); return; }
  if (d.copy !== undefined) {
    const out = document.getElementById('save-out') as HTMLTextAreaElement;
    if (!out.value) out.value = exportSave();
    navigator.clipboard?.writeText(out.value).then(() => flash('Code copié'), () => out.select());
    return;
  }
  if (d.import !== undefined) {
    const msg = document.getElementById('save-msg')!;
    try {
      importSave((document.getElementById('save-in') as HTMLTextAreaElement).value);
      flash('Sauvegarde importée');
      return render();
    } catch (err) {
      msg.textContent = (err as Error).message;
      return;
    }
  }
  if (d.reset !== undefined) {
    if (confirm('Effacer définitivement toute ta progression ? Exporte ta sauvegarde avant si tu veux la garder.')) {
      resetSave();
      render();
    }
    return;
  }

  // Battle controls
  const b = battle;
  if (!b) return;
  if (d.leave !== undefined) return leaveBattle();
  if (d.startwave !== undefined) { if (b.towers.length) b.startWave(); return; }
  if (d.restart !== undefined) return b.restart();
  if (d.boss !== undefined) {
    if (!b.towers.length) return flash('Place au moins un champion avant de défier le boss.');
    b.restart(true);
    return b.startWave();
  }
  if (d.speed) {
    store.data.speed = Number(d.speed);
    persist();
    document.querySelectorAll('.sp').forEach((x) => x.classList.toggle('on', x === el));
    return;
  }
  if (d.spell) return b.castSpell(d.spell as SpellId);
  if (d.roster) {
    const t = b.towers.find((x) => x.def.id === d.roster);
    if (t) { b.selectedTower = t; b.selectedRoster = null; }
    else if (b.slotsLeft() > 0) b.selectedRoster = b.selectedRoster === d.roster ? null : d.roster;
    else flash(`Tous les emplacements sont pris (${teamSlots()}). Retire un champion ou gagne des ★.`);
    return renderSide();
  }
  if (d.deselect !== undefined) { b.selectedTower = null; return renderSide(); }
  if (d.remove !== undefined && b.selectedTower) { b.remove(b.selectedTower); return renderSide(); }
});

app.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  if (el.id === 'b-auto') {
    store.data.auto = (el as HTMLInputElement).checked;
    persist();
    if (store.data.auto && battle && !battle.waveActive && battle.towers.length) {
      if (battle.over) battle.restart(); else battle.startWave();
    }
    refreshLive();
    return;
  }
  if (el.dataset.cfRegion !== undefined) { coll.region = el.value; render(); return; }
  if (el.dataset.equipItem) {
    if (el.value) equip(el.value, el.dataset.equipItem);
    else for (const [c, it] of Object.entries(store.data.equip)) if (it === el.dataset.equipItem) delete store.data.equip[c];
    persist();
    render();
    return;
  }
  const champId = el.dataset.equip;
  if (champId !== undefined) {
    equip(champId, el.value);
    if (battle) { battle.refreshStats(); renderSide(); } else render();
  }
});

// Drag a champion from the team bar onto the board.
let teamDrag: { id: string; x: number; y: number; ghost: HTMLElement | null } | null = null;
let suppressClick = false;

app.addEventListener('pointerdown', (e) => {
  const slot = (e.target as HTMLElement).closest<HTMLElement>('.team-slot');
  if (!slot || !battle || e.button !== 0) return;
  teamDrag = { id: slot.dataset.roster!, x: e.clientX, y: e.clientY, ghost: null };
});

window.addEventListener('pointermove', (e) => {
  if (!teamDrag || !battle) return;
  if (!teamDrag.ghost && Math.hypot(e.clientX - teamDrag.x, e.clientY - teamDrag.y) > 6) {
    const def = champ(teamDrag.id);
    teamDrag.ghost = document.createElement('div');
    teamDrag.ghost.className = 'drag-ghost';
    teamDrag.ghost.innerHTML = `<img src="${squareUrl(def.id)}" alt="">`;
    document.body.appendChild(teamDrag.ghost);
    battle.selectedRoster = teamDrag.id;
  }
  if (teamDrag.ghost) {
    teamDrag.ghost.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 28}px)`;
    battle.previewAt(e.clientX, e.clientY);
  }
});

window.addEventListener('pointerup', (e) => {
  if (!teamDrag) return;
  const drag = teamDrag;
  teamDrag = null;
  if (!drag.ghost || !battle) return;
  drag.ghost.remove();
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 0);
  const tile = battle.tileAtClient(e.clientX, e.clientY);
  const placed = battle.towers.some((t) => t.def.id === drag.id);
  if (tile && !placed && battle.slotsLeft() <= 0) flash(`Tous les emplacements sont pris (${teamSlots()}). Retire un champion ou gagne des ★.`);
  else if (tile) battle.dropChampion(drag.id, tile.c, tile.r);
  battle.selectedRoster = null;
  renderSide();
});

window.addEventListener('keydown', (e) => {
  if (!battle || (e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); if (battle.towers.length) battle.startWave(); }
  if (e.key === 'Escape') { battle.selectedRoster = null; battle.selectedTower = null; renderSide(); }
  if (e.key === 'p') battle.paused = !battle.paused;
});

window.addEventListener('beforeunload', persist);
