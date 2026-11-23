import { fmt, stars } from '../game';
import { store } from '../save';
import { app, esc, ui, type Screen } from './common';
import { champsScreen } from './collection';
import { currentMap, mountWorld, mapsScreen } from './atlas';
import { syncBackdrop } from './backdrop';
import { MAP_BY_ID } from '../data/maps';
import { forgeScreen, inventoryScreen } from './inventory';
import { optionsScreen } from './options';
import { bestiaryScreen } from './bestiary';
import { rankingScreen } from './ranking';
import { shopScreen } from './shop';
import { renderStarter } from './starter';
import './events';
import { setMusic } from '../music';
import { tutorialTick } from './tutorial';

export { statLines } from './common';

const CREST = `<svg class="crest" viewBox="0 0 40 44" aria-hidden="true"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f0e6d2"/><stop offset="1" stop-color="#785a28"/></linearGradient></defs>
  <path d="M20 2 36 11v22L20 42 4 33V11Z" fill="#0a1428" stroke="url(#cg)" stroke-width="2"/><path d="M20 9l8 6-3 3 3 9-8 7-8-7 3-9-3-3z" fill="url(#cg)"/><path d="M20 16l3 5-3 9-3-9z" fill="#0ac8b9"/></svg>`;
let lastScreen = '';

function header(): string {
  const tabs: [Screen, string][] = [['maps', 'Cartes'], ['champions', 'Champions'], ['shop', 'Boutique'], ['inventory', 'Inventaire'], ['forge', 'Forge'], ['bestiary', 'Bestiaire'], ['ranking', 'Classement'], ['options', 'Options']];
  const next = MAP_BY_ID[currentMap()];
  return `<header class="top">
    <div class="logo" data-nav="maps">${CREST}<div>RIFT<span>DEFENDERS</span></div></div>
    <nav>${tabs.map(([id, label]) => `<button class="tab ${ui.screen === id ? 'on' : ''}" data-nav="${id}">${label}</button>`).join('')}</nav>
    <div class="wallet"><span class="gold" title="Or">◆ <b id="h-gold">${fmt(store.data.gold)}</b></span>
      <span class="star-total" title="Étoiles gagnées">★ ${stars()}</span></div>
    <button class="btn start play" data-map="${next.id}" title="Reprendre sur ta carte en cours"><b>Jouer</b><small>${esc(next.name)}</small></button>
  </header>`;
}

export function render(): void {
  if (!store.data.owned.length) return renderStarter();
  if (ui.screen === 'battle') return;
  const body = ui.screen === 'maps' ? mapsScreen() : ui.screen === 'champions' ? champsScreen()
    : ui.screen === 'shop' ? shopScreen() : ui.screen === 'inventory' ? inventoryScreen() : ui.screen === 'forge' ? forgeScreen() : ui.screen === 'bestiary' ? bestiaryScreen() : ui.screen === 'ranking' ? rankingScreen() : optionsScreen();
  // The entrance plays when the screen changes, not on every refresh of the same screen
  app.innerHTML = header() + `<main class="screen ${lastScreen === ui.screen ? '' : 'enter'}">${body}</main>`;
  lastScreen = ui.screen;
  syncBackdrop();
  if (ui.screen === 'maps') mountWorld();
  tutorialTick();
}

export function go(s: Screen): void {
  ui.screen = s;
  if (s !== 'battle') setMusic('menu');
  render();
}

setMusic('menu');
