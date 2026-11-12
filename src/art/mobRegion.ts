// Regional bestiary: original cartoon creatures in the same style as mobDesign.ts (thick #2a1f1a outline,
// flat fills, glowing eyes), built from a few parametric templates. viewBox 0 0 240 200, feet at y~184, facing right.
const S = (b: string) => `<g stroke="#2a1f1a" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${b}</g>`;
const WOOD = '#6b4a2e';

type Helm = 'crest' | 'horn' | 'spike' | 'hood' | 'mask';
type Arm = 'sword' | 'axe' | 'spear' | 'crossbow' | 'staff' | 'blades';

interface Soldier {
  cloth: string;
  /** Darker shade of the cloth (folds, shield centre). */
  cloth2: string;
  trim: string;
  metal: string;
  helm: Helm;
  weapon: Arm;
  eye: string;
  shield?: boolean;
  cape?: string;
  fur?: string;
  /** Long robe instead of legs (casters). */
  robe?: boolean;
  /** Colour of the glowing orb on a staff. */
  orb?: string;
}

function weapon(p: Soldier): string {
  switch (p.weapon) {
    case 'sword':
      return `<g transform="rotate(-28 172 124)"><rect x="166" y="58" width="12" height="70" rx="4" fill="${p.metal}"/><path d="M172 64 V122" stroke="#aab4c0" stroke-width="2.5"/><rect x="154" y="126" width="36" height="9" rx="4" fill="${p.trim}"/><rect x="167" y="135" width="10" height="20" rx="4" fill="${WOOD}"/></g>`;
    case 'axe':
      return `<g transform="rotate(-20 170 120)"><rect x="166" y="48" width="9" height="112" rx="4" fill="${WOOD}"/><path d="M175 54 Q208 46 210 86 Q190 78 175 90Z" fill="${p.metal}"/><path d="M166 56 Q148 60 146 80 Q158 76 166 86Z" fill="${p.metal}"/></g>`;
    case 'spear':
      return `<g transform="rotate(-12 172 110)"><rect x="168" y="30" width="8" height="150" rx="4" fill="${WOOD}"/><path d="M172 6 L186 36 L172 46 L158 36Z" fill="${p.metal}"/><path d="M176 48 Q198 54 192 78 Q184 64 176 66Z" fill="${p.cloth}"/></g>`;
    case 'crossbow':
      return `<g transform="rotate(-8 176 120)"><rect x="146" y="114" width="60" height="11" rx="4" fill="${WOOD}"/><path d="M198 90 Q218 119 198 148" fill="none" stroke-width="12"/><path d="M198 90 Q218 119 198 148" fill="none" stroke="${p.metal}" stroke-width="5"/><path d="M198 92 L176 119 L198 146" fill="none" stroke-width="2"/><path d="M176 119 H212" stroke="${p.trim}" stroke-width="3"/></g>`;
    case 'staff':
      return `<path d="M176 44 L162 182" stroke-width="12"/><path d="M176 44 L162 182" stroke="${WOOD}" stroke-width="6"/>`;
    case 'blades':
      return `<g transform="rotate(-42 172 128)"><rect x="167" y="78" width="10" height="50" rx="4" fill="${p.metal}"/><rect x="161" y="126" width="22" height="7" rx="3" fill="${p.trim}"/></g><g transform="rotate(42 68 128)"><rect x="63" y="78" width="10" height="50" rx="4" fill="${p.metal}"/><rect x="57" y="126" width="22" height="7" rx="3" fill="${p.trim}"/></g>`;
  }
}

function helm(p: Soldier): string {
  const visor = `<rect x="84" y="58" width="72" height="20" rx="10" fill="#1f2633"/>`;
  const dome = `<circle cx="120" cy="66" r="42" fill="${p.metal}"/><path d="M88 52 Q102 34 128 32" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="5"/>`;
  switch (p.helm) {
    case 'crest':
      return `${dome}<path d="M120 24 Q132 2 154 8 Q140 18 138 34" fill="${p.cloth}"/>${visor}<rect x="114" y="26" width="12" height="34" rx="5" fill="${p.trim}"/>`;
    case 'horn':
      return `<path d="M86 46 Q56 34 58 6 Q78 16 98 30Z" fill="#efe6d2"/><path d="M154 46 Q184 34 182 6 Q162 16 142 30Z" fill="#efe6d2"/>${dome}${visor}<rect x="80" y="40" width="80" height="9" rx="4" fill="${p.trim}"/>`;
    case 'spike':
      return `<path d="M108 30 L120 3 L132 30Z" fill="${p.trim}"/><path d="M80 60 L58 44 L82 40Z" fill="${p.metal}"/><path d="M160 60 L182 44 L158 40Z" fill="${p.metal}"/>${dome}${visor}<path d="M120 78 L112 96 H128Z" fill="${p.metal}"/>`;
    case 'mask':
      return `<path d="M78 76 Q80 18 120 12 Q160 18 162 76 Q158 110 120 112 Q82 110 78 76Z" fill="${p.cloth}"/><path d="M84 62 H156 V84 Q120 96 84 84Z" fill="#14132a"/><path d="M150 46 Q176 40 190 54 Q172 54 160 64Z" fill="${p.trim}"/>`;
    case 'hood':
      return `<path d="M76 80 Q78 18 120 8 Q162 18 164 80 Q160 114 120 116 Q80 114 76 80Z" fill="${p.cloth}"/><path d="M120 12 Q138 32 146 62" fill="none" stroke="${p.cloth2}" stroke-width="4"/><ellipse cx="120" cy="80" rx="27" ry="22" fill="#14132a"/>`;
  }
}

