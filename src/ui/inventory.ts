import { REGIONS } from '../art/worldArt';
import { FORGE_ITEMS, ITEM_BY_ID } from '../data/items';
import { DROP_CHANCE, MATERIALS, MAT_BY_ID, MAT_RARITY } from '../data/loot';
import { canCraft, champ, ENDLESS_LOOT, fmt, pct } from '../game';
import { store } from '../save';
import type { MaterialDef } from '../types';
import { esc, itemIcon, portrait } from './common';

const have = (id: string): number => store.data.mats[id] ?? 0;
const regionName = (id: string): string => REGIONS.find((r) => r.id === id)?.name ?? id;

/** How a material drops, in words. */
const odds = (m: MaterialDef): string =>
  m.relic ? `${pct(ENDLESS_LOOT.relicChance)} par boss d'infini` : `${pct(DROP_CHANCE[m.rarity])} par tirage`;

/** Small material badge: icon, optional amount, rarity colour, tooltip with source and drop chance. */
export function matChip(m: MaterialDef, amount?: string, cls = ''): string {
  const tip = `${m.name} — ${MAT_RARITY[m.rarity]}\n${m.region ? `Tous les monstres : ${regionName(m.region)}` : m.desc}\n${odds(m)}`;
  return `<span class="mat m${m.rarity} ${cls}" title="${esc(tip)}"><i>${m.icon}</i>${amount !== undefined ? `<b>${amount}</b>` : ''}</span>`;
}

function matTile(m: MaterialDef): string {
  const n = have(m.id);
  return `<div class="mat-tile m${m.rarity} ${n ? '' : 'none'}">
    <div class="mat-ico">${m.icon}</div>
    <div class="mat-body"><b>${esc(m.name)}</b>
      <span class="small"><em class="rar m${m.rarity}">${MAT_RARITY[m.rarity]}</em> · ${odds(m)}</span>
      <span class="small muted">${esc(m.region ? `Tous les monstres de la région` : m.desc)}</span></div>
    <div class="mat-n">${fmt(n)}</div>
  </div>`;
}

export function inventoryScreen(): string {
  const groups: [string, MaterialDef[]][] = [
    ['Partout — selon le monstre', MATERIALS.filter((m) => !m.region && !m.relic)],
    [`Reliques — boss du mode infini (toutes les ${ENDLESS_LOOT.bossEvery} vagues)`, MATERIALS.filter((m) => m.relic)],
    ...REGIONS.filter((r) => MATERIALS.some((m) => m.region === r.id))
      .sort((a, b) => MATERIALS.findIndex((m) => m.region === a.id) - MATERIALS.findIndex((m) => m.region === b.id))
      .map((r) => [r.name, MATERIALS.filter((m) => m.region === r.id)] as [string, MaterialDef[]]),
  ];
  const total = Object.values(store.data.mats).reduce((n, v) => n + v, 0);
  const items = store.data.items.map((id) => {
    const it = ITEM_BY_ID[id];
    const holder = Object.entries(store.data.equip).find(([, x]) => x === id)?.[0];
    return `<div class="inv-item ${it.craft ? 'forged' : ''}">${itemIcon(it, 40)}<div><b>${esc(it.name)}</b><span class="small muted">${esc(it.desc)}</span></div>
      ${holder ? `<div class="si-holder">${portrait(champ(holder), 26)}<span>${esc(champ(holder).name)}</span></div>` : '<span class="small muted">Libre</span>'}</div>`;
  }).join('');
  return `<div class="inventory">
    <section class="card loot-rules">
      <h3>Butin des monstres</h3>
      <p class="muted small">Chaque monstre éliminé peut lâcher des matériaux. La chance est fixe et ne dépend que de la rareté du matériau.
        Les reliques ne tombent que sur le boss du mode infini, sans aucune garantie.
        Les gros monstres font plusieurs tirages : sbire canon et carapateur 2, super sbire et krug 3, gromp 4, monstre épique 25, boss final 50.</p>
      <div class="odds">${[1, 2, 3, 4].map((r) => `<div class="odd m${r}"><span>${MAT_RARITY[r]}</span><b>${pct(DROP_CHANCE[r])}</b><i>par tirage</i></div>`).join('')}</div>
    </section>
    <section>
      <div class="shop-head"><h2>Matériaux</h2><div class="muted small">${fmt(total)} en stock · utilisés à la Forge</div></div>
      ${groups.map(([name, list]) => `<h3 class="inv-group">${esc(name)}</h3><div class="mat-grid">${list.map(matTile).join('')}</div>`).join('')}
    </section>
    <section>
      <div class="shop-head"><h2>Objets</h2><div class="muted small">${store.data.items.length} possédé(s) · un objet par champion, à équiper depuis la fiche du champion ou la Boutique</div></div>
      <div class="inv-items">${items || '<span class="muted small">Aucun objet pour l\'instant : achète-en à la Boutique ou forge-en.</span>'}</div>
    </section>
  </div>`;
}

export function forgeScreen(): string {
  const order = ['rift', 'demacia', 'freljord', 'noxus', 'ionia', 'all'];
  const cards = [...FORGE_ITEMS].sort((a, b) => order.indexOf(a.origin ?? 'all') - order.indexOf(b.origin ?? 'all')).map((it, i) => {
    const owned = store.data.items.includes(it.id);
    const ready = canCraft(it.id);
    const holder = Object.entries(store.data.equip).find(([, x]) => x === it.id)?.[0];
    const needs = Object.entries(it.craft!).map(([id, n]) => {
      const m = MAT_BY_ID[id], h = have(id);
      return `<div class="need ${h >= n || owned ? 'ok' : ''}">${matChip(m)}<span>${esc(m.name)}</span><b>${owned ? n : `${fmt(Math.min(h, n))} / ${n}`}</b></div>`;
    }).join('');
    return `<div class="card forge-card ${owned ? 'owned' : ready ? 'ready' : ''}" style="--d:${i * 40}ms">
      <div class="forge-top">${itemIcon(it, 52)}<div><b>${esc(it.name)}</b>
        <span class="tagc">${it.origin === 'all' ? 'Légendaire' : esc(regionName(it.origin ?? ''))}</span><p>${esc(it.desc)}</p></div></div>
      <div class="needs">${needs}</div>
      <div class="forge-foot">${owned
        ? `<span class="small owned">Forgé${holder ? ` · sur ${esc(champ(holder).name)}` : ' · libre'}</span>
           <select data-equip-item="${it.id}"><option value="">Équiper sur…</option>${store.data.owned.map((id) => `<option value="${id}" ${holder === id ? 'selected' : ''}>${esc(champ(id).name)}</option>`).join('')}</select>`
        : `<span class="small muted">${ready ? 'Matériaux réunis' : 'Matériaux manquants'}</span>
           <button class="btn gold" data-craft="${it.id}" ${ready ? '' : 'disabled'}>Forger</button>`}</div>
    </div>`;
  }).join('');
  return `<div class="forge">
    <div class="shop-head"><h2>Forge</h2>
      <div class="muted small">${FORGE_ITEMS.filter((i) => store.data.items.includes(i.id)).length}/${FORGE_ITEMS.length} forgés · objets introuvables en boutique, fabriqués avec le butin des régions</div></div>
    <div class="forge-grid">${cards}</div>
  </div>`;
}
