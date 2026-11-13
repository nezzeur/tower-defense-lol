import { REGIONS } from '../art/worldArt';
import { ENEMIES, enemyTraits } from '../data/enemies';
import { lootRolls, lootTable } from '../data/loot';
import { MAPS } from '../data/maps';
import { fmt, REGION_ROSTER } from '../game';
import { store } from '../save';
import type { EnemyDef } from '../types';
import { creatureIcon } from './battleHud';
import { esc } from './common';
import { matChip } from './inventory';

const regionName = (id: string): string => REGIONS.find((r) => r.id === id)?.name ?? id;

/** Regions where a monster shows up (wave rosters, epic slots, final bosses). */
function habitat(id: string): string[] {
  const out = new Set<string>();
  for (const [region, ro] of Object.entries(REGION_ROSTER)) if (Object.values(ro).includes(id)) out.add(region);
  for (const m of MAPS) if (m.finalBoss === id && m.region) out.add(m.region);
  for (const d of Object.values(ENEMIES)) {
    const src = d.ability?.kind === 'summon' && d.ability.id === id ? d.id : d.split?.id === id ? d.id : null;
    if (src) for (const r of habitat(src)) out.add(r);
  }
  return [...out];
}

function card(d: EnemyDef): string {
  const kills = store.data.bestiary[d.id];
  if (kills === undefined) {
    return `<div class="beast unknown"><div class="beast-ico">?</div><div class="beast-body"><b>???</b><span class="small muted">Pas encore rencontré</span></div></div>`;
  }
  const where = habitat(d.id).map(regionName);
  const traits = enemyTraits(d);
  const loot = lootTable(d, '');
  return `<div class="beast ${d.boss ? 'boss' : d.shape === 'boss' ? 'epic' : ''}">
    <div class="beast-ico">${creatureIcon(d.id)}</div>
    <div class="beast-body">
      <div class="beast-h"><b>${esc(d.name)}</b><span class="small muted">${fmt(kills)} éliminé${kills > 1 ? 's' : ''}</span></div>
      <div class="small muted">PV ×${(d.hp / ENEMIES.melee.hp).toFixed(1)} · vitesse ${d.speed} · armure ${Math.round(d.armor * 100)} % · fuite −${d.leak} vie${d.leak > 1 ? 's' : ''}${where.length ? ` · ${esc(where.join(', '))}` : ''}</div>
      ${traits.map((t) => `<div class="trait"><span>${t.icon}</span><div><b>${esc(t.name)}</b><span class="small muted">${esc(t.desc)}</span></div></div>`).join('')}
      <div class="mat-row">${loot.map((m) => matChip(m)).join('')}${lootRolls(d) > 1 ? `<span class="small muted">${lootRolls(d)} tirages</span>` : ''}</div>
    </div>
  </div>`;
}

export function bestiaryScreen(): string {
  const all = Object.values(ENEMIES).filter((d) => habitat(d.id).length > 0);
  const groups: [string, EnemyDef[]][] = [
    ['Sbires et monstres', all.filter((d) => d.shape !== 'boss')],
    ['Monstres épiques', all.filter((d) => d.shape === 'boss' && !d.boss)],
    ['Boss', all.filter((d) => d.boss)],
  ];
  const seen = all.filter((d) => store.data.bestiary[d.id] !== undefined).length;
  return `<div class="bestiary">
    <div class="shop-head"><h2>Bestiaire</h2>
      <div class="muted small">${seen}/${all.length} rencontrés · un monstre s'ajoute ici dès qu'il apparaît en combat</div></div>
    ${groups.map(([name, list]) => `<h3 class="inv-group">${name}</h3><div class="beast-grid">${list.map(card).join('')}</div>`).join('')}
  </div>`;
}
