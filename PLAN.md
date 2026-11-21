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
- Car cutscene (first run only, skippable) ends on Dad's red eyes; repeat runs go straight into
  Day 1. Night 1 is forgiving.
- Lobby: school gym hall, a parent NPC at each pad. Leaderboards: best run + total nights.

### Still open — decide by the milestone shown

| Question | Needed by | Recommendation |
|---|---|---|
| **What does a live screen in the house do at the broadcast?** No adults are inside, so the design doesn't say yet. | M1 | It's a **beacon**: tonight's waves are bigger and go for that room first. Keeps "unplug the screens" and the generator choice meaningful. |
| Scale waves with party size? | M1 | Yes: wave size × (0.6 + 0.2 × kids), so solo is playable and 6 is chaos. |
| Does each kid own their weapons, or is there a shared locker? | M2 | Each kid owns what they carry; a **weapon locker** at home for sharing. |
| Save a run between sessions? Rejoin a run after disconnecting? | M8 | Rejoin yes (lobby button, M8). Saving whole runs: decide after playtests show how long runs actually last. |
| Kid classes (Builder / Scout / Medic / Techie)? | After M5 | Not for now; revisit if runs feel samey. |

---

## M0 — Snapshot and strip the prototype

Goal: a clean base that still compiles, lints and passes tests, with only the generic parts left.

- [ ] **Commit the prototype first** (nothing is committed yet) and tag it `ghost-prototype`, so
      everything we delete stays recoverable.
- [ ] Remove ghost-only code: `spooks.ts`, `ghostVisibility.ts`, `sanity.ts`, `panic.ts`,
      `banishing.ts` (keep its camera rig, see below), `objectives.ts` (ritual), server and shared;
      client `ghostHud.tsx`, `ghostSelf.ts`, `sanityHud.tsx`, `objectiveHud.tsx`, `roleBanner.tsx`;
      shared `ghost.ts`, `sanity.ts`, `spooks.ts`, `ritualItems.ts`, `objectives.ts`, and their
      remotes, config values and specs.
- [ ] Keep and generalise:
  - `banishCamera.ts` → `cutsceneCamera.ts` (a reusable camera-shot player).
  - `melee.ts` / `combat.ts` → melee against **NPC targets** (drop the ghost/hunter rules; keep
    client-picked hits + server re-check, hit markers, damage flash).
  - `flashlight.ts` → beam + cone check (becomes the stun in M1).
  - `roles.ts` → party membership only (everyone is a kid); `teams.ts` → "living kids".
  - `round.ts` → replaced by the run/phase clock in M1.
  - `roundEnd.ts`, `roundStats.ts`, `scoreboard.ts`, `endScreen.tsx` → end-of-run screen.
  - Party handoff, gatekeeper, admission, safe teleport, stats/leaderboard: unchanged.
- [ ] Rename `package.json` `name` to `marked`.
- [ ] `npm run lint` and `npm test` pass; Studio Play loads the house and nothing errors.

## M1 — Vertical slice: one night in the house

Goal: **Day → Dusk → Night → Dawn, repeating**, in a single house, with real attacks.
Playtest question: *is holding the house fun, with 1 player and with 4?*

**Phase clock**
- [ ] `shared/phases.ts` (pure): phase lengths per night, next phase, time left, night number.
      Spec.
- [ ] Server `run.ts`: drives the clock, publishes phase/night/time to a client store; `resync`.
- [ ] HUD: "NIGHT 3 · Dusk · 0:32" plus a warning before dusk.

**The house**
- [ ] Rebuild `src/main/server/world.ts` as a two-storey house blockout: living room, kitchen,
      garage, 2 bedrooms, bathroom, basement (spawn), attic. Front, back and garage doors,
      ~6 windows.
- [ ] Tag entry points (`BarricadeSlot`), infected spawns outside (`InfectedSpawn`), screens
      (`Screen`), lights (`HouseLight`), the generator and workbench.
- [ ] Generator on/off prompt; house lights follow it.

**Barricades**
- [ ] `shared/barricade.ts` (pure): plank health, damage, repair, breach. Spec.
- [ ] Server `barricades.ts`: hold-to-nail prompts, plank count per kid, plank visuals per slot.
- [ ] Plank pile in the garage (refills a little each dawn, for now).

**The infected**
- [ ] Server `infected.ts`: spawn, PathfindingService to the nearest barricade, attack planks;
      once inside, chase the nearest kid; hit for damage. Red glowing eyes.
- [ ] Health + damage on the server; death = **static dissolve** effect (client VFX from a tag).
- [ ] **Dad**: a named shambler who is knocked down, never killed, and returns the next night.
- [ ] `shared/waves.ts` (pure): wave composition from night number and party size. Spec.

**Kids**
- [ ] Health 100 (server-owned), damage flash (reuse `combatFeedback.tsx`), heal to full at dawn.
- [ ] **Taken** at 0: spectate (reuse `spectate.tsx`), back in the basement at dawn. The run ends
      when every kid is taken at once.
- [ ] **Baseball bat** (melee from M0) and **slingshot**: client aims, server validates (range,
      line of sight, rate). `shared/ranged.ts` validation is pure, with a spec. Stones as ammo.
- [ ] Flashlight stun (~2 s) on infected.

**Screens and the broadcast**
- [ ] 1–3 house screens switch on at dusk; prompt to unplug or smash.
- [ ] Broadcast at dusk + 0:30 (sound, flicker). Live screens act as beacons (pending the M1
      decision above).

**Night 1 rules**
- [ ] Forgiving: 2 small waves, half damage, double plank health, 15 s taken timer, the run
      can't end.

**Wrap-up**
- [ ] Dawn summary card (planks lost, taken, nights survived).
- [ ] End-of-run screen with nights survived and the first titles (Carpenter, Slugger, Survivor).
- [ ] README: new main-game section + regression checklist.

## M2 — Day: Maple Street, loot and coins

Goal: a reason to leave the house. Playtest question: *is the day tense, and does the walk home
at dusk feel risky?*

- [ ] Neighbourhood blockout: home + 4–5 houses on Maple Street, gardens, the street.
- [ ] Loot containers (cupboards, drawers, car boots) on tagged spawns. `shared/loot.ts` (pure):
      weighted tables that scale by night (ammo falls to 40% by Night 10, 25% by Night 20). Spec.
- [ ] **Looted stays looted** for the run.
- [ ] Inventory (server-owned): planks, nails, stones, ammo, coins, items; carry limit; drop all
      on taken. Hotbar + small inventory UI.
- [ ] **Coins**: pickups, +5 per kid at dawn, store + HUD counter.
- [ ] Dormant infected in front of screens by day; noise and flashlight wake them.
- [ ] "Sun's going down" warning, streetlights at 2:00.

## M3 — Workbench, trading and the walkie-talkie

Goal: a reason to spend coins. Playtest question: *do players plan trips around what they want
to buy?*

- [ ] Workbench upgrades (reinforced planks, door bar, bigger backpack, generator tune-up,
      shutters, scrap press). Bought on the server; state goes to the client stores.
- [ ] `shared/pricing.ts` (pure): base prices, +15% per night for ammo, want-list bonuses. Spec.
- [ ] First two NPC bases: **Treehouse** (kids) and **Fire Station** (adult), each with a trader
      prompt, stock and a daily want list.
- [ ] Trade UI (react), purchases validated on the server (coins, stock, distance to the trader).
- [ ] **Walkie-talkie** UI: morning report, base status, messages log.

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
