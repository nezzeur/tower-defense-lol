// Account + cloud save (Supabase, plain fetch: no SDK). The browser save stays the source of truth while
// playing; it is pushed to the player's account a few seconds after each change and pulled on start or login.
// Only the main save slot syncs (?save=<name> test slots stay local). Disabled when the env keys are missing.
import { MAPS } from './data/maps';
import { stars } from './game';
import { onPersist, replaceSave, saveHash, slot, store, type SaveData } from './save';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const META = 'riftdefenders.cloud';
const PUSH_DELAY = 8000;

interface Session { access: string; refresh: string; expires: number; user: string; email: string }
interface Meta { session?: Session; syncedAt?: string; syncedHash?: string; /** Leaderboard name, once chosen. */ pseudo?: string }
export interface RemoteSave { data: SaveData; updated_at: string }

export const cloudEnabled = (): boolean => !!URL_ && !!KEY_ && !slot;
/** The leaderboard can be read from any slot, even without an account. */
export const rankingEnabled = (): boolean => !!URL_ && !!KEY_;

let meta: Meta = readMeta();
let timer = 0;
let busy = false;
/** Set when the account and this device both changed since the last sync: the player picks one. */
export let conflict: RemoteSave | null = null;
export let status = '';
let onChange: () => void = () => {};

function readMeta(): Meta {
  try { return JSON.parse(localStorage.getItem(META) ?? '{}') as Meta; } catch { return {}; }
}
function writeMeta(): void {
  try { localStorage.setItem(META, JSON.stringify(meta)); } catch { /* storage blocked */ }
}
function say(s: string): void { status = s; onChange(); }

export const account = (): string | null => meta.session?.email ?? null;
export const lastSync = (): string | null => meta.syncedAt ?? null;

async function api(path: string, init: RequestInit = {}, auth = true): Promise<Response> {
  const headers: Record<string, string> = { apikey: KEY_!, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  if (auth) headers.Authorization = `Bearer ${await token()}`;
  return fetch(`${URL_}${path}`, { ...init, headers });
}

async function errorText(r: Response): Promise<string> {
  try {
    const j = await r.json() as { msg?: string; error_description?: string; message?: string; error?: string };
    const raw = j.msg ?? j.error_description ?? j.message ?? j.error ?? '';
    if (/invalid login/i.test(raw)) return 'E-mail ou mot de passe incorrect.';
    if (/not confirmed/i.test(raw)) return 'Confirme d\'abord ton e-mail (lien reçu par mail).';
    if (/already registered/i.test(raw)) return 'Ce compte existe déjà : connecte-toi.';
    if (/password/i.test(raw)) return 'Mot de passe trop court (6 caractères minimum).';
    return raw || `Erreur ${r.status}`;
  } catch { return `Erreur ${r.status}`; }
}

function keep(j: { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email: string } }): void {
  meta.session = { access: j.access_token, refresh: j.refresh_token, expires: Date.now() + j.expires_in * 1000, user: j.user.id, email: j.user.email };
  writeMeta();
}

/** A valid access token, refreshed when it is about to expire. */
async function token(): Promise<string> {
  const s = meta.session;
  if (!s) throw new Error('Non connecté');
  if (Date.now() < s.expires - 60_000) return s.access;
  const r = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh }) }, false);
  if (!r.ok) { meta.session = undefined; writeMeta(); throw new Error('Session expirée : reconnecte-toi.'); }
  keep(await r.json());
  return meta.session!.access;
}

export async function signUp(email: string, password: string): Promise<void> {
  // The confirmation link brings the player back to this page (the URL must be allowed in Supabase's redirect list)
  const back = encodeURIComponent(location.origin + location.pathname);
  const r = await api(`/auth/v1/signup?redirect_to=${back}`, { method: 'POST', body: JSON.stringify({ email, password }) }, false);
  if (!r.ok) return say(await errorText(r));
  const j = await r.json();
  // With email confirmation on, no session comes back until the link is clicked
  if (!j.access_token) return say('Compte créé. Clique sur le lien reçu par e-mail, puis connecte-toi.');
  keep(j);
  say('Compte créé.');
  await sync();
}

