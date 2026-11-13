// Regional bestiary in the spirit of a MOBA jungle: lane minions in each region's colours (recoloured from the
// base minion art), plus camp creatures built from parametric templates (beast, flyer, brute, golem, treant, wisp)
// and an elemental drake per region. Original art, same cartoon style as mobDesign.ts (thick #2a1f1a outline,
// flat fills, glowing eyes). viewBox 0 0 240 200, feet at y~184, facing right.
import { DESIGN_SVG } from './mobDesign';
const S = (b: string) => `<g stroke="#2a1f1a" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${b}</g>`;
const WOOD = '#6b4a2e';

interface Beast {
  body: string;
  body2: string;
  belly: string;
  eye: string;
  /** Row of spikes / shards along the back. */
  spikes?: string;
  collar?: string;
  /** Armour plates on the back and a horn on the snout (heavy lizard). */
  plates?: string;
  /** Size multiplier around the feet. */
  k?: number;
  /** Fan of three spirit tails (tip colour) instead of the single tail. */
  tails?: string;
}

function beast(p: Beast): string {
  const leg = (x: number, c: string) => `<rect x="${x}" y="146" width="17" height="34" rx="7" fill="${c}"/>`;
  const back = p.spikes ? [64, 84, 104, 124, 144].map((x, i) => `<path d="M${x} ${102 - (i % 2) * 3} L${x + 9} ${72 - (i % 2) * 8} L${x + 18} ${102 - (i % 2) * 3}Z" fill="${p.spikes}"/>`).join('') : '';
  const plates = p.plates ? `<path d="M62 112 Q112 70 164 108 Q112 96 62 112Z" fill="${p.plates}"/><path d="M84 100 V112 M110 92 V106 M136 96 V108" stroke-width="3"/><path d="M208 96 L222 76 L220 104Z" fill="#efe6d2"/>` : '';
  const tail = p.tails
    ? [[14, 52], [8, 92], [22, 130]].map(([tx, ty]) => `<path d="M66 116 Q${tx + 30} ${ty + 30} ${tx} ${ty} Q${tx + 34} ${ty - 6} 72 104Z" fill="${p.body}"/><circle cx="${tx + 4}" cy="${ty + 3}" r="9" fill="${p.tails}"/>`).join('')
    : `<path d="M62 118 Q30 110 24 80 Q46 90 66 104Z" fill="${p.body2}"/>`;
  const inner = S(`${tail}${leg(72, p.body2)}${leg(140, p.body2)}${back}<ellipse cx="112" cy="128" rx="58" ry="34" fill="${p.body}"/><ellipse cx="110" cy="144" rx="40" ry="16" fill="${p.belly}" stroke-width="0"/>${plates}${leg(92, p.body)}${leg(158, p.body)}<path d="M160 76 L166 46 L182 72Z" fill="${p.body2}"/><path d="M188 72 L200 46 L208 78Z" fill="${p.body}"/><circle cx="178" cy="104" r="34" fill="${p.body}"/><ellipse cx="204" cy="118" rx="21" ry="14" fill="${p.belly}"/><circle cx="221" cy="113" r="5" fill="#2a1f1a"/><path d="M192 126 L196 136 L202 127 M208 128 L212 136 L216 126" fill="#ffffff" stroke-width="2.5"/>${p.collar ? `<path d="M150 112 Q156 140 176 140" fill="none" stroke-width="13"/><path d="M150 112 Q156 140 176 140" fill="none" stroke="${p.collar}" stroke-width="7"/>` : ''}`)
    + `<g><ellipse cx="186" cy="98" rx="8" ry="6" fill="${p.eye}"/><circle cx="188" cy="98" r="2.5" fill="#2a1f1a"/></g>`;
  return p.k && p.k !== 1 ? `<g transform="translate(120 184) scale(${p.k}) translate(-120 -184)">${inner}</g>` : inner;
}

interface Flyer { body: string; wing: string; wing2: string; beak: string; eye: string; crest?: string }

