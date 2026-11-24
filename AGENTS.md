# AGENTS.md

**MARKED**: a co-op horror survival Roblox game, written entirely in code: TypeScript → Luau via
[roblox-ts](https://roblox-ts.com), synced/built with [Rojo](https://rojo.space). Two places —
**lobby** and **main game** — plus shared code. See `README.md` for the full structure.

## Design and plan

- **`GAMEPLAY.md`** is the design and the source of truth for how the game should play.
- **`PLAN.md`** is the build plan. Work through it in milestone order, tick tasks off as they
  land, and note anything that changed.
- The code started as a **ghost-hunt prototype** (archived design:
  `docs/archive/GAMEPLAY-ghost-prototype.md`; code at git tag `ghost-prototype`). M0 removed the
  ghost-only systems; recover anything useful from the tag rather than rewriting it.

## Build & run

```sh
npm run watch          # compile TS -> Luau in out/ on save
npm run serve:lobby    # Rojo live-sync into Studio (serve / serve:main for the others)
npm run build:lobby    # static .rbxlx into build/ (build:main, build:dev)
npm run models         # rebuild Blender models (FBX/GLB/preview)
npm run lint           # ESLint + Prettier (lint:fix to auto-fix); run before committing
npm test               # compile + Lune unit tests (tests/unit); run before committing
```

**Fast loop:** `npm run watch` (terminal 1) + `npm run serve:<place>` (terminal 2), then connect
the Rojo plugin in Studio. No rebuild + reopen. The lobby world (floor, zones, pads, beams) is
built at *runtime* by `buildLobbyWorld()`, so it only exists while the server is running.

## Roblox Studio MCP

Studio is controllable through the `roblox-studio` MCP server. Enable "MCP mode" in Studio, then
add the server (done globally on this machine):

```sh
opencode mcp add roblox-studio --global -- "/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP"
```

Call its tools inside `execute` as `tools["roblox-studio"].<tool>(...)`. `search({ namespace: "roblox-studio" })`
lists them all. The essential ones:

- `list_roblox_studios()` → get a `studio_id`; direct every call at one instance.
- `start_stop_play` → press Play/Stop; `get_console_output` → read logs; `screen_capture` → screenshot.
- `execute_luau` → run Lua in a datamodel (`Edit` / `Client` / `Server`).
- `search_game_tree` / `inspect_instance` → walk the live data model.

The lobby world is built at runtime, so inspect it with `datamodel_type: "Server"` **during a
playtest** — `Workspace.TeleportZones` won't exist in Edit mode.

## Code structure (main-game server)

- **One system per file**, started by a `start…(hooks)` function. `systems.ts` starts them all and
  connects them; `phaseEvents.ts` says what happens as each phase begins; `main.server.ts` is only
  the start-up order. Keep game logic out of `main.server.ts`.
- **Direct imports** for foundations any system may use: config, party, life, round, inventory,
  coins, prompts, effects, round stats, night report, world. **Hooks** for anything one system
  needs to know about or do to another (e.g. the infected damaging barricades). No import cycles.
- Reuse the helpers: `shared/characters.ts` (root part, living Humanoid), `effects.ts` (sounds, hit
  flash), `prompts.ts`, `infectedDamage.ts` (every weapon's hit goes through it).
- A system that outgrows one file becomes a folder, like `infected/`: a new behaviour is a `Mode`
  plus one function in `behaviours.ts`.
- **Adding a workbench upgrade:** an ID and an entry in `shared/upgrades.ts`, and its line in
  `upgradeEffects.ts` (the compiler insists). The list, checks and messages need no changes.
- **Numbers:** balance values that make sense alone go in `config.ts` (editable live in Studio).
  Tables and formulas (waves, loot, stack sizes) live in `src/shared/` so they can be unit-tested.

## Server authority (anti-exploit)

Anything that decides the game stays **server-side**: party lists, who's in the run, damage, and
config. Concretely:

- Config goes in `Configuration` instances in **ServerStorage** (`shared/serverConfig.ts`), not
  Workspace/ReplicatedStorage. Values come from code and overwrite the place file at startup;
  test-only values use `configInt`'s Studio override, never a value saved in the place.
- Lobby → main-game data goes through **MemoryStore** (`shared/partyHandoff.ts`), never
  `TeleportData` — it passes through the client and can be forged.
- Party membership lives in a server-side set (`src/main/server/party.ts`), not on replicated
  attributes. The same goes for health, inventory and coins as they arrive.
- Treat every `RemoteEvent` argument as hostile: type-check and validate it against server state.
- Send and receive remote messages only through `shared/net.ts`, with the message maps in
  `shared/remotes.ts`. Client -> server payloads arrive as `unknown` by design: validate them.

## Tests

Pure rules and validation get unit tests in `tests/unit/*.spec.luau` (run with `npm test`, Lune,
against compiled `out/`). When you add logic that can be a pure function — rates, thresholds,
geometry, validating client input — write it as one (no Roblox services) and add a spec. Check a
new test can fail (break the code briefly) before trusting it.

## Keep the docs current

When you add or change player-facing behaviour, update **README.md → Regression test checklist**
(and GAMEPLAY.md if the design changed). Tick off finished tasks in **PLAN.md**. New gameplay numbers go in `src/main/server/config.ts`
(or `src/lobby/server/config.ts`), not as constants scattered through the code.

## Gotchas

- **`MeshPart.Size` is a multiplier of the mesh's own scale, not studs.** Author meshes at final
  size and keep `Size` at `1,1,1`. Setting it to the mesh dimensions scales it up (this bit us:
  a 10-stud pad rendered 100 studs).
- **Roblox FBX import reads Blender as metres → cm → 1 cm = 1 stud.** Export at `EXPORT_SCALE = 0.01`
  (`tools/blender/build.py`) so a 10-unit model arrives at 10 studs. Always check Studio's
  **File Geometry** readout before importing; `1000` means the export scale is wrong.
- **Never `createRoot(PlayerGui)` (or any container with other children).** A react-roblox root
  clears its container's children — in PlayerGui that deleted Roblox's `TouchGui`, so phone/tablet
  players had no joystick and couldn't move. Root into an empty `Folder` and
  `createPortal(<App />, container)` instead (see the client entry files and `zoneDisplay.tsx`).
- **Review `npm run lint:fix` diffs — the roblox-ts rules' auto-fixes can break code.** It
  rewrote a helper named `spawn` into `task.spawn(player)`, and `return $tuple(x)` (needed by
  e.g. `DataStore:UpdateAsync`) into `return [x]`. Don't name things after Roblox globals; for
  `$tuple`, disable `roblox-ts/no-user-defined-lua-tuple` on that line.
- **Main-game clients: read server state from `src/main/client/gameState.ts` stores — don't add
  more `onServerMessage` listeners in UI components.** Roblox queues remote events until a
  listener connects but hands them only to the *first* one, so UI that subscribes later (after
  React mounts) missed messages — on a slow tablet the ghost never learned its role and had no
  spook panel. One early listener fills the stores; clients also send `Ready` and the server
  re-sends their state (`resync` in main.server.ts). New per-player messages need a store and a
  line in `resync`.
- **Content streaming is off** (`Workspace.StreamingEnabled: false` in every project file). The
  maps are small, and client code assumes other players' tools, lamps etc. exist; keep it off
  unless a map gets big.
- **Blender -Y (front) imports as Roblox -Z (a part's LookVector).** A model facing Blender's
  front faces the way its MeshPart's CFrame looks — no 180° turn needed (verified with the skull).
- **`MeshPart.MeshId` is read-only at runtime.** The asset ID lives in `assets/rojo/*.model.json`
  and is synced by Rojo — never set it from code. `findMeshAsset` in `src/shared/assets.ts` looks
  it up at runtime.
