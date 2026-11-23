// Leaderboard screen: the best players with an account and a pseudo, sorted by one stat (data from Supabase).
import { leaderboard, pseudo, rankingEnabled, type Ranked, type RankSort } from '../cloud';
import { fmt } from '../game';
import { esc } from './common';
import { render } from './index';

export const rank: { sort: RankSort; rows: Ranked[] | null; error: string; loading: boolean } = { sort: 'kills', rows: null, error: '', loading: false };

const SORTS: [RankSort, string][] = [['kills', 'Éliminations'], ['gold_earned', 'Or gagné'], ['stars', 'Étoiles'], ['endless', 'Record infini']];

function load(): void {
  if (rank.loading) return;
  rank.loading = true;
  rank.error = '';
  const sort = rank.sort;
  leaderboard(sort)
    .then((rows) => { if (rank.sort === sort) rank.rows = rows; })
    .catch((e: Error) => { rank.error = e.message || 'Classement indisponible (hors ligne ?)'; rank.rows = []; })
    .finally(() => { rank.loading = false; render(); });
}

export function rankingScreen(): string {
  if (!rankingEnabled()) return '<section class="card"><h3>Classement</h3><p class="muted">Classement indisponible sur cette version.</p></section>';
  if (!rank.rows) load();
  const me = pseudo()?.toLowerCase();
  const head = `<div class="rank-sorts">${SORTS.map(([id, label]) => `<button class="tab ${rank.sort === id ? 'on' : ''}" data-rank-sort="${id}">${label}</button>`).join('')}</div>`;
  const hint = me ? '' : '<p class="small muted">Crée un compte et choisis un pseudo (Options &gt; Compte) pour apparaître ici.</p>';
  if (!rank.rows) return `<div class="ranking"><h2>Classement</h2>${head}<p class="muted">Chargement…</p></div>`;
  const rows = rank.rows.map((r, i) => `<tr class="${r.pseudo.toLowerCase() === me ? 'me' : ''} ${i < 3 ? `top${i + 1}` : ''}">
      <td class="rk">${i + 1}</td><td class="ps">${esc(r.pseudo)}</td>
      <td class="${rank.sort === 'kills' ? 'on' : ''}">${fmt(r.kills)}</td><td class="${rank.sort === 'gold_earned' ? 'on' : ''}">${fmt(r.gold_earned)}</td>
      <td class="${rank.sort === 'stars' ? 'on' : ''}">${r.stars}</td><td>${r.maps}</td><td>${r.champions}</td>
      <td class="${rank.sort === 'endless' ? 'on' : ''}">${r.endless}</td></tr>`).join('');
  return `<div class="ranking"><h2>Classement</h2>${head}${hint}
    ${rank.error ? `<p class="small red-text">${esc(rank.error)}</p>` : ''}
    ${rank.rows.length ? `<div class="rank-wrap"><table class="rank-table"><thead><tr><th>#</th><th>Joueur</th><th>Éliminations</th><th>Or gagné</th><th>★</th><th>Cartes</th><th>Champions</th><th>Infini</th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : '<p class="muted">Personne dans le classement pour l\'instant.</p>'}
  </div>`;
}
