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
- `src/ui.ts` all screens (atlas, battle HUD, collection, shop, options) — big, candidate for splitting
- `src/data/` champions (26), enemies, items, `maps.ts` (regions plan + hand maps + curve), `mapgen.ts` (seeded generator)
- `src/art/` `mapHD.ts` terrain/landmarks, `creatures.ts` vector monsters, `worldArt.ts` atlas, `champArt.ts`
- `scripts/sim.ts` balance bot; `public/mobs/` optional custom monster PNGs
- Dead code: pixel sprites/chibis in `src/art/pixel.ts`

## Game state
- 5 regions ("villes"): Faille 5 maps, Demacia 6, Freljord 7, Noxus 8, Ionia 9. Regular maps 30 waves, last map = arena (40). 3★ on previous map opens next; arena opens next region.
- Difficulty `mult = 1.5 * 1.24^index * laneFactor`; bot clears all in ~12h (most regular maps cleared first try).
- Shurima, Piltover, Shadow Isles shelved (hand maps kept in `HAND`, decorative on atlas).
- Ideas queued: active ultimates, region synergies, target priority, enemy info on click, sound, new regions, split `ui.ts`.
