# The map: tiles

The neighbourhood is being rebuilt from **tiles**: 200×200-stud areas that always look the same, laid
out differently each run. This file says what's in each tile and the rules for making one.
`GAMEPLAY.md` §8 says what the places are *for*.

**Status:** sample tiles and the planner that lays them out, to look at in Studio. The game doesn't use them
yet: it still builds the house, Maple Street and the bases from code (`src/main/server/world/`).

## Looking at them

```sh
npm run serve:tiles          # build the tiles, lay them out and live-sync them into Studio (an empty Baseplate)
npm run tiles                # build and lay them out again after changing one (while serve:tiles is going)
npm run tiles -- 7 42 300    # the same, showing the run's map for seeds 7, 42 and 300 (default: 1, 2, 3)
```

Connect the Rojo plugin to port **34873** (so it can run beside `serve:main`); there's no need to press Play. `Workspace.Tiles` has:

- **Gallery**: every tile on its own in a row (to the south), with its name and edge labels.
- **Layouts**: the run's map for each seed, side by side, planned exactly as the game will plan it (below).
  Each seed's tiles are listed in the terminal too. `npm run tiles` fails if a seed can't be planned or its
  map breaks a rule.

The tile tools read the game's compiled rules from `out/`, so keep `npm run watch` going (or run
`npm run build` once).

## Where tiles live

A tile is **either coded or hand-edited**, never both (the build stops if a name is in both places):

| | Source (committed) | Built to (not committed) |
|---|---|---|
| **Coded** (all of them, so far) | `tools/tiles/tiles/<Name>.ts` | `build/tiles/models/<Name>.model.json` |
| **Hand-edited** in Studio | `assets/tiles/<Name>.model.json` | (used as it is) |

`npm run tiles` type-checks the code, builds the coded tiles, then lays every tile out for viewing in
`build/tiles/view`. `npm test` runs it too, so the checks see every tile.

The shared pieces (walls, trees, fences, the bungalow, loot, markers) are in `tools/tiles/lib/build.ts`,
and the materials in `lib/styles.ts`: change one there and every tile that uses it changes. Random
placement is seeded, so a tile comes out the same every build until its code changes.

To edit a tile in Studio instead: change it, save it as JSON into `assets/tiles` (a converter is still to
be written), and delete its `.ts` file and its line in `tools/tiles/build.ts`.

## The tiles

Edges are **route/ground** (see below). Parts are a guide to the cost of a tile.

