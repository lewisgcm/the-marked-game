/**
 * Builds the map tiles from tools/tiles/tiles/*.ts into Rojo model files (build/tiles/models), which
 * the game and the gallery read. Run by `npm run tiles:build`, `npm run tiles`, and `npm run tiles:watch`
 * (again on every save; with --gallery, it lays the gallery out too). See MAP.md.
 *
 * Hand-edited tiles (assets/tiles) aren't built here: a tile is either coded here or hand-edited there.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { roadblock } from "./lib/build.ts";
import { CFrame } from "./lib/cframe.ts";
import { Tile } from "./lib/tile.ts";
import { fireStation } from "./tiles/FireStation.ts";
import { forestRoadA } from "./tiles/ForestRoad_A.ts";
import { home } from "./tiles/Home.ts";
import { housesA } from "./tiles/Houses_A.ts";
import { meadowA } from "./tiles/Meadow_A.ts";
import { swampA } from "./tiles/Swamp_A.ts";
import { treehouse } from "./tiles/Treehouse.ts";
import { woodsBehindHome, woodsSouth } from "./tiles/Woods.ts";
import { lobbyHall } from "./lobby/Hall.ts";

/** Every coded tile. A new tile: a file in tiles/, a line here, and its section in MAP.md. */
const TILES: Array<() => Tile> = [
	home,
	fireStation,
	housesA,
	treehouse,
	meadowA,
	forestRoadA,
	swampA,
	woodsSouth,
	woodsBehindHome,
];

/**
 * Pieces the game places itself, not tiles: ServerStorage.MapKit (build/tiles/kit). Each is built standing
 * at the origin; the game moves a copy where it's wanted.
 */
const PIECES: Array<() => Tile> = [
	() => {
		const t = new Tile("Roadblock");
		roadblock(t, new CFrame());
		return t;
	},
];

/** The lobby's hall (lobby/Hall.ts): build/lobby/Hall.model.json, straight into the lobby's Workspace. */
const LOBBY_OUT = "build/lobby";

const OUT = "build/tiles/models";
const KIT_OUT = "build/tiles/kit";
const HAND_EDITED = "assets/tiles";

mkdirSync(OUT, { recursive: true });
const written = new Set<string>();
for (const make of TILES) {
	const tile = make();
	const file = `${tile.name}.model.json`;
	if (written.has(file)) throw new Error(`Two tiles are called ${tile.name}`);
	if (existsSync(`${HAND_EDITED}/${file}`)) {
		throw new Error(
			`${tile.name} is hand-edited (${HAND_EDITED}/${file}): delete its code, or the hand-edited file`,
		);
	}
	writeFileSync(`${OUT}/${file}`, tile.toJson());
	written.add(file);
}
// Tiles whose code has gone. (Not the whole folder: Rojo may be watching it.)
for (const file of readdirSync(OUT)) if (!written.has(file)) rmSync(`${OUT}/${file}`);
console.log(`Built ${written.size} tiles into ${OUT}`);

mkdirSync(KIT_OUT, { recursive: true });
const pieces = new Set<string>();
for (const make of PIECES) {
	const piece = make();
	writeFileSync(`${KIT_OUT}/${piece.name}.model.json`, piece.toJson());
	pieces.add(`${piece.name}.model.json`);
}
for (const file of readdirSync(KIT_OUT)) if (!pieces.has(file)) rmSync(`${KIT_OUT}/${file}`);

mkdirSync(LOBBY_OUT, { recursive: true });
writeFileSync(`${LOBBY_OUT}/Hall.model.json`, lobbyHall().toJson());
console.log(`Built the lobby hall into ${LOBBY_OUT}`);

if (process.argv.includes("--gallery")) {
	spawnSync("lune", ["run", "tools/tiles/gallery"], { stdio: "inherit" });
}
