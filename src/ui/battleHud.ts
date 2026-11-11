import { squareUrl, splashUrl } from '../art/champArt';
import { CREATURE_HEIGHT, drawCreature } from '../art/creatures';
import { FEATURE_INFO } from '../art/mapArt';
import { Battle, initials, PRIORITIES, SPELLS, type Enemy, type SpellId, type Tower } from '../battle';
import { SYN_TIERS, synText, teamSynergies } from '../data/synergies';
import type { Priority } from '../types';
import { ENEMIES } from '../data/enemies';
import { MAP_BY_ID } from '../data/maps';
import { REGIONS } from '../art/worldArt';
import { champ, enemyName, fmt, level, pct, rewardChance, rewardFor, rollReward, stars, teamSlots } from '../game';
import { sfx } from '../audio';
import { persist, store } from '../save';
import type { MapDef } from '../types';
import { app, esc, itemSelect, abilityRow, levelButtons, mapThumb, portrait, starRow, statLines, ui, ultButton } from './common';
import { go } from './index';

export function startBattle(mapId: string): void {
  const map = MAP_BY_ID[mapId];
  ui.screen = 'battle';
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
        <div class="ults" id="ults"></div>
        <div class="team" id="team"></div>
      </div>
      <div class="go">
        <button class="btn boss hidden" id="b-boss" data-boss title="Commence directement à la vague ${map.waves}">Défier le boss ⚔</button>
        <button class="btn start" id="b-start" data-startwave>Lancer la vague ▶</button>
      </div>
    </div>
  </div>`;

  ui.battle = new Battle(map, { onChange: renderSide, onEnd: showResult });
  document.getElementById('board')!.prepend(ui.battle.canvas);
  if (store.data.auto) ui.battle.startWave();
  renderSide();
  clearInterval(ui.tick);
  ui.tick = window.setInterval(refreshLive, 150);
}
export function leaveBattle(): void {
  ui.battle?.destroy();
  ui.battle = null;
  clearInterval(ui.tick);
  go('maps');
}

export function renderSide(): void {
  const b = ui.battle;
  if (!b) return;
  const ov = document.getElementById('overlay')!;
  if (!b.over) ov.classList.add('hidden');
  const details = document.getElementById('details')!;
  const t = b.selectedTower;
  if (t) b.selectedEnemy = null;
  details.innerHTML = (b.selectedEnemy ? '<div class="hud-card enemy-card"><div id="enemy-card"></div><button class="btn" data-deselect-enemy>Fermer</button></div>' : '') + (t ? towerPanel(t) : mapInfoPanel(b));
  document.getElementById('ults')!.innerHTML = b.towers.map((x, i) => ultButton(x.def, `data-ult="${x.def.id}"`, i < 9 ? i + 1 : undefined)).join('');
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
function towerPanel(t: Tower): string {
  const def = t.def, lvl = level(def.id);
  const share = ui.battle ? t.dmgDone / Math.max(1, ui.battle.towers.reduce((n, x) => n + x.dmgDone, 0)) : 0;
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
    <button class="btn ult-big" data-ult="${def.id}" data-ult-big="${def.id}"></button>
    <label class="item-sel">Priorité de cible
      <select data-prio="${def.id}">${(Object.keys(PRIORITIES) as Priority[]).map((p) => `<option value="${p}" ${t.priority === p ? 'selected' : ''}>${PRIORITIES[p].name} — ${PRIORITIES[p].desc}</option>`).join('')}</select></label>
    ${tileBonusLine(t)}
    <div class="stat-grid">${statLines(t.stats).map((l) => `<div>${l}</div>`).join('')}</div>
    <div class="run-line"><span>⚔ ${t.kills} élim.</span><span>✦ ${fmt(t.dmgDone)} dégâts</span><span>${Math.round(share * 100)} %</span></div>
    ${t.runStacks ? `<div class="small">Cumuls de partie : +${t.runStacks.toFixed(1)}</div>` : ''}
    ${itemSelect(def)}
    <div class="row"><button class="btn" data-deselect>Fermer</button><button class="btn red" data-remove>Retirer</button></div>`;
}

