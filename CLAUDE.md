# Rift Defenders (LolTD)

Personal, local-only LoL-themed tower defense (PokéPath-like progression). Original code and art; official champion/item/ability images load at runtime from Riot Data Dragon (`src/art/champArt.ts`). Never bundle or publish Riot assets.

## Token budget (user priority)
- Delegate implementation to a Sonnet subagent (`model: "sonnet"`), usually one, max 2-3. Opus: short brief, quick review, short summary.
- Cheap checks: `npm run check` (= `tsc --noEmit`, `vite build`, short sim). Browser screenshots or balance sims only when really needed.
- Reply in French, briefly.

## Commands
- `npm run dev` (port 5173; user's real save lives on origin localhost:5174)
- `npm run sim -- <starter> <hours>` headless balance bot; env `GROWTH`, `BASE`, `BAL`, `LOG=<mapId>`
- `?save=<name>` URL param = separate save slot for testing; `?save=demo` starts with all champions (lvl 20), all maps cleared, 5M gold

## Layout
- `src/game.ts` rules: stats, levels (max 150), stars, unlocks (`unlockReason`, `isArena`), economy `BALANCE`, waves, chests
- `src/battle/` one battle on one map (import from `./battle`, i.e. `battle/index.ts`):
  - `battle.ts` class `Battle`: board state, placement, saved teams, wave flow, modes, spells, blessings, main loop (`step`, rAF `frame` drives the sim, the 50 ms timer only takes over in a hidden tab)
  - `model.ts` shapes and constants (`Enemy`, `Tower`, `Proj`, `Fx`, `TILE`, `SPELLS`, `PRIORITIES`, `TUNE`)
  - `enemies.ts` spawn, movement, traits, boss abilities (`useAbility`), allied turrets
  - `combat.ts` targeting, projectiles, `hit`, `damage`, `kill`, loot
  - `ultimates.ts` aiming, `castUlt` per effect type, auto-cast
  - `effects.ts` visual/sound cues fired by the sim (no-ops headless)
  - `input.ts` pointer input on the canvas
  - `render.ts` frame + visual-only animation (`animate`, `render`, weather `AMBIENT`), `units.ts` monsters and champions, `scenery.ts` portal, nexus, banners, cut-in, bolts
  - Convention: module functions take the battle as first argument `bt`; `Battle` members are public for these modules only. Render-only fields on `Tower`/`Enemy` never feed the sim. `store.data.lowFx` = reduced effects
- `src/ui/` screens: `index.ts` (router/header), `common.ts` (shared state `ui`, helpers), `atlas.ts`, `collection.ts`, `shop.ts` (+chest), `inventory.ts` (inventory + forge), `options.ts`, `starter.ts`, `bestiary.ts` (monsters met, from save `bestiary` id -> kills), `tutorial.ts` (one-time guided tips anchored to a selector: `TIPS` list with `when`/`done`, seen ids in save `tips`, `tutorialTick` runs on render and in `refreshLive`), `battleHud.ts`, `events.ts` (all DOM listeners), `backdrop.ts` (living menu backdrop: runtime champion splash, per-screen light `--amb`, motes; off in battle and with `lowFx`)
- `src/data/` champions (26), enemies, items, `maps.ts` (regions plan + hand maps + curve), `mapgen.ts` (seeded generator)
- `src/art/` `color.ts` (shade), `glow.ts` (cached soft sprites for every glow/light/soft shadow — use it instead of `shadowBlur`), `vfx.ts` (`Vfx`: particles with physics, lights, ground marks, dying monsters; visual only, null in headless), `heroes.ts` (board champions: body per role + weapon + portrait head, `HERO_LOOK` weapon/shot/element per champion, `drawShot` projectiles), `mapHD.ts` terrain/landmarks (returns the map's light sources), `regionArt.ts` (per-region ground dressing, set pieces, colour grade; runtime weather/lights live in `battle.ts` `AMBIENT`), `creatures.ts` vector monsters, `worldArt.ts` atlas, `champArt.ts`
- `scripts/sim.ts` balance bot; `public/mobs/` optional custom monster PNGs

## Adding things
- Champion: entry in `data/champions.ts` (base stats, `ult` rank upgrade, `active` ultimate using an existing `UltFx` kind) + key in `art/champArt.ts` `KEYS` + look in `art/heroes.ts` `HERO_LOOK`.
- Monster: entry in `data/enemies.ts` (traits are plain fields) + art in `art/mobRegion.ts` (`REGION_SVG`, templates or `recolor`) + height/top in `art/creatures.ts` (`CREATURE_HEIGHT`, `TOP`, `FLOATERS`) + a wave slot in `REGION_ROSTER` (`game.ts`). New trait: field on `EnemyDef`, behaviour in `battle/enemies.ts` or `battle/combat.ts`, text in `enemyTraits`.
- Boss ability: new `kind` in `Ability` (`types.ts`), a `case` in `useAbility` (`battle/enemies.ts`), a phrase in `enemyTraits`.
- Ultimate effect type: new `kind` in `UltFx` (`types.ts`), a branch in `castUlt` (`battle/ultimates.ts`), a rule in `autoUlts`.
- Item: `data/items.ts` (shop: `price`; forged: `craft` recipe). Material: `data/loot.ts`. Blessing: `data/boons.ts` (stat channel of `Battle.syn`, or a `special` handled in `Battle.pickBoon` / `statsAt`).
- Region: plan in `data/maps.ts` (`REGION_PLANS`, `REGION_BOSSES`), roster in `game.ts`, look in `art/mapHD.ts` `LOOKS` + `art/regionArt.ts`, weather in `battle/render.ts` `AMBIENT`, music theme in `music.ts`, materials in `data/loot.ts`.
- Screen: file in `ui/`, id in `Screen` (`ui/common.ts`), tab + route in `ui/index.ts`, clicks in `ui/events.ts` (one delegated listener on `data-*` attributes). Tip: entry in `ui/tutorial.ts` `TIPS`.
- Saved field: add to `SaveData` + `fresh()` + a guard in `sanitize()` (`save.ts`) so old saves keep loading.
- After any change: `npm run check` (typecheck, build, short headless sim).

## Game state
- 5 regions ("villes"): Faille 5 maps, Demacia 6, Freljord 7, Noxus 8, Ionia 9. Regular maps 50 waves, last map = arena (60). Game speed x1/x2 only. A final boss reaching the nexus = instant defeat (`BALANCE.bossHp` 0.35 scales boss HP so one pass is fair). Victory never auto-restarts on screen: the end screen offers next map / replay. New region opened: one-time reveal on the atlas (save `regionsSeen`). 3★ on previous map opens next; arena opens next region.
- Difficulty `mult = 1.5 * 1.25^index * laneFactor` (raised from 1.24 after ultimates + synergies); bot clears all in ~12-14h (noisy).
- Shurima, Piltover, Shadow Isles shelved (hand maps kept in `HAND`, decorative on atlas).
- Active ultimates: `ChampionDef.active` (cd 40-80s, effect `UltFx`: burst/control/buff/execute/gold/lives), cast from HUD buttons or keys 1-9; `Battle.castUlt`; damage scaled by `TUNE.ult` (0.25, sim-tuned). `def.ult` = passive upgrade at levels 10/30/60 (`ULT_LEVELS`) ("Rang d'ultime").
- Region synergies (`src/data/synergies.ts`): 2/3/4+ same-region placed champions give +5/10/18 % (Demacia armor shred, Freljord slow, Noxus dmg, Ionia rate, Piltover range, Zaun splash, Bilgewater gold, Bandle ult recharge, Néant boss dmg).
- Boss drops (`rewardChance`/`rollReward` in `game.ts`): 7 maps carry a champion; each final-boss win rolls a fixed `REWARD.base 5 % * 0.82^rank` (5 % Voie du Bas ... 1.5 % Ionia). No pity, by user choice.
- Loot (`src/data/loot.ts`): monsters drop materials into `store.data.mats`; fixed chance per roll by rarity (`DROP_CHANCE` 5 / 1.5 / 0.4 / 0.2 %), `lootRolls` gives tough monsters more rolls (epic 25, boss 50). 6 universal materials by monster family + 3 per region (any monster on that region's maps).
- Items (`src/data/items.ts`): 20 shop items (`SHOP_ITEMS`, priced 400 → 3M to span the whole campaign; bot now ~12h40-14h) + 11 forged (`FORGE_ITEMS`, `craft` recipe, 2 per region + 1 legendary); `canCraft`/`craftItem` in `game.ts`. Pages `src/ui/inventory.ts` (Inventaire, Forge), styles `src/styles/inventory.css`.
- Regional enemies (`data/enemies.ts`, MOBA-jungle spirit): per region a recoloured lane minion (`*_minion`), camp creatures (`dem_golem`, `dem_hound`, `dem_wing`, `frl_wolf`, `frl_troll`, `frl_shaman`, `nox_hound`, `nox_basilisk`, `nox_mage`, `ion_fox`, `ion_crane`, `ion_treant`, `ion_wisp`) and an elemental drake as epic (`drake_mountain`, `drake_ocean`, `drake`, `drake_cloud`). Wave slots: `REGION_ROSTER` in `game.ts`. Art: `art/mobRegion.ts` (templates + `recolor` of the base minion/caster/drake SVGs). Traits on `EnemyDef` (fly, tenacity, regen, heal, shield, split, fireproof) handled in `battle.ts`, described by `enemyTraits`. Sim: 11h48-14h37.
- Endless mode: region arenas only (`endlessUnlocked` checks `isArena`). (`Battle.endless`, chosen with the mode selector `Battle.setMode` which never launches a wave by itself, save `endless[mapId]` = waves survived): opens on a map once its last wave is beaten, starts right after it. HP (`endlessHp` in `game.ts`) = HP of wave 30 x `endlessWaveFactor(n)` (1.25 x (1 + 0.06 n) x 1.006^n) x level factor (enemies match 65 % of each level the board's average is above `endlessRefLevel(map)` = 18 + 2.05 x map index, measured on the bot). "% of max HP" damage is divided by the wave factor in endless (`Battle.pctHpScale`), otherwise it ignores the curve. The map's boss returns every 25 endless waves and is the usual wall. Probe: `npx tsx scripts/endless.ts <level> <mapIndex,...>` (fixed 8-champion team with shop items): map 1 lvl 95 → 224 waves; arenas at lvl 95 → Demacia 99, Freljord 64, Noxus 24, Ionia 2; Ionia lvl 130 → 19, lvl 150 → 47.
- Endless rewards (`ENDLESS_LOOT` in `game.ts`, all pure luck by user choice): killing the endless boss drops the region's relic at 12 % (`relic` materials `r_*` in `data/loot.ts`, used by the 5 relic items `x-*` in `data/items.ts` with new effects: `unfreezable`, `ultOnKill`, `execute`, `trueSight`, extra target) and, on the last map only, the exclusive champion Lillia at 1 % (`ChampionDef.endless`, never in chests). `endlessBossLoot` in `battle/combat.ts`.
- Aimed ultimates: `Battle.requestUlt` arms burst / area-control ults (`needsAim`), a click on the board casts there (`castUlt(t, at)`), pressing again auto-aims; others fire at once. Bot and auto-cast use auto-aim.
- Blessings (`src/data/boons.ts`, 10 of them), endless mode only by user choice: after each endless wave `BOON_CHANCE` (25 %) to pause on a choice of 3, at most `BOON_MAX` (10) per run (unbounded stacking made runs infinite); they feed the same team channels as synergies (`Battle.syn`). Auto waves pick after 8 s.
- Boss and epic abilities: `EnemyDef.ability` (`Ability` in `types.ts`: summon, charge, shield, freeze champions, rally, phase, mend) on a cooldown, run by `Battle.useAbility`; frozen champions use `Tower.stunT`. Regular maps take their boss from `REGION_BOSSES` in `maps.ts` (rift herald/baron, demacia petricite, freljord colossus/poro king, noxus warbeast, ionia spirit guard). Void grub (`herald`, summons `voidling`s) is the Rift's wave-20 epic only. Sim after this: 11h05-12h26.
- Saved teams: 3 slots per map (`TEAM_SLOTS`, save `teams` / `teamSlot`, `Battle.switchTeam`, between waves only); `layouts[mapId]` stays the active one. End screen: `runStats` in `battleHud.ts` (totals + per-champion table).
- Target priority per champion (`Tower.priority`, save `priorities`); enemy click shows an info card (`Battle.selectedEnemy`).
- Balance facts (measured, `ENDLESS=1 npm run sim` prints them): raw damage keeps up with enemy HP over the whole campaign (the strongest champion needs 1 hit on a wave-25 minion early, 3-10 on the last maps); team level at first clear goes from 18 to ~88. Champion balance probe: `npx tsx scripts/champs.ts <level> <mapIndex,...>` runs every champion alone; after the last pass most sit at 17-21 waves (maps 13 and 20, level 45), Lillia 28, utility champions (Soraka, Twisted Fate, Gangplank, Morgana) lower by design. Nasus's permanent stacks multiply damage (`permStackMult`, +3 % x sqrt). `ULT=<x>` env scales/disables ults in the sim.
- Auto-cast option (`store.data.autoUlt`, `Battle.autoUlts`): casts ready ults when worthwhile (5+ enemies or an epic/boss).
- Economy (Nov 2026 pass): level cost x `RARITY_COST` (common 1, rare 1.6, epic 2.5, legendary 4); chests `chestBase` 400 x 1.55^owned, weights 12/4/1, `EPIC_PITY` 6; `hpPerWave` 1.07. Bot: ~30h+ for the campaign, arenas are the walls.
- Ideas queued: legendary champions (rarity 4, cost slot ready), more regions, music.