function flyer(p: Flyer): string {
  return S(`<path d="M104 104 Q58 40 14 58 Q48 70 40 96 Q68 86 94 120Z" fill="${p.wing2}"/><path d="M86 122 L44 146 L58 124 L40 116Z" fill="${p.wing2}"/><ellipse cx="120" cy="112" rx="38" ry="27" fill="${p.body}"/><path d="M132 98 Q150 28 208 26 Q188 52 198 76 Q168 72 146 116Z" fill="${p.wing}"/><path d="M150 96 Q166 60 190 50 M158 104 Q176 78 194 72" fill="none" stroke-width="3"/><circle cx="160" cy="86" r="23" fill="${p.body}"/>${p.crest ? `<path d="M150 66 Q150 40 170 34 Q164 52 172 64Z" fill="${p.crest}"/>` : ''}<path d="M178 80 L212 90 L178 100Z" fill="${p.beak}"/><path d="M106 136 L102 152 M122 138 L122 154" stroke-width="5"/>`)
    + `<g><ellipse cx="166" cy="82" rx="6" ry="5" fill="${p.eye}"/><circle cx="168" cy="82" r="2.2" fill="#2a1f1a"/></g>`;
}

interface Brute { body: string; body2: string; belly: string; eye: string; horn: string; horns: 'oni' | 'ice'; club?: boolean; mark?: string }

function brute(p: Brute): string {
  const horns = p.horns === 'oni'
    ? `<path d="M84 66 Q70 40 82 22 Q92 40 104 56Z" fill="${p.horn}"/><path d="M156 66 Q170 40 158 22 Q148 40 136 56Z" fill="${p.horn}"/>`
    : `<path d="M78 70 L66 34 L92 54Z" fill="${p.horn}"/><path d="M102 56 L104 18 L120 52Z" fill="${p.horn}"/><path d="M138 56 L142 22 L156 58Z" fill="${p.horn}"/><path d="M162 70 L178 38 L150 56Z" fill="${p.horn}"/>`;
  return S(`<rect x="88" y="156" width="22" height="26" rx="9" fill="${p.body2}"/><rect x="130" y="156" width="22" height="26" rx="9" fill="${p.body2}"/>${p.club ? `<g transform="rotate(24 196 118)"><rect x="188" y="52" width="16" height="96" rx="7" fill="${WOOD}"/><circle cx="196" cy="58" r="15" fill="#8a6a48"/><path d="M184 50 L176 42 M208 50 L216 42 M196 44 V34" stroke-width="5"/></g>` : ''}<path d="M62 106 Q26 122 34 162 Q50 174 62 154 Q58 132 76 124Z" fill="${p.body}"/>${horns}<path d="M60 120 Q60 60 120 54 Q180 60 180 120 Q184 176 120 178 Q56 176 60 120Z" fill="${p.body}"/><ellipse cx="120" cy="140" rx="40" ry="30" fill="${p.belly}"/><path d="M178 106 Q214 122 206 162 Q190 174 178 154 Q182 132 164 124Z" fill="${p.body}"/><path d="M92 122 Q120 140 148 122" fill="#3a1418"/><path d="M100 124 L104 108 L112 128Z M140 124 L136 108 L128 128Z" fill="#ffffff" stroke-width="3"/>${p.mark ? `<path d="M120 62 L128 76 L120 90 L112 76Z" fill="${p.mark}"/>` : ''}<path d="M86 88 L110 96 M154 88 L130 96" stroke-width="5"/>`)
    + `<g><ellipse cx="100" cy="100" rx="8" ry="6" fill="${p.eye}"/><ellipse cx="140" cy="100" rx="8" ry="6" fill="${p.eye}"/></g>`;
}

function wisp(body: string, core: string): string {
  return `<g><circle cx="120" cy="124" r="52" fill="${body}" opacity=".28"/></g>`
    + S(`<path d="M120 58 Q138 84 150 102 Q160 130 148 152 Q138 172 120 172 Q102 172 92 152 Q80 130 90 102 Q102 84 120 58Z" fill="${body}"/><path d="M120 92 Q136 116 132 140 Q128 158 120 158 Q112 158 108 140 Q104 116 120 92Z" fill="${core}" stroke-width="0"/><path d="M84 96 Q76 84 80 72 M158 100 Q166 90 162 78" fill="none" stroke="${body}" stroke-width="6"/>`)
    + `<g><ellipse cx="110" cy="128" rx="6" ry="8" fill="#2a1f1a"/><ellipse cx="130" cy="128" rx="6" ry="8" fill="#2a1f1a"/></g>`;
}

interface Golem { stone: string; stone2: string; crystal: string; eye: string; moss?: string }

