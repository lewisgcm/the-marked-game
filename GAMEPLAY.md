# Gameplay — MARKED

A co-op horror survival game. A broadcast called **the Signal** is spreading through every
screen, phone and radio. It only affects **adults**: each exposure leaves a **mark**, and at
**three marks** they turn — and come for the children. You and your friends are kids. Hold the
house, scavenge the neighbourhood, trade with the bases that are still standing, and survive as many
nights as you can. Every night is harder than the last, and there's no last night.

> Status: **design doc, under review.** Everything here is a proposal; numbers are first guesses
> to tune in playtests. The earlier ghost-hunt design (whose systems we reuse) is archived in
> [docs/archive/GAMEPLAY-ghost-prototype.md](docs/archive/GAMEPLAY-ghost-prototype.md).

## Core rules (the whole game in five lines)

1. **Only adults can be infected.** Screens and radios give them marks; 3 marks and they turn.
2. **Kids can fight back** — with improvised weapons and ammo that gets harder to find every night.
3. **Day:** go out, scavenge, trade. **Night:** get home and hold the barricades.
4. **Power is a trade-off:** the generator gives light and keeps the infected wary, but it burns
   fuel.
5. **Survive as long as you can.** The run is endless and keeps getting harder. Your score is
   nights survived. From Night 10 you can call for rescue to end the run on your own terms.

## The player journey

```
Lobby (school gym hall)    ──► Intro cutscene (drive home, Dad turns) ──► Day 1
                                                                          │
                     ┌────────────────────────────────────────────────────┘
                     ▼
        ┌─► Day ──► Dusk (broadcast) ──► Night (hold the house) ──► Dawn (upgrade) ─┐
        └────────────────────────── every night harder, no limit ──────────────────────┘
                                                                          │
                              Everyone taken, or rescue called (Night 10+) ──► End screen ──► Lobby
```

---

## 1. Lobby — the school gym hall

The lobby is the **school gym hall after the last bell**: kids waiting to be picked up. It works
exactly like the current lobby (pads, host, party size, countdown, teleport); this is mostly a
**visual redesign** of the old churchyard.

**The hall:** polished wooden floor with court lines, climbing wall bars, stacked crash mats,
basketball hoops, rows of school bags and lost-property coats along the walls. Late-afternoon
light slants in through high windows; a few strip lights buzz and flicker. The stage at the far
end holds the noticeboard.

**The portals:** the pads sit along the open double doors to the car park. A **parent NPC stands
at each one** waiting for their kids — Mum with car keys, a dad holding a coat, a parent tapping at
a phone. Each pad's `BillboardGui` (player count, countdown) floats above that parent.

- Walk onto a parent's pad to join their party. The first player is the **host** and picks the
  party size.
- **Party size 1–6.** Solo is allowed — it's co-op now, there's no second role to fill. (Old
  minimum was 2 because of the ghost.)
- When the countdown ends the parent turns and **leads the kids out through the doors** (fade to
  black), and the party is teleported. The intro cutscene opens in the back of that parent's car.
- **Foreshadowing while you wait:** the parents are just slightly off. One stares at a phone
  without blinking and doesn't react to anyone; another twitches when the hall's TV (a news ticker
  on a trolley) glitches. Now and then every screen in the hall flickers at once, and all the
  parents freeze for a second before carrying on. Never explained — it pays off in the cutscene.
