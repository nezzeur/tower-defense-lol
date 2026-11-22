import { abilityIcons, itemIconUrl, loadingUrl, squareUrl } from '../art/champArt';
import { drawMapHD } from '../art/mapHD';
import { initials, type Battle } from '../battle';
import { MAP_BY_ID } from '../data/maps';
import { ITEMS, ITEM_BY_ID } from '../data/items';
import { champ, fmt, level, levelCost, MAX_LEVEL, ULT_LEVELS, ultRank } from '../game';
import { persist, store } from '../save';
import type { ChampionDef, Stats } from '../types';
import { render } from './index';
import { renderSide } from './battleHud';

export type Screen = 'maps' | 'champions' | 'shop' | 'inventory' | 'forge' | 'bestiary' | 'options' | 'battle';

export const app = document.getElementById('app')!;
/** Shared mutable UI state (ES module bindings can't be reassigned across files). */
export const ui = {
  screen: 'maps' as Screen,
  battle: null as Battle | null,
  tick: 0,
  selectedChamp: null as string | null,
};

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function portrait(def: ChampionDef, size = 44, locked = false): string {
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.34)}px;`
    + (locked ? '' : `background:${def.color};`);
  const img = locked ? '' : `<img src="${squareUrl(def.id)}" alt="" loading="lazy" onerror="this.remove()">`;
  return `<div class="portrait ${locked ? 'locked' : ''} r${def.rarity}" style="${style}"><span>${locked ? '?' : initials(def.name)}</span>${img}</div>`;
}

/** Tall card with the champion's loading-screen art. */
export function artCard(def: ChampionDef, attrs: string, body: string, delay = 0): string {
  return `<button class="art-card r${def.rarity}" ${attrs} style="--d:${delay}ms;--c:${def.color}">
    <div class="art-img" style="background-image:url('${loadingUrl(def.id)}')"></div>
    <div class="art-body">${body}</div></button>`;
}

const previews = new Map<string, string>();
export function mapPreview(id: string): string {
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

export function starRow(n: number, max = 5): string {
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
  if (s.unfreezable) L.push('Insensible au <b>gel</b> des boss');
  if (s.ultOnKill) L.push(`Ultime <b>−${s.ultOnKill} s</b> par élim.`);
  if (s.execute) L.push(`Achève sous <b>${Math.round(s.execute * 100)} %</b> PV`);
  if (s.trueSight) L.push('Ignore <b>boucliers</b> et vol');
  if (s.bossMult) L.push(`Contre boss <b>x${s.bossMult.toFixed(2)}</b>`);
  if (s.killStack) L.push(s.killStack.sqrt ? `Cumul/élim. <b>+${s.killStack.amount.toFixed(2)}</b> (partie, de plus en plus lent)` : `Cumul/élim. <b>+${Math.round(s.killStack.amount * 100)} %</b> (partie)`);
  return L;
}

export function itemSelect(def: ChampionDef): string {
  const cur = store.data.equip[def.id] ?? '';
  const opts = store.data.items.map((id) => {
    const holder = Object.entries(store.data.equip).find(([, it]) => it === id)?.[0];
    const note = holder && holder !== def.id ? ` (sur ${champ(holder).name})` : '';
    return `<option value="${id}" ${id === cur ? 'selected' : ''}>${ITEM_BY_ID[id].icon} ${esc(ITEM_BY_ID[id].name)}${esc(note)}</option>`;
  }).join('');
  return `<label class="item-sel">Objet
    <select data-equip="${def.id}"><option value="">— Aucun —</option>${opts}</select></label>`;
}

export function equip(champId: string, itemId: string): void {
  for (const [c, it] of Object.entries(store.data.equip)) if (it === itemId) delete store.data.equip[c];
  if (itemId) store.data.equip[champId] = itemId; else delete store.data.equip[champId];
  persist();
}

export function levelButtons(def: ChampionDef): string {
  const lvl = level(def.id);
  if (lvl >= MAX_LEVEL) return '<div class="muted">Niveau maximum</div>';
  return `<div class="row">
    <button class="btn gold" data-lvl="${def.id}" data-cost="${levelCost(lvl, def.rarity)}">Niveau ${lvl + 1} — ◆ ${fmt(levelCost(lvl, def.rarity))}</button>
    <button class="btn" data-lvl10="${def.id}" title="Monte de 10 niveaux tant que l'or suffit">+10</button>
  </div>`;
}

export const RARITY = ['', 'Commun', 'Rare', 'Épique'];
export const ROLE_ICON: Record<string, string> = { Tireur: '🏹', Mage: '✨', Combattant: '⚔', Support: '✚', Assassin: '🗡' };

export function chip(attr: string, value: string, label: string, on: boolean): string {
  return `<button class="chip ${on ? 'on' : ''}" ${attr}="${value}">${label}</button>`;
}

export function itemIcon(it: (typeof ITEMS)[number], size = 44): string {
  return it.dd
    ? `<img class="item-img" src="${itemIconUrl(it.dd)}" alt="" style="width:${size}px;height:${size}px" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'item-img emoji',textContent:'${it.icon}'}))">`
    : `<span class="item-img emoji" style="width:${size}px;height:${size}px">${it.icon}</span>`;
}

export function mapThumb(id: string): string {
  return `<img src="${mapPreview(id)}" alt="">`;
}

export function abilityRow(def: ChampionDef): string {
  const icons = abilityIcons(def.id, () => { if (ui.battle?.selectedTower?.def.id === def.id || ui.screen === 'champions') ui.battle ? renderSide() : render(); });
  const rank = ultRank(level(def.id));
  const ico = (src: string | undefined, fallback: string, cls: string) =>
    src ? `<img class="abil ${cls}" src="${src}" alt="">` : `<span class="abil ${cls} ph">${fallback}</span>`;
  return `<div class="abilities">
    <div class="ab">${ico(icons?.passive, 'P', 'p')}<div><b>${esc(icons?.passiveName ?? 'Passif')}</b><span>${esc(def.passive)}</span></div></div>
    <div class="ab act">${ico(icons?.ult, 'R', 'r')}<div><b>${esc(def.active.name)} <i class="cdtag">${def.active.cd} s</i></b><span>${esc(def.active.desc)}</span></div></div>
    <div class="ab ${rank ? '' : 'off'}">${ico(undefined, '★', 'r')}<div><b>Rang d'ultime <i>${ULT_LEVELS.map((l, i) => `<em class="${i < rank ? 'on' : ''}">${l}</em>`).join('')}</i></b><span>${esc(def.ult.desc)}</span></div></div>
  </div>`;
}

/** Round ultimate button (battle HUD): icon, cooldown sweep and key hint filled in by refreshLive. */
export function ultButton(def: ChampionDef, attrs: string, key?: number): string {
  const icons = abilityIcons(def.id, () => { if (ui.battle) renderSide(); });
  const img = icons?.ult ? `<img src="${icons.ult}" alt="" draggable="false">` : `<span class="ini">${initials(def.name)}</span>`;
  return `<button class="ult-btn" ${attrs} data-ult-btn="${def.id}" title="${esc(def.active.name)} — ${esc(def.active.desc)} (${def.active.cd} s)">
    ${img}<span class="sweep"></span><i class="cdn"></i>${key ? `<kbd>${key}</kbd>` : ''}</button>`;
}

export function flash(msg: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
