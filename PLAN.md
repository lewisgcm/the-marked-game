# PLAN — building MARKED

How we get from the ghost-hunt prototype to the game in [GAMEPLAY.md](GAMEPLAY.md).

- Work **in milestone order**. Each milestone ends with something playable and a **playtest
  question**. If the answer is "no", fix the design before building more on top of it.
- Tick tasks off (`[x]`) as they land; add notes where the plan changed.
- Every gameplay number goes in `src/main/server/core/config.ts` (or `src/lobby/server/config.ts`).
  Pure rules go in `src/shared/` with a Lune spec in `tests/unit/`. Follow AGENTS.md (server
  authority, `net.ts` remotes, `gameState.ts` stores + `resync`).
- Each milestone updates **README.md** (what the code does + regression checklist).

## Decisions

### Settled (see GAMEPLAY.md)

- Kids only, co-op, party of 1–6, one reserved server and one house per party.
- Endless runs that get harder every night; score = nights survived. Optional rescue call from
  Night 10.
- Kids can kill the infected (they dissolve into static; no gore). Weapon tiers: bat + slingshot →
  improvised → pistol, rifle, submachine gun. Melee never breaks; ammo is the scarce resource.
- Health (100) and "taken" at 0. **No** fear/sanity meter, **no** hunger.
- One currency: **coins**. Adult bases fall to the Signal on their own schedule; kids' bases never
  turn. Distress calls.
- No screens inside the house; the Signal matters out in the neighbourhood (M4). The generator is
  light and safety vs fuel (fuel from M3).
- Car cutscene (first run only, skippable) ends on Dad's red eyes; repeat runs go straight into
  Day 1. Night 1 is forgiving.
- Lobby: school gym hall, a parent NPC at each pad. Leaderboards: best run + total nights.

### Order of work (proposed 24 Nov 2026)

Milestones stay grouped by theme, but we don't build them all before anyone plays. Sizes are rough.

| Step | What | Size |
|---|---|---|
| 1 | **Finish M3:** shutters and scrap press | Small |
| 2 | **Play a full run with friends** (published; the lobby needs 2+ players until M6). If holding the house isn't fun, fix that before adding more | — |
| 3 | **M4**, plus the **Runner** from M5 so nights aren't all shamblers | Medium |
| 4 | **M6** (lobby, solo play), then **M7** (first run) | Medium each |
| 5 | **First public test**, Nights 1–5 only | — |
| 6 | The rest of **M5** (very big), then **M8** and **M9** (big), guided by what players say | Very big |

Art runs alongside, on the same branch: the infected, cars, wrecks, fire engine and torch are in. The map's
tiles are next (**Map art**, below the map tiles).

### Still open — decide by the milestone shown

| Question | Needed by | Recommendation |
|---|---|---|
| Scale waves with party size? | M1 | Yes: wave size × (0.6 + 0.2 × kids), so solo is playable and 6 is chaos. |
| Does each kid own their weapons, or is there a shared locker? | M2 | Each kid owns what they carry; a **weapon locker** at home for sharing. |
| Save a run between sessions? Rejoin a run after disconnecting? | M8 | Rejoin yes (lobby button, M8). Saving whole runs: decide after playtests show how long runs actually last. |
| Tell players the power must be on before dark (it counts after 20s)? | After the friends playtest | Only if they get caught out: a word in Mum's sundown line. |
| Kid classes (Builder / Scout / Medic / Techie)? | After M5 | Not for now; revisit if runs feel samey. |

---

## M0 — Snapshot and strip the prototype ✅

Goal: a clean base that still compiles, lints and passes tests, with only the generic parts left.

- [x] **Commit the prototype first** and tag it `ghost-prototype`, so everything we delete stays
      recoverable.
- [x] Remove ghost-only code: `spooks.ts`, `ghostVisibility.ts`, `sanity.ts`, `panic.ts`,
      `banishing.ts`, `objectives.ts` (ritual), `traps.ts`, `systems.ts`; client `ghostHud.tsx`,
      `ghostSelf.ts`, `sanityHud.tsx`, `objectiveHud.tsx`, `roleBanner.tsx`, `banishCamera.ts`;
      shared `ghost.ts`, `sanity.ts`, `spooks.ts`, `objectives.ts`, `roles.ts`, and their remotes,
      config values and specs.
