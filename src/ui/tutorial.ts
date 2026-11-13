// Guided tips: a bubble anchored to the part of the screen it talks about. Each tip shows once (the save
// remembers the ones already seen); some close by themselves when the player does what they ask.
import { enemyTraits, ENEMIES } from '../data/enemies';
import { persist, store } from '../save';
import { ui } from './common';

interface Tip {
  id: string;
  title: string;
  text: string;
  /** CSS selector of the element the bubble points at (centre of the screen when missing). */
  target?: string;
  /** Shown only while this holds. */
  when: () => boolean;
  /** Closes by itself once this holds (the "Compris" button always works too). */
  done?: () => boolean;
}

const b = () => ui.battle;
const on = (screen: string) => ui.screen === screen && !document.querySelector('.hx-overlay');
const fight = () => ui.screen === 'battle' && !!b() && !b()!.over && !b()!.boonOffer;

/** In order: the first tip that is unseen and applicable is the one on screen. */
const TIPS: Tip[] = [
  // --- World map and menus ---
  { id: 'm-atlas', title: 'Carte du monde', target: '.region-panel, .atlas',
    text: 'Choisis une région, puis une carte. Chaque carte donne jusqu\'à 5 ★ selon les vagues repoussées : 3 ★ ouvrent la carte suivante, et battre la dernière carte d\'une région ouvre la région suivante.',
    when: () => on('maps') },
  { id: 'm-champs', title: 'Tes champions', target: '.coll-layout',
    text: 'Chaque champion a un passif, un ultime et une région. Monte leur niveau avec ton or : +8 % de dégâts par niveau, et un palier d\'ultime aux niveaux 6, 11 et 16.',
    when: () => on('champions') },
  { id: 'm-shop', title: 'Boutique', target: '.chest-panel',
    text: 'Le coffre propose 3 champions : tu en gardes un. Plus bas, les objets : un seul par champion, à équiper depuis sa fiche.',
    when: () => on('shop') },
  { id: 'm-inv', title: 'Inventaire', target: '.loot-rules',
    text: 'Les monstres lâchent des matériaux, avec une chance fixe selon leur rareté. Chaque région a les siens. Ils servent à la Forge.',
    when: () => on('inventory') },
  { id: 'm-forge', title: 'Forge', target: '.forge-grid',
    text: 'Ces objets ne s\'achètent pas : ils se fabriquent avec le butin des régions. Les quantités manquantes sont en rouge.',
    when: () => on('forge') },

  // --- First battle, step by step ---
  { id: 'b-place', title: 'Place ton champion', target: '#team',
    text: 'Glisse un champion de cette barre sur une case libre, près du chemin. Sa portée s\'affiche pendant que tu le déplaces.',
    when: () => fight() && b()!.towers.length === 0, done: () => b()!.towers.length > 0 },
  { id: 'b-start', title: 'Lance la vague', target: '#b-start',
    text: 'Quand ton équipe est prête, lance la première vague (ou touche Espace).',
    when: () => fight() && b()!.towers.length > 0 && b()!.wave === 0 && !b()!.waveActive, done: () => b()!.waveActive || b()!.wave > 0 },
  { id: 'b-lives', title: 'Défends le Nexus', target: '.bstat.lives',
    text: 'Les monstres suivent le chemin jusqu\'à ton Nexus. Chacun qui passe te coûte des vies : à zéro, la partie s\'arrête. Ton or, lui, est toujours conservé.',
    when: () => fight() && b()!.waveActive && b()!.wave === 1 },
  { id: 'b-select', title: 'Améliore ton champion', target: '#board',
    text: 'Clique ton champion sur la carte pour ouvrir sa fiche. Maintiens le clic et glisse pour le déplacer.',
    when: () => fight() && b()!.wave >= 1 && !b()!.waveActive && b()!.towers.length > 0, done: () => !!b()!.selectedTower },
  { id: 'b-panel', title: 'Sa fiche', target: '#details',
    text: 'Ici : monter son niveau avec ton or, choisir son objet, et sa priorité de cible (le plus avancé, le plus fort, le plus faible…).',
    when: () => fight() && !!b()!.selectedTower },
  { id: 'b-ult', title: 'Ultime prêt', target: '#ults',
    text: 'Chaque champion a un ultime qui se recharge en combat. Clique son bouton (ou touches 1 à 9). Pour les ultimes de zone, clique ensuite sur la carte pour viser.',
    when: () => fight() && b()!.towers.some((t) => b()!.ultReady(t)), done: () => !b()!.towers.some((t) => b()!.ultReady(t)) },
  { id: 'b-enemy', title: 'Connais tes ennemis', target: '#board',
    text: 'Clique un monstre pour voir ses PV, son armure, ses traits et ce qu\'il peut lâcher.',
    when: () => fight() && b()!.waveActive && b()!.wave >= 2, done: () => !!b()!.selectedEnemy },
  { id: 'b-speed', title: 'Vitesse et automatismes', target: '.speed',
    text: 'Accélère jusqu\'à x8. « Vagues auto » enchaîne les vagues et relance après une défaite, « Ultimes auto » lance les ultimes quand ils sont utiles. Touche P : pause.',
    when: () => fight() && b()!.wave >= 3 && !b()!.waveActive },
  { id: 'b-traits', title: 'Monstres spéciaux', target: '.next-wave',
    text: 'Les icônes sous un monstre sont ses traits : volant, bouclier, soigneur, régénération… Survole-le pour le détail. Adapte ton équipe et tes priorités de cible.',
    when: () => fight() && b()!.nextWave().some((x) => ENEMIES[x.id] && enemyTraits(ENEMIES[x.id]).length > 0) },
  { id: 'b-syn', title: 'Synergie active', target: '#wave-panel',
    text: 'Deux champions de la même région posés ensemble donnent un bonus à toute l\'équipe. Il grandit à 3 puis 4 champions.',
    when: () => fight() && Object.keys(b()!.syn).length > 0 },
  { id: 'b-modes', title: 'Modes de jeu', target: '#b-modes',
    text: 'Carte terminée : choisis Normal, Boss (la dernière vague seule) ou Infini (sans fin, de plus en plus dur, avec des bénédictions à choisir). Rien ne démarre avant que tu lances la vague.',
    when: () => fight() && !!document.querySelector('#b-modes:not(.hidden)') },
];

