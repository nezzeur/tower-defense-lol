// Original hextech chest art (inline SVG) + fullscreen opening sequence. No external assets.
import '../chest.css';
import { sfx, stopSfx } from '../audio';

let uid = 0;

/** Ornate dark-steel chest with gold trim and a glowing teal hextech crystal. `lid` and `core` are animated by CSS. */
export function chestSVG(extra = ''): string {
  const k = `hc${uid++}`;
  const hex = (cx: number, cy: number, r: number) =>
    Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 3 * i - Math.PI / 6; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
  return `<svg class="hx-chest ${extra}" viewBox="0 0 220 190" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${k}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26405a"/><stop offset="1" stop-color="#0b1626"/></linearGradient>
    <linearGradient id="${k}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0e6d2"/><stop offset=".4" stop-color="#c8aa6e"/><stop offset="1" stop-color="#785a28"/></linearGradient>
    <radialGradient id="${k}c" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#7ff5ea"/><stop offset="1" stop-color="#0397ab"/></radialGradient>
    <radialGradient id="${k}i" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#7ff5ea"/><stop offset="1" stop-color="#0397ab" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="110" cy="178" rx="84" ry="9" fill="#000" opacity=".45"/>
  <g class="hx-inner"><rect x="30" y="70" width="160" height="30" fill="url(#${k}i)" opacity="0"/></g>
  <!-- body -->
  <path d="M26 92 H194 V166 Q194 172 188 172 H32 Q26 172 26 166 Z" fill="url(#${k}s)" stroke="#785a28" stroke-width="3"/>
  <path d="M40 104 H180 V160 H40 Z" fill="none" stroke="#0397ab" stroke-opacity=".35" stroke-width="1.5"/>
  <g stroke="#0ac8b9" stroke-opacity=".5" stroke-width="1.5" fill="none">
    <polygon points="${hex(62, 132, 13)}"/><polygon points="${hex(158, 132, 13)}"/>
    <path d="M78 132 H92 M128 132 H142"/>
  </g>
  <rect x="26" y="150" width="168" height="8" fill="url(#${k}g)"/>
  <rect x="26" y="92" width="168" height="7" fill="url(#${k}g)"/>
  <rect x="48" y="92" width="10" height="80" fill="url(#${k}g)" opacity=".9"/><rect x="162" y="92" width="10" height="80" fill="url(#${k}g)" opacity=".9"/>
  <path d="M22 160 L40 160 L40 176 L28 176 Q22 176 22 170 Z M198 160 L180 160 L180 176 L192 176 Q198 176 198 170 Z" fill="url(#${k}g)" stroke="#785a28" stroke-width="1.5"/>
  <!-- lid -->
  <g class="hx-lid">
    <path d="M26 92 V74 Q26 40 110 36 Q194 40 194 74 V92 Z" fill="url(#${k}s)" stroke="#785a28" stroke-width="3"/>
    <path d="M40 90 V76 Q42 52 110 48 Q178 52 180 76 V90" fill="none" stroke="#0397ab" stroke-opacity=".35" stroke-width="1.5"/>
    <rect x="26" y="80" width="168" height="12" fill="url(#${k}g)"/>
    <path d="M48 82 Q50 52 70 46 L70 92 H48 Z M172 82 Q170 52 150 46 L150 92 H172 Z" fill="url(#${k}g)" opacity=".92"/>
    <path d="M70 46 Q110 36 150 46" fill="none" stroke="url(#${k}g)" stroke-width="5" stroke-linecap="round"/>
    <circle cx="36" cy="60" r="4" fill="#f0e6d2"/><circle cx="184" cy="60" r="4" fill="#f0e6d2"/>
  </g>
  <!-- lock plate + crystal -->
  <g class="hx-lock">
    <polygon points="${hex(110, 96, 27)}" fill="url(#${k}g)" stroke="#3a2b10" stroke-width="2"/>
    <polygon points="${hex(110, 96, 20)}" fill="#071320" stroke="#c8aa6e" stroke-width="1.5"/>
    <polygon class="hx-core" points="${hex(110, 96, 14)}" fill="url(#${k}c)" stroke="#e9fffd" stroke-width="1"/>
    <path d="M110 84 L116 96 L110 108 L104 96 Z" fill="#fff" opacity=".7"/>
  </g>
</svg>`;
}

/** Small ambient chest for lists/shop: idle glow pulse + floating particles. */
export function chestIdleHTML(): string {
  const sp = Array.from({ length: 9 }, (_, i) =>
    `<i style="--x:${10 + (i * 37) % 80}%;--dl:${(i * 0.55).toFixed(2)}s;--du:${(3 + (i % 3)).toFixed(1)}s;--s:${2 + (i % 3)}px"></i>`).join('');
  return `<div class="hx-idle"><div class="hx-idle-glow"></div>${chestSVG('hx-idle-art')}<div class="hx-sparks">${sp}</div></div>`;
}