- [x] Keep and generalise:
  - `melee.ts` / `combat.ts` → the **baseball bat** against models tagged `Infected` (client
    picks hits, server re-checks; hit markers, red flash). Swing candidates are now Models,
    validated by `parseSwingCandidates(payload, accept)`.
  - `flashlight.ts` → beam + cone; `litBy(target)` kept for the M1 stun.
  - `roles.ts` → `party.ts` (membership only; everyone is a kid); `teams.ts` → living kids.
  - `round.ts` → a placeholder run (Countdown → Playing → Ended), replaced by the phase clock
    in M1.
  - `life.ts` → `takeKid` (spectate until the run ends); `elimination.ts` ends the run when every
    kid is taken.
  - `roundEnd.ts`, `roundStats.ts`, `scoreboard.ts`, `endScreen.tsx` → end-of-run screen with kid
    titles (Slugger, First Taken, Survivor, Taken).
  - Party handoff, gatekeeper, admission, safe teleport: unchanged.
- [x] `npm run lint` and `npm test` pass (44 tests).
- [ ] **Studio check** (you): Play loads the house, the countdown runs, the bat hits the practice
      infected, the end screen shows. README → Regression test checklist, "Main game".

Notes — what changed from the plan:
- `banishCamera.ts` was **deleted, not generalised**: it only orbited the altar. M7 writes a
  proper shot-list camera (get the old one from the tag if useful).
- `ritualItems.ts` and the skull/book/candles models **stay until M6**: the lobby pedestals still
  use them. They were removed from `main.project.json`.
- Added a **Studio-only practice infected** (`practiceDummy.ts`) so melee can be tested; delete it
  once real infected exist (M1).
- Added `noticeHud.tsx` (notices used to live in the objective HUD).
- The lobby's Wins board no longer gets wins (there's no winning side). M6 replaces it.
- The lobby party minimum is still 2 (M6 makes it 1); solo only works in Studio for now.
- `package.json` name is now `marked`.

## M1 — Vertical slice: one night in the house

Goal: **Day → Dusk → Night → Dawn, repeating**, in a single house, with real attacks.
Playtest question: *is holding the house fun, with 1 player and with 4?*

**Phase clock** ✅
- [x] `shared/run/phases.ts` (pure): next phase, night number, nights survived, titles. Spec.
- [x] Server `round.ts` drives the clock and publishes phase/night/end time/nights survived as
      ReplicatedStorage attributes (no per-player messages, so nothing to `resync`).
- [x] HUD: "NIGHT 3 · 1:12" (red in the last 10s of day/dusk), a big banner + hint on each
      phase change, "SURVIVED N NIGHTS" on the end screen.
- [x] The 5 s countdown became a "DAY 1" title card (frozen, 4 s).
- [x] Per-phase lighting blends (`lighting.ts`). Studio phase lengths 40/20/60/15 s.

**The house**
- [x] Rebuild `src/main/server/world/world.ts` as a two-storey house blockout: living room, dining
      room, kitchen, garage, hall; upstairs 2 bedrooms, parents' room, bathroom; basement (spawn).
      Front, back and garage doors, 6 ground-floor windows (open gaps, low sills), glazed upstairs
      windows; garden, street, driveway. No attic (no Climber yet). Wall cutting is pure
      (`shared/world/walls.ts`, spec).
- [x] Tag entry points (`BarricadeSlot`, with `Kind`), infected spawns outside
      (`InfectedSpawn`), the TV (`Screen`), lights (`HouseLight`), generator, workbench, plank
      pile.
- [x] Generator on/off prompt (starts off); house lights follow it; off = waves 1.4× bigger (never
      on Night 1). Fuel in M3.

**Barricades** ✅
- [x] `shared/house/barricade.ts` (pure): plank health, add/remove, damage (one plank per hit),
      blocked/breached, how many planks to take. Spec.
- [x] Server `barricades.ts`: "Board up" (E, hold) / "Take down" (F) prompts at every opening,
      plank count per kid (`Planks` message + store + resync, HUD bottom-left), plank visuals,
      the opening blocks everyone while any plank is up. `damageEntry` ready for the infected.