/** Tips a returning player does not need to be walked through again. */
const BASICS = ['m-atlas', 'm-champs', 'm-shop', 'b-place', 'b-start', 'b-lives', 'b-select', 'b-panel', 'b-speed'];

let bubble: HTMLElement | null = null;
let ring: HTMLElement | null = null;
let shown: Tip | null = null;

function seen(): string[] {
  const d = store.data;
  if (!Array.isArray(d.tips)) {
    // First run of this system on an existing save: skip the basics for someone who already plays
    d.tips = d.owned.length > 2 ? [...BASICS] : [];
  }
  return d.tips;
}

function mark(id: string): void {
  if (!seen().includes(id)) { seen().push(id); persist(); }
}

function hide(): void {
  bubble?.remove();
  ring?.remove();
  bubble = ring = null;
  shown = null;
}

function show(t: Tip): void {
  hide();
  shown = t;
  ring = document.createElement('div');
  ring.className = 'tip-ring';
  bubble = document.createElement('div');
  bubble.className = 'tip';
  bubble.innerHTML = `<b></b><p></p><div class="tip-foot"><button class="btn gold" data-ok>Compris</button><button class="tip-skip" data-skip>Passer le tutoriel</button></div>`;
  bubble.querySelector('b')!.textContent = t.title;
  bubble.querySelector('p')!.textContent = t.text;
  bubble.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('button');
    if (!el) return;
    if (el.dataset.skip !== undefined) { for (const x of TIPS) mark(x.id); } else mark(t.id);
    hide();
    tutorialTick();
  });
  document.body.append(ring, bubble);
  place();
}

/** Keeps the bubble next to its target (the layout moves: panels refresh, the page scrolls). */
function place(): void {
  if (!shown || !bubble || !ring) return;
  const el = shown.target ? document.querySelector<HTMLElement>(shown.target) : null;
  const r = el?.getBoundingClientRect();
  const bw = bubble.offsetWidth, bh = bubble.offsetHeight, vw = innerWidth, vh = innerHeight, gap = 14;
  if (!r || r.width === 0 || r.bottom < 0 || r.top > vh) {
    ring.style.display = 'none';
    bubble.style.left = `${Math.max(8, (vw - bw) / 2)}px`;
    bubble.style.top = `${Math.max(8, vh - bh - 24)}px`;
    bubble.dataset.side = 'none';
    return;
  }
  ring.style.display = '';
  ring.style.left = `${r.left - 4}px`;
  ring.style.top = `${r.top - 4}px`;
  ring.style.width = `${r.width + 8}px`;
  ring.style.height = `${r.height + 8}px`;
  // Prefer above or below the target, whichever has room; large targets get the bubble inside, at the bottom
  let top: number, side: string;
  if (r.top - bh - gap >= 8) { top = r.top - bh - gap; side = 'top'; }
  else if (r.bottom + bh + gap <= vh - 8) { top = r.bottom + gap; side = 'bottom'; }
  else { top = Math.min(vh - bh - 12, r.bottom - bh - 12); side = 'none'; }
  const left = Math.max(8, Math.min(vw - bw - 8, r.left + r.width / 2 - bw / 2));
  bubble.style.left = `${left}px`;
  bubble.style.top = `${Math.max(8, top)}px`;
  bubble.dataset.side = side;
  bubble.style.setProperty('--ax', `${Math.max(16, Math.min(bw - 16, r.left + r.width / 2 - left))}px`);
}

/** Decides which tip (if any) is on screen. Called on every screen render and a few times a second in battle. */
export function tutorialTick(): void {
  if (typeof document === 'undefined' || !store.data.owned.length) { hide(); return; }
  const done = seen();
  if (shown) {
    if (done.includes(shown.id)) hide();
    else if (shown.done?.()) { mark(shown.id); hide(); }
    else if (!shown.when()) hide();
  }
  if (!shown) {
    const next = TIPS.find((t) => !done.includes(t.id) && t.when() && !t.done?.());
    if (next) show(next);
  }
  place();
}

/** Options: play every tip again. */
export function resetTutorial(): void {
  store.data.tips = [];
  persist();
  hide();
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  // Menus have no refresh loop of their own
  window.setInterval(() => { if (ui.screen !== 'battle') tutorialTick(); }, 500);
}