function tileBonusLine(t: Tower): string {
  const f = ui.battle?.featureAt(t.c, t.r);
  const nearPit = ui.battle && [-1, 0, 1].some((dc) => [-1, 0, 1].some((dr) => ui.battle!.featureAt(t.c + dc, t.r + dr) === 'dragon'));
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
      ${rw ? `<div class="mi-boss">${portrait(rw, 40, !store.data.owned.includes(rw.id))}<div><b>Butin du boss</b><span class="small muted">${store.data.owned.includes(rw.id) ? esc(rw.name) + ' (obtenu)' : `Champion mystère · ${pct(rewardChance(m.id))} par victoire`}</span></div></div>` : ''}
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
      <div class="hud-title">Synergies</div>
      ${synergyList(b)}
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

function synergyList(b: Battle): string {
  const list = teamSynergies(b.towers.map((t) => t.def.region));
  if (!list.length) return '<span class="small muted">Place 2 champions de la même région pour activer une synergie.</span>';
  return list.map((a) => {
    const tip = `${a.region} — ${a.def.name}\n${SYN_TIERS.map((t) => `${t.n}${t.n === 4 ? '+' : ''} champions : ${synText(a.def, t.v)}`).join('\n')}`;
    const pips = SYN_TIERS.map((_t, i) => `<i class="${i < a.tier ? 'on' : ''}"></i>`).join('');
    return `<div class="syn ${a.tier ? 'on' : ''}" title="${esc(tip)}"><div class="syn-h"><b>${esc(a.region)}</b><span class="pips">${pips}</span><em>${a.count}</em></div>
      <span class="small">${a.tier ? `${esc(a.def.name)} : ${esc(synText(a.def, a.value))}` : 'Encore 1 champion pour activer'}</span></div>`;
  }).join('');
}

function enemyCard(b: Battle, e: Enemy): string {
  const d = e.def, pct = (v: number) => `${Math.round(v * 100)} %`;
  const shred = b.syn.armorShred ?? 0;
  const armor = d.armor > 0 && shred ? `${pct(d.armor)} → <b>${pct(Math.max(0, d.armor - shred))}</b>` : pct(d.armor);
  const speed = d.speed * (e.stunT > 0 ? 0 : 1 - e.slowPct);
  const burn = e.burns.reduce((n, x) => n + x.dps, 0);
  const status = [
    e.slowPct > 0 ? `<span class="tagc st-slow">Ralenti −${pct(e.slowPct)} · ${e.slowT.toFixed(1)}s</span>` : '',
    e.stunT > 0 ? `<span class="tagc st-stun">Étourdi · ${e.stunT.toFixed(1)}s</span>` : '',
    e.burns.length ? `<span class="tagc st-burn">Brûlure ${fmt(burn)}/s${e.burns.length > 1 ? ` (x${e.burns.length})` : ''}</span>` : '',
  ].join('') || '<span class="small muted">Aucun</span>';
  return `<div class="hud-title">Ennemi</div>
    <div class="mi-boss">${creatureIcon(d.id)}<div><b>${esc(d.name)}</b><span class="small muted">${d.boss ? 'Boss' : d.shape === 'boss' ? 'Monstre épique' : 'Monstre'} · fuite : −${d.leak} vie${d.leak > 1 ? 's' : ''}</span></div></div>
    <div class="bar red"><div style="width:${Math.max(0, (e.hp / e.maxHp) * 100)}%"></div></div>
    <div class="run-line"><span>PV</span><b>${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)}</b></div>
    <div class="run-line"><span>Vitesse</span><b>${speed.toFixed(2)} case/s${speed < d.speed ? ` (base ${d.speed})` : ''}</b></div>
    <div class="run-line"><span>Armure</span><b>${armor}</b></div>
    <div class="run-line"><span>Butin</span><b>◆ ${fmt(b.enemyReward(e))}</b></div>
    <div class="cc-tags">${status}</div>`;
}

function ultState(b: Battle, id: string): { t: Tower; i: number; p: number } | null {
  const i = b.towers.findIndex((x) => x.def.id === id);
  if (i < 0) return null;
  const t = b.towers[i];
  return { t, i, p: 1 - t.ultCd / t.def.active.cd };
}

const liveHtml = new WeakMap<HTMLElement, string>();

export function refreshLive(): void {
  const gold = fmt(store.data.gold);
  const set = (id: string, v: string) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };
  set('h-gold', gold);
  set('b-gold', gold);
  document.querySelectorAll<HTMLButtonElement>('[data-cost]').forEach((btn) => {
    btn.disabled = store.data.gold < Number(btn.dataset.cost);
  });
  const b = ui.battle;
  if (!b) return;
  const wp = document.getElementById('wave-panel');
  // Only touch the DOM when something changed, so hover tooltips and images don't flicker.
  const setHtml = (el: HTMLElement, html: string) => { if (liveHtml.get(el) !== html) { liveHtml.set(el, html); el.innerHTML = html; } };
  if (wp) setHtml(wp, wavePanel(b));
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-ult-btn]')) {
    const st = ultState(b, btn.dataset.ultBtn!);
    if (!st) continue;
    const ready = b.ultReady(st.t);
    btn.disabled = !ready;
    btn.classList.toggle('ready', ready);
    btn.style.setProperty('--p', `${Math.round(st.p * 360)}deg`);
    const n = btn.querySelector('.cdn');
    const txt = ready ? '' : String(Math.ceil(st.t.ultCd));
    if (n && n.textContent !== txt) n.textContent = txt;
  }
  const big = document.querySelector<HTMLButtonElement>('[data-ult-big]');
  if (big) {
    const st = ultState(b, big.dataset.ultBig!);
    if (st) {
      const ready = b.ultReady(st.t);
      big.disabled = !ready;
      const key = st.i < 9 ? ` [${st.i + 1}]` : '';
      const txt = `${st.t.def.active.name} — ${ready ? `prêt${key}` : `${Math.ceil(st.t.ultCd)} s`}`;
      if (big.textContent !== txt) big.textContent = txt;
      big.style.setProperty('--p', `${Math.round(st.p * 100)}%`);
      big.classList.toggle('ready', ready);
    }
  }
  const card = document.getElementById('enemy-card');
  if (!!card !== !!b.selectedEnemy) return renderSide();
  if (card && b.selectedEnemy) setHtml(card, enemyCard(b, b.selectedEnemy));
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
  if (!ov || !ui.battle) return;
  let reward = '';
  if (win) {
    const id = ui.battle.map.id, rw = rewardFor(id), had = rewardChance(id);
    if (rw && had > 0) {
      if (rollReward(id)) {
        sfx('chestBurst');
        reward = `<div class="reward got">${portrait(rw, 56)}<div>Le boss lâche un champion !<br><b>${esc(rw.name)}</b> — ${esc(rw.title)}</div></div>`;
      } else {
        reward = `<div class="reward miss">${portrait(rw, 56, true)}<div>Pas de champion cette fois.<br>
          <b>${pct(had)}</b> de chance à chaque victoire contre le boss.</div></div>`;
      }
      persist();
    }
  }
  ov.innerHTML = `<div class="result ${win ? 'win' : 'lose'}">
    <h2>${win ? 'Victoire !' : 'Nexus détruit'}</h2>
    <p>${win ? `${esc(ui.battle.map.name)} terminée !` : `Tu as tenu jusqu'à la vague ${wave}.`}</p>
    <p class="small muted">Ton or, tes niveaux et tes objets sont conservés.</p>
    ${reward}
    <div class="row"><button class="btn gold" data-restart>Rejouer</button>
      ${ui.battle.canChallengeBoss() ? '<button class="btn boss" data-boss>Retenter le boss ⚔</button>' : ''}
      <button class="btn" data-leave>Changer de carte</button></div>
    ${store.data.auto ? '<p class="small muted">Mode auto : redémarrage automatique…</p>' : ''}
  </div>`;
  ov.classList.remove('hidden');
}
