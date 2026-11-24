# PLAN — building MARKED

How we get from the ghost-hunt prototype to the game in [GAMEPLAY.md](GAMEPLAY.md).

- Work **in milestone order**. Each milestone ends with something playable and a **playtest
  question**. If the answer is "no", fix the design before building more on top of it.
- Tick tasks off (`[x]`) as they land; add notes where the plan changed.
- Every gameplay number goes in `src/main/server/config.ts` (or `src/lobby/server/config.ts`).
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

### Still open — decide by the milestone shown

| Question | Needed by | Recommendation |
|---|---|---|
| Scale waves with party size? | M1 | Yes: wave size × (0.6 + 0.2 × kids), so solo is playable and 6 is chaos. |
| Does each kid own their weapons, or is there a shared locker? | M2 | Each kid owns what they carry; a **weapon locker** at home for sharing. |
| Save a run between sessions? Rejoin a run after disconnecting? | M8 | Rejoin yes (lobby button, M8). Saving whole runs: decide after playtests show how long runs actually last. |
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
- [x] `shared/phases.ts` (pure): next phase, night number, nights survived, titles. Spec.
- [x] Server `round.ts` drives the clock and publishes phase/night/end time/nights survived as
      ReplicatedStorage attributes (no per-player messages, so nothing to `resync`).
- [x] HUD: "NIGHT 3 · 1:12" (red in the last 10s of day/dusk), a big banner + hint on each
      phase change, "SURVIVED N NIGHTS" on the end screen.
- [x] The 5 s countdown became a "DAY 1" title card (frozen, 4 s).
- [x] Per-phase lighting blends (`lighting.ts`). Studio phase lengths 40/20/60/15 s.

**The house**
- [x] Rebuild `src/main/server/world.ts` as a two-storey house blockout: living room, dining
      room, kitchen, garage, hall; upstairs 2 bedrooms, parents' room, bathroom; basement (spawn).
      Front, back and garage doors, 6 ground-floor windows (open gaps, low sills), glazed upstairs
      windows; garden, street, driveway. No attic (no Climber yet). Wall cutting is pure
      (`shared/walls.ts`, spec).
- [x] Tag entry points (`BarricadeSlot`, with `Kind`), infected spawns outside
      (`InfectedSpawn`), the TV (`Screen`), lights (`HouseLight`), generator, workbench, plank
      pile.
- [x] Generator on/off prompt (starts off); house lights follow it; off = waves 1.4× bigger (never
      on Night 1). Fuel in M3.

**Barricades** ✅
- [x] `shared/barricade.ts` (pure): plank health, add/remove, damage (one plank per hit),
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
- [x] `shared/waves.ts` (pure): Night 1 = Dad + 1, then 2; later nights 3 growing waves, scaled
      by party size (0.6 + 0.2 × kids). Health +10% a night. Spec.
- [x] Deleted `practiceDummy.ts`.

**Kids**
- [x] Health 100 (server-owned Humanoid, no regeneration), red flash when hit, healed at dawn.
- [x] **Taken** at 0: spectate, back in the basement at dawn (15 s on Night 1). The run ends
      when every kid is taken at once (never on Night 1).
- [x] **Slingshot**: the client sends only its aim direction; the server validates it and casts
      the shot itself from the kid's head (10 damage, 80 studs, 0.6 s). 20 stones, +10 at dawn
      (max 20) until M2 loot. `shared/ranged.ts` (pure). Spec. Camera-facing shared with the bat
      (`client/faceCamera.ts`).
- [x] **Flashlight stun**: a beam held 0.6 s stuns an infected for 2 s (eyes dim), then 5 s
      immune. `shared/stun.ts` (pure). Spec.

**Screens and the broadcast** — dropped from the house; the broadcast arrives with the adult bases
in M4.

**Night 1 rules** ✅
- [x] Forgiving: 2 small waves, half damage, double plank health, 15 s taken timer, the run
      can't end.
- [x] Tips under the clock on Day 1 / Night 1: planks, boarding, generator, where they're
      attacking, how to fight. `shared/hints.ts` (pure). Spec. (Shown to everyone until M7's
      "finished a Night 1" flag.)

**Wrap-up**
- [x] Dawn summary card (infected downed, planks lost, who was taken). `shared/nightSummary.ts`
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
      ones tagged. `shared/loot.ts` (pure): weighted tables, nails 40% by Night 10, 25% by Night 20.
      Spec.
- [x] **Looted stays looted** for the run; garden stones come back at dawn.
- [x] **Slot inventory** (`inventory.ts`): 5 slots of stacks; coins and the starter tools
      (flashlight, bat, slingshot) don't use slots, or there'd be no room left. `shared/inventory.ts`
      (pure). Spec. Nailing a plank now costs a nail; stones come from here; medkits heal 50.
