/** Region synergies: 2 / 3 / 4+ placed champions of one region grant a modest team-wide bonus. */
export type SynStat = 'dmg' | 'rate' | 'range' | 'slow' | 'armorShred' | 'gold' | 'splash' | 'boss' | 'ultCd';

export interface RegionSynergy {
  name: string;
  stat: SynStat;
  /** What the percentage applies to (French, after "+x %"). */
  label: string;
}

export const SYN_TIERS = [
  { n: 2, v: 0.05 },
  { n: 3, v: 0.1 },
  { n: 4, v: 0.18 },
] as const;

export const SYNERGIES: Record<string, RegionSynergy> = {
  Demacia: { name: 'Justice', stat: 'armorShred', label: "d'armure ennemie ignorée" },
  Freljord: { name: 'Hiver éternel', stat: 'slow', label: 'de ralentissement en plus' },
  Noxus: { name: 'Suprématie', stat: 'dmg', label: 'de dégâts' },
  Ionia: { name: 'Équilibre', stat: 'rate', label: "de vitesse d'attaque" },
  Piltover: { name: 'Progrès', stat: 'range', label: 'de portée' },
  Zaun: { name: 'Chimie', stat: 'splash', label: 'de rayon de zone' },
  Bilgewater: { name: 'Butin', stat: 'gold', label: "d'or sur les éliminations" },
  Bandle: { name: 'Magie yordle', stat: 'ultCd', label: 'de recharge des ultimes' },
  'Néant': { name: 'Corruption', stat: 'boss', label: 'de dégâts contre les boss' },
};

export interface ActiveSynergy {
  region: string;
  count: number;
  /** 0 = inactive (fewer than 2), 1..3. */
  tier: number;
  value: number;
  def: RegionSynergy;
}

/** Synergies of a team given the regions of its placed champions (regions without a bonus are skipped). */
export function teamSynergies(regions: string[]): ActiveSynergy[] {
  const counts = new Map<string, number>();
  for (const r of regions) counts.set(r, (counts.get(r) ?? 0) + 1);
  const out: ActiveSynergy[] = [];
  for (const [region, count] of counts) {
    const def = SYNERGIES[region];
    if (!def) continue;
    const tier = SYN_TIERS.filter((t) => count >= t.n).length;
    out.push({ region, count, tier, value: tier ? SYN_TIERS[tier - 1].v : 0, def });
  }
  return out.sort((a, b) => b.tier - a.tier || b.count - a.count);
}

export const synText = (s: RegionSynergy, v: number): string => `+${Math.round(v * 100)} % ${s.label}`;
