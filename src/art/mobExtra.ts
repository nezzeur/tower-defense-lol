// Same cartoon style as mobDesign.ts (thick #2a1f1a outline, flat fills, glowing eyes) for the enemies
// the design did not cover. Original art. viewBox 0 0 240 200, feet at y~184, facing right.
const S = (b: string) => `<g stroke="#2a1f1a" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${b}</g>`;

export const EXTRA_SVG: Record<string, string> = {
  super: S(`
<rect x="96" y="148" width="18" height="32" rx="7" fill="#3a2230"/><rect x="128" y="148" width="18" height="32" rx="7" fill="#3a2230"/>
<ellipse cx="103" cy="181" rx="14" ry="6" fill="#4a3526"/><ellipse cx="138" cy="181" rx="14" ry="6" fill="#4a3526"/>
<g transform="rotate(-24 178 124)"><rect x="170" y="48" width="14" height="82" rx="5" fill="#e9eef3"/><path d="M177 54 V122" stroke="#b7c2cc" stroke-width="2.5"/><rect x="156" y="128" width="42" height="10" rx="4" fill="#d9ad4f"/><rect x="171" y="138" width="12" height="22" rx="4" fill="#6b4a2e"/></g>
<path d="M76 116 Q76 166 120 168 Q164 166 164 116 Q164 90 120 90 Q76 90 76 116Z" fill="#a82727"/>
<path d="M92 154 Q120 164 150 154" fill="none" stroke="#6e1717" stroke-width="4"/>
<rect x="80" y="126" width="80" height="12" rx="4" fill="#d9ad4f"/>
<circle cx="164" cy="112" r="12" fill="#d9ad4f"/><circle cx="72" cy="126" r="30" fill="#d9ad4f"/><circle cx="72" cy="126" r="18" fill="#a82727" stroke-width="3"/><path d="M72 113 L80 126 L72 139 L64 126Z" fill="#e9eef3" stroke-width="2.5"/>
<circle cx="120" cy="62" r="42" fill="#b9c3cf"/><path d="M88 48 Q102 30 128 28" fill="none" stroke="#e6ecf2" stroke-width="5"/>
<path d="M82 40 L66 10 L96 30Z M158 40 L174 10 L144 30Z" fill="#d9ad4f"/>
<path d="M112 22 Q120 0 132 6 Q124 14 126 28Z" fill="#a82727"/>
<rect x="82" y="54" width="76" height="22" rx="11" fill="#1f2633"/>`) +
    `<ellipse cx="104" cy="65" rx="7" ry="5" fill="#ffd75e"/><ellipse cx="136" cy="65" rx="7" ry="5" fill="#ffd75e"/>`,

  scuttle: S(`
<path d="M70 150 L44 172 M88 158 L70 184 M152 158 L170 184 M170 150 L196 172" fill="none" stroke="#1f8f86" stroke-width="7"/>
<path d="M62 116 Q40 96 50 74 Q76 70 84 96Z" fill="#37c2b5"/><path d="M178 116 Q200 96 190 74 Q164 70 156 96Z" fill="#37c2b5"/>
<path d="M54 80 L40 62 L66 72Z M186 80 L200 62 L174 72Z" fill="#7de8de" stroke-width="3"/>
<ellipse cx="120" cy="136" rx="62" ry="40" fill="#4fd1c5"/>
<path d="M76 140 Q120 164 164 140" fill="none" stroke="#2fa89d" stroke-width="4"/>
<ellipse cx="120" cy="150" rx="34" ry="16" fill="#bff3ec" stroke-width="3"/>
<path d="M98 100 L96 78 M142 100 L144 78" fill="none" stroke-width="5"/>
<circle cx="96" cy="72" r="14" fill="#fff6c7" stroke-width="3"/><circle cx="144" cy="72" r="14" fill="#fff6c7" stroke-width="3"/>
<path d="M112 120 L120 108 L128 120" fill="#ffd36b" stroke-width="3"/>`) +
    `<circle cx="98" cy="73" r="6" fill="#1a2a26"/><circle cx="142" cy="73" r="6" fill="#1a2a26"/><circle cx="99" cy="71" r="2" fill="#fff"/><circle cx="143" cy="71" r="2" fill="#fff"/>`,

  herald: S(`
<ellipse cx="62" cy="168" rx="26" ry="14" fill="#5b2a80"/><ellipse cx="96" cy="160" rx="32" ry="24" fill="#6f33a0"/>
<ellipse cx="140" cy="150" rx="40" ry="34" fill="#8e44ad"/>
<path d="M98 150 Q96 130 104 120 M118 148 Q118 124 126 112" fill="none" stroke="#5b2a80" stroke-width="4"/>
<path d="M120 128 Q140 110 170 116 L172 146 Q150 160 126 150Z" fill="#c07ae0" stroke-width="3"/>
<path d="M150 112 L146 80 L168 104 Z M176 112 L188 82 L196 112 Z" fill="#e05cff"/>
<circle cx="176" cy="116" r="30" fill="#8e44ad"/>
<path d="M194 124 Q214 126 214 140 Q200 150 186 144Z" fill="#5b2a80"/>
<path d="M192 138 L196 148 L202 140 M204 138 L207 146" fill="#fff" stroke-width="2.5"/>
<ellipse cx="176" cy="108" rx="15" ry="16" fill="#1a0d2b"/>`) +
    `<circle cx="178" cy="108" r="10" fill="#ffe66b"/><circle cx="180" cy="108" r="4" fill="#1a0d2b"/>`,

  riftherald: S(`
<path d="M54 142 Q18 130 22 94 Q34 70 56 84 Q44 100 70 110Z" fill="#6b3ec0"/><path d="M186 142 Q222 130 218 94 Q206 70 184 84 Q196 100 170 110Z" fill="#6b3ec0"/>
<path d="M26 94 L14 76 L40 82Z M214 94 L226 76 L200 82Z" fill="#e0a5ff" stroke-width="3"/>
<rect x="76" y="150" width="26" height="32" rx="9" fill="#4a2a88"/><rect x="138" y="150" width="26" height="32" rx="9" fill="#4a2a88"/>
<path d="M60 150 Q50 80 120 56 Q190 80 180 150 Q120 176 60 150Z" fill="#5b3a9e"/>
<path d="M82 140 Q120 156 158 140" fill="none" stroke="#4a2a88" stroke-width="4"/>
<path d="M88 66 L84 30 L108 56Z M132 56 L156 30 L152 66Z M110 52 L120 18 L130 52Z" fill="#e0a5ff"/>
<ellipse cx="120" cy="104" rx="38" ry="32" fill="#1a0d2b"/>
<path d="M92 140 L100 150 L108 140 L116 150 L124 140 L132 150 L140 140 L148 150" fill="#fff" stroke-width="2.5"/>`) +
    `<ellipse cx="120" cy="104" rx="28" ry="23" fill="#7d3cff"/><ellipse cx="120" cy="104" rx="12" ry="20" fill="#ffe66b"/><ellipse cx="120" cy="104" rx="4" ry="14" fill="#1a0d2b"/>`,

  poroking: S(`
<ellipse cx="86" cy="176" rx="20" ry="9" fill="#d8d4cc"/><ellipse cx="154" cy="176" rx="20" ry="9" fill="#d8d4cc"/>
<path d="M44 150 Q36 90 92 70 L96 40 L114 62 Q120 60 126 62 L144 40 L148 70 Q204 90 196 150 Q170 184 120 182 Q70 184 44 150Z" fill="#f5f2ea"/>
<path d="M92 48 L98 40 L108 56Z M148 48 L142 40 L132 56Z" fill="#f2a6b0" stroke-width="2.5"/>
<path d="M60 150 Q80 168 120 168 Q160 168 180 150" fill="none" stroke="#d8d4cc" stroke-width="4"/>
<ellipse cx="120" cy="140" rx="30" ry="22" fill="#ffffff" stroke-width="3"/>
<path d="M104 134 Q120 148 136 134" fill="#7a2a3a" stroke-width="3"/>
<ellipse cx="120" cy="124" rx="9" ry="6" fill="#d9788a" stroke-width="3"/>
<path d="M78 66 L84 30 L100 52 L120 20 L140 52 L156 30 L162 66 Z" fill="#ffd84a"/>
<path d="M80 66 H160" stroke="#c9a12c" stroke-width="5"/><circle cx="120" cy="40" r="5" fill="#ff5a5a" stroke-width="2.5"/>
<ellipse cx="90" cy="100" rx="17" ry="19" fill="#fff"/><ellipse cx="150" cy="100" rx="17" ry="19" fill="#fff"/>`) +
    `<circle cx="94" cy="102" r="10" fill="#2a1f1a"/><circle cx="146" cy="102" r="10" fill="#2a1f1a"/><circle cx="97" cy="98" r="3.5" fill="#fff"/><circle cx="149" cy="98" r="3.5" fill="#fff"/>`,

  colossus: S(`
<path d="M82 160 L78 182 L110 182 L108 160 Z M134 160 L132 182 L164 182 L160 160 Z" fill="#7aa3c0"/>
<path d="M68 168 L56 108 L84 62 L160 58 L186 106 L174 168 Z" fill="#9fc4dc"/>
<path d="M160 58 L186 106 L174 168 L148 160 L152 104 Z" fill="#7aa3c0"/>
<path d="M84 62 L104 50 L140 48 L160 58 L120 72 Z" fill="#dff4ff"/>
<path d="M40 100 L62 90 L76 122 L70 154 L38 152 L28 126 Z" fill="#9fc4dc"/><path d="M180 94 L206 102 L214 136 L198 156 L174 148 L168 116 Z" fill="#7aa3c0"/>
<path d="M76 56 L66 22 L96 48Z M146 50 L170 20 L172 56Z M112 46 L122 10 L134 46Z" fill="#dff4ff"/>
<path d="M92 88 L114 94 M128 94 L150 88" stroke-width="6"/>
<path d="M106 114 L114 128 L106 142 L118 156" fill="none" stroke="#5a7e98" stroke-width="3"/>`) +
    `<rect x="96" y="96" width="14" height="8" rx="3" fill="#bff4ff"/><rect x="132" y="96" width="14" height="8" rx="3" fill="#bff4ff"/>`,

  sentinel: S(`
<path d="M82 160 L78 182 L110 182 L108 160 Z M134 160 L132 182 L164 182 L160 160 Z" fill="#a8822c"/>
<path d="M68 168 L60 110 L84 60 L160 60 L182 110 L174 168 Z" fill="#c9a35a"/>
<path d="M160 60 L182 110 L174 168 L148 160 L152 104 Z" fill="#a8822c"/>
<path d="M84 60 L108 44 L136 44 L160 60 L120 70Z" fill="#e8c878"/>
<path d="M86 108 H154 M84 134 H156" stroke="#a8822c" stroke-width="3"/>
<path d="M112 44 L120 8 L128 44Z" fill="#e8c878"/><path d="M96 48 L84 20 L108 44Z M144 48 L156 20 L132 44Z" fill="#c9a35a" stroke-width="3"/>
<path d="M36 100 L62 90 L74 122 L68 154 L38 152 L26 126Z" fill="#c9a35a"/><path d="M180 94 L206 102 L214 136 L198 154 L174 146 L168 116Z" fill="#a8822c"/>
<circle cx="120" cy="96" r="20" fill="#1a2630"/>`) +
    `<circle cx="120" cy="96" r="13" fill="#4fe0ff"/><circle cx="120" cy="96" r="5" fill="#fff"/><path d="M104 140 L114 126 L126 142 L136 128" fill="none" stroke="#4fe0ff" stroke-width="3" stroke-linecap="round"/>`,

  fallenking: S(`
<path d="M50 150 Q40 86 120 60 Q200 86 190 150 L200 184 L178 168 L164 186 L146 166 L120 186 L100 166 L80 186 L66 166 L40 184Z" fill="#3dd6a3" opacity=".92"/>
<path d="M74 150 Q120 164 166 150" fill="none" stroke="#25a07a" stroke-width="4"/>
<path d="M44 128 Q22 140 26 168 L40 156 L48 170 L56 150Z" fill="#25a07a"/>
<path d="M78 66 L72 30 L96 52 L120 18 L144 52 L168 30 L162 66Z" fill="#ffd84a"/><path d="M78 66 H162" stroke="#c9a12c" stroke-width="5"/>
<circle cx="120" cy="38" r="5" fill="#ff5a5a" stroke-width="2.5"/>
<ellipse cx="120" cy="104" rx="42" ry="36" fill="#2bb88a"/>
<ellipse cx="102" cy="100" rx="11" ry="15" fill="#0b2a22"/><ellipse cx="138" cy="100" rx="11" ry="15" fill="#0b2a22"/>
<path d="M98 128 Q120 142 142 128 L138 140 Q120 150 102 140Z" fill="#0b2a22" stroke-width="3"/>
<rect x="196" y="50" width="8" height="96" rx="3" fill="#cfe9e0"/><rect x="184" y="136" width="32" height="8" rx="3" fill="#ffd84a"/>`) +
    `<ellipse cx="102" cy="101" rx="5" ry="8" fill="#bfffe9"/><ellipse cx="138" cy="101" rx="5" ry="8" fill="#bfffe9"/>`,

  petricite: S(`
<path d="M82 160 L78 182 L110 182 L108 160 Z M134 160 L132 182 L164 182 L160 160 Z" fill="#aab3c2"/>
<path d="M68 168 L56 108 L84 62 L160 58 L186 106 L174 168 Z" fill="#dfe5ee"/>
<path d="M160 58 L186 106 L174 168 L148 160 L152 104 Z" fill="#aab3c2"/>
<path d="M84 62 L104 50 L140 48 L160 58 L120 72 Z" fill="#ffffff"/>
<path d="M40 100 L62 90 L76 122 L70 154 L40 152 L30 126 Z" fill="#dfe5ee"/><path d="M180 94 L206 102 L214 136 L198 154 L174 146 L170 116 Z" fill="#aab3c2"/>
<path d="M96 56 L90 20 L116 50Z M124 50 L150 18 L148 58Z" fill="#c7a8ff" stroke-width="3"/>
<path d="M74 124 L90 104 L108 128 L90 150Z M130 130 L148 108 L164 132 L146 152Z" fill="#c7a8ff" stroke-width="3"/>
<path d="M92 86 L114 92 M128 92 L150 86" stroke-width="6"/>`) +
    `<rect x="96" y="94" width="14" height="8" rx="3" fill="#ffd84a"/><rect x="132" y="94" width="14" height="8" rx="3" fill="#ffd84a"/>`,

  warbeast: S(`
<path d="M34 118 Q18 100 24 76 Q40 92 46 86 Q44 104 58 108Z" fill="#5a1220"/>
<rect x="66" y="140" width="22" height="42" rx="9" fill="#5a1220"/><rect x="146" y="140" width="22" height="42" rx="9" fill="#5a1220"/>
<ellipse cx="116" cy="122" rx="66" ry="42" fill="#8a1c2a"/>
<rect x="88" y="146" width="22" height="36" rx="9" fill="#8a1c2a"/><rect x="158" y="146" width="22" height="36" rx="9" fill="#8a1c2a"/>
<path d="M62 120 Q116 96 168 116" fill="none" stroke="#5a1220" stroke-width="4"/>
<path d="M104 90 L112 60 L124 82 L136 54 L144 82 L156 60 L160 96Z" fill="#4a4048"/>
<path d="M152 70 L146 28 L172 56Z M184 64 L200 26 L204 66Z" fill="#e8dcc0"/>
<path d="M148 100 Q150 62 184 60 Q214 64 216 92 L226 106 Q220 122 198 122 Q168 128 152 116Z" fill="#a8283a"/>
<path d="M176 118 L182 106 L188 118 M192 117 L197 106 L202 116" fill="#fff" stroke-width="2.5"/>
<circle cx="224" cy="102" r="6" fill="#1a0d14" stroke-width="2.5"/>
<path d="M166 84 L192 90" stroke-width="5"/>`) +
    `<path d="M172 90 Q180 84 192 92 Q180 98 172 90Z" fill="#ffd75e"/><circle cx="182" cy="91" r="2" fill="#2a1f1a"/>`,

  spiritguard: S(`
<path d="M52 150 Q44 90 120 66 Q196 90 188 150 Q196 176 172 170 Q160 188 142 170 Q120 188 100 170 Q80 188 68 170 Q44 176 52 150Z" fill="#ff9ed2" opacity=".95"/>
<path d="M76 150 Q120 166 164 150" fill="none" stroke="#e070aa" stroke-width="4"/>
<path d="M66 82 L58 36 L94 66Z M174 82 L182 36 L146 66Z" fill="#ffc2e4"/>
<path d="M66 70 L62 46 L82 66Z M174 70 L178 46 L158 66Z" fill="#e070aa" stroke-width="2.5"/>
<ellipse cx="120" cy="108" rx="44" ry="38" fill="#ffb5dc"/>
<ellipse cx="120" cy="40" rx="18" ry="7" fill="#fff0f6" stroke-width="3"/><path d="M120 33 Q112 24 120 16 Q128 24 120 33Z" fill="#ffd0e8" stroke-width="2.5"/>
<ellipse cx="100" cy="104" rx="11" ry="15" fill="#4a1a38"/><ellipse cx="140" cy="104" rx="11" ry="15" fill="#4a1a38"/>
<path d="M110 128 Q120 138 130 128" fill="none" stroke-width="3.5"/>`) +
    `<ellipse cx="100" cy="105" rx="5" ry="8" fill="#fff6c7"/><ellipse cx="140" cy="105" rx="5" ry="8" fill="#fff6c7"/>`,

  automaton: S(`
<path d="M78 160 L74 182 L110 182 L108 160 Z M132 160 L130 182 L166 182 L162 160 Z" fill="#8a6c34"/>
<path d="M66 168 L58 110 L84 62 L160 62 L184 110 L176 168 Z" fill="#c9a35a"/>
<path d="M160 62 L184 110 L176 168 L150 160 L154 106 Z" fill="#a8822c"/>
<path d="M84 62 L106 48 L138 48 L160 62 L120 74Z" fill="#e8c878"/>
<circle cx="120" cy="136" r="20" fill="#1a2630"/><path d="M70 118 H98 M142 118 H170 M70 150 H96 M144 150 H170" stroke="#8a6c34" stroke-width="3"/>
<circle cx="76" cy="88" r="4" fill="#e8c878" stroke-width="2"/><circle cx="164" cy="88" r="4" fill="#e8c878" stroke-width="2"/>
<rect x="104" y="20" width="32" height="30" rx="8" fill="#c9a35a"/><path d="M120 20 V4" stroke-width="5"/><circle cx="120" cy="4" r="5" fill="#3fe0d0" stroke-width="3"/>
<path d="M38 100 L62 92 L74 124 L68 156 L40 154 L28 128Z" fill="#c9a35a"/><path d="M180 94 L206 102 L214 136 L198 156 L174 148 L168 116Z" fill="#a8822c"/>
<rect x="88" y="84" width="64" height="18" rx="9" fill="#1a2630"/>`) +
    `<circle cx="120" cy="136" r="13" fill="#3fe0d0"/><circle cx="120" cy="136" r="5" fill="#fff"/><rect x="98" y="88" width="14" height="10" rx="4" fill="#3fe0d0"/><rect x="128" y="88" width="14" height="10" rx="4" fill="#3fe0d0"/>`,
};
