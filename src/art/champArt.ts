// Official champion art, loaded at runtime from Riot's Data Dragon CDN (nothing is bundled).
// Personal, non-commercial fan use only.
const DD = 'https://ddragon.leagueoflegends.com';
let version = '16.22.1';

const KEYS: Record<string, string> = {
  ashe: 'Ashe', lux: 'Lux', annie: 'Annie', caitlyn: 'Caitlyn', jinx: 'Jinx', teemo: 'Teemo', tf: 'TwistedFate',
  gangplank: 'Gangplank', soraka: 'Soraka', vayne: 'Vayne', ziggs: 'Ziggs', kogmaw: 'KogMaw', yasuo: 'Yasuo',
  heimer: 'Heimerdinger', brand: 'Brand', morgana: 'Morgana', zed: 'Zed', missfortune: 'MissFortune', nasus: 'Nasus',
  veigar: 'Veigar', anivia: 'Anivia', malzahar: 'Malzahar',
  garen: 'Garen', darius: 'Darius', ahri: 'Ahri', jayce: 'Jayce',
};

export async function initArt(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const list: string[] = await fetch(`${DD}/api/versions.json`, { signal: ctrl.signal }).then((r) => r.json());
    clearTimeout(timer);
    if (list[0]) version = list[0];
  } catch {
    /* offline or slow: keep the pinned version */
  }
}

export const squareUrl = (id: string): string => `${DD}/cdn/${version}/img/champion/${KEYS[id]}.png`;
export const splashUrl = (id: string): string => `${DD}/cdn/img/champion/splash/${KEYS[id]}_0.jpg`;
export const loadingUrl = (id: string): string => `${DD}/cdn/img/champion/loading/${KEYS[id]}_0.jpg`;

const images = new Map<string, HTMLImageElement>();

/** Square icon for canvas drawing; null until loaded (callers draw a fallback). */
export function squareImage(id: string): HTMLImageElement | null {
  let img = images.get(id);
  if (!img) {
    // No crossOrigin: the CDN sends no CORS headers and we never read pixels back.
    img = new Image();
    img.src = squareUrl(id);
    images.set(id, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

const splashes = new Map<string, HTMLImageElement>();

/** Wide splash art for canvas drawing (ultimate cut-in); null until loaded. */
export function splashImage(id: string): HTMLImageElement | null {
  let img = splashes.get(id);
  if (!img) {
    img = new Image();
    img.src = splashUrl(id);
    splashes.set(id, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export interface AbilityIcons { passive: string; ult: string; passiveName: string; ultName: string }
const abilities = new Map<string, AbilityIcons | 'loading' | 'error'>();

/**
 * Passive and ultimate icons for a champion, from Data Dragon's champion data.
 * Returns null until loaded; onReady is called once they are available.
 */
export function abilityIcons(id: string, onReady: () => void): AbilityIcons | null {
  const cur = abilities.get(id);
  if (cur && typeof cur === 'object') return cur;
  if (!cur) {
    abilities.set(id, 'loading');
    const key = KEYS[id];
    fetch(`${DD}/cdn/${version}/data/fr_FR/champion/${key}.json`)
      .then((r) => r.json())
      .then((j) => {
        const c = j.data[key];
        abilities.set(id, {
          passive: `${DD}/cdn/${version}/img/passive/${c.passive.image.full}`,
          ult: `${DD}/cdn/${version}/img/spell/${c.spells[3].image.full}`,
          passiveName: c.passive.name,
          ultName: c.spells[3].name,
        });
        onReady();
      })
      .catch(() => abilities.set(id, 'error'));
  }
  return null;
}

export const itemIconUrl = (dd: number): string => `${DD}/cdn/${version}/img/item/${dd}.png`;
