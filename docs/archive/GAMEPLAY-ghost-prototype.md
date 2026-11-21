# Gameplay

A spooky asymmetric horror game: a team of **hunters** tries to banish one invisible
**ghost** before the ghost gets them.

> Status: design doc. Sections marked **Proposal** are ideas still to be decided.

## Round flow

1. **Lobby — form a team.** Players stand on a teleport pad together. When the pad's
   countdown finishes, everyone on it is teleported into the main game as one team
   (see [README → The lobby](README.md#the-lobby)).
2. **Pick the ghost.** Once the team has arrived, the server picks one player at random to
   be the ghost. Everyone else is a hunter. Parties are 2–6 players (configurable).
3. **Hunt.** Hunters explore the map, find keys, unlock the ritual items, and track the
   ghost. The ghost hunts them back.
4. **Banish or be haunted.** The round ends when the hunters complete the banishing ritual
   (hunters win) or a ghost win condition is met (ghost wins).

## Roles

### The ghost

- **Invisible** to hunters by default. Their character is hidden, and they make no
  footsteps.
- Only revealed by a **ghost trap** or a **flashlight beam** (see below).
- Can't pick up keys or ritual items.

### Hunters

Each hunter spawns with:

- **Flashlight:** shining the beam on the ghost reveals them for as long as the beam
  stays on them.
- **Ghost traps:** 2 per hunter per round, set on the floor from the hotbar. When the ghost
  comes within 6 studs the trap snaps: the ghost is revealed and slowed to half speed for
  4 seconds, and every hunter is told. Traps glow dimly, so a careful ghost can avoid them.

## Sanity

Each hunter has **sanity**, 100 (calm) to 0 (terrified), shown as a meter; the screen
loses colour, darkens at the edges and finally blurs as it drops. Per second:

| Situation                              | Change   |
| -------------------------------------- | -------- |
| Alone in the dark                      | −0.8     |
| Near a working lamp *or* another hunter | +0.5     |
| Near a lamp *and* another hunter        | +1.5     |
| The ghost within ~14 studs (seen or not) | extra −1.2 |

So a lone hunter empties in about two minutes, and the ghost's presence can be *felt*.
Rules live in `src/shared/sanity.ts`.

### Panic

At **0 sanity** a hunter **panics** until they recover to ~20: their flashlight dies and won't
switch on, they move at ~70% speed, and they **scream** — loud enough to carry across the house,
so the ghost knows where a helpless hunter is and teammates know who needs rescuing. Panic doesn't
take a hunter out by itself: the ghost still has to act (see grab, below).

Panic and low sanity set up the ghost's kill: below **30** sanity a hunter is **vulnerable** to the
ghost's knife (see Scream & combat).

## Spooks (the ghost's abilities)

The ghost holds up to **3 spook charges** — it starts the hunt with 2 and regains one every
40 seconds — with a few seconds between spooks. Keys Q / F, or the on-screen buttons.

**Fear feeds the ghost:** scaring hunters pulls the next charge closer, so an active ghost
spooks far more often than one that waits: 8s per hunter a scream hits, 10s when a hunter
starts panicking, 10s per knife hit, 15s per kill. A big enough scare charges a spook at once
(the rest carries over). Wasted while at max charges.

- **Scream:** every hunter within ~15 studs (walls don't stop sound) loses 25 sanity, and the
  ghost **shows itself for 6 seconds**: its only chance to use the knife, and the hunters' chance
  to strike back.
- **Lights out:** the nearest working lamp stutters, pops and goes dark for 10 seconds — no light,
  and no sanity comfort under it. Needs a lit lamp within ~20 studs; otherwise no charge is used.

So the ghost's loop is: isolate a hunter, kill the light, scream, and let the dark do the rest.

## Scream & combat

- **Scream to attack:** there's no separate "become visible" button. Every attack starts with a
  scream, so it costs a spook charge, scares everyone nearby, and gives the ghost away.
- **Knife (ghost):** works **only in the 6 seconds after a scream**, while the ghost is visible,
  so hunters always see the attack coming. A
  hunter **below 30 sanity** is **killed** — out for the round, spectating the living hunters
  (never the ghost). Anyone else just loses 20 sanity.
- **Fire poker (hunters):** hurts the ghost **only while it's visible** — revealed by a flashlight,
  a trap, or its own scream. The ghost has 100 health (20 per hit) and is briefly
  slowed when hit.

So the flashlight and traps find the ghost, a teammate can strike while it's lit, and the ghost has
to risk exposing itself to kill.

**Feel:** holding a weapon turns you to face the camera, a click slashes at what's in front of you
(a 120° arc), and hits are judged from what you saw on your screen (checked by the server, with
allowance for lag). A hit marker (four ticks around the crosshair) confirms a hit; being struck flashes your screen red.

## Win conditions

| Hunters win if…                        | The ghost wins if…               |
| -------------------------------------- | -------------------------------- |
| they complete the banishing ritual     | every hunter is dead             |
| they destroy the ghost (health 0)      | the clock runs out (8 minutes)   |

## Objective: banish the ghost

Three ritual items are locked away in chests around the house:

| Item       | Where                                  |
| ---------- | -------------------------------------- |
| 📖 Book    | a locked chest in a random room        |
| 🕯️ Candles | a locked chest in another room         |
| 💀 Skull   | a locked chest in a third room         |

- **Keys** (one per chest, plus a spare) are scattered on floors and low furniture, glowing
  faintly gold. Any key opens any chest; opening one uses the key up.
- Chests are never in either start room (hunters' or ghost's) or the ritual room.
- Hunters **carry** what they pick up. If a hunter resets or leaves, everything they carry
  drops where they stood.
- The **altar** in the centre room: hunters place carried items on it. With all three
  placed, a hunter **holds "Banish the ghost" for 10 seconds** — the hunters win.
- **The banishing:** everyone freezes and every camera swings round the altar. A column of pale
  light bursts up, the ghost is dragged into it (visible, screaming), rises spinning and
  writhing, then a blinding flash dissolves it into sparks. About 6 seconds, then the end screen.
- The ghost can't touch keys, chests, items or the altar.

## End of the round

A **scoreboard** for 15 seconds: a card per player with their avatar, a **fun title** and a few
stats. The ghost's card comes first, so everyone finds out who it was. **Back to lobby** skips
the wait, and the title floats above your head in the lobby until you play again (up to an hour).

| Hunter title | For | Ghost title | For |
|---|---|---|---|
| The Banisher | held the final banish | The Reaper | killed every hunter |
| Ghostbuster | landed the final poker blow | Untouchable | never got hit |
| First to Fall | killed first | Banshee | 3+ scream hits |
| Spotlight | most time lighting the ghost (3s+) | Blackout | 3+ lamps put out |
| Locksmith | most chests opened | Phantom | won (default) |
| Trapper | caught the ghost in a trap | Lost Soul | lost (default) |
| Scaredy Cat | panicked the most | | |
| Survivor / Haunted | default (alive / dead) | | |

Each hunter title goes to one player, in that order, so nobody gets two and the top honours go
first.

## The clock

After a 5-second "get ready" countdown (everyone frozen), the hunt has a **time limit**
(8 min by default; `RoundSeconds` in `src/main/server/config.ts`). If the ghost is still around
when time runs out, **the ghost wins** — so even a ghost that never kills can win by slowing the
hunters down, scaring them apart and keeping them from the ritual.

### Ideas not chosen yet

- **Disrupt the ritual.** Interrupting the banishing scatters the items back around the
  map, costing the hunters time.

## Backlog

### Next up (resume here)

- **More for the ghost to do (playtest: "boring for the ghost").** ~~Scares speed up
  recharge~~ (done: "Fear feeds the ghost"). If still dull after testing: recharge faster while
  unseen and far from light; a higher max late in the round; new spooks (slam a door, knock an
  item out of a hunter's hands, fake footsteps).
- **Test pass: scream knife, fire poker, death & spectating** — built and committed but not
  yet fully playtested. Use README → Regression test checklist → "Scream, knife & death" and
  "Fire poker".
- **Move server-only model templates to ServerStorage.** Skull, book and candles are only cloned
  by the server, so clients needn't download them; only `LightCone` must stay in
  ReplicatedStorage (clients clone it). Update the project files and `findMeshAsset`.
- **Clone pre-built templates instead of building with `Instance.new()`:** keys, chests, ghost
  traps and the three hunter tools (flashlight, trap, poker) plus the knife. Make them models
  (Studio or Blender), keep them as templates, and have code only place them and add behaviour.
- **Wins anti-farming + ranking repair:** with a 2-player minimum, wins can be farmed with a
  second account — only count wins from rounds with 3+ players and/or a minimum length. Also
  copy each player's total into the ranking store on lobby join, in case a ranking write failed.
- **Swing animations and real sounds:** tools have no swing animation yet; the scream, wail,
  bulb pop, trap ping and sword sounds are built-in placeholders.

### Lobby polish (parked to focus on the main game)

- **Blender hero props** to replace the runtime blockouts in `src/lobby/server/decor.ts`:
  chapel ruins (Gothic arches, broken edges, bell tower), dead trees (one twisted tapering
  trunk — `lib/sdf.py` suits this), and the iron gate (curled ironwork).
- **Ambient sound:** wind loop, a distant bell when a countdown starts, gate creak. Needs
  audio asset IDs from the Creator Store.
- **Ghost wisp:** an invisible wisp drifting round the graveyard that only shows in a
  flashlight beam — teaches the core mechanic while players wait. Build after the main
  game's flashlight, and reuse it.
- **Lower-poly skull:** it's ~4000 tris; ~1500 would do for a 1-stud prop (needs a re-upload).

### Gameplay

- **Ghost threat (agreed design), build in order:** ~~ghost traps~~ (done) → ~~sanity meter~~ (done) → ~~panic~~ (done) →
  ~~spooks~~ (done) →
  ~~Manifest + knife (Manifest later folded into Scream), fire poker, ghost health, death & spectating~~ (done).
- ~~**End-of-round scoreboard**~~ (done: cards with titles and stats, Back to lobby, titles
  over heads in the lobby).
- **Hand-built main map (and lobby):** once gameplay settles, build the house in Studio, save it
  to the repo as a model file, and mark spawn spots with tagged invisible parts (KeySpawn,
  ChestSpawn, RitualSite) that the code picks from. Static layouts are currently generated at
  runtime with a fixed seed (~900 parts in the lobby, ~150 in the house — fine for performance,
  but edit-time layouts are easier to art-direct).
- **Engine-level tests in Studio (option A):** `@rbxts/jest` run inside Studio, ideally via the
  Studio MCP connected to Claude Code so the agent can run them. Targets the real systems: reveal
  raycasts through walls, traps, objectives (key → chest → altar), lobby party states, the
  main-server wiring. ~Half a day to set up. (Pure-logic unit tests with Lune are done: `npm test`.)
- **One shared game tick (not now):** flashlight reveals, traps, sanity, spooks and objectives
  each run their own Heartbeat loop. Fine as long as no system depends on another's timing; merge
  them into one ordered tick only if that changes.
- **Ghost boost (Robux).** A paid Developer Product that raises a player's chance of being
  picked as the ghost in their next round. Must be enforced server-side: the purchase is
  granted via `ProcessReceipt`, stored server-side, and read by the ghost selection on the
  main server — never trusted from the client.

## Balancing levers

Knobs to tune once it's playable:

- Flashlight **battery** (drains while on, recharges or needs pickups).
- Number of **traps** per hunter, and how long a trap reveals the ghost.
- Ghost **attack cooldown** and how long they're revealed after attacking.
- Round **time limit**, and number of keys vs. locks (spare keys, decoys).
- Ghost **speed** vs. hunter speed.

## Open questions

- Does a haunted hunter spectate, or come back as a weaker helper for the ghost?
- Are item locations fixed, or randomised each round?
- Can the ghost interact with the world (slam doors, flicker lights, move keys)?
