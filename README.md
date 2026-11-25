# MARKED

A Roblox game written entirely in code, using [roblox-ts](https://roblox-ts.com) (TypeScript → Luau) and [Rojo](https://rojo.space) (file sync / build).

The game is split into **two places** — a **lobby** and a **main game** — plus **shared code** used by both.

**MARKED** is a co-op horror survival game. A broadcast called the Signal is turning adults
against their children: three marks and they turn. You play the kids: hold the house at night,
scavenge and trade by day, and survive as many nights as you can.

- **[GAMEPLAY.md](GAMEPLAY.md)**: the game design.
- **[PLAN.md](PLAN.md)**: the build plan, milestone by milestone.

> **Current state: M1 and M2 built, awaiting playtests.** Kids hold the family house through an
> endless day/night clock (barricades, generator, waves of infected) and search Maple Street by day
> for supplies. Trading comes next (M3), and the lobby still looks like the ghost-hunt prototype's
> churchyard until M6 (that prototype: git tag `ghost-prototype`, design in
> [docs/archive/GAMEPLAY-ghost-prototype.md](docs/archive/GAMEPLAY-ghost-prototype.md)). This README
> describes **what the code does today**, and is updated as each milestone in [PLAN.md](PLAN.md)
> lands.

## The lobby

The lobby is a **party/queue system** (modeled on the BloodyMary example): multiple teleport zones,
each with a `ZoneContainer` detection region and a `BillboardGui` showing the player count and state.

- First player into a zone becomes the **host** and gets a UI to pick the party size (clamped between
  `LowestPlayer` and `HighestPlayer`, default 2–6), then presses **Create**.
- **To leave, walk off the pad** — there's no Leave button, so the screen stays clear to watch
  others join. Party members just see a small "step off the pad to leave" hint.
- Everyone else on the pad — including anyone who stepped on while the host was choosing — joins as a
  **member**, up to the chosen size.
- The countdown only runs while the party has at least `LowestPlayer` members (still 2 from the
  ghost prototype; becomes 1 in M6);
  if people step off and it drops below that, it goes back to waiting.
- When it finishes, the lobby server **reserves** a main-game server, writes the party's user IDs to
  **MemoryStore** under that server's `PrivateServerId`, and teleports everyone there with
  **SafeTeleport** (`TeleportAsync` + retry). If any step fails, the party is disbanded instead of
  leaving the pad stuck.
- The main server reads the party back from MemoryStore and waits for everyone to arrive
  (`ArrivalTimeout`).
- **Everything authoritative is server-side**: party state, the party list (never `TeleportData`, which
  passes through the client). Clients only send `RequestCreate`,
  which the server validates.
- Config values are set in code and exposed as `IntValue`s in `Configuration` instances in
  **ServerStorage** (`LobbyConfig`, `GameConfig`). ServerStorage never replicates, so clients can't
  see them. See [Tuning](#tuning).
- UI is written with **[react-luau](https://react-luau.dev)** (`@rbxts/react` + `@rbxts/react-roblox`):
  the client party UI and the in-world `BillboardGui` counters are declarative JSX components.

The lobby is a **ruined churchyard at night**. Players spawn inside an iron gate and follow a
flagstone path to the three pads, which are dressed as ritual circles: flickering candles, rising
embers, and a pedestal behind each one holding a ritual item from the ghost prototype (book, skull,
candles). Graves line the sides and back, dead trees frame the corners, and a crumbling chapel with
a leaning bell tower and a red-glowing window closes off the north end. Low fog drifts across the
ground.

- **Scoreboard:** a noticeboard beside the path shows the **top 10 players by total wins**, all-time
  across every server, and each player's **Wins** appear in the Roblox player list. Wins are
  recorded by the main game when a round ends (everyone on the winning side; not in Studio) and
  saved with DataStore (`src/shared/lobby/stats.ts`, `src/lobby/server/leaderboard.ts`).
- Lighting (night, crimson haze, bloom) lives in `setupLighting()` in `src/lobby/server/world.ts`.
- All set dressing is built at runtime in `src/lobby/server/decor.ts` from plain parts with a fixed
  random seed, so the layout is the same every run. It's a blockout: the chapel, gate, trees and
  ritual items are meant to become Blender models later.
- Candle flicker runs on each client (`src/shared/world/flicker.ts`, started from
  `src/lobby/client/candleFlicker.client.ts`), driven by the `FlickerLight` CollectionService tag, so it costs no network traffic.

## The main game

One run per server: every party gets its own reserved server. Anyone who gets into a main-game
server another way — following a friend mid-run, or joining the main place directly — is sent to
the lobby to queue up (`gatekeeper.ts`; Studio is exempt). Party members whose teleport was slow
still join.

> M0 placeholder: the day/night loop, barricades and infected arrive in M1 (see [PLAN.md](PLAN.md)).

1. **The party.** The server waits for the party to arrive (`party.ts`). Everyone in it is a kid;
   there are no roles.
2. **"DAY 1" title card.** 4 seconds over a dark screen with everyone frozen (the server anchors
   each character).
3. **The day/night clock** (`shared/run/phases.ts`, driven by `round.ts`): Day (3:00) → Dusk (0:45)
   → Night (2:30) → Dawn (0:45), then the next day, with no last night. In Studio the phases are
   90/20/60/15 seconds. The top of the screen shows e.g. "NIGHT 2 · 1:12" in the phase's colour
   (red in the last 10s of day or dusk); how each phase is announced is in
   `shared/run/announce.ts` (a banner for days and nights, a pulse of the clock at dusk, the dawn card at
   dawn, always with a chime); the sky and indoor light blend to the phase over ~6s (`lighting.ts`).
   - Kids start in the **basement** of the family house (a blockout built at runtime by
     `src/main/server/world/world.ts`; layout diagram at the top of that file) with a **flashlight**,
     a **baseball bat**, a **slingshot** and a **hammer**. Ground floor: living room, dining room, kitchen, garage (workbench,
     generator, plank pile), hall with stairs up and down. Upstairs: two bedrooms, the parents'
     room, a bathroom. Front, back and garage doors and six ground-floor windows are open gaps,
     each with an invisible tagged `BarricadeSlot` for the barricades to come. Outside: garden,
     a street out front, a driveway, and invisible `InfectedSpawn` markers on all four sides.
   - **Flashlight:** a hotbar tool with a visible light cone (an uploaded cone mesh, nested ×3 for
     a fade), pointing the way the character faces. The server can tell what a beam is on
     (`litBy`), for the M1 stun.
   - **Baseball bat:** the character turns to face the camera while it's held, and a click plays
     the classic slash. Hits follow Roblox's recommended split: the attacker's client picks which
     **infected** it hit (models tagged `Infected`), and the server re-checks each with its own
     positions (reach and arc plus lag tolerance, a wall raycast, the tag, a cooldown) before
     taking 20 off their Humanoid's health. Feedback: a hit marker (red on a kill) and a red flash
     on the target.
   - **Slingshot** (`slingshot.ts`, rules in `shared/combat/ranged.ts`): click to fire a stone where you
     aim (the mouse on PC, the screen centre on touch). The client only sends the direction; the
     server checks it and casts the shot itself from the kid's head: 10 damage, 80 studs, one
     shot every 0.6s. Stones come from the inventory.
   - **Flashlight stun** (`shared/infected/stun.ts`): hold a beam on an infected for 0.6s and it stops
     dead for 2s, eyes dimmed; then beams don't work on it for 5s.
   - **Workbench** (`workbench.ts`, list in `shared/economy/upgrades.ts`): spend coins on tougher planks, a
     door bar (a fourth, sturdier plank on the front and back doors) and rucksacks (8 and 12
     slots). Rucksacks are personal; the rest are for the whole party, whoever pays. It also makes things
     from scrap (`crafting.ts`, list in `shared/economy/recipes.ts`): **window shutters**, and with the **scrap
     press**, nails and stones.
   - **Window shutters** (`barricades.ts`): use one next to a window, hammer in hand. It sits behind the planks; shamblers
     can't hurt it and go and find another way in. Dad can break it. It can't be taken down.
   - **Bases** (`bases.ts`, `trading.ts`; who sells what in `shared/economy/bases.ts`): the **Treehouse** (from
     Day 2) at the left end of Maple Street and the **Fire Station** (Day 3) at the right. Each restocks
     every morning, for the whole party, and buys food, batteries and scrap. Each also orders 2–3 of one
     of them every morning (no two bases the same), paying double until the order's filled. Nails cost 15% more every day. Closed at night.
   - **Walkie-talkie** (`walkie.ts`, what's said in `shared/economy/walkie.ts`): a few seconds into each day Mum
     and every base in contact report in (what they want, and what they pay). The first new message
     pops up in the message bar; the button on the left (or T) opens the bases and the log. Mum
     gives the sundown warning. Any system can speak with `say(from, text)`.
   - **The map** (`world/map.ts`, MAP.md): tiles laid out from a seed each run, round the family house;
     the neighbours' houses, cars and wrecks have things to search (`containers.ts`, tables in
     `shared/items/loot.ts`). A searched container stays empty for the run, except that 3 get something the bases have on
     order every morning; nails get scarcer every night.
     Gardens have stones, back every dawn. A minute before dusk: a warning, and the street lamps.
   - **Inventory** (`inventory.ts`, rules in `shared/items/inventory.ts`): 5 slots of stacks down the right
     edge; tap one to Drop it (or Use a medkit or a shutter; `itemUses.ts`). Kids start with 20 stones and 10 nails.
     Coins and the starter tools use no slots. A taken kid's slots are left where they were.
   - **Dormant infected** stand in the neighbours' houses by day, staring at the TV. Crossing in
     front, touching one, a torch beam, a nearby noise or a hit wakes it (`shared/infected/wake.ts`); it gives
     up 70 studs away. They're extra to the night's waves and stay put at night. Dad waits in the
     left neighbour's garden on Day 1 and joins Night 1's first wave.
   - **Generator** (`generator.ts`): a switch in the garage for every house light; it starts off.
     With it off, waves are 1.4× bigger (never on Night 1); it only counts once it's been on for 20s
     (8s in Studio), so flicking it on as a wave arrives doesn't help. Running it **at night** burns fuel (rules
     in `shared/house/fuel.ts`): it starts with one night's worth, a can adds one, and the tank holds three.
     Cans take a whole slot each and turn up in tool chests and car boots. The tune-up halves the burn.
   - **Messages** (`shared/core/messages.ts`): one at a time in the bar under the clock, danger first (it
     interrupts), then the walkie, then news, with Night 1 tips when it's free; and a short line near
     the bottom replying to what you just did.
   - **Tips** on Day 1 / Night 1 in that bar (`shared/run/hints.ts`), and a **dawn card** with what
     the night cost (`shared/run/nightSummary.ts`, counted in `nightReport.ts`).
   - **Barricades** (`barricades.ts`, rules in `shared/house/barricade.ts`): a **Take planks** prompt on
     the garage pile gives up to 5 (the pile starts at 30, +10 every dawn). Every door and
     window takes 3 planks. Holding the **hammer** (`hammer.ts`, `client/house/buildMode.ts`) is build
     mode: only then do the openings show their prompts (within 5 studs) and the server accept them. Hold
     **Board up** (E) to nail one (a plank and a nail), **Take down** (F) to pull one off and get both back. While any plank is up the opening is blocked for everyone. Planks have 100
     health (double if nailed on Day/Night 1); the infected will wear down the outermost one.
   - **The infected** (`infected/`, waves in `shared/infected/waves.ts`): at night they come in waves
     from all four sides (Night 1: Dad + 1, then 2 more; from Night 2, three growing waves scaled
     by party size). Rigged models with glowing red eyes (MODELLING.md): hooded shamblers, and **Dad**, who comes
     every night. Each walks to the nearest door or window, bashes the planks (15 a hit every
     1.5s), climbs in once it's open, then hunts the nearest kid with pathfinding and hits them
     (15, or 7.5 on Night 1). They go for a kid they can see outside, and walk off at dawn.
     Health 60 (+10% a night); at 0 they dissolve in a flicker of static.
   - **Kids' health** (`health.ts`): 100, no regeneration, full again at dawn. At 0 a kid is
     **taken** (`life.ts`): they spectate the others and come back in the basement at dawn (after
     15s on Night 1). Dying any other way at night
     (resetting, falling) counts as taken. The run ends when every kid is taken at once, never on
     Night 1.
4. **End.** The run ends when every kid is taken at once (never on Night 1). The **end screen** (15s) shows "SURVIVED N NIGHTS" and a card per kid: avatar, a fun **title** (Slugger, Carpenter, First Taken, Survivor)
   and a few stats, counted on the server (`src/main/server/core/roundStats.ts`, rules in
   `src/shared/run/scoreboard.ts`). **Back to lobby** leaves early; the title then floats over the
   player's head in the lobby for an hour (`src/shared/lobby/lastTitle.ts`, MemoryStore). Then everyone
   is teleported back to the lobby they came from; anyone the teleport can't move is kicked with a
   "rejoin" message rather than left stuck. Nothing is recorded on the lobby's Wins board any more
   (it becomes best run + total nights in M6).

### Server authority

Everything that decides the game runs on the server: who's in the party, the clock, every hit and
how much damage it does. Clients only send button presses — tool clicks and the lobby's *Create* —
and the server validates each one. Remote messages are typed (`src/shared/core/remotes.ts` +
`src/shared/core/net.ts`), so a misspelt message is a compile error. Public state (run phase and clock)
is published as attributes for the HUD. See [AGENTS.md](AGENTS.md#server-authority-anti-exploit).

## Structure

```
src/
  shared/              # rules and data for both sides (both places); pure ones have a spec in tests/unit
    core/              # remotes + net (typed messages), tags, serverConfig, characters, messages, placeIds, safeTeleport
    run/               # phases, round, announce, scoreboard, nightSummary, hints
    house/             # barricade, fuel
    combat/            # combat, melee, ranged, flashlight
    infected/          # waves, wake, stun
    items/             # inventory, loot, gains, slotLayout
    economy/           # bases, pricing, trade, upgrades, recipes, walkie
    world/             # parts, walls, flicker, assets (mesh lookup), tiles + layout + mapRules (the map, MAP.md)
    lobby/             # partyHandoff (lobby -> main), lastTitle, stats, kitManifest, ritualItems (until M6)
  lobby/
    server/            # world.ts, decor.ts (churchyard), queue.ts (parties), zoneDisplay.tsx, config.ts
    client/            # main.client.tsx, partyUi.tsx, candleFlicker.client.ts
  main/
    server/            # main.server.ts (entry: the start-up order), systems.ts (starts and connects
                       #   everything), phaseEvents.ts (what each phase does), and:
      core/            # config (tuning), party, life, teams, round (day/night clock), roundStats, gameRemote, prompts, effects
      run/             # gatekeeper, admission, loadout (setup on spawn), elimination (taken, spectating),
                       #   roundEnd, resync (re-send state on "Ready"), nightReport, hints
      house/           # barricades, hammer, generator, lighting, streetlights
      combat/          # combat (bat), slingshot, flashlight, torch, health, infectedDamage
      infected/        # director (spawning, waves), behaviours (one function per mode), senses,
                       #   movement, body, state, types
      items/           # inventory, itemUses, containers
      economy/         # coins, wallet, workbench, upgradeEffects, crafting, trading, walkie
      world/           # map (tiles, from a seed), world (the house), building, bases (traders), npc, cars,
                       #   wrecks, fire, models
    client/            # main.client.tsx (entry), and:
      core/            # gameState (stores for server messages), theme, sound, device, panel, useViewport
      hud/             # roundHud, messageBar, messageQueue, inventoryHud, gainFeed, walkieUi, dawnCard
      house/           # buildMode (prompts only with the hammer)
      shops/           # shopPanel, workbenchUi, tradeUi
      combat/          # melee, slingshot, flashlight (beam visuals), faceCamera, combatFeedback
      run/             # spectate, endScreen

default.project.json   # "dev" place: BOTH lobby + main (both worlds build at once — prefer the two below)
lobby.project.json     # lobby place only
main.project.json      # main game place only
tiles.project.json     # the map tiles laid out to look at (MAP.md); not part of the game

tests/                 # unit tests run with Lune against the compiled out/ modules
  run.luau             #   tiny runner (describe / it / expect); `npm test`
  unit/<topic>/        #   one spec per module, in the same topic folders as src/
tools/tiles/           # the map tiles in TypeScript (run by Node, not part of the game), built and
                       #   checked by npm run tiles (MAP.md)
tools/blender/         # 3D models, built from Python with headless Blender (lib/sdf.py for organic shapes)
assets/
  models/              # generated FBX / GLB / preview PNG (committed)
  tiles/               # map tiles edited by hand in Studio, if any (MAP.md)
  rojo/                # MeshParts with their Roblox asset IDs, synced by Rojo
```

The pipeline is: `.ts` in `src/` → `rbxtsc` → `.luau` in `out/` → `rojo build/serve` → Roblox.

## 3D models

Props are made in Blender — but scripted, not hand-modeled, so they live in the repo like
everything else. `tools/blender/assets/*.py` each describe one model; a build step runs
Blender headlessly and writes the FBX to upload plus a preview render.

```sh
npm run models                 # rebuild every model
npm run models -- teleport_pad # just one
```

Models so far: the lobby's **teleport pad**, the three ritual items (**skull**, **book**,
**candles**) used on the lobby pedestals (they were the ghost prototype's ritual pickups), and the flashlight's
**light cone**. Organic shapes (skull, melted candles) are modelled as signed distance fields
(`tools/blender/lib/sdf.py`). Until a model's asset ID is filled into
`assets/rojo/<model>.model.json`, the game falls back to plain parts.

See **[tools/blender/README.md](tools/blender/README.md)** for the full pipeline, the units
convention and the list of assets.

## Why three project files?

- **`default.project.json`** maps *every* source folder. `rbxtsc` reads it by default to resolve
  `import` statements, and `rojo serve` uses it to give you a dev place with both lobby and main.
- **`lobby.project.json`** and **`main.project.json`** each include only their own folder + shared,
  so each place is clean and independent.

The folder names (`Shared`, `Lobby`, `Main`) must stay identical across all three files so the
compiled `require()` paths resolve in every place.

## Getting started

```sh
# 1. Install tools (Node + Rokit)
rokit install            # installs Rojo (pinned in rokit.toml)
rojo plugin install      # installs the Rojo Studio plugin
npm install              # installs roblox-ts + TypeScript packages

# 2. Compile TypeScript and rebuild the map tiles on every save (terminal 1)
npm run watch

# 3. Start a live sync server for one place (terminal 2)
npm run serve:lobby      # or: npm run serve:main, npm run serve (dev)

# 4. In Roblox Studio, open a place, click the Rojo plugin, and Connect

# Before committing
npm run lint             # ESLint + Prettier (npm run lint:fix to auto-fix)
npm test                 # unit tests for pure logic (needs Lune: `rokit install`)
```

To test the main game, press **Play** (solo works) or use **Test → Clients and Servers** with 2–3
players. It works on an unpublished place: outside a reserved server the game skips the
MemoryStore handoff and uses whoever joins in the first few seconds.

## Roblox Studio MCP

Studio can be driven by an AI agent through its built-in **MCP** server, which ships with the app
at `/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`. Enable MCP mode in Studio, then add
the server to OpenCode (or any MCP client):

```sh
# OpenCode
opencode mcp add roblox-studio --global -- "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP"
# Claude Code
claude mcp add roblox-studio -- "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP"
```

That exposes ~38 `roblox-studio` tools to the agent: `start_stop_play`, `execute_luau`,
`get_console_output`, `screen_capture`, `search_game_tree`, `inspect_instance`, `script_grep`, and
more. Combined with `npm run watch` + `npm run serve:*` (see [Getting started](#getting-started)),
the agent can iterate on the game — press Play, read logs, inspect the running world — without
reopening the place. Full agent-facing notes: **[AGENTS.md](AGENTS.md)**.

> The lobby world is built at *runtime* by `buildLobbyWorld()`, so it only exists while the server
> is running (during Play) — inspect it with the `Server` datamodel, not in Edit mode.

## Building place files

```sh
npm run build:lobby   # → build/lobby.rbxlx
npm run build:main    # → build/main.rbxlx
npm run build:dev     # → build/dev.rbxlx  (both places together)
```

## Wiring up the two places on Roblox

1. Create two places (lobby + main game) in one universe via the
   [Creator Dashboard](https://create.roblox.com).
2. Copy both place IDs into `src/shared/core/placeIds.ts`: `MAIN_GAME_PLACE_ID` (lobby → game) and
   `LOBBY_PLACE_ID` (back to the lobby after a round). Until they're set, the lobby countdown logs
   "place ID not configured" instead of teleporting, and the main game stays put after the end screen.
   The MemoryStore party handoff also needs the places published (and, to test it from Studio,
   *Enable Studio Access to API Services*).
3. Optional: pin each project file to its place so `rojo serve` can't sync into the wrong one:

   ```json
   // lobby.project.json
   {
     "name": "lobby",
     "placeId": 12345678,
     "servePlaceIds": [12345678],
     ...
   }
   ```

## Tuning

**All gameplay numbers live in code**, in two files:

- `src/lobby/server/config.ts` — zone count, floor size, countdown, party size.
- `src/main/server/core/config.ts` — **the main game's tuning numbers**: run timings (arrival timeout,
  countdown, run length, end screen, respawn delay), how dark unlit rooms are (DarkRoomLight,
  applied live), and melee (bat damage/range/cooldown, swing arc and lag tolerances). Each value
  has a comment saying what it does.

At server start these are written into `ServerStorage.LobbyConfig` / `ServerStorage.GameConfig`,
**overwriting** anything saved in the place file, so git is the single source of truth. During a
Studio play session you can **edit them live** in ServerStorage to experiment (systems read them
as they go); the change doesn't stick, so copy a good value back into the config file.

Some settings have a **Studio-only value** in code (a 3-minute run instead of 8, a party minimum
of 1 so the lobby pads can be tested solo), applied only when running in Studio.

The one exception: the flashlight's range and cone angle live in `src/shared/combat/flashlight.ts`,
because every client also needs them to draw the beam, and clients can't read ServerStorage.

## Automated tests

`npm test` compiles the TypeScript and runs `tests/unit/<topic>/*.spec.luau` with
[Lune](https://lune-org.github.io/docs) (a standalone Luau runtime, pinned in `rokit.toml`). The
tests load the **compiled** modules from `out/`, so they check exactly what ships.

They cover **pure logic** only — code that doesn't need the Roblox engine: the flashlight's beam
cone, melee reach, validation of client input (party size, swing candidates), who may stay in a
main-game server (admission), and the end-of-run titles. To make something testable
here, pull its rules into a pure function (no Roblox services) in `src/shared/` or a small module,
like `inBeamCone` and `parsePartySize`. Engine-level tests (raycasts, prompts, real systems) need
Studio and are in the backlog. Everything else is covered by the manual checklist below.

## Regression test checklist

Run through this after changes. Main-game tests work solo with **Play**; use **Test → Clients and
Servers** with 2–3 players for anything about other players. Tip: phase lengths
(`DaySeconds`, `NightSeconds`...) can be changed in `ServerStorage.GameConfig` during play; they
apply from the next phase.

### Lobby
- [ ] Joining fresh on a **phone/tablet** (or Studio's Device Emulator), you can move straight away (streaming is off).
- [ ] The churchyard is readable at night: floor, graves, chapel and pads visible; can't fall or jump out (60-stud walls).
- [ ] Candles flicker; fog and embers drift; the three pedestals show the book, skull and candles models.
- [ ] First player onto a pad becomes host and gets the size picker (2–6; 1–6 in Studio).
- [ ] Players already standing on the pad join when the host presses Create.
- [ ] Countdown only runs with at least the minimum party; stepping off below it returns to "Need N more".
- [ ] Walking off the pad leaves the party; the bottom hint says so; there's no Leave button.
- [ ] Pad billboard shows count and state and isn't oversized.
- [ ] Host who doesn't press Create in time is removed; the next player on the pad becomes host.
- [ ] (Published places only) the party teleports to one reserved server together.
- [ ] The scoreboard beside the path shows the top 10 by wins (or "No one has won yet" / a fog message if the DataStore is unavailable, e.g. Studio without API access).
- [ ] The player list (top-right) shows each player's Wins.

### Lobby look (low-poly kit)
- [ ] The lobby is built from the low-poly kit, not grey blocks: iron fence on a low stone wall all round, gate with stone pillars and an iron arch, chapel ruins with a glowing red pointed window, a leaning bell tower, a crypt either side, gothic/round/cross/broken graves and obelisks, twisted dead trees, rubble.
- [ ] Night is cool and blue; warm flickering lanterns line the path from the gate; candles and the red pad glow stand out.
- [ ] No "[LobbyKit] ... has no MeshId" warning in the Output.
- [ ] Walking right up to the chapel, tower and crypts, they stay visible (no popping out).
- [ ] The ground is flat-coloured low-poly facets (grass, moss and dirt patches, a dirt strip under the path), not a realistic grass texture; the path stones are flat greys.
- [ ] You can't walk through the graves, fence, gate pillars, crypts, chapel, tower, tree trunks or lantern posts; you can walk over rubble.
- [ ] Each pad's pedestal shows its low-poly ritual item (book with pages, skull, candle cluster with flames on the wicks).
- [ ] (Published) After a run, each player's title from it (gold, or red if they were taken) floats above their head, above the name tag; it's still there after a reset, and gone after an hour.

### Main game: run
- [ ] (Published) Following a friend who's mid-run sends you to the lobby (or a "join from the lobby" message), not into their run.
- [ ] (Published) Joining the main game place directly sends you to the lobby.
- [ ] As soon as the game loads, a dark "DAY 1 — Board up the house before dark." card covers the screen (no blank wait); nobody can move or jump while it shows.
- [ ] ~6s later (Studio: 2s party wait + 4s card) it clears; everyone is in the basement with a Flashlight, a Baseball Bat, a Slingshot and a Hammer; no role banner.

### The house
- [ ] The basement has a flickering bulb, shelves and boxes; a ramp leads up into the hall.
- [ ] The ground floor has a living room (sofa, TV), dining room, kitchen (back door), garage (workbench, yellow generator, plank pile, big garage door) and a hall with the front door.
- [ ] The ramp in the hall goes upstairs to two bedrooms, the parents' room and a bathroom; rails stop you falling into either stairwell.
- [ ] Six ground-floor windows and the three doors are open gaps you can walk or climb through (low sills); upstairs windows are glass.
- [ ] Outside: grass all round, a pavement and street out front, a driveway to the garage.
- [ ] Day is visibly brighter than night through the windows and outside; indoors stays navigable at night.
- [ ] Then "DAY 1 · 1:30" (Studio) at the top, in sync across windows, counting down; red in the last 10s.
- [ ] Each phase change chimes. NIGHT 1 (red) and DAY 2 (white) show a title for 2s, with a line of advice until Night 2 and just the title from Day 3. DUSK has no title: the clock turns orange and swells once. DAWN has only the dawn card. The clock pill matches the phase.
- [ ] The light blends over a few seconds: bright by day, orange at dusk, darkest at night, pinkish at dawn. Indoors stays navigable at night.
- [ ] Changing `NightSeconds` in ServerStorage → GameConfig during play changes the next night's length.
- [ ] A player who resets respawns after ~3s in the basement with all four tools (by day).
- [ ] (Published) After the end screen, everyone is teleported back to the lobby; nobody is left on the end screen.
- [ ] (Published) Nothing changes on the lobby's Wins board.
- [ ] No errors in the server or client output during a whole run.

### House lighting
- [ ] An unlit room is dim and blue-ish (DarkRoomLight 0.8 for now), and you can clearly see walls, doorways and furniture without a torch.
- [ ] Lamp rooms have warm pools of light that clearly stand out from the dark rooms; a torch is still much brighter than the dark.
- [ ] In Studio, changing ServerStorage → GameConfig → DarkRoomLight during play brightens/darkens the house straight away.

### Flashlight
- [ ] Every kid has a Flashlight (a teal and black torch held in the hand, pointing forward); equip = on, click toggles; the lens in its open end glows when on.
- [ ] A 3D cone comes straight out of the lens in the direction the character faces (not the camera).
- [ ] The cone is faint and see-through, even close to the torch: you can clearly see what's behind and inside it.
- [ ] Other kids' cones are visible from your window.
- [ ] Resetting gives a fresh flashlight.

### Generator
- [ ] The run starts with every house lamp dark; the garage generator's prompt says "Start" (E).
- [ ] Starting it lights every lamp (no message); the prompt becomes "Switch off" and reverses it.
- [ ] From Night 2, a wave that spawns with the power off, or on for less than 20s (Studio 8s), is bigger. Switching it on at dusk (free) always counts.
- [ ] The prompt says how much is left: "Generator (1 night of fuel)" at the start. Running it by day or dusk doesn't lower it; at night it counts down, and pauses while it's off.
- [ ] Pour in fuel (F, hold) uses a can and adds a night to the prompt (no message). Without one: "You need a fuel can...". The two prompts don't overlap, and it's gone when a whole can wouldn't fit (3 nights).
- [ ] With a quarter of a night left, everyone's warned; at empty the lights go out and everyone's told. Start then says "It's out of fuel...".
- [ ] The tune-up is for everyone: the prompt's nights double at once, and it burns half as fast.
- [ ] A dropped fuel can, and a taken kid's, can be picked up.

### Messages
- [ ] Never two messages at the top at once, nor two lines at the bottom.
- [ ] Boarding up with no planks, over and over: one line near the bottom that goes 2s after the last try.
- [ ] An opening breaking or a kid being taken shows in red at once, even over the walkie; a cut-off walkie message comes back after. Everyone sees it (the taken kid sees "You were taken").
- [ ] Running out of fuel shows in red; other generator news waits its turn.
- [ ] Nothing shows behind the title card or the end screen. On a phone the bar and bottom line are clear of the joystick and jump button.

### Tips (Day 1 / Night 1)
- [ ] A tip shows for 8s after it changes, only while no message is showing, then goes.
- [ ] With no planks: "Grab planks..."; carrying some: "Take out your hammer...", then with it in hand "Hold E..."; something boarded and no planks in hand: "Start the generator..."; powered: "Search the houses..." by day, "Get inside..." at dusk.
- [ ] At night: "They're at the <opening>!" while one is bashed, otherwise how to fight. Nothing at dawn, while taken, or from Day 2.

### Dawn card
- [ ] At dawn, for ~6s and with no DAWN banner: "NIGHT N SURVIVED" with infected downed, planks lost and who was taken. It doesn't cover the message bar.

### Inventory and coins
- [ ] Right edge: "Coins 0" (Studio: 150) over five slots: Stones 20/20, Nails 10/20, three empty and faint (in Studio two hold Fuel 1/1 and Scrap 10/10).
- [ ] Phone (device emulator, landscape): the slots start at the top and use more columns instead of reaching the jump button, with 5, 8 and 12 slots. Drop and Use work in every column.
- [ ] Anything gained (searching, picking up, taking planks, buying, coins at dawn) shows "+N Item" left of the coins for 2.5s; more of the same adds to its line. Not for your starting kit, nor for losing things.
- [ ] Tapping a filled slot shows Drop (and Use for a medkit or a shutter); tapping again hides it.
- [ ] Drop leaves a box on the floor; anyone can pick it up. With no room: "Your pockets are full."
- [ ] A medkit heals 50; at full health it says "You're not hurt." and isn't used.
- [ ] Every kid still in at dawn gets 5 coins.

### Workbench
- [ ] The garage workbench's prompt ("Upgrade") opens a list: the window shutter, then six upgrades, with costs and your coins (Studio starts you with 150).
- [ ] You can only buy what you can afford; bought ones say "Owned"; the hiking rucksack says "Needs school rucksack" first.
- [ ] Planks nailed after buying reinforced planks have two metal strips; ones already up don't, until they're taken down and nailed again. No description in the list is cut off.
- [ ] Reinforced planks and the door bar are for everyone (the buyer gets a bottom line, the others news in the bar, and it shows Owned for them). Front and back doors then take 4 planks; the garage door and windows still take 3.
- [ ] Rucksacks are yours only: 8 slots, then 12, and they stay after you're taken.
- [ ] The list closes with X or when you walk away, and scrolls if it's taller than the screen (phone).
- [ ] A window shutter takes 30 coins and 5 scrap, and says how much scrap you have; "Needs scrap" without enough, "No room" with no free slot.
- [ ] Press nails (2 scrap: 3) and Press stones (2 scrap: 8) join everyone's list once the party has the scrap press, not before.

### Window shutters
- [ ] Using one next to a window, with the hammer in hand, fits a metal shutter on the house side, behind any planks, and uses it up. You can't get through the window, with or without planks, and can still board it up over the shutter.
- [ ] Without the hammer in hand: "Hold your hammer to fit it."
- [ ] Away from a window (or at a door): "Stand next to a window to fit it." At a window that has one: "It already has a shutter." Neither uses it up.
- [ ] Shamblers break planks over a shutter, then leave that window for the nearest opening they can break, walking round the house to it. They ignore a shuttered window with no planks.
- [ ] With every window shuttered they all come to the doors.
- [ ] Dad breaks a shutter (about 30s on his own) and everyone's told the window is broken.
- [ ] An infected outside that can see a kid through gaps in the planks still bashes (it doesn't freeze), and hits a kid in reach.

### Trading
- [ ] The Treehouse (big tree, left end of the street) has a kid behind a counter; the Fire Station (right end) has an adult behind one, inside, and a fire engine in its bay you can't walk through. Both stand still, idling, with a name and no health bar.
- [ ] "Trade" opens the base's list with your coins. In Studio both trade from Day 1; with `OpenAllBases` at 0 (editable live): "The Treehouse starts trading on Day 2.", and the base says hello over the walkie the morning it opens.
- [ ] Buying takes the coins, gives the lot and lowers "left today" for everyone looking. At 0: "Sold out", until the next day.
- [ ] Greyed out when you can't afford it; "No room" when the whole lot wouldn't fit. Nothing is charged.
- [ ] One row is gold: "They need 3!" and pays double. One press sells as many as they need and you have ("3 for 18 coins"); the number drops for everyone looking, and in the walkie. Once filled the row goes back to its usual price.
- [ ] Everything else sells one at a time, for what the button says; greyed out at "You have 0".
- [ ] The two bases never order the same item, and a base's order is different the next day.
- [ ] From Day 2, up to 3 searched containers are searchable again (their colour is back) and hold 1–2 of something on order. Never nails, fuel or medkits.
- [ ] At nightfall an open list closes by itself.
- [ ] Nails at the Treehouse cost more each day.
- [ ] At night the traders say "Closed until morning."
- [ ] The list closes with X or when you walk away.

### Walkie-talkie
- [ ] ~4s into Day 1, after the title card, Mum's message pops up under the clock with a sound, for 6s, with "+2 more on the walkie (T)" in Studio (the bases' messages are in the log).
- [ ] What a base says it needs ("We need 3 batteries today. 6 coins each.") matches the gold row in its list.
- [ ] The small walkie button has a green dot while there are unread messages, and T does the same as pressing it. Opening it clears the dot; X or T closes it. On PC it's halfway down the left edge, clear of the chat; on touch it's top left, clear of the joystick.
- [ ] Bases are at the top: green "Trading" by day, "Closed until morning" at night, "No contact yet" before their first day (`OpenAllBases` at 0). Messages are newest first, with the day, and scroll.
- [ ] Popups don't show while it's open, and typing a "t" in chat doesn't open it.
- [ ] Two players see the same messages. Someone who loads in late has the log but no old popups.

### The map (MAP.md)
- [ ] The Output says `[Map] Seed N: ...` and the map matches `npm run tiles -- N`. Setting `MapSeed` to that N in `ServerStorage.GameConfig` before Play gives the same map again; 0 gives a new one each run.
- [ ] Home is at the bottom middle with the family house on its plot (no blue box, nothing to bump into); kids start in the basement as before. The Treehouse is beside home, the Fire Station beside it or in the row behind, and every road joins up.
- [ ] No red marker boxes anywhere. A dormant infected stands at each neighbour's TV and in the ranger hut; on Day 1 Dad is in the left neighbour's garden.
- [ ] The Treehouse kid and the Fire Station chief stand behind their counters (turned with their tile), and trading works at both. The fire engine's model replaces the red block.
- [ ] Roads that run off the map end at a red and white roadblock, and you can't walk off any edge.
- [ ] A strip of woods runs along the south edge, behind home's row. At night the infected come from across the street (Dad's first wave too) and out of the woods behind the house (straight behind and both back corners), and find their way in.
- [ ] Searching, stones and street lamps work on every tile.
- [ ] Parked cars (with a boot to search) outside the Home neighbours and along the kerb in other streets; the crashed and burnt cars in Home's street (fire, smoke, steam), the ambulance (medical bag) and burning tank by the Fire Station, the school bus in the trees by the Treehouse. You can't walk through them, they turn with their tile, and a car or wreck whose model can't load is a plain block.

### Maple Street
- [ ] A house either side of home and two across the street, each with a front and back door, its own car (minivan, estate; the hatchback and ice-cream van at the kerb) and garden stones. Each car's boot can be searched, and you can't walk through a car. Wrecks (and you can't walk through them, and infected don't get stuck on them): the school bus on its side by the Treehouse, the tank and the ambulance (search the medical bag) by the Fire Station, a crashed car at a lamp post (search its boot) and a burnt car in home's street. The burnt car and the tank are on fire and smoking, and the crashed car's bonnet steams; none of it hurts, and the fires glow at night.
- [ ] Searching (hold E) shows "+3 Nails" beside your coins for what you got; an empty one says "Nothing useful."; the container goes dark and is empty for everyone (a few restock each morning; see Trading). What doesn't fit is left at your feet: "No room: left on the floor."
- [ ] 25s before dusk (Studio): Mum says "The sun's going down. Get home." over the walkie and the street lamps come on; off at dawn.

### Dormant infected
- [ ] By day one stands in each house facing the TV. You can walk behind it; crossing in front, touching it or shining a torch on it wakes it.
- [ ] Searching the drawers in the same room, or swinging a bat nearby, wakes it. So does hitting it.
- [ ] A woken one chases you; far enough away by day, it walks back to its TV. At dawn it leaves with the others.
- [ ] A killed one is replaced the next morning.
- [ ] Day 1: Dad stands in the left neighbour's garden, and comes with Night 1's first wave (only one Dad).

### Slingshot
- [ ] Every kid has a Slingshot, and "Stones 20/20" in a slot from the very start.
- [ ] Holding it turns you to face the camera, like the bat.
- [ ] PC: clicking fires a small stone toward the mouse; it flies visibly and stops at walls. Touch: it fires at the middle of the screen.
- [ ] Hitting an infected: it flashes red, a hit marker shows, Stones drops by one. Six hits bring a Night 1 shambler down (60 health, 10 each).
- [ ] Holding the mouse/spamming fires at most about one stone every 0.6s.
- [ ] At 0 stones clicking does nothing; gathering from a garden patch gives 10, and the patch is back at dawn.
- [ ] Other players see your stones fly.

### Flashlight stun
- [ ] Hold your beam on an infected for about half a second: it stops dead and its eyes go dark red for ~2s, then carries on.
- [ ] Keeping the beam on it doesn't stun it again for ~5s.
- [ ] A stunned infected can still be hit with the bat and slingshot.

### Barricades
- [ ] The garage pile prompt says "Take planks (30 left)"; using it gives 5 and the count drops to 25. With no room: "Your pockets are full."
- [ ] With the hammer put away, no door or window shows a prompt, whatever else you hold. (The plank pile, generator and workbench always do.)
- [ ] With the hammer in hand, within about 5 studs of any door or window (from inside, and outside): "Board up (0/3)" (E, hold ~1s) and, once a plank is up, "Take down" (F). Putting it away mid-hold cancels it.
- [ ] Two players: one kid's hammer doesn't show the prompts to the other.
- [ ] After respawning or being taken and returned, the prompts are hidden until the new hammer is out.
- [ ] Boarding up uses a plank and a nail; without nails: "You need nails...".
- [ ] Board up without planks: "You need planks. There's a pile in the garage."
- [ ] Each plank appears across the opening at a slight angle, on the inside; at 3/3 the Board up prompt goes away.
- [ ] With 1+ planks up you can't walk or climb through the opening; taking them all down opens it again.
- [ ] Take down gives the plank and nail back; with no room for a plank it says so and leaves it up.
- [ ] At dawn the pile goes up by 10.
- [ ] Two players: planks one kid nails show for the other; each has their own count.
- [ ] Prompts do nothing behind the "DAY 1" card.

### The infected
- [ ] Day and dusk: no infected. A few seconds into NIGHT 1, Dad (his own model: blue shirt, one slipper, taller than the rest) and one hooded shambler come from the street and the sides; ~25s later (Studio) two more.
- [ ] They're grey with glowing red eyes, walk (not slide), and have no name or health bar over them.
- [ ] Each walks to the nearest door or window. Boarded: it bashes it, and the planks come off one at a time; when the last goes, everyone gets "The … is broken!".
- [ ] Open (or once broken): it climbs in (windows too) and goes after the nearest kid, through the house and up/down stairs.
- [ ] A kid outside in view gets chased straight away.
- [ ] Being hit flashes your screen red and drops your health (Roblox health bar top-right); it doesn't regenerate.
- [ ] Three bat hits bring a shambler down on Night 1 (60 health); it flickers white and vanishes. Dad goes down the same way and is back the next night.
- [ ] At DAWN the rest walk off and vanish; everyone's health is full again.
- [ ] From Night 2 there are three waves, bigger each night, and more with more players.

### Taken
- [ ] At 0 health you're taken: "You were taken!", the camera follows another kid (or none, solo).
- [ ] Night 1: you're back in the basement after ~15s with your bat and flashlight; the run doesn't end even if everyone's taken.
- [ ] Later nights: you're back at dawn; if every kid is taken at once, the run ends with "SURVIVED N NIGHTS".
- [ ] Your slots are left as boxes where you were taken, and anyone can pick them up; coins are kept.
- [ ] Resetting at night counts as taken; resetting by day respawns you after ~3s.

### Baseball bat
- [ ] The bat is held like a sword (pointing out of the fist), not sideways.
- [ ] While it's held, the character turns to face where the camera looks; unequipping restores normal turning.
- [ ] Clicking plays a slash animation (check on an **R15** avatar too), at most about once every 0.8s.
- [ ] Hitting an infected: hit sound, it flashes red, and a white hit marker shows mid-screen. The killing hit shows a bigger red marker.
- [ ] Swinging from too far away, from behind, or through a wall does nothing.
- [ ] Swings before the countdown ends or on the end screen do nothing.
- [ ] On a tablet: swinging at what's in front of the camera works without precise aiming.

### End-of-run scoreboard
- [ ] The end screen shows a card per kid: avatar, name, title, a one-line hint, and stats.
- [ ] "SURVIVED N NIGHTS" at the top; the kid who downed the most infected is the **Slugger** with "N infected downed".
- [ ] Cards are ordered by how much each kid did (kills, then hits).
- [ ] "Back to lobby (N)" counts down from ~15; pressing it says "Heading back..." and (published) teleports just that player straight away. Everyone left goes at 0.
- [ ] On a **phone/tablet** the whole screen shrinks to fit: every card and the button are visible and tappable.
- [ ] A player whose client loads late (slow tablet) still gets the cards.
- [ ] (Published) Back in the lobby, your title floats over your head (gold, or red if you were taken).
