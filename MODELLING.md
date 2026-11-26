# Modelling and rigging characters

Notes for making a character for MARKED, from Blender to walking around in the game. Static props:
`tools/blender/README.md`. Worked examples: `tools/blender/assets/infected_dad.py` and
`infected_neighbour.py`; for ordinary people, the lobby's parents (`parent_mum.py`, `parent_dad.py`,
`parent_phone.py`), built from the pieces in `lib/people.py` (same proportions and joints, a human face).

## Look

- Original designs only. Reference sheets and paid packs are for the general genre, not for copying.
- Adults, blocky, about 5.3 studs tall, under ~1,500 triangles. Lofted, corner-cut shapes.
- Infected: grey-green skin, red eyes, three glitch marks on the cheek. No blood (GAMEPLAY.md §10).
- Give each one a silhouette and one odd detail (Dad's missing slipper, the neighbour's hood).
- Colours come from the shared palette (`lib/palette.py`, 16 × 16). **Append** new swatches. An uploaded
  model keeps the palette it was uploaded with, so later changes don't affect it until it's rebuilt and
  imported again.

## Rig

`lib/rig.py` builds the skeleton; `lib/blocky.py` has the joints, lofts, face and posing.

- Model facing **-Y**, arms **straight down**, feet at Z = 0, the character's left at **+X**.
- 15 meshes named `<Part>_Geo`, each bound 100% to the bone `<Part>` (R15 part names).
- Bones: `Root` (0,0,0) → `HumanoidRootNode` (at the hips) → `LowerTorso` → the rest.
- **Every bone is a stub pointing straight up, roll 0.** It looks wrong in Blender, but it gives every
  joint a world-aligned rest pose in the FBX, which R15 animations assume. With it, Roblox's default
  walk plays correctly. Don't point bones along the limbs.
- Overlap parts at the joints by 0.05–0.1 studs so bends don't open gaps.
- A preview pose (`preview_pose()`) checks the joints; the export is always the rest pose.

## Build and check

`npm run models -- infected_neighbour`, then look at `assets/models/<name>/preview.png`. The size in
`<name>.json` is what Studio should show. Not checked automatically: weights and bone orientation.

## Import (once per model)

1. Studio → File → Import → the FBX. **Rig Type R15**, **Merge Meshes off**, **Anchored off**.
2. File Geometry must match `<name>.json` (Dad: 2.64 × 5.26 × 1.28). If not, stop.
3. Import, and copy the **model's** asset ID (a character is loaded whole, so not a mesh ID).
4. Delete the copy left in Workspace; the game loads its own.

The account that owns the game must own the model: `InsertService.LoadAsset` refuses others' models.

## What Studio makes of it

Seen on Dad's import:

- Joints are kinematic `AnimationConstraint`s (plus ball sockets), not Motor6Ds. Animations still work.
- The palette arrives as a `SurfaceAppearance` on each part. It overrides `Color`, so remove it to
  recolour a part (the static fade does).
- **HumanoidRootPart is left at the feet.** Line it up with `LowerTorso.RootRigAttachment` before
  using the model (`loadRig` in `src/main/server/infected/body.ts`).
- Hip height comes out right (2.1, so the root is 3.1 above the floor).

## In the game

- Load once, prepare a template in ServerStorage, clone it per spawn. If loading fails, fall back to
  the plain body so a fresh clone still runs.
- **Size:** use `Model:ScaleTo`, which also scales joints, welded parts and `HipHeight`; no re-import.
  Dad is `DadScale` (1.2, so 6.31 studs) and shamblers `ShamblerScale` (1.1, so 5.8); one tall
  avatar measured 6.58, the plain body 5.2.
- Spawn points are set for a root 3 studs up, so a taller body starts higher (`spawnOne`).
- Windows open 6 studs. Dad gets through at 6.31; test anything taller.
- **Eyes:** code adds Neon `Eye` parts just over the painted ones, so a stun can dim them. They're
  placed from the neck joint (`EYES_FROM_NECK`), because a head's centre moves with its hair or hood.
  Keep the face in `blocky.infected_face()` and the neck joint, and they fit every infected.
