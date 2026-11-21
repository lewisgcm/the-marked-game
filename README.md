# MARKED

A Roblox game written entirely in code, using [roblox-ts](https://roblox-ts.com) (TypeScript → Luau) and [Rojo](https://rojo.space) (file sync / build).

The game is split into **two places** — a **lobby** and a **main game** — plus **shared code** used by both.

**MARKED** is a co-op horror survival game. A broadcast called the Signal is turning adults
against their children: three marks and they turn. You play the kids: hold the house at night,
scavenge and trade by day, and survive as many nights as you can.

- **[GAMEPLAY.md](GAMEPLAY.md)**: the game design.
- **[PLAN.md](PLAN.md)**: the build plan, milestone by milestone.

> **Current state:** the code is still the **ghost-hunt prototype** this project started from
> (hunters banish an invisible ghost played by one of their own; design archived in
> [docs/archive/GAMEPLAY-ghost-prototype.md](docs/archive/GAMEPLAY-ghost-prototype.md)). It's being
> turned into MARKED by following [PLAN.md](PLAN.md). The rest of this README describes **what the
> code does today**, and is updated as each milestone lands.

## The lobby

The lobby is a **party/queue system** (modeled on the BloodyMary example): multiple teleport zones,
each with a `ZoneContainer` detection region and a `BillboardGui` showing the player count and state.

- First player into a zone becomes the **host** and gets a UI to pick the party size (clamped between
  `LowestPlayer` and `HighestPlayer`, default 2–6), then presses **Create**.
- **To leave, walk off the pad** — there's no Leave button, so the screen stays clear to watch
  others join. Party members just see a small "step off the pad to leave" hint.
- Everyone else on the pad — including anyone who stepped on while the host was choosing — joins as a
  **member**, up to the chosen size.
- The countdown only runs while the party has at least `LowestPlayer` members (a ghost needs hunters);
  if people step off and it drops below that, it goes back to waiting.
- When it finishes, the lobby server **reserves** a main-game server, writes the party's user IDs to
  **MemoryStore** under that server's `PrivateServerId`, and teleports everyone there with
  **SafeTeleport** (`TeleportAsync` + retry). If any step fails, the party is disbanded instead of
  leaving the pad stuck.
- The main server reads the party back from MemoryStore, waits for everyone to arrive (`ArrivalTimeout`),
  and picks the ghost at random.
- **Everything authoritative is server-side**: party state, the party list (never `TeleportData`, which
  passes through the client) and ghost selection. Clients only send `RequestCreate`,
  which the server validates.
- Config values are set in code and exposed as `IntValue`s in `Configuration` instances in
  **ServerStorage** (`LobbyConfig`, `GameConfig`). ServerStorage never replicates, so clients can't
  see them. See [Tuning](#tuning).
- UI is written with **[react-luau](https://react-luau.dev)** (`@rbxts/react` + `@rbxts/react-roblox`):
  the client party UI and the in-world `BillboardGui` counters are declarative JSX components.

The lobby is a **ruined churchyard at night**. Players spawn inside an iron gate and follow a
flagstone path to the three pads, which are dressed as ritual circles: flickering candles, rising
embers, and a pedestal behind each one holding a ritual item from the main game (book, skull,
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

One round per server: every party gets its own reserved server. Anyone who gets into a main-game
server another way — following a friend mid-round, or joining the main place directly — is sent to
the lobby to queue up (`gatekeeper.ts`; Studio is exempt). Party members whose teleport was slow
still join as hunters.

1. **Roles.** The server waits for the party to arrive, then picks one **ghost** at random; everyone
   else is a **hunter**. Each player gets a banner with their role and goal.
2. **Countdown.** 5 seconds with everyone frozen (the server anchors each character).
3. **The hunt** — 8 minutes on the clock:
   - **The ghost is invisible.** The server makes its body transparent (no name tag, no shadow), so
     hunters see nothing; the ghost's own client shows it a faint figure of itself.
   - **Flashlights** (hunters): a hotbar tool with a visible light cone (an uploaded cone mesh,
     nested ×3 for a fade). The server checks range, a 60° cone and a raycast for walls from each
     hunter's head, in the direction the character faces, and reveals the ghost while lit.
   - **Ghost traps** (hunters, 2 each): set on the floor; when the ghost comes within 6 studs the
     trap snaps, revealing and slowing it for 4 seconds.
   - **Sanity** (hunters): drains alone in the dark and faster with the ghost nearby, recovers near
     working lamps and other hunters. The screen loses colour, darkens and blurs as it drops.
   - **Panic** at 0 sanity, until it recovers to 20: the flashlight dies, the hunter slows to 70%
     and screams every 10s (heard across the house), with a pulsing warning and camera shake.
   - **Spooks** (ghost): up to 3 charges (starts with 2, +1 every 40s). **Scream** (Q) — hunters
     within 15 studs lose 25 sanity, and the ghost is visible for 6s. **Lights out**
     (F) — the nearest working lamp stutters and dies for 10s. **Fear feeds the ghost:** scream
     hits, a hunter panicking and knife hits/kills take seconds off its next charge.
   - **Scream & knife** (ghost): there's no Manifest; a **scream** opens the ghost's 6s attack
     window. Only then can it use its **knife**: a hunter below 30 sanity is **killed** (out for the
     round, spectating living hunters); anyone else loses 20 sanity.
   - **Fire poker** (hunters): only hurts the ghost while it's **visible** (flashlight, trap or
     scream). The ghost has 100 health; 20 per hit; a health bar appears once it's hurt.
   - **Melee feel:** while the knife or poker is held, the character turns to face the camera; a
     click plays the classic slash. Hits follow Roblox's recommended split — the attacker's client
     picks who it hit (what the player saw) and the server re-checks each with its own positions
     (reach and arc plus lag tolerance, a wall raycast, role, visibility, cooldown). Feedback: a hit marker
     (red on a kill), a red flash and camera jolt when struck, and the ghost flashes red.
   - **The objective:** find glowing **keys**, unlock **chests** holding the **book, candles and
     skull**, carry them to the **altar** in the centre room, then hold *Banish the ghost* for 10
     seconds. A short **banishing cutscene** follows: the ghost is dragged into a column of light
     above the altar, rises and dissolves, with every camera circling the altar.
4. **End.** Hunters win by **banishing** the ghost or **destroying** it; the ghost wins if **every
   hunter is dead** or the **clock runs out**. Everyone sees the result and why (and the ghost),
   and each winner gets a win on the lobby scoreboard. The **end screen** (15s) shows a card per
   player: avatar, a fun **title** (The Banisher, Spotlight, The Reaper...) and a few stats,
   counted on the server (`src/main/server/roundStats.ts`, rules in `src/shared/scoreboard.ts`).
   **Back to lobby** leaves early; the title then floats over the player's head in the lobby for
   an hour (`src/shared/lastTitle.ts`, MemoryStore). Then everyone is teleported back to the
   lobby they came from (the lobby records its place ID in the party handoff); anyone the teleport
   can't move is kicked with a "rejoin" message rather than left stuck.

Coming next: the rework into MARKED (see [PLAN.md](PLAN.md)).

The test map is a dark house of 3×3 rooms built at runtime (`src/main/server/world.ts`); a
hand-built map is planned once the gameplay settles.

### Server authority

Everything that decides the game runs on the server: roles, reveals, the clock, sanity, what each
hunter carries, every prompt and trap. Clients only send button presses — tool clicks, prompt
triggers and the lobby's *Create* — and the server validates each one. Remote messages are typed
(`src/shared/remotes.ts` + `src/shared/net.ts`), so a misspelt message is a compile error. Public
state (round phase and clock, ritual progress, each player's sanity) is published as attributes
for the HUD. See [AGENTS.md](AGENTS.md#server-authority-anti-exploit).

## Structure

```
src/
  shared/              # compiled to ReplicatedStorage.Shared (both places)
    remotes.ts, net.ts # typed remote message maps + send/receive helpers
    serverConfig.ts    # ServerStorage config written from code
    parts.ts, flicker.ts, tags.ts      # world-building helpers, client light flicker
    ritualItems.ts, assets.ts          # book/candles/skull models, mesh lookup
    round.ts, roles.ts, objectives.ts, sanity.ts, flashlight.ts, ghost.ts  # shared rules/state
    partyHandoff.ts, safeTeleport.ts, placeIds.ts   # lobby -> main game handoff
  lobby/
    server/            # world.ts, decor.ts (churchyard), queue.ts (parties), zoneDisplay.tsx, config.ts
    client/            # main.client.tsx, partyUi.tsx, candleFlicker.client.ts
  main/
    server/            # main.server.ts (entry: the start-up order, ~60 lines), config.ts (all tuning)
                       # wiring: systems.ts (starts systems + connects them), loadout.ts (per-role setup
                       #   on spawn), elimination.ts (deaths, spectating), roundEnd.ts (wins, return to
                       #   lobby), resync.ts (re-send state on "Ready"), gameRemote.ts, teams.ts
                       # systems: world.ts (house), roles.ts, round.ts, life.ts, flashlight.ts,
                       #   ghostVisibility.ts, traps.ts, sanity.ts, panic.ts, spooks.ts, combat.ts,
                       #   objectives.ts, speed.ts
    client/            # main.client.tsx (entry), gameState.ts (stores for server messages), roleBanner,
                       # roundHud, objectiveHud, sanityHud, ghostHud, spectate, flashlight.ts (beam
                       # visuals), ghostSelf.ts (the ghost's view of itself)

default.project.json   # "dev" place: BOTH lobby + main (both worlds build at once — prefer the two below)
lobby.project.json     # lobby place only
main.project.json      # main game place only

tests/                 # unit tests run with Lune against the compiled out/ modules
  run.luau             #   tiny runner (describe / it / expect); `npm test`
  unit/*.spec.luau     #   sanity & panic, flashlight cone, party size, admission, melee reach, spook charges, scoreboard titles
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
**candles**) used on the lobby pedestals and as pickups in the main game, and the flashlight's
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

To test the main game, use **Test → Clients and Servers** with 2–3 players (you need a hunter and
a ghost). It works on an unpublished place: outside a reserved server the game skips the
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
- `src/main/server/config.ts` — **everything in the main game**: round timings, how dark unlit
  rooms are (DarkRoomLight, applied live), reveal linger,
  traps (count, trigger radius, duration, slow), sanity (drain/recovery rates, lamp/company/ghost
  radii), panic (start and recover thresholds, speed, scream interval), spooks (charges, recharge, scare rewards,
  cooldown, Scream radius/damage/reveal-and-attack time, Lights out radius/duration), combat (knife range/cooldown/damage, the vulnerable-sanity threshold, ghost health,
  weapon damage/range/cooldown, swing arc and lag tolerances, hit slow, respawn delay), and the objective (spare keys, banish
  hold time, banishing cutscene length). Each value has a comment saying what it does.

At server start these are written into `ServerStorage.LobbyConfig` / `ServerStorage.GameConfig`,
**overwriting** anything saved in the place file, so git is the single source of truth. During a
Studio play session you can **edit them live** in ServerStorage to experiment (systems read them
as they go); the change doesn't stick, so copy a good value back into the config file.

Some settings have a **Studio-only value** in code (a 3-minute round instead of 8, a party minimum
of 1 so the lobby pads can be tested solo), applied only when running in Studio.

The one exception: the flashlight's range and cone angle live in `src/shared/flashlight.ts`,
because every client also needs them to draw the beam, and clients can't read ServerStorage.

## Automated tests

`npm test` compiles the TypeScript and runs `tests/unit/*.spec.luau` with
[Lune](https://lune-org.github.io/docs) (a standalone Luau runtime, pinned in `rokit.toml`). The
tests load the **compiled** modules from `out/`, so they check exactly what ships.

They cover **pure logic** only — code that doesn't need the Roblox engine: sanity/panic rules, the
flashlight's reveal cone, validation of client input (party size), and who may stay in a
main-game server (admission). To make something testable
here, pull its rules into a pure function (no Roblox services) in `src/shared/` or a small module,
like `inBeamCone` and `parsePartySize`. Engine-level tests (raycasts, prompts, real systems) need
Studio and are in the backlog. Everything else is covered by the manual checklist below.

## Regression test checklist

Run through this after changes. Main-game tests need **Test → Clients and Servers** with 2–3
players (one becomes the ghost). Tip: set `RoundSeconds` low in `ServerStorage.GameConfig` during
play to reach the end screen quickly.

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
- [ ] (Published) After a round, each player's title from it (gold for hunters, red for the ghost) floats above their head, above the name tag; it's still there after a reset, and gone after an hour.

### Main game: round
- [ ] (Published) Following a friend who's mid-round sends you to the lobby (or a "join from the lobby" message), not into their round.
- [ ] (Published) Joining the main game place directly sends you to the lobby.
- [ ] On a **phone/tablet** (slow to load), the role banner, the ghost's spook panel and the hunter HUD all still appear.
- [ ] ~5s after joining, each player gets a role banner (Ghost / Hunter); exactly one ghost.
- [ ] Hunters start in one corner room, the ghost in the opposite one.
- [ ] 5-4-3-2-1 countdown with ticks; nobody can move or jump during it.
- [ ] Clock appears at the top, in sync across windows, red under 1:00.
- [ ] At 0:00: "THE GHOST WINS" for everyone and the ghost becomes visible.
- [ ] (Published) After the end screen, everyone is teleported back to the lobby; nobody is left on the end screen.
- [ ] (Published) Winners' Wins go up by one in the lobby (player list and board, within a minute). Studio rounds don't record wins.

### Ghost invisibility
- [ ] Hunters can't see the ghost (no body, name tag, health bar or shadow), but bump into it.
- [ ] The ghost sees itself as a faint figure; accessories hidden too.
- [ ] Resetting the ghost keeps it invisible, in the ghost room.

### House lighting
- [ ] An unlit room is dim and blue-ish (DarkRoomLight 0.8 for now), and you can clearly see walls, doorways and furniture without a torch.
- [ ] Lamp rooms have warm pools of light that clearly stand out from the dark rooms; a torch is still much brighter than the dark.
- [ ] In Studio, changing ServerStorage → GameConfig → DarkRoomLight during play brightens/darkens the house straight away.

### Flashlight
- [ ] Hunters have a Flashlight (ghost doesn't); equip = on, click toggles; lens glows when on.
- [ ] A 3D cone comes straight out of the lens in the direction the character faces (not the camera).
- [ ] The cone is faint and see-through, even close to the torch: you can clearly see what's behind and inside it.
- [ ] Other hunters' cones are visible from your window.
- [ ] Beam on the ghost reveals it (pale glowing figure) in every hunter window; it lingers ~1s after.
- [ ] No reveal through walls/furniture, beyond ~60 studs, or outside the cone.
- [ ] The ghost's own view goes more solid while revealed.
- [ ] Resetting a hunter gives a fresh flashlight.

### Ghost traps
- [ ] Hunters have "Ghost Trap (2)"; clicking places one ~3 studs ahead; count drops; tool vanishes at 0.
- [ ] Can't place before the hunt, through a wall (goes at your feet), or on top of another trap.
- [ ] Ghost within ~6 studs: trap snaps (flash + ping), ghost revealed and half speed for ~4s, all hunters notified.
- [ ] Resetting doesn't refill traps.

### Sanity
- [ ] Hunters see "Sanity 100" during the hunt; the ghost doesn't.
- [ ] Alone in a dark room it drains (~1/s); colour fades and edges darken as it drops.
- [ ] Under a working lamp or next to another hunter it recovers; faster with both.
- [ ] The ghost nearby (even unseen) drains it faster.
- [ ] Below 30 the screen blurs; recovering clears it. Effects are off before and after the hunt.

### Panic (sanity 0)
- [ ] Flashlight flickers out and won't switch on (clicking/re-equipping does nothing).
- [ ] Movement is slower (~70%).
- [ ] A scream plays on panic and every ~10s, audible (quieter) across the house.
- [ ] Meter shows a pulsing "PANICKING" and the camera shakes; other hunters get "<name> is panicking!".
- [ ] Resetting while panicking keeps panic, slowness and the dead flashlight.
- [ ] Recovering to 20 near a lamp/teammate: "You've calmed down", flashlight works, normal speed, shake stops.

### Spooks (ghost)
- [ ] When the hunt starts, the ghost sees a slim spook panel on the **right edge**, a little above the middle: "SPOOKS +1 in Ns", 2 of 3 round pips filled, Scream [Q] and Lights out [F] buttons stacked, and a knife-status line. Hunters don't see it.
- [ ] Nothing covers the middle of the screen. On a **phone/tablet** the panel clears the jump button and the top-right menu, and the buttons are easy to tap with the right thumb.
- [ ] Charges refill one at a time (~40s) up to 3; the timer counts down.
- [ ] Scream (Q or button): hunters within ~15 studs lose ~25 sanity and get a notice; the ghost is visible to hunters for ~6s; a low wail plays.
- [ ] Lights out (F or button) near a lit lamp: it stutters, pops and goes dark; sanity no longer recovers under it; it comes back after ~10s.
- [ ] Lights out with no working lamp nearby: "No working lamp nearby." and no charge used.
- [ ] Can't spook with 0 charges, within ~3s of the last spook, or before the hunt starts.
- [ ] **Fear feeds the ghost:** a scream that hits 2 hunters knocks ~16s off "next in"; the ghost sees "Their fear feeds you (-16s)".
- [ ] A hunter starting to panic (~10s), a knife slash (~10s) and a knife kill (~15s) also cut the timer, with the same notice.
- [ ] When a reward is bigger than the time left, a pip fills at once ("spook charged!") and the next timer starts early.
- [ ] At 3/3 charges, scares give no notice and nothing changes.

### Scream, knife & death (ghost)
- [ ] The ghost has a Knife; there's no Manifest button and R does nothing. The spook panel's bottom line reads "Scream to show yourself and attack". Hunters don't see it.
- [ ] Using the knife without screaming first: "Scream first (Q) to use the knife."
- [ ] After a scream the bottom line turns red, "VISIBLE Ns — use your knife!", counting down from ~6, then goes back; hunters can see the ghost for that time.
- [ ] Screaming again while visible extends the window (costs another charge).
- [ ] Knife after a scream on a hunter above 30 sanity: they lose ~20 and get "The ghost slashed at you!".
- [ ] Knife after a scream on a hunter below 30: they die, see "You're out — spectating", and don't respawn; other hunters are told.
- [ ] A killed hunter's keys/items drop where they died.
- [ ] Spectating: camera follows a living hunter (never the ghost); arrows/buttons switch; their hunter HUD is hidden.
- [ ] Killing the last living hunter (or the last one leaving): "THE GHOST WINS — Every hunter is dead."
- [ ] A hunter who just resets (not killed) respawns after ~3s as normal.

### Melee feel (knife & poker)
- [ ] The knife and poker are held like a sword (blade/rod pointing out of the fist), not sideways.
- [ ] While either is held, the character turns to face where the camera looks; unequipping restores normal turning.
- [ ] Clicking plays a slash animation (check on an **R15** avatar too).
- [ ] A hit shows a white hit marker (four diagonal ticks, no square box) in the middle of the attacker's screen (bigger and red on a kill); the victim's screen flashes red and jolts.
- [ ] Hitting a moving target that looks in reach on your screen registers (lag tolerance); a target through a wall never does.
- [ ] On a tablet: swinging at what's in front of the camera works without precise aiming.

### Fire poker (hunters)
- [ ] Hunters have a Fire Poker; swinging at an invisible ghost does nothing.
- [ ] With the ghost visible (flashlight / trap / scream) and in front within ~7 studs: hit sound, "You hit the ghost!", the ghost is briefly slowed, and a GHOST health bar appears under the clock for everyone.
- [ ] 5 hits (100 health, 20 each): "HUNTERS WIN — The ghost has been destroyed."
- [ ] The end screen line matches the reason: clock, all dead, banished or destroyed.

### End-of-round scoreboard
- [ ] The end screen shows a card per player: avatar, name, title, a one-line hint, and 2-3 stats. The ghost's card is first, red, and says "(the ghost)".
- [ ] Hunter cards are ordered by how much they did; dead hunters' avatars are greyed and the last line says "Died at m:ss"; survivors say "Survived".
- [ ] Titles make sense for what happened: the hunter who held the banish is The Banisher; the one who landed the last poker hit is Ghostbuster; the first hunter killed is First to Fall; keys/chests/items, "Lit the ghost Ns" and poker hits look right.
- [ ] Each hunter title is given to only one player; anyone left over is Survivor (alive) or Haunted (dead).
- [ ] Ghost: The Reaper if it killed every hunter, Untouchable if never hit, Banshee for 3+ scream hits, Blackout for 3+ lamps, else Phantom (won) / Lost Soul (lost).
- [ ] "Back to lobby (N)" counts down from ~15; pressing it says "Heading back..." and (published) teleports just that player straight away. Everyone left goes at 0.
- [ ] On a **phone/tablet** the whole screen shrinks to fit: every card and the button are visible and tappable.
- [ ] A player whose client loads late (slow tablet) still gets the cards.

### Objective
- [ ] 4 keys glow gold (with sparkles) on floors/low furniture; picking one up shows "Keys: 1".
- [ ] No chest ever appears in the hunters' or the ghost's start room (players spawn at room centres).
- [ ] A chest without a key says "You need a key"; with one, the lid opens, an item appears, the key is used.
- [ ] Items can be picked up ("Carrying: Skull").
- [ ] The altar in the centre room accepts carried items; top-right shows "Ritual: N/3".
- [ ] Placing the last item switches the prompt to "Banish the ghost" straight away — no need to walk off and back.
- [ ] With 3/3, a 10s hold on "Banish the ghost" ends the round: "HUNTERS WIN" for everyone (after the cutscene).

### Banishing cutscene
- [ ] Completing the ritual freezes everyone and puts away held weapons; no one can move, swing or spook.
- [ ] Every player's camera (hunters, the ghost and dead spectators) swings round to circle the altar room; "The ritual is complete..." shows at the bottom.
- [ ] A pale column of light bursts up from the altar and lights the room; the ghost appears in it, visible, with a low scream.
- [ ] The ghost rises up the column, spinning faster and shaking, without going through the ceiling.
- [ ] A bright flash and a burst of sparks; the ghost fades to nothing (the ghost player sees itself fade too).
- [ ] After ~6s the camera returns to normal and the end screen shows "HUNTERS WIN"; the ghost stays gone (not shown on the end screen).
- [ ] Other endings (time, all dead, destroyed) have no cutscene, and the ghost is shown on the end screen as before.
- [ ] Resetting or leaving while carrying drops everything where the hunter was; it can be picked up again.
- [ ] The ghost sees no prompts.