export async function signIn(email: string, password: string): Promise<void> {
  const r = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
  if (!r.ok) return say(await errorText(r));
  keep(await r.json());
  // A new account on this device: what was synced before belonged to someone else
  meta.syncedAt = undefined; meta.syncedHash = undefined; meta.pseudo = undefined; writeMeta();
  say('Connecté.');
  await sync();
}

export async function signOut(): Promise<void> {
  if (meta.session) await api('/auth/v1/logout', { method: 'POST' }).catch(() => undefined);
  meta = {};
  conflict = null;
  writeMeta();
  say('Déconnecté. La sauvegarde reste sur cet appareil.');
}

async function pull(): Promise<RemoteSave | null> {
  const r = await api(`/rest/v1/saves?select=data,updated_at&user_id=eq.${meta.session!.user}`);
  if (!r.ok) throw new Error(await errorText(r));
  const rows = await r.json() as RemoteSave[];
  return rows[0] ?? null;
}

async function push(keepalive = false): Promise<void> {
  const updated = new Date().toISOString();
  const r = await api('/rest/v1/saves?on_conflict=user_id', {
    method: 'POST', keepalive,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: meta.session!.user, data: store.data, updated_at: updated }),
  });
  if (!r.ok) throw new Error(await errorText(r));
  meta.syncedAt = updated;
  meta.syncedHash = saveHash();
  writeMeta();
  if (meta.pseudo) await pushProfile(meta.pseudo, keepalive).catch(() => undefined);
}

// ---------- Leaderboard ----------

export interface Ranked { pseudo: string; kills: number; gold_earned: number; stars: number; maps: number; champions: number; endless: number; runs: number }
export type RankSort = 'kills' | 'gold_earned' | 'stars' | 'endless';

export const pseudo = (): string | null => meta.session && meta.pseudo ? meta.pseudo : null;

/** The stats this player shows on the leaderboard, read from the save. */
function myStats(): Omit<Ranked, 'pseudo'> {
  const d = store.data;
  return {
    kills: Math.floor(d.kills), gold_earned: Math.floor(d.goldEarned), stars: stars(), runs: d.runs,
    maps: MAPS.filter((m) => (d.best[m.id] ?? 0) >= m.waves).length, champions: d.owned.length,
    endless: Math.max(0, ...Object.values(d.endless)),
  };
}

async function pushProfile(name: string, keepalive = false): Promise<Response> {
  return api('/rest/v1/profiles?on_conflict=user_id', {
    method: 'POST', keepalive,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: meta.session!.user, pseudo: name, ...myStats(), updated_at: new Date().toISOString() }),
  });
}

export const PSEUDO_RULE = /^[\p{L}\p{N}_ .-]{3,16}$/u;

/** Chooses (or changes) the leaderboard name; it must be unique. */
export async function setPseudo(name: string): Promise<void> {
  name = name.trim();
  if (!meta.session) return say('Connecte-toi d\'abord.');
  if (!PSEUDO_RULE.test(name)) return say('Pseudo : 3 à 16 caractères (lettres, chiffres, espace, _ . -).');
  try {
    const r = await pushProfile(name);
    if (r.status === 409) return say('Ce pseudo est déjà pris.');
    if (r.status === 400) return say('Pseudo refusé : garde lettres, chiffres, espace, _ . -');
    if (!r.ok) return say(await errorText(r));
    meta.pseudo = name;
    writeMeta();
    say(`Pseudo « ${name} » enregistré : tu apparais dans le classement.`);
  } catch (e) { say((e as Error).message); }
}

async function fetchPseudo(): Promise<void> {
  const r = await api(`/rest/v1/profiles?select=pseudo&user_id=eq.${meta.session!.user}`);
  if (!r.ok) return;
  const rows = await r.json() as { pseudo: string }[];
  meta.pseudo = rows[0]?.pseudo;
  writeMeta();
}

