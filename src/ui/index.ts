import { fmt, stars } from '../game';
import { store } from '../save';
import { app, ui, type Screen } from './common';
import { champsScreen } from './collection';
import { mountWorld, mapsScreen } from './atlas';
import { optionsScreen } from './options';
import { shopScreen } from './shop';
import { renderStarter } from './starter';
import './events';

export { statLines } from './common';

function header(): string {
  const tabs: [Screen, string][] = [['maps', 'Cartes'], ['champions', 'Champions'], ['shop', 'Boutique'], ['options', 'Options']];
  return `<header class="top">
    <div class="logo">RIFT<span>DEFENDERS</span></div>
    <nav>${tabs.map(([id, label]) => `<button class="tab ${ui.screen === id ? 'on' : ''}" data-nav="${id}">${label}</button>`).join('')}</nav>
    <div class="wallet"><span class="gold">◆ <b id="h-gold">${fmt(store.data.gold)}</b></span>
      <span class="star-total">★ ${stars()}</span></div>
  </header>`;
}

export function render(): void {
  if (!store.data.owned.length) return renderStarter();
  if (ui.screen === 'battle') return;
  const body = ui.screen === 'maps' ? mapsScreen() : ui.screen === 'champions' ? champsScreen()
    : ui.screen === 'shop' ? shopScreen() : optionsScreen();
  app.innerHTML = header() + `<main class="screen">${body}</main>`;
  if (ui.screen === 'maps') mountWorld();
}

export function go(s: Screen): void {
  ui.screen = s;
  render();
}
