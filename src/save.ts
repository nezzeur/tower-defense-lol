import { CHAMPIONS } from './data/champions';
import { MAPS } from './data/maps';
import type { Priority } from './types';

export interface Placement { id: string; c: number; r: number }

export interface SaveData {
  v: 1;
  gold: number;
  owned: string[];
  levels: Record<string, number>;
  /** Persistent kill stacks (Nasus). */
  stacks: Record<string, number>;
  items: string[];
  /** Loot materials (id -> amount). */
  mats: Record<string, number>;
  /** champion id -> item id */
  equip: Record<string, string>;
  /** Highest wave cleared per map. */
  best: Record<string, number>;
  /** Endless mode: most waves survived beyond the map's last one, per map. */
  endless: Record<string, number>;
  layouts: Record<string, Placement[]>;
  /** Saved teams per map (3 slots) and the slot in use; `layouts` holds the active one. */
  teams: Record<string, Placement[][]>;
  teamSlot: Record<string, number>;
  /** Monsters met so far: id -> number killed. */
  bestiary: Record<string, number>;
  chestsOpened: number;
  /** Pending chest choice (champion ids); kept in the save so a reload can't reroll it. */
  chestOffer: string[] | null;
  chestsSinceEpic: number;
  /** Targeting priority per champion (default 'first'). */
  priorities: Record<string, Priority>;
  speed: number;
  /** Regions whose opening was already celebrated on the world map (undefined: fill silently on first visit). */
  regionsSeen?: string[];
  auto: boolean;
  /** Cast active ultimates automatically when they are worth it. */
  autoUlt: boolean;
  /** Reduced visual effects (fewer particles, no lights) for slower machines. */
  lowFx: boolean;
  kills: number;
  runs: number;
  /** Master volume 0-1. */
  volume: number;
  muted: boolean;
  /** Music volume 0-1. */
  music: number;
  /** Guided tips already seen (undefined on saves from before the tutorial). */
  tips?: string[];
}

// ?save=<name> uses a separate save slot (testing without touching real progress).
const slot = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('save');
const KEY = 'riftdefenders.save.v1' + (slot ? `:${slot}` : '');

function fresh(): SaveData {
  return {
    v: 1, gold: 0, owned: [], levels: {}, stacks: {}, items: [], mats: {}, equip: {}, best: {}, endless: {}, layouts: {}, teams: {}, teamSlot: {}, bestiary: {}, priorities: {},
    chestsOpened: 0, chestOffer: null, chestsSinceEpic: 0, speed: 1, auto: false, autoUlt: false, lowFx: false, kills: 0, runs: 0, volume: 0.5, muted: false, music: 0.35,
  };
}

/** `?save=demo`: a try-out slot that starts with every champion (level 20), every map cleared and plenty of gold. */
function demo(): SaveData {
  const d = fresh();
  d.owned = CHAMPIONS.map((c) => c.id);
  for (const c of CHAMPIONS) d.levels[c.id] = 20;
  for (const m of MAPS) d.best[m.id] = m.waves;
  d.gold = 5_000_000;
  return d;
}

function sanitize(raw: unknown): SaveData {
  const d = { ...fresh(), ...(raw as Partial<SaveData>) };
  if (d.v !== 1 || !Array.isArray(d.owned) || typeof d.gold !== 'number') throw new Error('bad save');
  if (typeof d.volume !== 'number' || !(d.volume >= 0 && d.volume <= 1)) d.volume = 0.5;
  d.muted = d.muted === true;
  for (const k of ['teams', 'teamSlot', 'bestiary'] as const) {
    if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) (d as unknown as Record<string, unknown>)[k] = {};
  }
  if (d.tips !== undefined && !Array.isArray(d.tips)) d.tips = undefined;
  if (!d.endless || typeof d.endless !== 'object' || Array.isArray(d.endless)) d.endless = {};
  if (typeof d.music !== 'number' || !(d.music >= 0 && d.music <= 1)) d.music = 0.35;
  if (!d.mats || typeof d.mats !== 'object' || Array.isArray(d.mats)) d.mats = {};
  d.autoUlt = d.autoUlt === true;
  d.lowFx = d.lowFx === true;
  // Game speed is x1 or x2 only
  d.speed = d.speed === 2 ? 2 : 1;
  if (d.regionsSeen !== undefined && !Array.isArray(d.regionsSeen)) d.regionsSeen = undefined;
  if (!d.priorities || typeof d.priorities !== 'object' || Array.isArray(d.priorities)) d.priorities = {};
  return d;
}

function load(): SaveData {
  let txt: string | null = null;
  try {
    txt = localStorage.getItem(KEY);
    if (txt) return sanitize(JSON.parse(txt));
  } catch {
    /* corrupted or unavailable storage: start fresh */
    if (txt) {
      const bak = `${KEY}.backup.${Date.now()}`;
      try { localStorage.setItem(bak, txt); } catch { /* storage full or blocked */ }
      console.warn(`Invalid save reset to defaults; raw copy kept under "${bak}"`);
    }
  }
  return slot === 'demo' && !txt ? demo() : fresh();
}

export const store: { data: SaveData } = { data: load() };

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store.data));
  } catch {
    /* storage full or blocked: keep playing in memory */
  }
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Base64 over UTF-8 so accented names survive the round trip on every browser.
function toB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function fromB64(s: string): string {
  const bin = atob(s);
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

export function exportSave(): string {
  const json = JSON.stringify(store.data);
  return `RD1.${toB64(json)}.${hash(json)}`;
}

export function importSave(code: string): void {
  const [tag, body, sum] = code.trim().split('.');
  if (tag !== 'RD1' || !body || !sum) throw new Error('Code invalide');
  const json = fromB64(body);
  if (hash(json) !== sum) throw new Error('Code corrompu (checksum)');
  store.data = sanitize(JSON.parse(json));
  persist();
}

export function resetSave(): void {
  // Progress is wiped; device preferences (sound, game speed) are kept.
  const { volume, muted, music, speed, autoUlt, lowFx } = store.data;
  store.data = { ...fresh(), volume, muted, music, speed, autoUlt, lowFx };
  persist();
}