function soldier(p: Soldier): string {
  const eyeY = p.helm === 'hood' ? 82 : p.helm === 'mask' ? 72 : 68;
  const lower = p.robe
    ? `<path d="M78 178 Q84 114 120 102 Q156 114 162 178 Q120 188 78 178Z" fill="${p.cloth}"/><path d="M80 170 Q120 182 160 170" fill="none" stroke="${p.trim}" stroke-width="6"/><path d="M120 108 V174" stroke="${p.cloth2}" stroke-width="4"/>`
    : `<rect x="100" y="148" width="16" height="30" rx="7" fill="#2b2f3a"/><rect x="126" y="148" width="16" height="30" rx="7" fill="#2b2f3a"/><ellipse cx="106" cy="180" rx="13" ry="6" fill="#4a3a2c"/><ellipse cx="136" cy="180" rx="13" ry="6" fill="#4a3a2c"/>`;
  const torso = p.robe ? '' : `<path d="M82 116 Q82 162 120 164 Q158 162 158 116 Q158 96 120 96 Q82 96 82 116Z" fill="${p.cloth}"/><path d="M96 150 Q120 158 146 150" fill="none" stroke="${p.cloth2}" stroke-width="4"/><rect x="86" y="128" width="68" height="11" rx="4" fill="${p.trim}"/>`;
  const left = p.shield
    ? `<circle cx="76" cy="124" r="28" fill="${p.trim}"/><circle cx="76" cy="124" r="17" fill="${p.cloth2}" stroke-width="3"/><path d="M76 112 L84 124 L76 136 L68 124 Z" fill="#ffffff" stroke-width="2.5"/>`
    : p.weapon === 'blades' ? '' : `<circle cx="84" cy="126" r="10" fill="${p.trim}"/>`;
  return S(`${p.cape ? `<path d="M94 102 Q62 150 80 180 L156 180 Q176 150 146 102Z" fill="${p.cape}"/>` : ''}${lower}${weapon(p)}${torso}${p.fur ? `<path d="M82 106 Q120 126 158 106 Q152 90 120 90 Q88 90 82 106Z" fill="${p.fur}"/>` : ''}${helm(p)}<circle cx="160" cy="114" r="10" fill="${p.trim}"/>${left}`)
    + `<g><ellipse cx="107" cy="${eyeY}" rx="7" ry="5" fill="${p.eye}"/><ellipse cx="133" cy="${eyeY}" rx="7" ry="5" fill="${p.eye}"/></g>`
    + (p.orb ? `<g><circle cx="178" cy="38" r="25" fill="${p.orb}" opacity=".35"/><circle cx="178" cy="38" r="13" fill="${p.orb}" stroke="#2a1f1a" stroke-width="4"/><circle cx="174" cy="34" r="4" fill="#fff"/></g>` : '');
}

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
}