/** Top players for one stat (public: works without an account). */
export async function leaderboard(sort: RankSort): Promise<Ranked[]> {
  const cols = 'pseudo,kills,gold_earned,stars,maps,champions,endless,runs';
  const r = await api(`/rest/v1/profiles?select=${cols}&order=${sort}.desc,updated_at.asc&limit=100`, {}, false);
  if (!r.ok) throw new Error(await errorText(r));
  return r.json() as Promise<Ranked[]>;
}

/** True when the save holds no real progress (a brand-new device). */
const empty = (d: SaveData): boolean => d.runs === 0 && d.owned.length <= 1 && Object.keys(d.best).length === 0;

/**
 * Reconciles this device with the account: whichever side changed since the last sync wins;
 * when both changed, `conflict` is set and the player chooses (keepRemote / keepLocal).
 */
export async function sync(): Promise<void> {
  if (!cloudEnabled() || !meta.session || busy) return;
  busy = true;
  try {
    if (meta.pseudo === undefined) await fetchPseudo().catch(() => undefined);
    const remote = await pull();
    const local = saveHash();
    if (!remote) { await push(); say('Sauvegarde envoyée sur ton compte.'); return; }
    const remoteHash = saveHash(remote.data);
    const localChanged = local !== meta.syncedHash;
    // Postgres formats timestamps its own way: compare instants, not strings
    const remoteChanged = !meta.syncedAt || Date.parse(remote.updated_at) !== Date.parse(meta.syncedAt);
    if (remoteHash === local) {
      meta.syncedAt = remote.updated_at; meta.syncedHash = local; writeMeta();
      say('Synchronisé.');
    } else if (!localChanged || (empty(store.data) && meta.syncedHash === undefined)) {
      adopt(remote);
      say('Sauvegarde du compte chargée.');
    } else if (!remoteChanged) {
      await push();
      say('Synchronisé.');
    } else {
      conflict = remote;
      say('Ta sauvegarde diffère entre ce compte et cet appareil : choisis laquelle garder.');
    }
  } catch (e) {
    say((e as Error).message || 'Synchronisation impossible (hors ligne ?).');
  } finally {
    busy = false;
  }
}

function adopt(remote: RemoteSave): void {
  replaceSave(remote.data);
  meta.syncedAt = remote.updated_at;
  meta.syncedHash = saveHash();
  writeMeta();
}

export async function keepRemote(): Promise<void> {
  if (!conflict) return;
  adopt(conflict);
  conflict = null;
  say('Sauvegarde du compte chargée.');
}

export async function keepLocal(): Promise<void> {
  conflict = null;
  try { await push(); say('Sauvegarde de cet appareil envoyée sur ton compte.'); } catch (e) { say((e as Error).message); }
}

function schedule(): void {
  if (!cloudEnabled() || !meta.session || conflict) return;
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (saveHash() === meta.syncedHash) return;
    push().then(() => onChange(), () => { /* offline: retried on the next change */ });
  }, PUSH_DELAY);
}

/** Starts the sync: pulls once, then pushes after changes and when the page is hidden. `refresh` re-renders the UI. */
/**
 * Coming back from the confirmation e-mail, Supabase puts the new session in the URL hash
 * (#access_token=...&refresh_token=...): keep it as a normal sign-in, then clear the hash from the address bar.
 */
function sessionFromLink(): boolean {
  const h = new URLSearchParams(location.hash.slice(1));
  const access = h.get('access_token'), refresh = h.get('refresh_token');
  if (!access || !refresh) return false;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const claims = JSON.parse(atob(access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { sub: string; email: string };
    keep({ access_token: access, refresh_token: refresh, expires_in: Number(h.get('expires_in') ?? 3600), user: { id: claims.sub, email: claims.email } });
    meta.syncedAt = undefined; meta.syncedHash = undefined; meta.pseudo = undefined; writeMeta();
    status = 'E-mail confirmé : tu es connecté.';
    return true;
  } catch { return false; }
}

export function initCloud(refresh: () => void): void {
  onChange = refresh;
  if (!cloudEnabled()) return;
  sessionFromLink();
  onPersist(schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !meta.session || conflict || saveHash() === meta.syncedHash) return;
    clearTimeout(timer);
    void push(true).catch(() => undefined);
  });
  if (meta.session) void sync().then(refresh);
}