- [x] Plank pile in the garage: 30 to start, +10 each dawn, carry 5. Night 1 planks get 2×
      health. Nails wait for the M2 inventory.

**The infected** ✅ (first pass)
- [x] Server `infected.ts`: spawn at the four markers, walk to the nearest opening, bash its
      planks, climb in once it's open, then chase the nearest kid with PathfindingService and hit
      them; go for a kid they can see outside; retreat at dawn. R15 bodies from a plain
      HumanoidDescription, grey, red glowing eyes, default walk animation.
- [x] Health on the server (their Humanoid); brought down → **static dissolve** (server-side
      flicker; a client VFX can replace it later).
- [x] **Dad**: blue shirt, in the first wave every night; knocked down, never gone for good.
- [x] `shared/infected/waves.ts` (pure): Night 1 = Dad + 1, then 2; later nights 3 growing waves, scaled
      by party size (0.6 + 0.2 × kids). Health +10% a night. Spec.
- [x] Deleted `practiceDummy.ts`.

**Kids**
- [x] Health 100 (server-owned Humanoid, no regeneration), red flash when hit, healed at dawn.
- [x] **Taken** at 0: spectate, back in the basement at dawn (15 s on Night 1). The run ends
      when every kid is taken at once (never on Night 1).
- [x] **Slingshot**: the client sends only its aim direction; the server validates it and casts
      the shot itself from the kid's head (10 damage, 80 studs, 0.6 s). 20 stones, +10 at dawn
      (max 20) until M2 loot. `shared/combat/ranged.ts` (pure). Spec. Camera-facing shared with the bat
      (`client/combat/faceCamera.ts`).
- [x] **Flashlight stun**: a beam held 0.6 s stuns an infected for 2 s (eyes dim), then 5 s
      immune. `shared/infected/stun.ts` (pure). Spec.

**Screens and the broadcast** — dropped from the house; the broadcast arrives with the adult bases
in M4.

**Night 1 rules** ✅
- [x] Forgiving: 2 small waves, half damage, double plank health, 15 s taken timer, the run
      can't end.
- [x] Tips under the clock on Day 1 / Night 1: planks, boarding, generator, where they're
      attacking, how to fight. `shared/run/hints.ts` (pure). Spec. (Shown to everyone until M7's
      "finished a Night 1" flag.)

**Wrap-up**
- [x] Dawn summary card (infected downed, planks lost, who was taken). `shared/run/nightSummary.ts`
      (pure). Spec.
- [x] End-of-run screen with nights survived and the first titles (Slugger, Carpenter, First
      Taken, Survivor).
- [x] Dying any other way at night (resetting, falling) counts as taken, so Reset is no escape.
- [x] README: new main-game section + regression checklist.
- [ ] **Playtest**: is holding the house fun with 1 player, and with 4?

## M2 — Day: Maple Street, loot and coins

Goal: a reason to leave the house. Playtest question: *is the day tense, and does the walk home
at dusk feel risky?*

- [x] Neighbourhood blockout (`neighbourhood.ts`): two houses either side of home, two across the
      street, cars, gardens, street lamps, invisible map edge. Side infected spawns moved to ±62.
- [x] Loot containers (`containers.ts`): cupboards, drawers, tool chests, car boots, the searchable
      ones tagged. `shared/items/loot.ts` (pure): weighted tables, nails 40% by Night 10, 25% by Night 20.
      Spec.
- [x] **Looted stays looted** for the run; garden stones come back at dawn.
- [x] **Slot inventory** (`inventory.ts`): 5 slots of stacks; coins and the starter tools
      (flashlight, bat, slingshot) don't use slots, or there'd be no room left. `shared/items/inventory.ts`
      (pure). Spec. Nailing a plank now costs a nail; stones come from here; medkits heal 50.
- [x] Inventory UI down the right edge: tap a slot for Drop / Use. Dropped stacks can be picked up;
      a taken kid leaves everything where they were (but keeps their coins).
- [x] **Coins** (`coins.ts`): found, +5 per kid still in at dawn, HUD counter.
- [x] **Dormant infected** in front of screens by day: crossing in front, bumping, a beam, noise
      (searching nearby, bat swings) or a hit wakes them (`shared/infected/wake.ts`, spec). They give up 70
      studs away. They stay dormant at night until the broadcast exists (M4), so Night 1 stays easy.
      Dad waits next door on Day 1; Night 1's first wave wakes him.