/** Stone sentinel: massive torso, fists on the ground, crystals growing from its shoulders. */
function golem(p: Golem): string {
  return `<g><circle cx="74" cy="64" r="22" fill="${p.crystal}" opacity=".3"/><circle cx="168" cy="62" r="22" fill="${p.crystal}" opacity=".3"/></g>`
    + S(`<rect x="92" y="150" width="24" height="32" rx="8" fill="${p.stone2}"/><rect x="126" y="150" width="24" height="32" rx="8" fill="${p.stone2}"/><path d="M70 92 Q34 104 30 150 Q30 178 52 178 Q72 174 68 148 Q66 124 84 112Z" fill="${p.stone}"/><path d="M60 88 L70 46 L88 84Z" fill="${p.crystal}"/><path d="M80 78 L92 54 L100 80Z" fill="${p.crystal}"/><path d="M156 84 L172 44 L182 90Z" fill="${p.crystal}"/><path d="M66 96 Q70 60 120 56 Q170 60 174 96 Q178 150 120 158 Q62 150 66 96Z" fill="${p.stone}"/><path d="M92 98 L120 86 L148 98 L140 134 L120 144 L100 134Z" fill="${p.stone2}"/><path d="M120 98 L130 114 L120 130 L110 114Z" fill="${p.crystal}"/><path d="M170 92 Q206 104 210 150 Q210 178 188 178 Q168 174 172 148 Q174 124 156 112Z" fill="${p.stone}"/><rect x="98" y="48" width="44" height="34" rx="12" fill="${p.stone2}"/><path d="M78 122 L88 132 L82 144 M160 118 L152 132 M40 150 H58 M184 152 H200" fill="none" stroke-width="3"/>${p.moss ? `<path d="M70 74 Q96 58 120 60 Q100 68 92 84Z" fill="${p.moss}"/><path d="M34 138 Q46 130 60 136 Q48 142 44 152Z" fill="${p.moss}"/>` : ''}`)
    + `<g><ellipse cx="109" cy="66" rx="6" ry="5" fill="${p.eye}"/><ellipse cx="131" cy="66" rx="6" ry="5" fill="${p.eye}"/></g>`;
}

interface Treant { bark: string; bark2: string; leaf: string; leaf2: string; eye: string }

/** Living tree: bark body, branch antlers in bloom, glowing eyes and a jagged mouth. */
function treant(p: Treant): string {
  const branch = (d: string) => `<path d="${d}" fill="none" stroke-width="13"/><path d="${d}" fill="none" stroke="${p.bark2}" stroke-width="7"/>`;
  return S(`<path d="M92 150 L82 182 H110 L114 152Z" fill="${p.bark2}"/><path d="M126 152 L130 182 H158 L148 150Z" fill="${p.bark2}"/><path d="M72 100 Q34 110 32 152 Q40 174 58 164 Q58 134 84 122Z" fill="${p.bark}"/>${branch('M96 66 Q84 40 62 34 M86 48 Q76 34 78 20')}${branch('M144 66 Q156 40 178 34 M154 48 Q164 34 162 20')}<circle cx="58" cy="32" r="15" fill="${p.leaf}"/><circle cx="80" cy="18" r="12" fill="${p.leaf2}"/><circle cx="182" cy="32" r="15" fill="${p.leaf}"/><circle cx="160" cy="18" r="12" fill="${p.leaf2}"/><path d="M70 110 Q66 64 120 58 Q174 64 170 110 Q172 156 120 162 Q68 156 70 110Z" fill="${p.bark}"/><path d="M168 100 Q206 110 208 152 Q200 174 182 164 Q182 134 156 122Z" fill="${p.bark}"/><path d="M92 136 Q120 150 148 136 M100 150 Q120 158 140 150 M84 84 Q90 96 86 108" fill="none" stroke="${p.bark2}" stroke-width="4"/><circle cx="46" cy="158" r="9" fill="${p.leaf}"/><circle cx="194" cy="158" r="9" fill="${p.leaf2}"/>`)
    + `<g><path d="M96 92 L112 98 L98 106Z" fill="${p.eye}"/><path d="M144 92 L128 98 L142 106Z" fill="${p.eye}"/><path d="M100 124 L108 116 L116 124 L124 116 L132 124 L140 116" fill="none" stroke="${p.eye}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></g>`;
}

