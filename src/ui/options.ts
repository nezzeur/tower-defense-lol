import { fmt, stars } from '../game';
import { account, cloudEnabled, conflict, lastSync, pseudo, status } from '../cloud';
import { store, type SaveData } from '../save';
import { esc } from './common';

/** One-line summary of a save, to compare the account's copy with this device's. */
function brief(d: SaveData): string {
  const lv = Object.values(d.levels).reduce((n, l) => n + l, 0);
  const st = Object.values(d.best).length;
  return `${d.owned.length} champions · niveaux cumulés ${lv} · ${st} cartes jouées · ${fmt(d.gold)} or · ${d.runs} parties`;
}

/** Account panel: sign in to keep the same save on every device. */
function accountCard(): string {
  if (!cloudEnabled()) return '';
  const who = account();
  const msg = status ? `<p class="small acc-msg">${esc(status)}</p>` : '';
  if (!who) {
    return `<section class="card"><h3>Compte</h3>
      <p class="muted small">Connecte-toi pour retrouver ta progression sur tous tes appareils, sans code à copier.</p>
      <form class="acc-form" data-acc-form>
        <input id="acc-email" type="email" autocomplete="email" placeholder="E-mail" required>
        <input id="acc-pass" type="password" autocomplete="current-password" placeholder="Mot de passe (6 caractères min.)" minlength="6" required>
        <div class="row"><button class="btn gold" data-acc="login">Se connecter</button><button class="btn" data-acc="signup">Créer un compte</button></div>
      </form>${msg}</section>`;
  }
  const when = lastSync() ? new Date(lastSync()!).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais';
  const pick = conflict ? `<div class="acc-conflict">
      <div><b>Compte</b> (${esc(new Date(conflict.updated_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }))})<br><span class="small">${esc(brief(conflict.data))}</span></div>
      <div><b>Cet appareil</b><br><span class="small">${esc(brief(store.data))}</span></div>
      <div class="row"><button class="btn gold" data-acc="keep-remote">Garder le compte</button><button class="btn" data-acc="keep-local">Garder cet appareil</button></div>
    </div>` : '';
  return `<section class="card"><h3>Compte</h3>
    <p class="small">Connecté : <b>${esc(who)}</b> · dernière synchro ${esc(when)}</p>
    <p class="muted small">La progression est envoyée sur ton compte quelques secondes après chaque changement.</p>
    <form class="acc-pseudo row" data-pseudo-form>
      <input id="acc-pseudo" maxlength="16" placeholder="Pseudo pour le classement" value="${esc(pseudo() ?? '')}">
      <button class="btn ${pseudo() ? '' : 'gold'}" data-acc="pseudo">${pseudo() ? 'Changer de pseudo' : 'Choisir mon pseudo'}</button>
    </form>
    ${pseudo() ? '' : '<p class="small muted">Sans pseudo, tu n\'apparais pas dans le classement.</p>'}
    ${pick}
    <div class="row"><button class="btn" data-acc="sync">Synchroniser</button><button class="btn" data-acc="logout">Se déconnecter</button></div>${msg}</section>`;
}

export function optionsScreen(): string {
  const d = store.data;
  return `<div class="options">
    <section class="card"><h3>Son</h3>
      <div class="row"><button class="btn" data-mute>${d.muted ? 'Son coupé' : 'Son activé'}</button>
        <input type="range" id="opt-volume" min="0" max="100" step="1" value="${Math.round(d.volume * 100)}" aria-label="Volume">
        <span id="opt-volume-val" class="small">${Math.round(d.volume * 100)} %</span></div>
      <div class="row"><span class="small" style="min-width:86px">Musique</span>
        <input type="range" id="opt-music" min="0" max="100" step="1" value="${Math.round(d.music * 100)}" aria-label="Volume de la musique">
        <span id="opt-music-val" class="small">${Math.round(d.music * 100)} %</span></div>
      <p class="muted small">Musique et ambiance générées en direct, un thème par région. Le premier curseur règle les bruitages.</p>
    </section>
    <section class="card"><h3>Affichage</h3>
      <label class="auto"><input type="checkbox" id="opt-lowfx" ${d.lowFx ? 'checked' : ''}> Effets réduits</label>
      <p class="muted small">Moins de particules, pas de lumières ni de traces au sol. À cocher si les combats saccadent.</p>
    </section>
    <section class="card"><h3>Aide</h3>
      <div class="row"><button class="btn" data-tuto>Revoir le tutoriel</button>
        <span class="small muted">Réaffiche toutes les bulles d'aide, sur les menus comme en combat.</span></div>
    </section>
    ${accountCard()}
    <section class="card"><h3>Sauvegarde</h3>
      <p class="muted small">Sauvegarde automatique dans le navigateur. Exporte régulièrement : vider les données du navigateur efface ta progression.</p>
      <div class="row"><button class="btn" data-export>Exporter</button><button class="btn" data-copy>Copier</button></div>
      <textarea id="save-out" readonly placeholder="Le code d'export apparaît ici"></textarea>
      <textarea id="save-in" placeholder="Colle un code RD1... ici"></textarea>
      <div class="row"><button class="btn" data-import>Importer</button><span id="save-msg" class="small"></span></div>
    </section>
    <section class="card"><h3>Statistiques</h3>
      <ul class="stat-list"><li>Éliminations <b>${fmt(d.kills)}</b></li><li>Parties <b>${d.runs}</b></li>
      <li>Coffres ouverts <b>${d.chestsOpened}</b></li><li>Étoiles <b>${stars()}</b></li></ul>
    </section>
    <section class="card danger"><h3>Zone dangereuse</h3>
      <button class="btn red" data-reset>Réinitialiser la progression</button></section>
    <p class="small muted">Rift Defenders est un projet de fan non officiel, gratuit et non commercial. Il n'est ni approuvé ni sponsorisé par Riot Games.
      League of Legends et les noms associés sont des marques de Riot Games, Inc.</p>
  </div>`;
}