function beast(p: Beast): string {
  const leg = (x: number, c: string) => `<rect x="${x}" y="146" width="17" height="34" rx="7" fill="${c}"/>`;
  const back = p.spikes ? [64, 84, 104, 124, 144].map((x, i) => `<path d="M${x} ${102 - (i % 2) * 3} L${x + 9} ${72 - (i % 2) * 8} L${x + 18} ${102 - (i % 2) * 3}Z" fill="${p.spikes}"/>`).join('') : '';
  const plates = p.plates ? `<path d="M62 112 Q112 70 164 108 Q112 96 62 112Z" fill="${p.plates}"/><path d="M84 100 V112 M110 92 V106 M136 96 V108" stroke-width="3"/><path d="M208 96 L222 76 L220 104Z" fill="#efe6d2"/>` : '';
  const inner = S(`<path d="M62 118 Q30 110 24 80 Q46 90 66 104Z" fill="${p.body2}"/>${leg(72, p.body2)}${leg(140, p.body2)}${back}<ellipse cx="112" cy="128" rx="58" ry="34" fill="${p.body}"/><ellipse cx="110" cy="144" rx="40" ry="16" fill="${p.belly}" stroke-width="0"/>${plates}${leg(92, p.body)}${leg(158, p.body)}<path d="M160 76 L166 46 L182 72Z" fill="${p.body2}"/><path d="M188 72 L200 46 L208 78Z" fill="${p.body}"/><circle cx="178" cy="104" r="34" fill="${p.body}"/><ellipse cx="204" cy="118" rx="21" ry="14" fill="${p.belly}"/><circle cx="221" cy="113" r="5" fill="#2a1f1a"/><path d="M192 126 L196 136 L202 127 M208 128 L212 136 L216 126" fill="#ffffff" stroke-width="2.5"/>${p.collar ? `<path d="M150 112 Q156 140 176 140" fill="none" stroke-width="13"/><path d="M150 112 Q156 140 176 140" fill="none" stroke="${p.collar}" stroke-width="7"/>` : ''}`)
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

export const REGION_SVG: Record<string, string> = {
  // Demacia: white steel, royal blue, gold
  dem_soldier: soldier({ cloth: '#3f6fc9', cloth2: '#2a5199', trim: '#e2c15a', metal: '#eef1f5', helm: 'crest', weapon: 'sword', shield: true, eye: '#7fe7ff' }),
  dem_knight: soldier({ cloth: '#eef1f5', cloth2: '#aab4c4', trim: '#e2c15a', metal: '#f7f8fa', helm: 'crest', weapon: 'spear', shield: true, cape: '#2a5199', eye: '#ffe27a' }),
  dem_hunter: soldier({ cloth: '#5a6a7a', cloth2: '#3f4c5a', trim: '#c9ced8', metal: '#dfe4ea', helm: 'hood', weapon: 'crossbow', cape: '#3f4c5a', eye: '#ffffff' }),
  dem_wing: flyer({ body: '#f4f6fa', wing: '#dfe6f2', wing2: '#b9c6dc', beak: '#e2c15a', eye: '#7fe7ff', crest: '#3f6fc9' }),
  // Freljord: furs, horns, ice
  frl_raider: soldier({ cloth: '#5d7f9e', cloth2: '#3f5c78', trim: '#b98a4e', metal: '#9aa7b4', helm: 'horn', weapon: 'axe', fur: '#f1ede4', eye: '#bff3ff' }),
  frl_wolf: beast({ body: '#eef4f8', body2: '#b8cbd9', belly: '#ffffff', eye: '#5fd0ff', spikes: '#9fdcff' }),
  frl_troll: brute({ body: '#7fb0c9', body2: '#55829c', belly: '#c4e2ee', eye: '#ffe27a', horn: '#dff4ff', horns: 'ice', club: true }),
  frl_witch: soldier({ cloth: '#3f6a8a', cloth2: '#2a4c66', trim: '#bfe9ff', metal: '#bfe9ff', helm: 'hood', weapon: 'staff', robe: true, fur: '#f1ede4', eye: '#bff3ff', orb: '#9fe8ff' }),
  // Noxus: black iron and crimson
  nox_legion: soldier({ cloth: '#8a1c26', cloth2: '#5e1018', trim: '#3a3136', metal: '#55505a', helm: 'spike', weapon: 'axe', shield: true, eye: '#ff7a4a' }),
  nox_hound: beast({ body: '#4a2a2e', body2: '#2e181c', belly: '#8a3a34', eye: '#ffb347', spikes: '#b3283a', collar: '#55505a' }),
  nox_basilisk: beast({ body: '#5f7a52', body2: '#3f5638', belly: '#c9c08a', eye: '#ffe27a', plates: '#55505a', k: 1.12 }),
  nox_mage: soldier({ cloth: '#5e1018', cloth2: '#3a0a10', trim: '#c9a35a', metal: '#3a3136', helm: 'hood', weapon: 'staff', robe: true, eye: '#ff4a4a', orb: '#ff3a3a' }),
  // Ionia: silk, spirits, masks
  ion_acolyte: soldier({ cloth: '#3f9a8a', cloth2: '#2a6f64', trim: '#f0d9a0', metal: '#f0d9a0', helm: 'hood', weapon: 'staff', robe: true, eye: '#fff3b0', orb: '#ffb8e0' }),
  ion_ninja: soldier({ cloth: '#4a3a6a', cloth2: '#30254a', trim: '#b3283a', metal: '#cfd6e0', helm: 'mask', weapon: 'blades', eye: '#ff9ed2' }),
  ion_crane: flyer({ body: '#ffffff', wing: '#ffd9ec', wing2: '#ff9ed2', beak: '#f0a03a', eye: '#b3283a', crest: '#b3283a' }),
  ion_oni: brute({ body: '#b84a5a', body2: '#8a2f3e', belly: '#e69aa4', eye: '#fff3b0', horn: '#f0e6d2', horns: 'oni', mark: '#f0d9a0' }),
  ion_wisp: wisp('#7ff0e0', '#eafffb'),
};