/** Swaps fill colours of an existing design (exact hex matches). */
function recolor(svg: string, map: Record<string, string>): string {
  return svg.replace(/#[0-9a-fA-F]{6}/g, (h) => map[h.toLowerCase()] ?? h);
}

/** Lane minion in a region's colours: cloth, darker cloth, trim, helmet, eyes. */
const minion = (cloth: string, dark: string, trim: string, helm: string, eye: string) =>
  recolor(DESIGN_SVG.melee, { '#3f78c9': cloth, '#2a5a9e': dark, '#d9ad4f': trim, '#b9c3cf': helm, '#7fe7ff': eye });
/** Caster minion (hooded, staff with an orb) in a region's colours. */
const mage = (robe: string, hood: string, dark: string, trim: string, orb: string, eye: string) =>
  recolor(DESIGN_SVG.caster, { '#4a5fc1': robe, '#2f3f8f': hood, '#3a4b9e': dark, '#5b70d6': dark, '#d9ad4f': trim, '#8ef0ff': orb, '#ffd75e': eye });
/** Elemental drake: body, light belly, dark shade, wing membrane. */
const drake = (body: string, light: string, dark: string, deep: string, glow: string) =>
  recolor(DESIGN_SVG.drake, { '#e8742c': body, '#f08a3e': light, '#e8a85a': light, '#c95a22': dark, '#b8461f': dark, '#8a3014': deep, '#ffd08a': glow, '#ffc44d': glow });

export const REGION_SVG: Record<string, string> = {
  // Demacia: white petricite, royal blue, gold
  dem_minion: minion('#eef1f5', '#aab4c4', '#e2c15a', '#3f6fc9', '#ffe27a'),
  dem_golem: golem({ stone: '#e6e9ee', stone2: '#b9c0cc', crystal: '#f2d36a', eye: '#ffe27a' }),
  dem_hound: beast({ body: '#f4f6fa', body2: '#b9c6dc', belly: '#ffffff', eye: '#ffe27a', collar: '#e2c15a' }),
  dem_wing: flyer({ body: '#f4f6fa', wing: '#dfe6f2', wing2: '#b9c6dc', beak: '#e2c15a', eye: '#7fe7ff', crest: '#3f6fc9' }),
  drake_mountain: drake('#9a8a72', '#b9aa90', '#6f6250', '#4a4034', '#f2d36a'),
  // Freljord: ice and fur
  frl_minion: minion('#6f9fc4', '#4a7699', '#f1ede4', '#dfeaf2', '#bff3ff'),
  frl_wolf: beast({ body: '#eef4f8', body2: '#b8cbd9', belly: '#ffffff', eye: '#5fd0ff', spikes: '#9fdcff' }),
  frl_troll: brute({ body: '#7fb0c9', body2: '#55829c', belly: '#c4e2ee', eye: '#ffe27a', horn: '#dff4ff', horns: 'ice', club: true }),
  frl_shaman: mage('#3f6a8a', '#2a4c66', '#22405a', '#f1ede4', '#9fe8ff', '#bff3ff'),
  drake_ocean: drake('#3f9fc9', '#6fc4e6', '#2a769e', '#1c5270', '#bff3ff'),
  // Noxus: black iron and crimson
  nox_minion: minion('#8a1c26', '#5e1018', '#3a3136', '#55505a', '#ff7a4a'),
  nox_hound: beast({ body: '#4a2a2e', body2: '#2e181c', belly: '#8a3a34', eye: '#ffb347', spikes: '#b3283a', collar: '#55505a' }),
  nox_basilisk: beast({ body: '#5f7a52', body2: '#3f5638', belly: '#c9c08a', eye: '#ffe27a', plates: '#55505a', k: 1.12 }),
  nox_mage: mage('#5e1018', '#3a0a10', '#2a060a', '#c9a35a', '#ff3a3a', '#ff7a4a'),
  // Ionia: spirits and blossom
  ion_minion: minion('#3f9a8a', '#2a6f64', '#f0d9a0', '#ffd9ec', '#fff3b0'),
  ion_fox: beast({ body: '#ffe9f2', body2: '#f2b8d2', belly: '#ffffff', eye: '#ff5fa2', tails: '#ff9ed2' }),
  ion_crane: flyer({ body: '#ffffff', wing: '#ffd9ec', wing2: '#ff9ed2', beak: '#f0a03a', eye: '#b3283a', crest: '#b3283a' }),
  ion_treant: treant({ bark: '#8a6a4e', bark2: '#5e4632', leaf: '#ff9ed2', leaf2: '#ffd1e8', eye: '#7ff0e0' }),
  ion_wisp: wisp('#7ff0e0', '#eafffb'),
  voidling: wisp('#b06cff', '#f0dcff'),
  drake_cloud: drake('#cfd8e6', '#eef2f8', '#9aa8bf', '#6f7d96', '#ffffff'),
};
