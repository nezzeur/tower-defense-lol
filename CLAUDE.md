# Rift Defenders (LolTD)

Personal, local-only LoL-themed tower defense (PokéPath-like progression). Original code and art; official champion/item/ability images load at runtime from Riot Data Dragon (`src/art/champArt.ts`). Never bundle or publish Riot assets.

## Token budget (user priority)
- Delegate implementation to a Sonnet subagent (`model: "sonnet"`), usually one, max 2-3. Opus: short brief, quick review, short summary.
- Cheap checks: `npx tsc --noEmit && npx vite build`. Browser screenshots or balance sims only when really needed.
- Reply in French, briefly.

## Commands
- `npm run dev` (port 5173; user's real save lives on origin localhost:5174)
- `npm run sim -- <starter> <hours>` headless balance bot; env `GROWTH`, `BASE`, `BAL`, `LOG=<mapId>`
- `?save=<name>` URL param = separate save slot for testing; `?save=demo` starts with all champions (lvl 20), all maps cleared, 5M gold

## Layout
- `src/game.ts` rules: stats, levels (max 150), stars, unlocks (`unlockReason`, `isArena`), economy `BALANCE`, waves, chests
- `src/battle.ts` sim + HD render, lanes, tile features, turrets, drag-to-move. The rAF loop drives the sim (`advance`) for smooth motion; the 50 ms timer only takes over in a hidden tab. Render-only fields on `Tower`/`Enemy` (aim, swing, knock-back...) never feed the sim. Hit-stop, light pass (`screen` blend) and `store.data.lowFx` (reduced effects option)
- `src/ui/` screens: `index.ts` (router/header), `common.ts` (shared state `ui`, helpers), `atlas.ts`, `collection.ts`, `shop.ts` (+chest), `inventory.ts` (inventory + forge), `options.ts`, `starter.ts`, `battleHud.ts`, `events.ts` (all DOM listeners)
- `src/data/` champions (26), enemies, items, `maps.ts` (regions plan + hand maps + curve), `mapgen.ts` (seeded generator)
- `src/art/` `color.ts` (shade), `glow.ts` (cached soft sprites for every glow/light/soft shadow — use it instead of `shadowBlur`), `vfx.ts` (`Vfx`: particles with physics, lights, ground marks, dying monsters; visual only, null in headless), `heroes.ts` (board champions: body per role + weapon + portrait head, `HERO_LOOK` weapon/shot/element per champion, `drawShot` projectiles), `mapHD.ts` terrain/landmarks (returns the map's light sources), `regionArt.ts` (per-region ground dressing, set pieces, colour grade; runtime weather/lights live in `battle.ts` `AMBIENT`), `creatures.ts` vector monsters, `worldArt.ts` atlas, `champArt.ts`
- `scripts/sim.ts` balance bot; `public/mobs/` optional custom monster PNGs

## Game state
- 5 regions ("villes"): Faille 5 maps, Demacia 6, Freljord 7, Noxus 8, Ionia 9. Regular maps 30 waves, last map = arena (40). 3★ on previous map opens next; arena opens next region.
- Difficulty `mult = 1.5 * 1.25^index * laneFactor` (raised from 1.24 after ultimates + synergies); bot clears all in ~12-14h (noisy).
- Shurima, Piltover, Shadow Isles shelved (hand maps kept in `HAND`, decorative on atlas).
- Active ultimates: `ChampionDef.active` (cd 40-80s, effect `UltFx`: burst/control/buff/execute/gold/lives), cast from HUD buttons or keys 1-9; `Battle.castUlt`; damage scaled by `TUNE.ult` (0.25, sim-tuned). `def.ult` = passive upgrade at levels 6/11/16 ("Rang d'ultime").
- Region synergies (`src/data/synergies.ts`): 2/3/4+ same-region placed champions give +5/10/18 % (Demacia armor shred, Freljord slow, Noxus dmg, Ionia rate, Piltover range, Zaun splash, Bilgewater gold, Bandle ult recharge, Néant boss dmg).
- Boss drops (`rewardChance`/`rollReward` in `game.ts`): 7 maps carry a champion; each final-boss win rolls a fixed `REWARD.base 5 % * 0.82^rank` (5 % Voie du Bas ... 1.5 % Ionia). No pity, by user choice.
- Loot (`src/data/loot.ts`): monsters drop materials into `store.data.mats`; fixed chance per roll by rarity (`DROP_CHANCE` 5 / 1.5 / 0.4 / 0.2 %), `lootRolls` gives tough monsters more rolls (epic 25, boss 50). 6 universal materials by monster family + 3 per region (any monster on that region's maps).
- Items (`src/data/items.ts`): 20 shop items (`SHOP_ITEMS`, priced 400 → 3M to span the whole campaign; bot now ~12h40-14h) + 11 forged (`FORGE_ITEMS`, `craft` recipe, 2 per region + 1 legendary); `canCraft`/`craftItem` in `game.ts`. Pages `src/ui/inventory.ts` (Inventaire, Forge), styles `src/styles/inventory.css`.
- Regional enemies (`data/enemies.ts`, MOBA-jungle spirit): per region a recoloured lane minion (`*_minion`), camp creatures (`dem_golem`, `dem_hound`, `dem_wing`, `frl_wolf`, `frl_troll`, `frl_shaman`, `nox_hound`, `nox_basilisk`, `nox_mage`, `ion_fox`, `ion_crane`, `ion_treant`, `ion_wisp`) and an elemental drake as epic (`drake_mountain`, `drake_ocean`, `drake`, `drake_cloud`). Wave slots: `REGION_ROSTER` in `game.ts`. Art: `art/mobRegion.ts` (templates + `recolor` of the base minion/caster/drake SVGs). Traits on `EnemyDef` (fly, tenacity, regen, heal, shield, split, fireproof) handled in `battle.ts`, described by `enemyTraits`. Sim: 11h48-14h37.
- Endless mode (`Battle.endless`, chosen with the mode selector `Battle.setMode` which never launches a wave by itself, save `endless[mapId]` = waves survived): opens on a map once its last wave is beaten (`endlessUnlocked`), starts right after that wave, extra HP growth `BALANCE.endlessGrowth` 1.07/wave, final boss returns every 10 endless waves. Same rewards as normal play, no boss-drop roll (no victory). Special rewards planned later.
- Aimed ultimates: `Battle.requestUlt` arms burst / area-control ults (`needsAim`), a click on the board casts there (`castUlt(t, at)`), pressing again auto-aims; others fire at once. Bot and auto-cast use auto-aim.
- Blessings (`src/data/boons.ts`), endless mode only by user choice: every `BOON_EVERY` (5) endless waves the run pauses on a choice of 3 (`Battle.boonOffer`, `pickBoon`); they stack for the run and feed the same team channels as synergies (`Battle.syn`). Headless picks at random; auto waves pick after 8 s.
- Target priority per champion (`Tower.priority`, save `priorities`); enemy click shows an info card (`Battle.selectedEnemy`).
- Sim with all this at growth 1.25: ashe 11h41, lux 9h46; the bot casts ults instantly, humans will be slower. `ULT=<x>` env scales/disables ults in the sim.
- Auto-cast option (`store.data.autoUlt`, `Battle.autoUlts`): casts ready ults when worthwhile (5+ enemies or an epic/boss).
- Ideas queued: more regions, music.
