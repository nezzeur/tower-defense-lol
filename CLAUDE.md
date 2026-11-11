# Rift Defenders (LolTD)

Personal, local-only LoL-themed tower defense (PokéPath-like progression). Original code and art; official champion/item/ability images load at runtime from Riot Data Dragon (`src/art/champArt.ts`). Never bundle or publish Riot assets.

## Token budget (user priority)
- Delegate implementation to a Sonnet subagent (`model: "sonnet"`), usually one, max 2-3. Opus: short brief, quick review, short summary.
- Cheap checks: `npx tsc --noEmit && npx vite build`. Browser screenshots or balance sims only when really needed.
- Reply in French, briefly.

## Commands
- `npm run dev` (port 5173; user's real save lives on origin localhost:5174)
- `npm run sim -- <starter> <hours>` headless balance bot; env `GROWTH`, `BASE`, `BAL`, `LOG=<mapId>`
- `?save=<name>` URL param = separate save slot for testing

## Layout
- `src/game.ts` rules: stats, levels (max 150), stars, unlocks (`unlockReason`, `isArena`), economy `BALANCE`, waves, chests
- `src/battle.ts` sim (setInterval) + HD render (rAF), lanes, tile features, turrets, drag-to-move
- `src/ui/` screens: `index.ts` (router/header), `common.ts` (shared state `ui`, helpers), `atlas.ts`, `collection.ts`, `shop.ts` (+chest), `options.ts`, `starter.ts`, `battleHud.ts`, `events.ts` (all DOM listeners)
- `src/data/` champions (26), enemies, items, `maps.ts` (regions plan + hand maps + curve), `mapgen.ts` (seeded generator)
- `src/art/` `color.ts` (shade), `mapHD.ts` terrain/landmarks, `creatures.ts` vector monsters, `worldArt.ts` atlas, `champArt.ts`
- `scripts/sim.ts` balance bot; `public/mobs/` optional custom monster PNGs

## Game state
- 5 regions ("villes"): Faille 5 maps, Demacia 6, Freljord 7, Noxus 8, Ionia 9. Regular maps 30 waves, last map = arena (40). 3★ on previous map opens next; arena opens next region.
- Difficulty `mult = 1.5 * 1.25^index * laneFactor` (raised from 1.24 after ultimates + synergies); bot clears all in ~10-12h (noisy).
- Shurima, Piltover, Shadow Isles shelved (hand maps kept in `HAND`, decorative on atlas).
- Active ultimates: `ChampionDef.active` (cd 40-80s, effect `UltFx`: burst/control/buff/execute/gold/lives), cast from HUD buttons or keys 1-9; `Battle.castUlt`; damage scaled by `TUNE.ult` (0.25, sim-tuned). `def.ult` = passive upgrade at levels 6/11/16 ("Rang d'ultime").
- Region synergies (`src/data/synergies.ts`): 2/3/4+ same-region placed champions give +5/10/18 % (Demacia armor shred, Freljord slow, Noxus dmg, Ionia rate, Piltover range, Zaun splash, Bilgewater gold, Bandle ult recharge, Néant boss dmg).
- Target priority per champion (`Tower.priority`, save `priorities`); enemy click shows an info card (`Battle.selectedEnemy`).
- Sim with all this at growth 1.25: ashe 11h41, lux 9h46; the bot casts ults instantly, humans will be slower. `ULT=<x>` env scales/disables ults in the sim.
- Ideas queued: manual ult aiming, auto-cast option, more regions, enemy traits (flying, resists).
