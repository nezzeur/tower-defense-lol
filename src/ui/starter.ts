import { esc, app, artCard } from './common';
import { CHAMPIONS } from '../data/champions';

export function renderStarter(): void {
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
