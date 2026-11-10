import { loadingUrl, splashUrl } from '../art/champArt';
import { CHAMPIONS } from '../data/champions';
import { ITEMS, ITEM_BY_ID } from '../data/items';
import { MAPS, MAP_BY_ID } from '../data/maps';
import { champ, computeStats, fmt, level, MAX_LEVEL, ULT_LEVELS, ultRank } from '../game';
import { SYNERGIES, SYN_TIERS, synText } from '../data/synergies';
import { store } from '../save';
import type { ChampionDef } from '../types';
import { abilityRow, chip, esc, itemIcon, itemSelect, levelButtons, RARITY, ROLE_ICON, statLines, ui } from './common';

export const coll = { role: '', region: '', owned: 'all' as 'all' | 'owned' | 'locked', sort: 'level' as 'level' | 'name' | 'rarity' };

export function champsScreen(): string {
  const owned = store.data.owned;
  if (!ui.selectedChamp || !owned.includes(ui.selectedChamp)) ui.selectedChamp = owned[0];
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
    return `<button class="coll-card r${c.rarity} ${has ? '' : 'locked'} ${c.id === ui.selectedChamp ? 'sel' : ''}"
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
    <aside class="panel coll-detail">${champDetail(champ(ui.selectedChamp))}</aside>
  </div>`;
}

function synergyInfo(def: ChampionDef): string {
  const sy = SYNERGIES[def.region];
  const mates = CHAMPIONS.filter((c) => c.region === def.region).length;
  if (!sy) return `<div class="syn-info"><b>${esc(def.region)}</b><span class="small muted">Pas de synergie de région (un seul champion).</span></div>`;
  return `<div class="syn-info"><b>${esc(def.region)} — ${esc(sy.name)}</b>
    ${SYN_TIERS.map((t) => `<span class="small"><kbd>${t.n}${t.n === 4 ? '+' : ''}</kbd> ${esc(synText(sy, t.v))}</span>`).join('')}
    <span class="small muted">${mates} champion${mates > 1 ? 's' : ''} de cette région dans le jeu</span></div>`;
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
    ${synergyInfo(def)}
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
