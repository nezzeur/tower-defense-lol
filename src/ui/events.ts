import { loadingUrl, squareUrl } from '../art/champArt';
import { ITEM_BY_ID } from '../data/items';
import { champ, claimChest, craftItem, openChest, level, teamSlots, tryLevelUp, ULT_LEVELS, ultRank } from '../game';
import { playChestOpening } from '../art/chest';
import { applyVolume, sfx } from '../audio';
import { applyMusicVolume } from '../music';
import { resetTutorial } from './tutorial';
import type { SpellId } from '../battle';
import type { Priority } from '../types';
import { keepLocal, keepRemote, setPseudo, signIn, signOut, signUp, sync } from '../cloud';
import { rank } from './ranking';
import { exportSave, importSave, persist, resetSave, store } from '../save';
import { selectRegion } from './atlas';
import { leaveBattle, refreshLive, renderSide, startBattle } from './battleHud';
import { coll } from './collection';
import { app, equip, esc, flash, portrait, RARITY, ui, type Screen } from './common';
import { go, render } from './index';
import { shop } from './shop';

function levelUp(id: string, times: number): void {
  let n = 0;
  while (n < times && tryLevelUp(id)) n++;
  if (!n) return;
  persist();
  sfx('upgrade');
  const lvl = level(id);
  if (ULT_LEVELS.some((l) => lvl >= l && lvl - n < l)) flash(`${esc(champ(id).name)} : ultime renforcée (rang ${ultRank(lvl)}) !`);
  if (ui.battle) { ui.battle.refreshStats(); renderSide(); } else render();
}

