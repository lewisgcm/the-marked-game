# Blender models

Game models are built from code, the same way everything else here is: each asset is a
small Python module that describes its geometry, and a driver runs Blender headlessly to
produce the FBX you upload to Roblox plus a preview render.

```sh
npm run models                 # build every asset (FBX + GLB + preview PNG)
npm run models -- teleport_pad # build one asset
npm run models -- --no-render  # skip previews, for fast iteration
```

Blender is found automatically (Homebrew `blender`, or `/Applications/Blender.app`).
Override with `BLENDER=/path/to/blender npm run models`.

## How a model gets into the game

1. **Model it** — edit or add a module in `tools/blender/assets/`.
2. **Build** — `npm run models` writes `assets/models/<asset>/<asset>.fbx` and a
   `preview.png`. Check the render; the asset is designed to be judged by eye.
3. **Upload once** — with Studio's importer, following [Importing into Studio](#importing-into-studio-once-per-model).
   This step can't be automated from the repo: mesh data lives on Roblox's servers, and
   `MeshPart.MeshId` is read-only from scripts.
4. **Wire it up** — paste the *mesh* ID (not the model ID) into `assets/rojo/<asset>.model.json`
   as `"MeshId"`, then clone that model from code (`findMeshAsset` in `src/shared/assets.ts`).

Until step 4 happens the model file has no `MeshId` and `findMeshAsset` returns `undefined`,
so the game falls back to plain parts. A fresh clone always runs.

## The lobby kit (low-poly, one import for everything)