| Tile | North | East | South | West | Loot | Stones | Dormant | Parts |
|---|---|---|---|---|---|---|---|---|
| [Home](#home) | Road/Grass | Road/Town | None/Grass | Road/Town | 12 | 4 | 4 | 255 |
| [FireStation](#firestation) | None/Grass | Road/Town | None/Grass | Road/Town | – | – | – | 96 |
| [Houses_A](#houses_a) | Road/Grass | Road/Town | None/Grass | Road/Town | 12 | 4 | 4 | 329 |
| [Treehouse](#treehouse) | None/Forest | Road/Grass | None/Forest | None/Forest | – | 1 | – | 231 |
| [Meadow_A](#meadow_a) | Road/Grass | None/Grass | None/Grass | Road/Grass | 2 | 2 | – | 128 |
| [ForestRoad_A](#forestroad_a) | None/Forest | Road/Forest | Road/Grass | None/Forest | 3 | 1 | 1 | 300 |
| [Swamp_A](#swamp_a) | None/Swamp | None/Swamp | None/Grass | None/Forest | 3 | 1 | – | 188 |

### Home
Maple Street: the family house with a neighbour either side and two across the road, and a side road north.
Always at the bottom middle of the map, never turned.
- **The family house isn't in the tile.** The game builds it in code (`src/main/server/world/world.ts`),
  because barricades, lamps, the generator and the infected depend on it. The tile has a hole in the ground
  for its basement and a blue `HomePlot` box where it goes. The tile's middle is today's (0, -61), the middle
  of the street, so the house sits where it always has.
- **Neighbours:** four bungalows like Houses_A's (TV and dormant infected, drawers, cupboards, tool chest,
  stones). The beside ones moved in from x ±95 to ±72 to fit the tile.
- **Dad:** a `DadSpot` marker in the left neighbour's front garden, where he stands on Day 1.
- **Street lamps:** 4. Cars are still to come (meshes).

### FireStation
The adult base: today's station (brick, an open engine bay and the trading counter in the side bay) on a
straight street, with a car park and a training tower across the road. Safe, so nothing to loot.
- The engine is a plain red block until meshes go in tiles; the ambulance and tank wrecks are still to come.

### Houses_A
A residential street with a side road north (a T-junction). Four neighbours' houses, two each side, with
fenced gardens; a small green with a bench between the southern two.
- **Each house:** living room with a TV and a dormant infected watching it, drawers (Drawers), kitchen
  cupboards (Kitchen), tool chest (Garage), stones in the front garden.
- **Street lamps:** 4, off until evening.

### Treehouse
The kids' base: a clearing in a pine forest at the end of the road. A safe place, so there's nothing to loot.
- **The tree:** house up in the branches (for show), sign, and the trading counter at its foot.
- **Camp:** a cold campfire with log seats; stones nearby.

### Meadow_A
Open fields with a bend in the road, broken fences, hay bales, rocks and scattered oaks. Little cover.
- **Barn:** a wide door facing the road and a small one at the back; tool chest (Garage), drawers (Drawers).
- **Stones:** one patch by the rocks, one behind the barn.

### ForestRoad_A
A bend in the road through dense pines. Easy to lose sight of the others.
- **Ranger hut** (north-west, facing the bend): TV with a dormant infected, supply locker (Garage),
  cupboards (Kitchen). Porch and windows on three sides.
- **Camp** (south-east): tent, campfire, rucksack (Drawers). Stones in the western trees.

### Swamp_A
Shallow water with dead trees, reeds and mud islands. No road: boardwalks cross from the south and east.
- **Shack** (middle island): tackle box (Garage), cupboards (Kitchen).
- **Islands:** a crate (Garage) to the north-east, only reached by wading; stones on the south-west one, by
  boardwalk. The water doesn't slow anyone yet.

## Edges: what can go next to what

North is -Z, east is +X. Each tile has four attributes, `North`, `East`, `South` and `West`, each
`Route/Ground`. Two edges join when the **route is the same** and the **grounds can meet**:

- **Route:** `Road`, `Path` or `None`. (No tile uses `Path` yet.)
- **Ground:** `Town`, `Grass`, `Forest` or `Swamp`.

| | Town | Grass | Forest | Swamp |
|---|---|---|---|---|
| **Town** | ✓ | ✓ | – | – |
| **Grass** | ✓ | ✓ | ✓ | ✓ |
| **Forest** | – | ✓ | ✓ | ✓ |
| **Swamp** | – | ✓ | ✓ | ✓ |

A tile can be turned by quarter turns, and its edges turn with it. All of a tile's roads and paths must
join up inside it: the planner assumes that when it checks places can be reached. The rules are in
`src/shared/world/tiles.ts`, used by the game, the planner and the tile checks alike.

## The run's map

Each run gets a new seed, and the seed decides the map (`src/shared/world/layout.ts`), so the same seed
always gives the same map. The rules are in `src/shared/world/mapRules.ts`:

- **Size:** columns and rows of tiles. Row 0 is home's row, at the south; rows count north.
- **Fixed:** tiles always in the same place and turned the same way (home).
- **Places:** tiles every run has exactly once, somewhere between a nearest and furthest row.
- **Fillers:** tiles for the rest, each used at most so many times.

Any tile may be turned. The planner places the places, then fills the grid row by row with whatever joins
its neighbours, backing up when it gets stuck. A map is only accepted if every place can be reached by
road (or path) from home. Roads running off the map get a roadblock. If no map can be found, it returns
nothing, and the game should fall back to a known-good one.

The trial map is **3 × 2**: home at the bottom middle, the Treehouse beside it, the Fire Station beside it
or in the row behind, and streets, meadows, forest roads and the swamp to fill the rest. 2,000 seeds all
plan (0.2 s in all), giving about 960 different maps. `npm test` checks 500 of them.

| Rule | Value |
|---|---|
| Fixed | Home at the bottom middle |
| Places | Treehouse in row 0; FireStation in row 0 or 1 |
| Fillers | Houses_A ×2, Meadow_A ×2, ForestRoad_A ×2, Swamp_A ×1 |

## Making a tile

- **Code:** a file in `tools/tiles/tiles/` that returns a `Tile`, and a line in `TILES` in `tools/tiles/build.ts`.
  Edge labels, loot kinds and so on are typed, so a typo is an error from `npm run tiles`.
- **200×200 studs** around the origin, **ground at y = 0** along every edge. Hills and dips stay inside.
- **Roads** are 22 wide, with their top at 0.1, and meet an edge at its **middle**. Pavements (6 wide, top
  at 0.2) run to a `Town` edge and stop short of any other.
- **Blend inside the tile:** if a forest tile has a `Grass` edge, it fades to grass before the edge.
- **Folders** inside the Model group the parts (`Ground`, `Road`, `Trees`, `Loot`, `Markers`…). Name road
  parts `Road`: that's how the check knows a road reaches an edge.
- **Every part** is anchored and placed with a `CFrame` (in JSON: 12 numbers, position then rotation by
  rows). Rojo accepts `Position` but it isn't what Studio saves, so the check refuses it.
- **No scripts.** Tags and attributes say what things do:

| Tag | On | Attribute |
|---|---|---|
| `LootContainer` | Something to search | `Kind`: Kitchen, Drawers, Garage or Car |
| `Stones` | A patch of stones | |
| `Trader` | A trading counter; its trader stands behind it (+Z) | `Base` |
| `StreetLight` | A lamp's SpotLight | |
| `DormantSpot` | Where a dormant infected stands; its front (-Z) faces the screen. New: nothing reads it yet | |

`DormantSpot` markers are red and see-through so they show in Studio; the game must hide them.

`npm test` checks every tile for all of this (`tests/unit/world/tiles.spec.luau`). Add a new tile to this file.

## Not done yet

- **Meshes** (cars, wrecks, the fire engine): a MeshPart's size doesn't survive JSON reliably, so this needs a
  test in Studio first. NPCs and fires stay in code.
- **Saving a Studio edit back to JSON:** needs a converter. Until then, edits in Studio are lost (and a
  coded tile's next build would replace them anyway).
- **The game:** building the planned map at the start of a run, with roadblocks and the map's outer edges.
  Remove the spare copies of the tiles before any system starts, or tag searches find them too.
- **The family house in the Home tile**, built from markers instead of code (with the game switch-over).
- **Behind home:** the house's back garden is only 17 studs deep before the map's south edge, and today's
  back infected spawn (48 behind the house) would be off the map. A strip of woods along the south edge, or
  spawns moved, before the game uses tiles.
- **The other places** in `GAMEPLAY.md` §8.