app.addEventListener('click', (e) => {
  if (suppressClick) return;
  const el = (e.target as HTMLElement).closest<HTMLElement>('button, [data-nav]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const d = el.dataset;
  sfx('click');
  if (d.mute !== undefined) { store.data.muted = !store.data.muted; persist(); applyVolume(); applyMusicVolume(); return render(); }
  if (d.nav) return go(d.nav as Screen);
  if (d.starter) {
    store.data.owned.push(d.starter);
    persist();
    return go('maps');
  }
  if (d.map) return startBattle(d.map);
  if (d.region !== undefined) return selectRegion(d.region || null);
  if (d.champ) { ui.selectedChamp = d.champ; return render(); }
  if (d.cfRole !== undefined) { coll.role = d.cfRole; return render(); }
  if (d.cfOwned) { coll.owned = d.cfOwned as typeof coll.owned; return render(); }
  if (d.cfSort) { coll.sort = d.cfSort as typeof coll.sort; return render(); }
  if (d.sf !== undefined) { shop.cat = d.sf; return render(); }
  if (d.lvl) return levelUp(d.lvl, 1);
  if (d.lvl10) return levelUp(d.lvl10, 10);
  if (d.chest !== undefined) {
    (el as HTMLButtonElement).disabled = true;
    const got = openChest();
    persist();
    if (!got) return render();
    // The player picks the champion straight from the revealed cards ("later" keeps the offer in the shop)
    let chosen: string | null = null;
    playChestOpening(got.map((c) => ({
      rarity: c.rarity, id: c.id,
      html: `<div class="hx-img" style="background-image:url('${loadingUrl(c.id)}')"></div><b>${esc(c.name)}</b><small>${RARITY[c.rarity]}</small>`,
    })), () => {
      const def = chosen ? claimChest(chosen) : null;
      persist();
      if (def) flash(`${portrait(def, 40)}<div>Nouveau champion !<br><b>${esc(def.name)}</b> — ${esc(def.title)}</div>`);
      render();
    }, (id) => { chosen = id; });
    return;
  }
  if (d.claim) {
    const got = claimChest(d.claim);
    persist();
    if (got) flash(`${portrait(got, 40)}<div>Nouveau champion !<br><b>${esc(got.name)}</b> — ${esc(got.title)}</div>`);
    return render();
  }
  if (d.buy) {
    const it = ITEM_BY_ID[d.buy];
    if (store.data.gold >= it.price && !store.data.items.includes(it.id)) {
      store.data.gold -= it.price;
      store.data.items.push(it.id);
      persist();
      sfx('gold');
      flash(`${it.icon} ${esc(it.name)} acheté`);
    }
    return render();
  }
  if (d.craft) {
    if (craftItem(d.craft)) {
      persist();
      sfx('upgrade');
      flash(`${ITEM_BY_ID[d.craft].icon} ${esc(ITEM_BY_ID[d.craft].name)} forgé`);
    }
    return render();
  }
  if (d.rankSort) { rank.sort = d.rankSort as typeof rank.sort; rank.rows = null; return render(); }
  if (d.acc) {
    e.preventDefault();
    const email = (document.getElementById('acc-email') as HTMLInputElement | null)?.value.trim() ?? '';
    const pass = (document.getElementById('acc-pass') as HTMLInputElement | null)?.value ?? '';
    if ((d.acc === 'login' || d.acc === 'signup') && (!email || pass.length < 6)) { flash('E-mail et mot de passe (6 caractères min.)'); return; }
    const name = (document.getElementById('acc-pseudo') as HTMLInputElement | null)?.value ?? '';
    const run = { pseudo: () => setPseudo(name), login: () => signIn(email, pass), signup: () => signUp(email, pass), logout: signOut, sync, 'keep-remote': keepRemote, 'keep-local': keepLocal }[d.acc];
    (el as HTMLButtonElement).disabled = true;
    void run?.().finally(render);
    return;
  }
  if (d.tuto !== undefined) { resetTutorial(); flash('Tutoriel réactivé'); return render(); }
  if (d.export !== undefined) { (document.getElementById('save-out') as HTMLTextAreaElement).value = exportSave(); return; }
  if (d.copy !== undefined) {
    const out = document.getElementById('save-out') as HTMLTextAreaElement;
    if (!out.value) out.value = exportSave();
    navigator.clipboard?.writeText(out.value).then(() => flash('Code copié'), () => out.select());
    return;
  }
  if (d.import !== undefined) {
    const msg = document.getElementById('save-msg')!;
    try {
      importSave((document.getElementById('save-in') as HTMLTextAreaElement).value);
      flash('Sauvegarde importée');
      return render();
    } catch (err) {
      msg.textContent = (err as Error).message;
      return;
    }
  }
  if (d.reset !== undefined) {
    if (confirm('Effacer définitivement toute ta progression ? Exporte ta sauvegarde avant si tu veux la garder.')) {
      resetSave();
      render();
    }
    return;
  }

  // Battle controls
  const b = ui.battle;
  if (!b) return;
  if (d.leave !== undefined) return leaveBattle();
  if (d.startwave !== undefined) { if (b.towers.length) b.startWave(); return; }
  if (d.restart !== undefined) return b.restart();
  // Choosing a mode never launches anything: the player starts the wave when ready
  if (d.mode) { b.setMode(d.mode as 'normal' | 'boss' | 'endless'); return renderSide(); }
  if (d.speed) {
    store.data.speed = Number(d.speed);
    persist();
    document.querySelectorAll('.sp').forEach((x) => x.classList.toggle('on', x === el));
    return;
  }
  if (d.spell) return b.castSpell(d.spell as SpellId);
  if (d.roster) {
    const t = b.towers.find((x) => x.def.id === d.roster);
    if (t) { b.selectedTower = t; b.selectedRoster = null; }
    else if (b.slotsLeft() > 0) b.selectedRoster = b.selectedRoster === d.roster ? null : d.roster;
    else flash(`Tous les emplacements sont pris (${teamSlots()}). Retire un champion ou gagne des ★.`);
    return renderSide();
  }
  if (d.ult) { const t = b.towers.find((x) => x.def.id === d.ult); if (t) b.requestUlt(t); return refreshLive(); }
  if (d.team) { if (!b.switchTeam(Number(d.team)) && b.waveActive) flash('Change d\'équipe entre deux vagues.'); return renderSide(); }
  if (d.boon) { b.pickBoon(d.boon); return renderSide(); }
  if (d.deselectEnemy !== undefined) { b.selectedEnemy = null; return renderSide(); }
  if (d.deselect !== undefined) { b.selectedTower = null; return renderSide(); }
  if (d.remove !== undefined && b.selectedTower) { b.remove(b.selectedTower); return renderSide(); }
});

// Enter in the account form signs in (never reloads the page)
app.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target as HTMLElement;
  (document.querySelector(form.matches('[data-pseudo-form]') ? '[data-acc="pseudo"]' : '[data-acc="login"]') as HTMLButtonElement | null)?.click();
});

app.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'opt-music') {
    store.data.music = Number(el.value) / 100;
    applyMusicVolume();
    persist();
    const lab = document.getElementById('opt-music-val');
    if (lab) lab.textContent = `${Math.round(store.data.music * 100)} %`;
    return;
  }
  if (el.id !== 'opt-volume') return;
  store.data.volume = Number(el.value) / 100;
  if (store.data.volume > 0) store.data.muted = false;
  applyVolume();
  applyMusicVolume();
  persist();
  const out = document.getElementById('opt-volume-val');
  if (out) out.textContent = `${Math.round(store.data.volume * 100)} %`;
});