- **Noticeboard leaderboard** (on the stage), two boards side by side:
  - **Best run:** most nights survived in a single run.
  - **Total nights:** nights survived across all your runs, all time.

  Both are saved per player with DataStore (replacing today's *Wins*). The player list shows
  your best run. Titles from your last run float over your head (existing system).
- Same server-authoritative party handoff as today (MemoryStore, SafeTeleport). The only logic
  changes: minimum party size 1, and the parent NPC + door-exit animation. Pad positions, sizes and
  counts stay in `src/lobby/server/config.ts`.

## 2. Intro cutscene — the drive home (~75 s)

Plays on the main-game server **while the party is still arriving** (it hides the
`ArrivalTimeout` wait). Every player sees it from their own seat in the back of the car, kept in
sync by server time. The car is a separate set away from the playable map.

| Time | Shot | Notes |
|---|---|---|
| 0:00 | Back seat, Mum driving. Small talk about school. Rain on the windows. | Party kids are siblings/friends on the school run (minivan seats up to 6). |
| 0:10 | Radio music cuts to a **news bulletin**: reports of adults "freezing in front of screens", hospitals overwhelmed, "do not watch the broadcast". | The voice-over teaches the premise. |
| 0:25 | Under the newsreader, a **low warped tone** — the Signal. The screen glitches for a frame. **Mum flinches, rubs her temple.** A mark-shaped glitch flashes over her. | First mark shown, no text needed. Mum now has 1 mark. |
| 0:35 | Mum snaps the radio off. Out of the window: a man standing still in front of a shop-window TV; a phone glowing in an empty parked car. | |
| 0:50 | The car pulls onto your street. The house, lights on, TV flickering behind the curtains. | |
| 0:55 | The car stops on the drive. Mum: "Go on in, tell Dad dinner's at six." | |
| 1:00 | Through the front window: **Dad on the sofa**, lit by the TV, two glitch marks on his face. The TV flares. The third mark lands: his head twitches. | Same broadcast as the radio: it's the Signal. |
| 1:05 | Dad's head **slowly turns** to the window, toward the car. **Red eyes.** | Red eyes = infected, from here on. |
| 1:10 | **Smash cut to black.** Over the black: Mum shouting "Out! Basement, now!", running feet, a door slams. | |
| 1:15 | **"DAY 1"**, then the game starts. | |

- **Only on your first run.** Once you've finished a run's Night 1, the cutscene never plays for
  you again (saved per player) — see [Repeat runs](#repeat-runs-straight-into-day-1).
- **Skip button:** a **Skip** button in the bottom-right corner for first-timers who'd rather
  jump in (on PC, phone, tablet and console).
  - **Hold to skip** (about 1 s, with a fill ring) so a stray tap doesn't skip it by accident.
  - Skipping is **per player**: you skip your own screen, not the party's. Skipped players see the
    **"DAY 1"** card with "Waiting for 2 others…" until everyone has finished or skipped and the
    whole party has arrived. Then Day 1 starts for everyone at once.
  - The client tells the server it's done (`IntroDone` in `shared/remotes.ts`). The server only
    uses it to start Day 1, and it ignores repeats and players outside the party. If a client
    never sends it, the server treats the cutscene as finished when its own clock runs out.
- Built on the camera rig from the banishing cutscene (`banishCamera.ts`).

## 3. Starting a run

**Rule: a new run should be playable within seconds for anyone who's played before.** The story
is all in the cutscene (§2), which plays once per player. There's no separate arrival scene.

- **First run:** the car cutscene (~75 s, skippable) ends on Dad's red eyes → "DAY 1".
- **Repeat runs** (everyone in the party has finished a Night 1 before): no cutscene. A
  **"DAY 1"** title card covers the few seconds while the party arrives. **Lobby to playing:
  about 5–10 seconds**, plus the teleport.

Either way, everyone starts Day 1 **in the basement** in morning light, bat and slingshot in hand.

### Day 1 (every run)

A normal 3-minute day. Every kid starts with the **baseball bat** and **slingshot**, and the front
door is unboarded.

- **First-timers** get Mum's walkie line in full (*"I locked him out. Don't let any grown-up near
  a screen — three times and they're gone. I'm at the church. Board up the house before dark."*)
  and **hints**, not a checklist: board the front door, try Maple Street, be home before dark.
  Hints never block anything and switch off once you've finished a Night 1. Returning players
  get just *"Board up the house before dark. I'll call you."*
- **Dad** stands frozen in the neighbour's front garden, staring at their TV through the window —
  the first dormant infected players see.

### Night 1 — very forgiving

The first night is for learning to hold the house, not for losing:

- **Two small waves:** Dad plus 2–3 shamblers. No other infected types.
- Shamblers do **half damage** and planks have **double health**.
- On-screen hints: where they're attacking, how to repair, when to swing.
- A taken kid is back in the basement after **15 seconds** instead of at dawn.
- **The run can't end on Night 1.**

Dad stays the familiar first infected — he's always around the house in early nights.

## 4. The main loop — one night, minute by minute

One cycle of **Day → Dusk → Night → Dawn ≈ 7 minutes**, so 10 nights ≈ 75 minutes including
the intro. Runs have no time limit.

### ☀️ Day — 3:00 — scavenge & trade

| Time | What happens |
|---|---|
| 0:00 | **Morning walkie report** (Mum + other bases): today's base **want lists**, intel ("runners came from the east"), any new place unlocked. |
| 0:00–2:30 | Free roam. Leave the house to scavenge and trade. Dormant infected stand frozen in front of screens in other houses — sneak, don't wake them. |
| 2:00 | Walkie: *"Sun's going down, get home."* Streetlights flicker on. |
| 2:30 | Sky turns orange; dormant infected start to stir. Anyone still far away is in trouble. |

### 🌆 Dusk — 0:45 — the broadcast

| Time | What happens |
|---|---|
| 0:00 | Kids should be home. Last chance to **barricade**, and choose the **generator** on/off. |
| 0:30 | **The broadcast.** Every screen in the neighbourhood flares. Each **adult base** may gain a mark (see Bases). Dormant infected wake up. |
| 0:35 | Walkie: base status ("…something's wrong with the fire station…"). Possibly a **turning** distress call (see below). |

### 🌙 Night — 2:30 — hold the house

| Time | What happens |
|---|---|
| 0:10 | **Wave 1**: infected arrive at the doors and windows. |
| 0:50 | **Wave 2**, from a different side. |
| 1:00–1:40 | Window for a **"we're under attack"** distress call from a base (not every night). |
| 1:40 | **Wave 3**, the biggest; tonight's special infected arrive. |
| 2:30 | Dawn — the infected retreat. |

If the generator is **on**: house lights work, the garage door can be shut, fewer infected come
(they avoid lit windows), but it burns fuel. If it's **off**: darkness, flashlights only, and the
infected are bolder — more come. Screens inside the house do nothing: no adult is in there to be
marked. (Parked idea: a screen left on at the broadcast draws the waves to that room.)

### 🌅 Dawn — 0:45 — recover & upgrade

- **Night summary**: barricades lost, coins earned (+5 per kid still standing), who was taken.
- **Workbench** upgrades (spend coins + materials).
- Walkie: which bases survived the night. A fallen base is gone from the map's trade list.
- Taken kids come back (see below), and the next Day starts.

## 5. Survival mechanics

### Barricades
- Every **door and window** has 3 plank slots. Each plank has health; the infected wear it down.
  A breach with no planks left lets them in.
- Kids **repair** (hold to nail a plank, costs 1 plank) and **reinforce** with upgrades (metal
  bars, shutters).
- Your house: front door, back door, garage door, ~6 windows, all on the ground floor. (Upstairs
  windows only matter if we add a Climber later.)

### Weapons
Kids can **kill** the infected. Weapons go up in **tiers**: start with what's in the garage,
improvise with what's in the neighbourhood, then find real guns later. **Ammo is the scarce
resource**: easy early, harder every night.

| Tier | When | Weapons |
|---|---|---|
| **1. Starter** | Day 1 | Baseball bat and slingshot — every kid starts with both |
| **2. Improvised** | Nights 2–5 | Golf club, crowbar, nail gun, crossbow, fire axe |
| **3. Guns** | Nights 4–8 | Pistol, hunting rifle, submachine gun |
| **Special** | Rare | Flare gun |

**Melee — no ammo, never breaks.** Always the fallback, but you have to get close, inside grab range.

| Weapon | Damage | Extra | Source |
|---|---|---|---|
| Baseball bat | 20 | — | Start |
| Golf club / hockey stick | 22 | Longer reach | Maple Street houses |
| Crowbar | 25 | Opens locked cupboards, car boots and the police armoury | Hardware Store |
| Fire axe | 40 | Breaks through boarded doors | Fire Station (trade, or grab when it turns) |

**Ranged — needs ammo.**

| Weapon | Damage | Ammo | Where to get it |
|---|---|---|---|
| Slingshot | 10 | Stones | Start. Stones lie in every garden and driveway, so they never run out, but they're weak |
| Nail gun | 15, fast | Nails | Hardware Store. **Nails also build barricades**, so every shot is a plank you can't nail |
| Crossbow | 50 | Bolts (reusable — pick them back up) | Blueprint from the Skate Park; bolts are rare loot |
| **Pistol** | 25, 12-round magazine | Pistol ammo | A neighbour's lockbox on Maple Street (needs the crowbar), from Night 4 |
| **Hunting rifle** | 80, slow, long range | Rifle ammo | Hardware Store trade (expensive), from Night 6 |
| **Submachine gun** | 12 per shot, very fast | Pistol ammo (**shared with the pistol**, and it eats it) | Police Station armoury, from Night 8 |
| Flare gun | 40 + burn in an area, lights the area up | Flares | Fire Station, Gas station; very rare |

Damage and health are first guesses. Weapon damage and infected health go in
`src/main/server/config.ts`.

**Guns are loud.** A gunshot wakes dormant infected within about 40 studs by day, and at night it
draws the wave to that side of the house. Strong but risky, so the quiet weapons (bat, slingshot,
crossbow) stay useful all game.

**How ammo gets harder to find:**
1. **Looted places stay looted** for the run. The houses near home run dry, so you have to go
   further, into more danger.
2. **Ammo loot drops off every night:** nails, bullets and flares spawn at about 100% of the base
   rate on the night they first appear, falling to about 40% by Night 10 and 25% by Night 20,
   where it stays. Stones never run out.
3. **Base prices rise** as supply dries up: about +15% per night.
4. **The infected get tougher:** about +10% health per night, so the same ammo goes less far.
5. **Safety valve:** the workbench can craft a little ammo (nails, stones) from scrap, slowly and
   expensively, so a run is never stuck with nothing. It can't make bullets: those only come from
   loot and trades.

**Kills:** an infected that drops **collapses and dissolves into static**: a glitch effect, no
blood, no body. Sometimes it drops a few coins (pocket change).

**Dad:** he can be **knocked down but never killed**. He collapses into static and is
back at the door the next night. A story thread for a later chapter.

### Utility tools
| Tool | Use | Source |
|---|---|---|
| Flashlight | Stuns infected for ~2 s if held on the face | Start |
| Hammer & planks | Barricade / repair (uses nails) | Start (garage) |
| Noise maker (alarm clock, toy car) | Lures infected away from a weak spot, or into a kill zone | Found / blueprint |
| Fire extinguisher | Knocks back and stuns a group | Found, limited uses |
| Rope trap | Snares an infected for ~6 s | Blueprint |

### Inventory
- **Slot-based**: every kid starts with **5 slots**. A slot holds one weapon or tool, or a stack
  of one resource (e.g. up to 5 planks, 20 stones, 12 pistol rounds; stack sizes to tune).
  Coins don't take a slot.
- **Rucksacks** add slots: a **school rucksack** (8 slots) and a **hiking rucksack** (12),
  bought at the workbench (and maybe found or traded later).
- Full inventory means choosing what to leave behind, which keeps trips out meaningful.
- Taken kids drop everything they carried where they were taken.

### Health
Each kid has **100 health**. Infected hits do damage (about 15 for a shambler, more for tougher
types). Medkits heal; health doesn't regenerate on its own, but every kid is fully healed at dawn.

### Taken (instead of death)
- A kid who drops to **0 health** is **taken** by the infected — dragged off, screen fades. No
  gore: "taken" is the only word the game uses.
- A taken kid **spectates** until dawn, then wakes up in the basement, **dropping everything they
  carried** where they were taken.
- Teammates can **rescue** them early from the nearest infected nest before dawn (risky, rewarded).
- **The run ends** if every kid is taken at the same time.

## 6. The infected

All infected are server-controlled AI (pathfinding, barricade targeting). Every infected has **glowing red
eyes** (the tell from the cutscene), which also makes them readable in the dark.

| Type | First night | Health | Behaviour |
|---|---|---|---|
| **Shambler** | 1 | 60 | Slow, bangs on doors, follows noise. Dad is one. |
| **Runner** | 3 | 40 | Fast, goes for windows, gives up quickly when stunned. |
| **Watcher** | 5 | 80 | Stands still; if it sees a kid it **calls** every infected nearby. Daytime danger. |
| **Mimic** | 7 | 60 | Calls out in a familiar adult's voice ("sweetie, open the door…") to draw kids to a window. |
| **The Anchor** (boss) | 10 | 1500 | A newsreader whose voice turns any working screen nearby into a mini-broadcast; drags screens along with it. |

Health goes up about 10% per night. Daytime: **dormant** infected stand frozen in front of screens. Loud noise, flashlight in the face
or a Watcher wakes them.

**Later idea:** a **Climber** that scales the walls and comes in through upstairs windows, so the
upper floor needs defending too.

## 7. Bases, trading & coins

### Coins (the currency)
- **Coins** (loose change from sofas, jars, car cupholders). One currency, used everywhere.
- **Earn:** found while scavenging, deliveries and base jobs, distress-call rewards, rescuing lost
  kids, +5 per kid standing at dawn.
- **Spend:** base trades and the home workbench.

### Adult bases
**Fire Station**, **Hardware Store**, **Church** (Mum is here).

- Sell what kids can't make: **fuel, medicine, power tools, metal shutters**, and one **rescue
  radio part** each.
- **Want lists** change daily (batteries, food from tight spots, messages across town). Filling
  them earns coins and better prices.
- **The Signal takes them on its own schedule.** Each base has a mark meter (0–3, shown on the
  walkie). Kids can't stop it — the world just gets worse. Each base falls inside a random window
  so runs differ:

  | Base | Falls (3rd mark) on |
  |---|---|
  | Fire Station | night 4–6 |
  | Hardware Store | night 6–8 |
  | Church (Mum) | night 10–14 — the last one standing |

- **Distress calls:**
  1. **"We're under attack!"** (some nights, mid-night). Leave your barricades to help: coins,
     better prices — and the house is under-defended while you're gone.
  2. **"Something's wrong with us…"** (the dusk the base gets its 3rd mark). A garbled call, and a
     **short window (~60 s) to get there before it turns**: grab their stock (and their radio part),
     pull out any kids sheltering inside, and get out as the adults start to change around you.
- A fallen base becomes an **infected nest**: more infected come from that direction, and taken kids
  are dragged there.

### Kids' bases
**Treehouse Gang**, **School Gym**, **Skate Park Crew**.

- **Never infected** — your reliable partners. They can still be overrun at night and call for
  help.
- Sell **blueprints** (noise traps, crossbow, rope trap), stone pouches, lures, snacks, walkie batteries.
- Give **intel** over the walkie (where tonight's waves come from, where to find fuel).
- **Lost kids** you find in the world are walked to a kids' base: coins + reputation, and better
  trades.

### Price guide (first guess)
| Item | Price | Where |
|---|---|---|
| Medkit | 10 | Church, Fire Station |
| Fuel can (1 night of generator) | 15 | Hardware, Fire Station |
| Walkie batteries | 5 | Kids' bases |
| Blueprint | 25 | Kids' bases |
| Metal shutter (1 window) | 30 | Hardware |
| Box of nails (20) | 10, rising | Hardware |
| Pistol ammo (12) | 20, rising | Hardware, Fire Station (rarely) |
| Rifle ammo (5) | 30, rising | Hardware |
| Hunting rifle | 120 | Hardware |
| Crossbow bolts (3) | 20, rising | Skate Park |
| Flares (2) | 25, rising | Fire Station |
| Rescue radio part | 60, or grab it when the base turns | Each adult base |

A typical day earns ~15–30 coins for the party. Ammo prices go up about 15% per night.

### Workbench upgrades (home, at dawn or day)
| Upgrade | Cost | Effect |
|---|---|---|
| Reinforced planks | 20 | Planks have +50% health |
| Door bar | 30 | Front/back door gets a 4th, sturdier slot |
| School rucksack | 25 | 5 → 8 inventory slots |
| Hiking rucksack | 60 | 8 → 12 inventory slots (needs the school rucksack) |
| Scrap press | 30 | Craft a little ammo (nails, stones) from scrap |
| Generator tune-up | 35 | Uses half the fuel |
| Window shutters | per shutter bought | Ground-floor window can't be fully breached by shamblers |
| **Rescue radio** | the 3 parts | Lets you call for rescue from Night 10 (optional ending) |

## 8. Level guide — the neighbourhood

The map grows outward; new areas open on the morning walkie report. Walking time from home is the
main cost — further away means better loot and a later trip home.

```
                 [Radio tower] (rescue call, night 10+)
                        │
   [Church]──────[High Street]──────[Hardware Store]
      │           │ shop, clinic,       │
      │           │ police station      │
      │       [School]──[Skate Park]    │
      │           │                     │
 [Treehouse]──[Maple Street]──────[Fire Station]
                  │  neighbours' houses
               [HOME]──[Gas station]
```

| Area | Opens | Danger | Good for |
|---|---|---|---|
| **Home** | 0 | Safe by day | Workbench, generator, plank pile, basement safe room |
| **Maple Street** (4–5 neighbours' houses) | 1 | Low: a few dormant infected | Planks, nails, stones, coins, food, batteries; golf club; **pistol** in a lockbox (Night 4+) |
| **Treehouse** (kids' base) | 2 | Safe | Stone pouch (carry more stones), noise-maker blueprint, intel |
| **Corner shop** (High Street) | 2 | Medium | Food, batteries, coins in the till |
| **Fire Station** (adult base) | 3 | Safe until it falls | Fuel, medkits, extinguishers, **fire axe**, flares, radio part (battery pack) |
| **School** | 4 | Medium: dormant teachers in front of whiteboard screens | Lost kids, science-lab parts, **radio part (tuner)** found here instead of bought |
| **Hardware Store** (adult base) | 5 | Safe until it falls | Metal shutters, nails, **nail gun**, crowbar, **hunting rifle**, bullets |
| **Skate Park** (kids' base) | 6 | Safe | **Crossbow** blueprint, bolts, rope-trap blueprint |
| **Clinic** | 6 | High | Medkits, rare loot (bolts, flares) |
| **Gas station** | 7 | High: Watchers | Fuel and flares (free but dangerous) |
| **Police Station** (High Street) | 7 (armoury from 8) | Very high: overrun, the officers are infected | Pistol ammo, **submachine gun** in the armoury (needs the crowbar) |
| **Church** (adult base, Mum) | 2 (radio contact), 8 (visit) | Safe until it falls | **Radio part (aerial)**, medicine, Mum's story beats |
| **Radio tower** | 10 | Very high | Where you call for rescue |

### Rescue radio parts
| Part | Normal route | If the base fell |
|---|---|---|
| Battery pack | Buy at the Fire Station | Grab it during its turning call, or raid the nest |
| Tuner | School science lab (scavenge) | — |
| Aerial | Church — Mum gives it to you | Grab it during the Church's turning call |

## 9. Night-by-night schedule

### Nights 1–10: learning the world

| Night | New this night | Waves | Story / bases |
|---|---|---|---|
| — | First run only: car cutscene ending on Dad's red eyes. Repeat runs: straight in | — | Mum escapes to the Church |
| 1 | Barricades, Maple Street, the generator (hints for first-timers) | **Forgiving:** 2 small waves, Dad + 2–3 shamblers, half damage | Mum's walkie call |
| 2 | Corner shop, Treehouse; **coins and trading** | Shamblers | Treehouse kids make contact |
| 3 | **Runners**; Fire Station opens | Runners at windows | First "under attack" call possible |
| 4 | School; **lost kids**; **pistol** (Maple Street lockbox) | Mixed | Fire Station may get its 3rd mark (from 4) |
| 5 | **Watchers**; Hardware Store opens (nail gun) | Mixed + Watchers in the day | |
| 6 | Skate Park (crossbow), Clinic, **hunting rifle**. Nearby houses running dry | Bigger waves | Fire Station has fallen by now → nest to the east |
| 7 | **Mimics**; Gas station, Police Station | Mimics at windows | Hardware may turn (6–8) |
| 8 | Church visitable, **submachine gun** (police armoury) | Bigger mixed waves from more sides | Visit Mum; she gives you the aerial |
| 9 | — | The hardest regular night so far | Last trades before the first boss |
| 10 | **First boss**; radio tower opens | **The Anchor** + everything | The Church may turn from now on (Mum's call). With the radio built, rescue can be called |

### Night 11 onward: endless

The map is fully open by Night 10. After that, nothing new unlocks; the world just gets worse:

- **Every night:** infected health +10%, waves bigger, ammo scarcer (down to the 25% floor),
  base prices higher.
- **Every 10th night is a boss night:** The Anchor on Night 10, a new boss on 20 and 30 (to
  design), then the bosses come back in pairs.
- **Nests grow.** Every fallen adult base is a nest. With all three gone (the Church goes by about
  Night 14), only the kids' bases are left to trade with, and from Night 15 they can be
  **overrun** too (a distress call, then gone) if no one answers.
- **Night events** (random, from Night 11), so long runs stay surprising:

  | Event | Effect |
  |---|---|
  | **Blackout** | The generator won't start tonight |
  | **Fog** | Short sight lines; Watchers can't see far either |
  | **Double broadcast** | Two broadcasts: twice the dormant infected wake |
  | **Blood moon** *(name TBD)* | Every wave includes every infected type |

### Ending a run

- **Everyone taken at once** ends the run.
- **Call for rescue** (Night 10+, radio built): carry the radio to the radio tower at dusk and
  hold out until the helicopter lands at dawn. Survive it and the run ends as a **rescue**:
  your nights count, plus a *Rescued* title and badge. It's an optional way to finish on your
  own terms instead of pushing for a higher score.
- Either way you go to the **end screen**: cards per kid with fun titles (existing system), e.g.
  *Carpenter* (most planks nailed), *Slugger* (most kills), *Night Owl* (most stuns), *Big Brother*
  (most rescues), *Shopkeeper* (most coins traded), *Mum's Favourite* (kept the Church alive
  longest), *Rescued* (called rescue and made it), *Survivor* (default). Then back to the lobby.

## 10. Content rules (Roblox)

- The infected want to **take** children. Keep it implied: no biting, no blood, no "eat". Horror
  comes from sound, lighting, voices and anticipation.
- Kids **can** kill the infected, including with guns, but it stays stylised: they collapse and
  dissolve into static. No blood, no bodies. Guns are generic (no real brand or model names).
- Expect at least a **Moderate (13+)** maturity label; fill the Experience Questionnaire honestly.

## 11. What we reuse from the ghost prototype

| Existing system | Becomes |
|---|---|
| Lobby pads, party handoff, gatekeeper | Gym hall, a parent NPC at each pad (theme only; min size 1) |
| `banishCamera.ts` cutscene rig | Intro drive + finale |
| Lamps / lights out | Generator and house lights |
| `flashlight.ts` reveal cone | Flashlight **stun** |
| `melee.ts` / `combat.ts` (knife & poker: client-picked hits, server re-check, hit markers) | Melee weapons, extended with ranged hits |
| `traps.ts` placement | Barricades, noise traps, rope traps |
| `objectives.ts` items / chests / altar | Loot, radio parts, the workbench |
| `roundEnd.ts` + titles + `stats.ts` / `leaderboard.ts` | End-of-run screen; *Wins* become **best run** + **total nights** |
| `gameState.ts` stores + `resync` | Phase/night, coins, base status |
| Roles (ghost / hunter), spooks | **Removed** — no player-vs-player roles |
| `sanity.ts`, `panic.ts` | **Removed** — no fear meter |

**New systems:** the day/night phase clock, infected AI (pathfinding + barricade targeting), the
barricade health model, ranged weapons & ammo, inventory & coins, NPC bases with want lists and trades, the walkie-talkie
UI, the neighbourhood map.

## 12. Suggested build order

1. **Vertical slice — one night in the house:** phase clock, barricades, 3 waves of shamblers,
   generator, health, taken/respawn, baseball bat + slingshot. *Is holding the house fun?*
2. **Day + Maple Street:** scavenging, inventory, coins, dormant infected.
3. **Workbench + trading** with one kids' base and one adult base; walkie-talkie UI.
4. **Marks on bases + distress calls**, base falling into a nest.
5. **More infected types, weapon tiers (guns, ammo scarcity)** and the rest of the map, night by night.
6. **Lobby re-theme** (gym hall, parent NPCs at the pads, min size 1).
7. **Car cutscene, first-run hints and forgiving Night 1**, once the mechanics they
   teach are final.
8. **Night 10+:** The Anchor, rescue call, night events, endless scaling.

## Open questions

- **Run length & saving.** Runs are endless now (10 nights ≈ 75 min), so saving matters more.
  Save a run between sessions (per party host? per player?) or keep runs to one sitting?
- **Leaving mid-run.** Does a kid who leaves still get their nights counted? (Probably yes, the
  nights they were there for.)
- **Kid classes** (Builder / Scout / Medic / Techie) — worth the extra balancing, or keep every kid
  the same?
- **Party size vs. difficulty** — scale waves with party size, or a fixed difficulty?
- **Who owns a gun?** Each kid keeps what they pick up, or does the party share a weapon locker
  at home? A shared locker makes guns a team decision.
- **Player-to-player trading** between parties — later feature; NPC bases only for now.
- Should the house itself ever get Signal exposure (e.g. Mum visiting)? Currently no adult ever
  comes inside.