export interface RewardCard { html: string; rarity: number; /** Champion id: with `onPick`, clicking the card chooses it. */ id?: string }

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Runs the opening sequence; `cards` are shown at the reveal. With `onPick`, the player chooses a card right there
 * (the button then only postpones the choice); `onDone` fires when the overlay closes either way.
 */
export function playChestOpening(cards: RewardCard[], onDone: () => void, onPick?: (id: string) => void): void {
  const top = Math.max(...cards.map((c) => c.rarity));
  const ov = document.createElement('div');
  ov.className = `hx-overlay tier${top}${REDUCED() ? ' reduced' : ''}`;
  const runes = Array.from({ length: 6 }, (_, i) => `<i style="--a:${i * 60}deg;--i:${i}"></i>`).join('');
  const lines = Array.from({ length: 14 }, (_, i) => `<i style="--a:${i * (360 / 14)}deg;--i:${i % 5}"></i>`).join('');
  ov.innerHTML = `<div class="hx-bg"></div><div class="hx-rays"></div><div class="hx-lines">${lines}</div>
    <canvas class="hx-fx"></canvas><div class="hx-flash"></div>
    <div class="hx-stage"><div class="hx-runes">${runes}</div><div class="hx-aura"></div><div class="hx-shaker">${chestSVG('hx-main')}</div></div>
    ${onPick ? '<div class="hx-pick-h">Choisis ton champion</div>' : ''}
    <div class="hx-cards">${cards.map((c, i) => `<div class="hx-card r${c.rarity} ${onPick && c.id ? 'pickable' : ''}" style="--i:${i}" ${c.id ? `data-pick="${c.id}"` : ''}><div class="hx-card-in">${c.html}</div><span class="hx-shine"></span></div>`).join('')}</div>
    <button class="hx-take btn ${onPick ? '' : 'gold'} big">${onPick ? 'Choisir plus tard' : 'Récupérer'}</button><div class="hx-skip">Cliquer pour passer</div>`;
  ov.classList.toggle('picking', !!onPick);
  document.body.appendChild(ov);

  const cv = ov.querySelector('canvas') as HTMLCanvasElement;
  const timers: number[] = [];
  const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
  let phase = 0;
  let raf = 0;

  const burst = () => {
    sfx('chestBurst');
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    const g = cv.getContext('2d')!;
    g.scale(dpr, dpr);
    const cx = innerWidth / 2, cy = innerHeight * 0.46;
    const ps = Array.from({ length: 140 }, () => {
      const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 11;
      return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, r: 1.5 + Math.random() * 3.5, l: 1, d: 0.008 + Math.random() * 0.014, c: Math.random() < 0.55 ? '#f3d98d' : Math.random() < 0.5 ? '#7ff5ea' : '#ffffff' };
    });
    const step = () => {
      g.clearRect(0, 0, innerWidth, innerHeight);
      g.globalCompositeOperation = 'lighter';
      let alive = 0;
      for (const p of ps) {
        if (p.l <= 0) continue;
        alive++;
        p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy = p.vy * 0.97 + 0.16; p.l -= p.d;
        g.globalAlpha = Math.max(0, p.l);
        g.fillStyle = p.c;
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
      }
      raf = alive ? requestAnimationFrame(step) : 0;
    };
    step();
  };

  const reveal = () => {
    if (phase >= 3) return;
    phase = 3;
    cards.forEach((_, i) => window.setTimeout(() => sfx('card'), 120 + i * 150));
    ov.classList.add('s-reveal');
    ov.classList.remove('s-charge');
    ov.classList.add('s-open');
  };
  const close = () => {
    timers.forEach(clearTimeout);
    cancelAnimationFrame(raf);
    ov.classList.add('out');
    setTimeout(() => { ov.remove(); onDone(); }, REDUCED() ? 120 : 260);
  };

  if (REDUCED()) {
    ov.classList.add('s-open', 's-reveal');
    phase = 3;
    sfx('card');
  } else {
    ov.classList.add('s-drop'); phase = 0;
    at(750, () => { phase = 1; ov.classList.add('s-charge'); sfx('chestCharge'); });
    at(1850, () => { phase = 2; ov.classList.add('s-open'); burst(); });
    at(2300, reveal);
  }
  let picked = false;
  ov.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.hx-take')) { if (phase >= 3 && !picked) close(); return; }
    const card = (e.target as HTMLElement).closest<HTMLElement>('.hx-card.pickable');
    if (card && onPick && phase >= 3 && !picked) {
      // The chosen card lights up, the others fade, then the overlay closes on the choice
      picked = true;
      sfx('chestBurst');
      card.classList.add('picked');
      ov.querySelectorAll('.hx-card').forEach((c) => { if (c !== card) c.classList.add('dropped'); });
      ov.classList.add('chosen');
      window.setTimeout(() => { onPick(card.dataset.pick!); close(); }, REDUCED() ? 150 : 750);
      return;
    }
    if (phase < 3) {
      timers.forEach(clearTimeout);
      stopSfx('chestCharge');
      ov.classList.add('s-open', 'fast');
      if (phase < 2) burst();
      phase = 2;
      reveal();
    }
  });
}