app.addEventListener('change', (e) => {
  const el0 = e.target as HTMLElement;
  if (el0.id === 'opt-volume') sfx('click');
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  if (el.id === 'opt-lowfx') { store.data.lowFx = (el as HTMLInputElement).checked; persist(); return; }
  if (el.id === 'b-autoult') { store.data.autoUlt = (el as HTMLInputElement).checked; persist(); el.blur(); return; }
  if (el.id === 'b-auto') {
    store.data.auto = (el as HTMLInputElement).checked;
    persist();
    // Ticking the box mid-run resumes at once; before the first wave the player still launches it (mode choice)
    if (store.data.auto && ui.battle && !ui.battle.waveActive && ui.battle.towers.length && (ui.battle.wave > 0 || ui.battle.over)) {
      if (ui.battle.over) ui.battle.restart(); else ui.battle.startWave();
    }
    refreshLive();
    return;
  }
  if (el.dataset.cfRegion !== undefined) { coll.region = el.value; render(); return; }
  if (el.dataset.equipItem) {
    if (el.value) equip(el.value, el.dataset.equipItem);
    else for (const [c, it] of Object.entries(store.data.equip)) if (it === el.dataset.equipItem) delete store.data.equip[c];
    persist();
    render();
    return;
  }
  if (el.dataset.prio && ui.battle) {
    const t = ui.battle.towers.find((x) => x.def.id === el.dataset.prio);
    if (t) ui.battle.setPriority(t, el.value as Priority);
    el.blur(); // give the keyboard back to the battle shortcuts
    return;
  }
  const champId = el.dataset.equip;
  if (champId !== undefined) {
    equip(champId, el.value);
    if (ui.battle) { ui.battle.refreshStats(); renderSide(); } else render();
  }
});

// Drag a champion from the team bar onto the board.
let teamDrag: { id: string; x: number; y: number; ghost: HTMLElement | null } | null = null;
let suppressClick = false;

app.addEventListener('pointerdown', (e) => {
  const slot = (e.target as HTMLElement).closest<HTMLElement>('.team-slot');
  if (!slot || !ui.battle || e.button !== 0) return;
  teamDrag = { id: slot.dataset.roster!, x: e.clientX, y: e.clientY, ghost: null };
});

window.addEventListener('pointermove', (e) => {
  if (!teamDrag || !ui.battle) return;
  if (!teamDrag.ghost && Math.hypot(e.clientX - teamDrag.x, e.clientY - teamDrag.y) > 6) {
    const def = champ(teamDrag.id);
    teamDrag.ghost = document.createElement('div');
    teamDrag.ghost.className = 'drag-ghost';
    teamDrag.ghost.innerHTML = `<img src="${squareUrl(def.id)}" alt="">`;
    document.body.appendChild(teamDrag.ghost);
    ui.battle.selectedRoster = teamDrag.id;
  }
  if (teamDrag.ghost) {
    teamDrag.ghost.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 28}px)`;
    ui.battle.previewAt(e.clientX, e.clientY);
  }
});

window.addEventListener('pointerup', (e) => {
  if (!teamDrag) return;
  const drag = teamDrag;
  teamDrag = null;
  if (!drag.ghost || !ui.battle) return;
  drag.ghost.remove();
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 0);
  const tile = ui.battle.tileAtClient(e.clientX, e.clientY);
  const placed = ui.battle.towers.some((t) => t.def.id === drag.id);
  if (tile && !placed && ui.battle.slotsLeft() <= 0) flash(`Tous les emplacements sont pris (${teamSlots()}). Retire un champion ou gagne des ★.`);
  else if (tile) ui.battle.dropChampion(drag.id, tile.c, tile.r);
  ui.battle.selectedRoster = null;
  renderSide();
});

window.addEventListener('keydown', (e) => {
  if (!ui.battle || ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); if (ui.battle.towers.length) ui.battle.startWave(); }
  if (e.key === 'Escape') { ui.battle.aiming = null; ui.battle.selectedRoster = null; ui.battle.selectedTower = null; ui.battle.selectedEnemy = null; renderSide(); }
  if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const t = ui.battle.towers[Number(e.key) - 1];
    if (t) { ui.battle.requestUlt(t); refreshLive(); }
  }
  if (e.key.toLowerCase() === 'p') ui.battle.paused = !ui.battle.paused;
});