- [x] "The sun's going down" and street lamps 60 s before dusk.
- [ ] **Weapon locker** at home: nothing to share until there are found weapons (M5).
- [ ] **Playtest**: is the day tense, and does the walk home at dusk feel risky?

## Cleanup before M3 ✅

No gameplay changes. `infected.ts` (723 lines) became `infected/`; wiring moved to `systems.ts` and
phase logic to `phaseEvents.ts`; shared helpers (`characters.ts`, `effects.ts`, `infectedDamage.ts`);
infected reach barricades through hooks; deleted `speed.ts` and ghost leftovers. Rules written down
in AGENTS.md → Code structure.

- [x] **Studio check**: a full day and night plays as before.

## Hammer (25 Nov 2026)

Door and window prompts got in the way of defending, so building needs the hammer in hand.

- [x] **Hammer** (`house/hammer.ts`, `client/house/buildMode.ts`): the prompts show, within 5 studs, only
      while it's held; the server checks too. Shutters need it as well. Night 1 tip added.
- [ ] **Playtest**: is fighting at a window clear of prompts, and is swapping hammer and bat under attack tense
      or just a nuisance?

- [x] **Reinforced planks look reinforced**: metal strips on planks nailed after the upgrade (each plank now
      remembers). Showing damage (cracked planks) could follow.

## Folders (25 Nov 2026) ✅

No gameplay changes: `main/server`, `main/client`, `shared` and the specs are grouped by topic
(AGENTS.md → Code structure). Later: split `world.ts` and the lobby's `decor.ts`.

- [x] **Studio check** (main game). The lobby builds; check it loads next time it's opened.

## Map tiles (25 Nov 2026)

The map is 200×200-stud tiles, laid out differently each run (MAP.md): the game's only map since 25 Nov.

- [x] Five sample tiles, a gallery to view them in Studio (`npm run serve:tiles`), and checks on every tile.
      Spec.
- [x] Tiles are written in TypeScript (`tools/tiles`) and built to JSON, not hand-written JSON (25 Nov 2026):
      a tenth of the size, shared pieces, typed. A tile edited in Studio becomes JSON in `assets/tiles`.
- [x] **Studio check**: the gallery and sample map look right.
- [x] Studio check: editing a tile updates Studio live (after a stale Rojo plugin was reconnected).
- [ ] A converter for tiles edited in Studio (when someone wants to). Meshes straight in tile files: not
      needed so far (cars, wrecks and the engine are placed in code at markers).
