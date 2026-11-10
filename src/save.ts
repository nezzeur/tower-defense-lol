export interface Placement { id: string; c: number; r: number }

export interface SaveData {
  v: 1;
  gold: number;
  owned: string[];
  levels: Record<string, number>;
  /** Persistent kill stacks (Nasus). */
  stacks: Record<string, number>;
  items: string[];
  /** champion id -> item id */
  equip: Record<string, string>;
  /** Highest wave cleared per map. */
  best: Record<string, number>;
  layouts: Record<string, Placement[]>;
  chestsOpened: number;
  /** Pending chest choice (champion ids); kept in the save so a reload can't reroll it. */
  chestOffer: string[] | null;
  chestsSinceEpic: number;
  speed: number;
  auto: boolean;
  kills: number;
  runs: number;
  /** Master volume 0-1. */
  volume: number;
  muted: boolean;
}

// ?save=<name> uses a separate save slot (testing without touching real progress).
const slot = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('save');
const KEY = 'riftdefenders.save.v1' + (slot ? `:${slot}` : '');

function fresh(): SaveData {
  return {
    v: 1, gold: 0, owned: [], levels: {}, stacks: {}, items: [], equip: {}, best: {}, layouts: {},
    chestsOpened: 0, chestOffer: null, chestsSinceEpic: 0, speed: 1, auto: false, kills: 0, runs: 0, volume: 0.5, muted: false,
  };
}

function sanitize(raw: unknown): SaveData {
  const d = { ...fresh(), ...(raw as Partial<SaveData>) };
  if (d.v !== 1 || !Array.isArray(d.owned) || typeof d.gold !== 'number') throw new Error('bad save');
  if (typeof d.volume !== 'number' || !(d.volume >= 0 && d.volume <= 1)) d.volume = 0.5;
  d.muted = d.muted === true;
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
  return fresh();
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
  store.data = fresh();
  persist();
}
