# The map: tiles

The neighbourhood is being rebuilt from **tiles**: 200×200-stud areas that always look the same, laid
out differently each run. This file says what's in each tile and the rules for making one.
`GAMEPLAY.md` §8 says what the places are *for*.

**Status:** sample tiles, to look at in Studio. The game doesn't use them yet: it still builds the house,
Maple Street and the bases from code (`src/main/server/world/`).

## Looking at them

```sh
npm run serve:tiles    # build the tiles, lay them out and live-sync them into Studio (an empty Baseplate)
npm run tiles          # build and lay them out again after changing one (while serve:tiles is going)
```

Connect the Rojo plugin to port **34873** (so it can run beside `serve:main`); there's no need to press Play. `Workspace.Tiles` has:

- **Gallery**: every tile on its own in a row (to the south), with its name and edge labels.
- **Sample**: six tiles joined up (around the origin), to check the seams. Its layout is at the top of
  `tools/tiles/gallery.luau`; `npm run tiles` fails if two edges in it don't join.

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
| [Houses_A](#houses_a) | Road/Grass | Road/Town | None/Grass | Road/Town | 12 | 4 | 4 | 329 |
| [Treehouse](#treehouse) | None/Forest | Road/Grass | None/Forest | None/Forest | – | 1 | – | 231 |
| [Meadow_A](#meadow_a) | Road/Grass | None/Grass | None/Grass | Road/Grass | 2 | 2 | – | 125 |
| [ForestRoad_A](#forestroad_a) | None/Forest | Road/Forest | Road/Grass | None/Forest | 3 | 1 | 1 | 300 |
| [Swamp_A](#swamp_a) | None/Swamp | None/Swamp | None/Grass | None/Forest | 3 | 1 | – | 188 |

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

A tile can be turned by quarter turns, and its edges turn with it. The rules are in
`tools/tiles/tiles.luau`, and will move to `src/shared/world/` when the game picks layouts.

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
- **The game:** choosing a layout from a seed, checking every place can be reached, and capping the map's
  outer edges. Remove the spare copies of the tiles before any system starts, or tag searches find them too.
- **Home tile**, Fire Station and the other places in `GAMEPLAY.md` §8.