- [x] Home tile (Maple Street round a plot where the code-built house goes) and the Fire Station; the map's
      rules use them (home fixed, Fire Station on home's row or the next).
- [ ] More filler tiles and the 3 × 4 map with M5's places; the family house built from the Home tile's markers.
- [x] Pick a layout from a seed (`shared/world/layout.ts`, rules in `mapRules.ts`): home fixed, places in
      their rows, edges joined, every place reachable by road, roads off the map listed. Spec. The gallery
      shows the map for any seeds (`npm run tiles -- 7 42`).
- [x] Build the run's map from tiles in the game (`world/map.ts`): seed printed and settable (`MapSeed`),
      fallback map, roadblocks, boundary, markers for dormant spots, Dad and spawns, traders at their
      counters. Spec for placement and the fallback. (Tried behind a `UseTiledMap` switch first.)
- [x] **Studio check** (25 Nov 2026): README → "The map" looks good.
- [x] Cars and wrecks on the tiled map: `CarSpot` / `WreckSpot` markers, placed by the old map's code. Studio check ✓.
- [x] `npm run watch` rebuilds the map tiles (and the gallery) on save too (`tiles:watch`).
- [x] Woods along the south edge, behind home's row (border tiles); the night's back and side spawns moved
      into them, 42-48 from the house again. Spawns have an `Order`: Dad comes from the first. Spec.
- [x] The tiled map is the only map: the switch, `neighbourhood.ts`, the old base buildings, wreck positions
      and the house's own grounds and spawns are gone. GAMEPLAY §8 updated.
- [ ] **Studio check** (you): README → "The map", especially the night's spawns from the woods.
- [x] Docs brought up to date with the tiled map: AGENTS.md (adding to the map, gotchas), MAP.md, README.

### Map art: models for the tiles

The tiles are blockouts of plain parts. Make them look like the game, the way the cars and the infected
were made: Blender models from Python (`tools/blender`, MODELLING.md for anything rigged), low-poly from the
shared palette, uploaded once, then wired in. Keep every tag, marker and collider working: art changes how
the map looks, not how it plays.

- [x] **Decide how tiles hold models** (tested 26 Nov 2026 with the lobby kit's tree): models go straight
      in the tile files as MeshParts, so `serve:tiles` shows the real art. Size and InitialSize = the mesh's
      own size survive JSON, live sync and a built place, and draw and cull right. A *scaled* mesh (Size 2×
      InitialSize) vanishes when its middle leaves the screen, so export each model at the size it's used
      and never scale it in a tile. Meshes don't collide (`CanCollide` off); plain parts inside are the
      colliders, as the wrecks have (a trunk, a building's walls).
- [x] **A map kit** (`tools/blender/assets/map_kit.py`, one FBX, like the lobby kit): pines, oaks and dead
      trees in three sizes, reeds, rocks, a hedge, hay bales, fence rails and posts, a street lamp, a tent,
      a campfire, a log seat and the roadblock. The pieces in `tools/tiles/lib/build.ts` use them, with
      plain-part colliders, once their IDs are in (`map_kit_ids.py`); blockouts until then. Checked with
      placeholder IDs: every tile passes.
- [x] **Upload the map kit** (26 Nov 2026, model 140405497216248; IDs read through the Studio MCP). Sizes
      match the build, dead trees sit on their trunks (`KIT_X_SIGN` right), every tile passes with them.
- [x] **Studio check** (26 Nov 2026): in a playtest, the kit's colliders block you where things look solid.
- [x] **Buildings** (`tools/blender/assets/map_buildings.py`, a second FBX): the bungalow, barn, ranger hut,
      swamp shack, Fire Station, its training tower and the treehouse, modelled on the blockouts' numbers, so
      doors and windows are where they were (open: kids and the infected go through). The blockout walls and
      roofs stay as invisible colliders; floors, loot, TVs, counters, signs and lights stay as they are.
      Checked with placeholder IDs: every tile passes.
- [x] **Upload the buildings** (26 Nov 2026, model 92928712614118; IDs read through the Studio MCP, sizes match
      the build). Studio check: looks good in a playtest.
- [x] Trim no longer flickers (26 Nov 2026): it started inside the wall, so its sides shared planes with the
      openings'; now it stands just off the wall. Re-uploaded as model 117961715635785.
- [x] **The roadblock mesh** at the map's open ends: build.ts writes a `Roadblock` piece (mesh and collider) to
      `build/tiles/kit`, synced to `ServerStorage.MapKit`; `world/map.ts` clones it, the gallery places it.
- [x] **Roads** (plain parts, `lib/build.ts` → Streets): town roads get kerbs and drains along their
      pavements (now the Pavement material), give-way lines at the side road, a zebra crossing on Home and a
      keep-clear box at the Fire Station; country roads get solid edge lines (turning the bends) and worn
      verges. Repeating details are spaced from each tile's middle, so they meet the next tile's.
- [ ] **Ground:** grass, forest floor and mud that blend at the seams, and patches to break up flat ground.
- [ ] **The family house** (was in M9): a model over the code-built house, keeping its barricade slots,
      lamps, stairs and basement; later, built from the Home tile's markers instead of code.
- [ ] **Budget:** parts and triangles per tile, checked on a phone with a full map, before streaming is
      considered (AGENTS.md → Gotchas).
- [ ] **Studio check** after each set: README → "The map" plays the same, and it looks better.

## M3 — Workbench, trading and the walkie-talkie

Goal: a reason to spend coins. Playtest question: *do players plan trips around what they want
to buy?*

- [x] **Workbench** (`workbench.ts`, `shared/economy/upgrades.ts`, spec): reinforced planks (1.5×), door bar
      (4th plank, 2×), school (8 slots) and hiking (12) rucksacks. Party upgrades are shared, whoever
      pays; rucksacks are personal. List UI scales to small screens.
- [x] **Generator fuel** (`shared/house/fuel.ts`, spec) and the tune-up (half the burn, 35 coins). Burns only
      at night, so Day 1's "Start the generator" tip isn't a trap. Starts with one night, holds three;
      cans (one per slot) are in tool chests and car boots until the Fire Station sells them.
- [x] **Window shutters** (`barricades.ts`, `shared/house/barricade.ts`, spec): 30 coins and 5 scrap each, at the
      workbench until the Hardware Store exists (M5). Shamblers break the planks over one, then go for an
      opening they can break, so shutters move the fight rather than end it; Dad breaks them. Also fixed:
      an infected outside that saw a kid it couldn't reach could stand still.
- [x] **Scrap press** (30 coins): 2 scrap makes 3 nails or 8 stones (`shared/economy/recipes.ts`, `crafting.ts`, spec).
      Never better than selling the scrap and buying.
- [x] `shared/economy/pricing.ts` (pure): base prices, +15% per day for scarce goods, want bonus (2×). Spec.
- [x] First two NPC bases: **Treehouse** (kids, Day 2) and **Fire Station** (adult, Day 3), at either
      end of Maple Street (`bases.ts`, `npc.ts`), each with a trader, daily stock and one daily order
      (2–3 of an item at 2×, different for every base; `shared/economy/bases.ts`, spec). A few searched
      containers restock with what's on order each morning, so there's always something to fill them with. Closed at night. Studio: both open from Day 1 (`OpenAllBases`).
      Stone pouch, blueprints, lures and the fire axe come with the things they need (M5).
- [x] Trade UI (`tradeUi.tsx`; the list is shared with the workbench in `shopPanel.tsx`). Clients send
      only a base and an item; `trading.ts` checks day, reach, stock, coins and room.
- [x] **Walkie-talkie** (`walkie.ts`, `walkieUi.tsx`, `shared/economy/walkie.ts`, spec): morning report (Mum on
      Days 1–3, then each base's hello and want), base status, log, popups; Mum's sundown warning. It's
      always on you: no slot, no batteries. Intel on waves waits for waves that pick a side (M5); which
      bases survived and mark meters are M4; the first-timer/returning Mum lines need M7's flag.
- [ ] **Playtest** with friends: do players plan trips around what they want to buy? (And the two open
      ones from M1 and M2.)

## M4 — The Signal takes the adult bases

Goal: the world gets worse on its own. Playtest question: *do distress calls create good
"do we go?" arguments?*

- [ ] `shared/baseMarks.ts` (pure): marks per broadcast, random fall windows per base (Fire
      Station 4–6, Hardware 6–8, Church 10–14). Spec.
- [ ] Mark meters on the walkie.
- [ ] Distress call 1, **"We're under attack!"**: an off-site wave at the base, with a reward.
- [ ] Distress call 2, **"Something's wrong with us…"**: a 60 s grab window, then the base turns.
- [ ] Fallen base → **infected nest**: extra spawns from that direction; taken kids go there.
- [ ] Rescue radio parts (battery pack, tuner, aerial) and where they come from.

## M5 — More infected, weapons and map

Goal: Nights 1–10 as designed in GAMEPLAY.md §9.

- [ ] Infected: **Runner** (N3), **Watcher** (N5), **Mimic** (N7). (A Climber is a possible later addition.)
- [ ] Melee: golf club / hockey stick, crowbar (opens locked loot), fire axe (breaks boarded doors).
- [ ] Ranged: nail gun (shares nails with barricades), crossbow (reusable bolts), **pistol**,
      **hunting rifle**, **submachine gun** (shares pistol ammo), flare gun.
- [ ] **Gun noise**: wakes dormant infected nearby by day; pulls the wave to that side at night.
- [ ] Map: Corner shop, School (lost kids, tuner), Hardware Store, Skate Park, Clinic,
      Gas station, Police Station (armoury), Church (Mum). Areas unlock by night.
- [ ] Remaining bases: Hardware Store, Church, School Gym, Skate Park.
- [ ] Lost kids → escort to a kids' base for coins.

## M6 — Lobby re-theme

Goal: the lobby looks like MARKED. Mostly visual (GAMEPLAY.md §1).

- [ ] Replace the churchyard decor (`decor.ts`, `kitDecor.ts`) with the **school gym hall**.
- [ ] A **parent NPC at each pad**, billboard above them; idle "slightly off" animations; the
      hall's screens glitch and every parent freezes now and then.
- [ ] Countdown end: the parent walks the party out through the doors, fade, teleport.
- [ ] Minimum party size **1**.
- [ ] Delete the last ghost-prototype leftovers: `ritualItems.ts`, `recordWin` in `stats.ts`, the skull,
      book and candles models, and old ghost comments in the lobby's `queue.ts` and `config.ts`.
- [ ] Leaderboards: **best run** and **total nights** (replace *Wins* in `stats.ts` and
      `leaderboard.ts`; player list shows best run).

## M7 — First-run experience

Goal: new players understand the game without a tutorial screen.

- [ ] **Car cutscene** (GAMEPLAY.md §2) on `cutsceneCamera.ts`, synced by server time, on a set
      away from the map. Radio bulletin, Mum's mark, the drive, Dad's red eyes, smash cut, "DAY 1".
- [ ] Hold-to-skip button (PC, touch, gamepad). `IntroDone` remote; the server starts Day 1 when
      everyone is done or its own clock runs out.
- [ ] Per-player **"finished a Night 1"** flag in DataStore. Repeat parties skip straight to a
      "DAY 1" card.
- [ ] First-run hints (board the front door, Maple Street, home before dark); Dad frozen in the
      neighbour's garden; the living-room TV switches on at dusk.

## M8 — Night 10 and beyond

Goal: the endless game.

- [ ] Boss: **The Anchor** (Night 10). Bosses for Nights 20 and 30 (design first).
- [ ] Endless scaling past Night 10 (health +10%/night, wave size, prices, ammo floor).
- [ ] Night events: blackout, fog, double broadcast, all-types night.
- [ ] Kids' bases can be overrun from Night 15.
- [ ] **Rescue call**: radio built → carry it to the radio tower at dusk → hold until dawn →
      run ends as *Rescued*.
- [ ] **Rejoin your run** button in the lobby (and the save decision from the table above).

## M9 — Polish and launch

- [ ] Blender models: more infected (adult rigs with red eyes), weapons, the gym hall props, Mum's car. (The
      family house and the map's tiles: **Map art**.)
- [ ] Audio: the Signal tone, radio bulletin voice-over, infected sounds, gunshots, ambience.
- [ ] Mobile / tablet / console UI pass (touch buttons for every action). Known: on the smallest phones
      the 12-slot rucksack overlaps the message bar a little.
- [ ] Performance pass with a full neighbourhood and 6 players (streaming is off, see AGENTS.md).
- [ ] Experience Questionnaire (expect a 13+ label), thumbnails, icon, description.
- [ ] Publish both places; wire place IDs (`src/shared/core/placeIds.ts`).

---

## Backlog

Not tied to a milestone yet.

- [x] **Rework the on-screen UI** ("too much pops up, all the time", playtest 24 Nov 2026): one message
      bar (`shared/core/messages.ts`), fewer messages and "+3 Nails" (`shared/items/gains.ts`), quieter phase
      changes (`shared/run/announce.ts`), and a phone layout (`shared/items/slotLayout.ts`). All with specs.
- [x] **Code tidy and the power fix**: shared panel, colours, sounds and prompt times; the generator only
      counts for a wave once it's been on 20s (`powerCounts` in `shared/infected/waves.ts`, spec).
- [ ] Better prices at a base for filling its orders (in GAMEPLAY §7, not built).

---

## Risks to watch

- **Infected AI cost.** Pathfinding for many NPCs on one server is the most likely performance
  problem. Keep path recomputes throttled, use simple steering once in line of sight, and cap
  live infected per night.
- **Run length.** Endless runs at ~7 min per night make disconnects painful. Rejoin (M8) may need
  to come earlier if playtests show long runs.
- **Content rating.** Kids killing (infected) adults, and adults taking kids. Keep it stylised:
  static, no blood, "taken" not "eaten".
- **Scope.** M5 is very big, so the first public test comes before most of it (see Order of work).
- **Two sessions in one folder.** Art and code work share this branch. Commit by path, or use a git
  worktree.
