import { chestIdleHTML } from '../art/chest';
import { ITEMS } from '../data/items';
import { champ, CHEST_CHOICES, chestPool, chestPrice, EPIC_PITY, fmt } from '../game';
import { store } from '../save';
import { artCard, chip, esc, itemIcon, portrait, RARITY, ROLE_ICON } from './common';

export const shop = { cat: '' };

export function shopScreen(): string {
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
  const items = ITEMS.filter((it) => !shop.cat || it.category === shop.cat).map((it, i) => {
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
      <div class="chest-visual">${chestIdleHTML()}</div>
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
        <div class="fgroup">${chip('data-sf', '', 'Tous', !shop.cat)}${cats.map((c) => chip('data-sf', c, c, shop.cat === c)).join('')}</div>
        <div class="muted small">${store.data.items.length}/${ITEMS.length} possédés · un objet par champion</div></div>
      <div class="shop-items">${items}</div>
    </section>
  </div>`;
}
