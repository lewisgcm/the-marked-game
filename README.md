# MARKED

A Roblox game written entirely in code, using [roblox-ts](https://roblox-ts.com) (TypeScript → Luau) and [Rojo](https://rojo.space) (file sync / build).

The game is split into **two places** — a **lobby** and a **main game** — plus **shared code** used by both.

**MARKED** is a co-op horror survival game. A broadcast called the Signal is turning adults
against their children: three marks and they turn. You play the kids: hold the house at night,
scavenge and trade by day, and survive as many nights as you can.

- **[GAMEPLAY.md](GAMEPLAY.md)**: the game design.
- **[PLAN.md](PLAN.md)**: the build plan, milestone by milestone.

> **Current state: M0 done.** The ghost-hunt prototype this project started from (design archived
> in [docs/archive/GAMEPLAY-ghost-prototype.md](docs/archive/GAMEPLAY-ghost-prototype.md), code at
> git tag `ghost-prototype`) has been stripped to a base for MARKED: a party of kids in a
> placeholder house with a flashlight and a baseball bat, a timed run, and an end screen. The
> lobby still looks like the prototype's churchyard until M6. This README describes **what the
> code does today**, and is updated as each milestone in [PLAN.md](PLAN.md) lands.

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
  saved with DataStore (`src/shared/stats.ts`, `src/lobby/server/leaderboard.ts`).
- Lighting (night, crimson haze, bloom) lives in `setupLighting()` in `src/lobby/server/world.ts`.
- All set dressing is built at runtime in `src/lobby/server/decor.ts` from plain parts with a fixed
  random seed, so the layout is the same every run. It's a blockout: the chapel, gate, trees and
  ritual items are meant to become Blender models later.
- Candle flicker runs on each client (`src/shared/flicker.ts`, started from
  `src/lobby/client/candleFlicker.client.ts`), driven by the `FlickerLight` CollectionService tag, so it costs no network traffic.

## The main game

One run per server: every party gets its own reserved server. Anyone who gets into a main-game
server another way — following a friend mid-run, or joining the main place directly — is sent to
the lobby to queue up (`gatekeeper.ts`; Studio is exempt). Party members whose teleport was slow
still join.

> M0 placeholder: the day/night loop, barricades and infected arrive in M1 (see [PLAN.md](PLAN.md)).

1. **The party.** The server waits for the party to arrive (`party.ts`). Everyone in it is a kid;
   there are no roles.
2. **Countdown.** 5 seconds with everyone frozen (the server anchors each character).
3. **The run** — a placeholder 8 minutes on the clock (3 in Studio):
   - Kids start in one corner room of a placeholder house (3×3 rooms, built at runtime by
     `src/main/server/world.ts`) with a **flashlight** and a **baseball bat**.
   - **Flashlight:** a hotbar tool with a visible light cone (an uploaded cone mesh, nested ×3 for
     a fade), pointing the way the character faces. The server can tell what a beam is on
     (`litBy`), for the M1 stun.
   - **Baseball bat:** the character turns to face the camera while it's held, and a click plays
     the classic slash. Hits follow Roblox's recommended split: the attacker's client picks which
     **infected** it hit (models tagged `Infected`), and the server re-checks each with its own
     positions (reach and arc plus lag tolerance, a wall raycast, the tag, a cooldown) before
     taking 20 off their Humanoid's health. Feedback: a hit marker (red on a kill) and a red flash
     on the target.
   - **Practice infected (Studio only):** a block figure with red eyes stands in the start room so
     the bat can be tested; brought down, it comes back after a few seconds
     (`practiceDummy.ts`).
   - **Taken:** `takeKid` (`life.ts`) takes a kid out: they spectate the kids still in, and the run
     ends when nobody is left. Nothing takes kids yet; the infected will in M1.
4. **End.** When the clock runs out (or every kid is taken), the **end screen** (15s) shows
   "RUN OVER" and a card per kid: avatar, a fun **title** (Slugger, First Taken, Survivor, Taken)
   and a few stats, counted on the server (`src/main/server/roundStats.ts`, rules in
   `src/shared/scoreboard.ts`). **Back to lobby** leaves early; the title then floats over the
   player's head in the lobby for an hour (`src/shared/lastTitle.ts`, MemoryStore). Then everyone
   is teleported back to the lobby they came from; anyone the teleport can't move is kicked with a
   "rejoin" message rather than left stuck. Nothing is recorded on the lobby's Wins board any more
   (it becomes best run + total nights in M6).

### Server authority

Everything that decides the game runs on the server: who's in the party, the clock, every hit and
how much damage it does. Clients only send button presses — tool clicks and the lobby's *Create* —
and the server validates each one. Remote messages are typed (`src/shared/remotes.ts` +
`src/shared/net.ts`), so a misspelt message is a compile error. Public state (run phase and clock)
is published as attributes for the HUD. See [AGENTS.md](AGENTS.md#server-authority-anti-exploit).

## Structure

```
src/
  shared/              # compiled to ReplicatedStorage.Shared (both places)
    remotes.ts, net.ts # typed remote message maps + send/receive helpers
    serverConfig.ts    # ServerStorage config written from code
    parts.ts, flicker.ts, tags.ts      # world-building helpers, client light flicker
    ritualItems.ts, assets.ts          # book/candles/skull models (lobby pedestals, until M6), mesh lookup
    round.ts, combat.ts, melee.ts, flashlight.ts, scoreboard.ts  # shared rules/state
    partyHandoff.ts, safeTeleport.ts, placeIds.ts   # lobby -> main game handoff
  lobby/
    server/            # world.ts, decor.ts (churchyard), queue.ts (parties), zoneDisplay.tsx, config.ts
    client/            # main.client.tsx, partyUi.tsx, candleFlicker.client.ts
  main/
    server/            # main.server.ts (entry: the start-up order), config.ts (all tuning)
                       # wiring: loadout.ts (setup on spawn), elimination.ts (taken, spectating),
                       #   roundEnd.ts (scoreboard, return to lobby), resync.ts (re-send state on
                       #   "Ready"), gameRemote.ts, teams.ts
                       # systems: world.ts (house), party.ts, round.ts, life.ts, flashlight.ts,
                       #   combat.ts, speed.ts, practiceDummy.ts (Studio only)
    client/            # main.client.tsx (entry), gameState.ts (stores for server messages), roundHud,
                       # endScreen, noticeHud, spectate, combatFeedback, melee.ts, flashlight.ts (beam
                       # visuals)

default.project.json   # "dev" place: BOTH lobby + main (both worlds build at once — prefer the two below)
lobby.project.json     # lobby place only
main.project.json      # main game place only

tests/                 # unit tests run with Lune against the compiled out/ modules
  run.luau             #   tiny runner (describe / it / expect); `npm test`
  unit/*.spec.luau     #   flashlight cone, party size, admission, melee reach + swing parsing, scoreboard titles
tools/blender/         # 3D models, built from Python with headless Blender (lib/sdf.py for organic shapes)
assets/
  models/              # generated FBX / GLB / preview PNG (committed)
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

# 2. Compile TypeScript and watch for changes (terminal 1)
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
2. Copy both place IDs into `src/shared/placeIds.ts`: `MAIN_GAME_PLACE_ID` (lobby → game) and
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
- `src/main/server/config.ts` — **everything in the main game**: run timings (arrival timeout,
  countdown, run length, end screen, respawn delay), how dark unlit rooms are (DarkRoomLight,
  applied live), and melee (bat damage/range/cooldown, swing arc and lag tolerances). Each value
  has a comment saying what it does.

At server start these are written into `ServerStorage.LobbyConfig` / `ServerStorage.GameConfig`,
**overwriting** anything saved in the place file, so git is the single source of truth. During a
Studio play session you can **edit them live** in ServerStorage to experiment (systems read them
as they go); the change doesn't stick, so copy a good value back into the config file.

Some settings have a **Studio-only value** in code (a 3-minute run instead of 8, a party minimum
of 1 so the lobby pads can be tested solo), applied only when running in Studio.

The one exception: the flashlight's range and cone angle live in `src/shared/flashlight.ts`,
because every client also needs them to draw the beam, and clients can't read ServerStorage.

## Automated tests

`npm test` compiles the TypeScript and runs `tests/unit/*.spec.luau` with
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
Servers** with 2–3 players for anything about other players. Tip: set `RunSeconds` low in
`ServerStorage.GameConfig` during play to reach the end screen quickly.

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
- [ ] ~5s after joining, everyone appears in the same corner room with a Flashlight and a Baseball Bat; no role banner.
- [ ] 5-4-3-2-1 countdown with ticks; nobody can move or jump during it.
- [ ] Clock appears at the top, in sync across windows, red under 1:00.
- [ ] A player who resets respawns after ~3s in the start room, with both tools again.
- [ ] At 0:00 everyone sees the end screen: "RUN OVER", "You made it to the end."
- [ ] (Published) After the end screen, everyone is teleported back to the lobby; nobody is left on the end screen.
- [ ] (Published) Nothing changes on the lobby's Wins board.
- [ ] No errors in the server or client output during a whole run.

### House lighting
- [ ] An unlit room is dim and blue-ish (DarkRoomLight 0.8 for now), and you can clearly see walls, doorways and furniture without a torch.
- [ ] Lamp rooms have warm pools of light that clearly stand out from the dark rooms; a torch is still much brighter than the dark.
- [ ] In Studio, changing ServerStorage → GameConfig → DarkRoomLight during play brightens/darkens the house straight away.

### Flashlight
- [ ] Every kid has a Flashlight; equip = on, click toggles; lens glows when on.
- [ ] A 3D cone comes straight out of the lens in the direction the character faces (not the camera).
- [ ] The cone is faint and see-through, even close to the torch: you can clearly see what's behind and inside it.
- [ ] Other kids' cones are visible from your window.
- [ ] Resetting gives a fresh flashlight.

### Baseball bat
- [ ] The bat is held like a sword (pointing out of the fist), not sideways.
- [ ] While it's held, the character turns to face where the camera looks; unequipping restores normal turning.
- [ ] Clicking plays a slash animation (check on an **R15** avatar too), at most about once every 0.8s.
- [ ] (Studio) A practice infected with red eyes stands ~10 studs in front of the start, facing you.
- [ ] Hitting it: hit sound, it flashes red, and a white hit marker shows mid-screen. The third hit (60 health, 20 each) shows a bigger red marker and it disappears; it comes back after ~4s.
- [ ] Swinging from too far away, from behind, or through a wall does nothing.
- [ ] Swings before the countdown ends or on the end screen do nothing.
- [ ] On a tablet: swinging at what's in front of the camera works without precise aiming.

### End-of-run scoreboard
- [ ] The end screen shows a card per kid: avatar, name, title, a one-line hint, and stats.
- [ ] A kid who downed the practice infected is the **Slugger** with "N infected downed"; the others are **Survivor** with "Made it".
- [ ] Cards are ordered by how much each kid did (kills, then hits).
- [ ] "Back to lobby (N)" counts down from ~15; pressing it says "Heading back..." and (published) teleports just that player straight away. Everyone left goes at 0.
- [ ] On a **phone/tablet** the whole screen shrinks to fit: every card and the button are visible and tappable.
- [ ] A player whose client loads late (slow tablet) still gets the cards.
- [ ] (Published) Back in the lobby, your title floats over your head (gold, or red if you were taken).
