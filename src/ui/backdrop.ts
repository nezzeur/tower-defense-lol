// Living backdrop behind the menus: the splash of one of the player's champions (loaded at runtime from
// Data Dragon, never bundled), a colour that follows the screen, and drifting hextech motes. Visual only.
import { splashUrl } from '../art/champArt';
import { level } from '../game';
import { store } from '../save';
import { ui, type Screen } from './common';

/** Light colour of each screen (the world map uses the selected region's colour instead). */
const AMBIENT: Record<Screen, string> = {
  maps: '#0ac8b9', champions: '#c8aa6e', shop: '#a06bff', inventory: '#3fb6d8', forge: '#ff8a3c', bestiary: '#e84057', options: '#7a8ca8', battle: '#0ac8b9',
};
/** Which of the player's strongest champions each screen shows, so the menus do not all look the same. */
const SLOT: Screen[] = ['maps', 'shop', 'inventory', 'forge', 'bestiary', 'options'];

let root: HTMLElement | null = null;
let layers: HTMLElement[] = [];
let front = 0;
let shown = '';
let tintOverride: string | null = null;

function build(): void {
  root = document.createElement('div');
  root.id = 'backdrop';
  root.innerHTML = '<div class="bd-img"></div><div class="bd-img"></div><div class="bd-veil"></div><canvas class="bd-motes"></canvas>';
  document.body.prepend(root);
  layers = [...root.querySelectorAll<HTMLElement>('.bd-img')];
  motes(root.querySelector('canvas')!);
}

function featured(): string | undefined {
  const owned = store.data.owned;
  if (!owned.length) return undefined;
  if (ui.screen === 'champions' && ui.selectedChamp && owned.includes(ui.selectedChamp)) return ui.selectedChamp;
  const best = [...owned].sort((a, b) => level(b) - level(a) || a.localeCompare(b));
  return best[Math.max(0, SLOT.indexOf(ui.screen)) % best.length];
}

const quiet = () => ui.screen === 'battle' || store.data.lowFx || matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The world map lights the page with the colour of the region being looked at. */
export function setAmbient(color: string | null): void {
  tintOverride = color;
  syncBackdrop();
}

/** Call after anything that may change the screen or the selected champion. */
export function syncBackdrop(): void {
  if (typeof document === 'undefined') return;
  if (!root) build();
  root!.classList.toggle('off', ui.screen === 'battle');
  root!.classList.toggle('still', quiet());
  document.body.dataset.screen = ui.screen;
  document.documentElement.style.setProperty('--amb', (ui.screen === 'maps' && tintOverride) || AMBIENT[ui.screen]);
  const id = ui.screen === 'battle' ? undefined : featured();
  const url = id ? splashUrl(id) : '';
  if (url === shown) return;
  shown = url;
  if (!url) { layers.forEach((l) => l.classList.remove('on')); return; }
  // Load first, then cross-fade: the page never shows a half-loaded picture
  const img = new Image();
  img.onload = () => {
    if (shown !== url) return;
    const next = layers[1 - front];
    next.style.backgroundImage = `url('${url}')`;
    next.classList.add('on');
    layers[front].classList.remove('on');
    front = 1 - front;
  };
  img.src = url;
}

interface Mote { x: number; y: number; r: number; vy: number; sway: number; ph: number; teal: boolean }

function motes(c: HTMLCanvasElement): void {
  const g = c.getContext('2d')!;
  const seed = (anywhere: boolean): Mote => ({
    x: Math.random(), y: anywhere ? Math.random() : 1.04, r: 0.6 + Math.random() * 1.8, vy: 0.012 + Math.random() * 0.03,
    sway: 0.004 + Math.random() * 0.012, ph: Math.random() * 6.28, teal: Math.random() < 0.35,
  });
  const list = Array.from({ length: 44 }, () => seed(true));
  const fit = () => { c.width = innerWidth; c.height = innerHeight; };
  fit();
  window.addEventListener('resize', fit);
  let last = performance.now(), blank = true;
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (quiet()) { if (!blank) { g.clearRect(0, 0, c.width, c.height); blank = true; } return; }
    blank = false;
    g.clearRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      m.y -= m.vy * dt;
      m.x += Math.sin(now / 1000 + m.ph) * m.sway * dt;
      if (m.y < -0.04) list[i] = seed(false);
      const a = (0.35 + 0.35 * Math.sin(now / 700 + m.ph * 3)) * Math.min(1, m.y * 4);
      const x = m.x * c.width, y = m.y * c.height;
      g.fillStyle = m.teal ? `rgba(10,200,185,${a * 0.22})` : `rgba(240,200,120,${a * 0.22})`;
      g.beginPath(); g.arc(x, y, m.r * 4, 0, 6.28); g.fill();
      g.fillStyle = m.teal ? `rgba(205,250,250,${a})` : `rgba(255,236,190,${a})`;
      g.beginPath(); g.arc(x, y, m.r, 0, 6.28); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  };
  requestAnimationFrame(loop);
}

if (typeof window !== 'undefined') {
  // Battle start/end and champion selection do not all go through the menu render
  window.setInterval(syncBackdrop, 600);
}