The lobby's props (graves, trees, fence, gate, chapel, bell tower, crypts, lanterns, rocks,
pedestal, candles) and the three ritual items are one asset, `lobby_kit`, in the Synty-style
low-poly look: faceted shapes coloured from one shared palette image (`lib/palette.py`,
`lib/lowpoly.py`). `npm run models -- lobby_kit` writes the FBX, the palette PNG and
`src/shared/kitManifest.ts` (each prop's size and centre, so code can stand it on the ground).

To upload it (once, and again only if the kit changes):

1. **Palette:** Studio → Asset Manager → Bulk Import → `assets/models/_palette/palette.png`.
   Right-click it → Copy Asset ID.
2. **Meshes:** File → Import → `assets/models/lobby_kit/lobby_kit.fbx`, with **Merge Meshes
   off** (each prop must be its own MeshPart), Anchored on, and Upload to Roblox + Add to
   Workspace on. Check File Geometry reads ~57 studs wide, not ~5700.
3. Make sure the imported model in Workspace is named `lobby_kit`, then paste
   `tools/blender/print_mesh_ids.lua` into the command bar and run it.
4. Save the printed `Name=rbxassetid://…` lines to a file and run
   `python3 tools/blender/kit_rojo.py ids.txt <palette id>` — it writes `assets/rojo/kit/*.model.json`
   and updates the Skull, Book and Candles models.
5. Delete the imported `lobby_kit` model from Workspace.

Until every kit mesh has an ID, the lobby keeps building its old blockout (`kitReady()` in
`src/lobby/server/kit.ts`).

## Rigged characters (R15)

Full notes: [MODELLING.md](../../MODELLING.md).

A character module sets `RIGGED = True` and builds its 15 body parts, then `lib/rig.py` adds an
R15 skeleton and binds each `<Part>_Geo` mesh 100% to its bone. Model facing -Y, arms straight
down, left side at +X. The FBX carries the skeleton and the palette image. An optional
`preview_pose()` poses the preview only; the export is always the rest pose.

To import one: Studio → File → Import → `assets/models/infected_dad/infected_dad.fbx`, with **Rig
Type: R15**, **Merge Meshes off** and **Anchored off**. File Geometry should read about
`2.64 × 5.26 × 1.28`. The result is a Model with a Humanoid, unlike the single-mesh steps below.

## Importing into Studio (once per model)

Roblox's API can't hand you a `MeshId` — uploading an FBX returns a *Model package*, and the
per-mesh IDs inside it are only visible once the asset exists. So this one step is manual, and
it's per model, not per build.

1. **Studio → File → Import**, and pick `assets/models/<asset>/<asset>.fbx`.
2. In the preview window, before hitting Import:
   - **File Geometry → Merge Meshes: on.** The pad carries two materials, and the importer
     otherwise creates one MeshPart *per material*. Merging gives you a single MeshPart, which
     is what a single `MeshId` requires.
   - **Check the dimensions** shown under File Geometry: they should read
     `10 × 0.79 × 10 studs` (`Scale Unit` defaults to Studs). If you see ~1000 instead, the
     `EXPORT_SCALE` in `build.py` is wrong — stop and fix it, don't import and hope.
   - **File General → Anchored: on**, since the pads never move.
   - Leave **Import Only As Model**, **Upload to Roblox** and **Add to Workspace** enabled.
     "Add to Workspace" is also what grants the place permission to use the asset.
3. **Import**, then wait for the upload to finish. The model lands in Workspace.
4. **Copy the mesh ID, not the model ID.** Expand the imported Model, select the `MeshPart`,
   and copy `MeshId` from Properties. The importer's right-click *Copy asset ID* copies the
   Model ID, which is the wrong one.
5. **Paste it** into `assets/rojo/<asset>.model.json`:

   ```json
   "MeshId": "rbxassetid://1234567890"
   ```

   Rojo maps that onto the serialized `MeshContent` property itself, so use the `MeshId` name.
   Leave the model's `Size` at `[1, 1, 1]` — see [Units](#units).
6. **Delete the imported model** from Workspace. The lobby builds its own pads; the imported
   copy would otherwise sit at the origin as a fourth one.
7. **Rebuild or sync** — `npm run build:lobby`, or just let `npm run serve:lobby` push the
   changed model JSON.

### If it doesn't show up

| Symptom | Cause |
| --- | --- |
| Pads missing in-game, fine in Studio | Asset not moderated yet, or it was imported without "Add to Workspace" so the place has no permission |
| Pad 100× too big / too small | Wrong `Scale Unit` at import, or a model `Size` that isn't `1,1,1` |
| An extra pad at the origin | Step 6 was skipped |
| `MeshId` empty after importing | "Upload to Roblox" was off, so nothing was uploaded |

## Output

```
assets/models/<asset>/
  <asset>.fbx      upload this to Roblox
  <asset>.glb      glTF, for other engines / web previews
  preview.png      Cycles render of the asset
  <asset>.json     triangle count, dimensions, material list
assets/rojo/
  <asset>.model.json   the MeshPart that Rojo syncs into ReplicatedStorage.Assets
```

`assets/models/` is build output but is committed, because the FBX is the artifact you
upload — regenerating it should not be required to work on the game.

## Writing an asset

Every module in `assets/` needs a `build()` that adds meshes to the scene and returns the
main object. Anything marked `preview_only` is excluded from the export but still rendered,
which is how glow and lighting detail shows up in the preview without ending up in the mesh.

```python
from lib import mesh

def build():
    metal = mesh.material("Metal", (0.06, 0.07, 0.09), roughness=0.4, metallic=0.8)
    crate = mesh.add_box("Crate", (4, 4, 4), mat=metal, bevel_width=0.15)
    mesh.shade_smooth(crate, angle=30)
    mesh.unwrap(crate)
    return crate
```

Useful helpers (`tools/blender/lib/mesh.py`):

| Helper | Use |
| --- | --- |
| `profile_solid(name, [(half, radius, z), ...], mat, bottom_z=...)` | stacked rounded-square rings — rims, grooves, steps, plinths |
| `add_box` / `add_cylinder` | primitives, with optional bevel |
| `bevel` / `bevel_vertical_edges` | angle-limited bevel, or corner rounding that preserves the top face size |
| `join_objects` | merge parts, origin at world origin |
| `shade_smooth` / `unwrap` | shading by angle, and UVs so texturing stays possible |
| `material` / `mark_preview_only` | Principled material, preview-only geometry |

For organic shapes, `tools/blender/lib/sdf.py` models with **signed distance fields**:
ellipsoids, capsules and rounded boxes combined with `smooth_union` / `smooth_subtract`,
which blend over a radius so pieces melt into one form and carved holes get worn rims.
`sdf.to_mesh(name, field, lo, hi, cell)` polygonises the field (surface nets); decimate the
result to a game-friendly triangle count. See `assets/skull.py`.

An asset can set `PREVIEW_DIRECTION = (x, y, z)` to choose its preview camera angle (the
default is a top-down three-quarter view; faces want to be seen head-on).

## Units

Model in **studs** (1 Blender unit = 1 stud), and the exporter scales by `0.01`
(`EXPORT_SCALE` in `build.py`).

That factor is not folklore, it's arithmetic: Roblox reads a Blender FBX as **metres**,
converts to centimetres, and imports 1 cm as 1 stud. A 10-stud pad would therefore arrive
at 1000 studs. Exporting at `0.01` stores the geometry 100× smaller, so it imports at
exactly the modelled size.

Verify it at import time rather than trusting it: the importer's **File Geometry** readout
should show the size you modelled (e.g. `10 × 0.79 × 10`). If it shows `1000`, the export
scale is wrong; don't import and hope.

The mesh is authored at its final size, and the `MeshPart`'s `Size` stays at `1,1,1`: a
MeshPart's `Size` is a **multiplier** of the mesh's own scale, not an absolute stud size, so
anything but `1,1,1` stretches the model. This is the failure that made a 10-stud pad render
at 100: the model JSON said `Size: [10, 0.786, 10]`, which scales the already-10-stud mesh up
tenfold. Author the mesh at the size you want, keep `Size` at `1,1,1`, and let `world.ts`
position it with `PAD_HEIGHT`. Rebuilding at a different size means moving
`ZONE_PLATFORM_SIZE` and the pad constants together.

Keep the object's origin at the geometric centre of what you model. `MeshPart.Position` is
the centre, so a centred mesh lands exactly where the code puts it.

## Gotchas this pipeline is built around

- **`MeshPart.MeshId` is read-only at runtime.** The asset ID can only come from data, which
  is why each model is a `.model.json` and not built inline in TypeScript.
- **`bmesh inset_region` flips winding** once you move the inset face to another height, and
  the next inset then grows outwards. `profile_solid` stacks explicit outlines instead, and
  recalculates normals, so every dimension is exactly what was asked for.
- **Coplanar faces z-fight.** If two surfaces end up at the same height, the result is a
  black patch that looks like a hole. Offset by a few hundredths of a stud.
- **Check the importer's File Geometry number before importing.** It is the only reliable
  read on how big the mesh will actually be; a 10-stud model reading `1000` means the export
  scale is wrong.
- **A `MeshPart`'s `Size` is a multiplier, not studs.** Keep it at `1,1,1` and author the mesh
  at the size you want. Setting `Size` to the model's dimensions (e.g. `[10, 0.786, 10]`)
  scales it up tenfold.
- **Metals go black in a dark preview scene.** A high `metallic` with nothing to reflect
  renders near-black; the preview lights and `AgX - Punchy` look are tuned so materials read
  the way they will in-game.
- **Multi-material models split into several MeshParts on import.** Keep gameplay meshes to
  one or two materials, and add glow with Neon parts at runtime (see `createPadGlowRing`).
- **Material colours do not survive FBX → MeshPart.** The importer brings geometry, not the
  Principled shader, so a model lands in Studio flat grey unless you bake a texture. That is
  why each `.model.json` sets a `Color` tint — the teleport pad's two-tone look is baked
  into the *preview* only, and in-game it reads as one dark part plus the Neon ring.

## Assets

| Asset | Size (studs) | Tris | Used by |
| --- | --- | --- | --- |
| `teleport_pad` | 10 × 0.786 × 10 | 312 | lobby queue platforms (`src/lobby/server/world.ts`) |
| `skull` | 0.77 × 1.05 × 1.1 | ~4000 | ritual item: lobby pedestal (`src/lobby/server/decor.ts`), main-game pickup |
| `book` | 1.88 × 0.52 × 1.11 | ~1600 | ritual item: covers, spine and clasp only — the pages are a Part filled in at runtime (`BOOK_PAGES_SIZE` in `decor.ts` mirrors `PAGES` in `book.py`) |
| `light_cone` | 36.95 × 36.95 × 32 | 128 | flashlight beam: open, double-sided cone; nested ×3 at runtime as translucent Neon for a fade (`src/main/client/flashlight.ts`). Length/angle mirror `BEAM_VISUAL_LENGTH` / `FLASHLIGHT_HALF_ANGLE` |
| `fire_engine` | 8.4 × 9.43 × 21.1 | 2760 | the Fire Station's engine (`lib/vehicle.py`); `src/main/server/bases.ts` loads it |
| `street_cars` | four meshes, up to 7.25 × 9.3 × 14.6 | 3712 | Maple Street: Minivan, Hatchback, Estate, IceCreamVan (`lib/vehicle.py`); `src/main/server/cars.ts` loads them as one model |
| `infected_dad` | 2.64 × 5.26 × 1.28 | 1264 | Dad, the first infected, on an R15 rig (`infected/body.ts` loads it) |
| `infected_neighbour` | 2.62 × 5.28 × 1.38 | 1292 | the ordinary shambler, on an R15 rig (`infected/body.ts` loads it) |
| `candles` | 1.48 × 1.22 × 1.28 | 1500 | ritual item: melted candle cluster; flames are added at runtime at each wick (`CANDLE_WICKS` in `decor.ts` mirrors `CANDLES` in `candles.py`) |

The teleport pad's groove dimensions are duplicated in `src/lobby/server/world.ts`
(`PAD_GROOVE_OUTER` / `PAD_GROOVE_INNER`), because the Neon ring that fills that groove is
built from parts at runtime rather than baked into the mesh. If you change the pad's
profile, update those constants — the build log prints the real numbers.