- [x] Inventory UI down the right edge: tap a slot for Drop / Use. Dropped stacks can be picked up;
      a taken kid leaves everything where they were (but keeps their coins).
- [x] **Coins** (`coins.ts`): found, +5 per kid still in at dawn, HUD counter.
- [x] **Dormant infected** in front of screens by day: crossing in front, bumping, a beam, noise
      (searching nearby, bat swings) or a hit wakes them (`shared/wake.ts`, spec). They give up 70
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

## M3 — Workbench, trading and the walkie-talkie

Goal: a reason to spend coins. Playtest question: *do players plan trips around what they want
to buy?*

- [x] **Workbench** (`workbench.ts`, `shared/upgrades.ts`, spec): reinforced planks (1.5×), door bar
      (4th plank, 2×), school (8 slots) and hiking (12) rucksacks. Party upgrades are shared, whoever
      pays; rucksacks are personal. List UI scales to small screens.
- [x] **Generator fuel** (`shared/fuel.ts`, spec) and the tune-up (half the burn, 35 coins). Burns only
      at night, so Day 1's "Start the generator" tip isn't a trap. Starts with one night, holds three;
      cans (one per slot) are in tool chests and car boots until the Fire Station sells them.
- [ ] More workbench upgrades: shutters, scrap press.
- [x] `shared/pricing.ts` (pure): base prices, +15% per day for scarce goods, want bonus (2×). Spec.
- [x] First two NPC bases: **Treehouse** (kids, Day 2) and **Fire Station** (adult, Day 3), at either
      end of Maple Street (`bases.ts`, `npc.ts`), each with a trader, daily stock and one daily order
      (2–3 of an item at 2×, different for every base; `shared/bases.ts`, spec). A few searched
      containers restock with what's on order each morning, so there's always something to fill them with. Closed at night. Studio: both open from Day 1 (`OpenAllBases`).
      Stone pouch, blueprints, lures and the fire axe come with the things they need (M5).
- [x] Trade UI (`tradeUi.tsx`; the list is shared with the workbench in `shopPanel.tsx`). Clients send
      only a base and an item; `trading.ts` checks day, reach, stock, coins and room.
- [x] **Walkie-talkie** (`walkie.ts`, `walkieUi.tsx`, `shared/walkie.ts`, spec): morning report (Mum on
      Days 1–3, then each base's hello and want), base status, log, popups; Mum's sundown warning. It's
      always on you: no slot, no batteries. Intel on waves waits for waves that pick a side (M5); which
      bases survived and mark meters are M4; the first-timer/returning Mum lines need M7's flag.

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
- [ ] Map: Corner shop, Treehouse, School (lost kids, tuner), Hardware Store, Skate Park, Clinic,
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

- [ ] Blender models: the house, infected (adult rigs with red eyes), weapons, the gym hall props,
      Mum's car.
- [ ] Audio: the Signal tone, radio bulletin voice-over, infected sounds, gunshots, ambience.
- [ ] Mobile / tablet / console UI pass (touch buttons for every action).
- [ ] Performance pass with a full neighbourhood and 6 players (streaming is off, see AGENTS.md).
- [ ] Experience Questionnaire (expect a 13+ label), thumbnails, icon, description.
- [ ] Publish both places; wire place IDs (`src/shared/placeIds.ts`).

---

## Backlog

Not tied to a milestone yet.

- [ ] **Rework the on-screen UI**, step by step: 1 one message bar (`shared/messages.ts`, spec;
      `messageQueue.ts`, `messageBar.tsx`) done; 2 say less (`shared/gains.ts`, spec: "+3 Nails" instead
      of a message for every search; no messages for what the lights or prompts show) done; 3 phase banners and dawn card (`shared/announce.ts`, spec) built; 4 the
      always-on parts. The note it came from:
      **too much pops up, all the time** (playtest, 24 Nov 2026). Best done
      before M4 adds distress calls. What shows today:
  - Always: clock, inventory and coins, walkie button, Night 1 tips (until Day 2).
  - Every phase change: a big banner and chime (3s). Dawn adds the dawn card (10s) under it.
  - Every morning: walkie popups one after another, 5s each with a sound. One to four a morning
    in a normal run, more with every base added.
  - Notices (3s each, and a new one replaces the last): every search, refusals ("Your pockets are
    full."), and to **everyone**: power on/off, refuelling, low/out of fuel, upgrades bought, an
    opening broken, a kid taken.
  - Starting points: one queue that decides what shows and when, with priorities (danger first);
    one walkie popup per morning ("3 new messages") with the rest in the log; things only one kid
    did told only to that kid; search finds shown by the inventory instead of a notice.
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
- **Scope.** M5 is big. If time is short, ship the first public test after **M4 + M6 + M7** with
  Nights 1–5 content only.
