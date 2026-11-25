/**
 * Builds the map tiles from tools/tiles/tiles/*.ts into Rojo model files (build/tiles/models), which
 * the gallery and, later, the game read. Run by `npm run tiles`. See MAP.md.
 *
 * Hand-edited tiles (assets/tiles) aren't built here: a tile is either coded here or hand-edited there.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import type { Tile } from "./lib/tile.ts";
import { forestRoadA } from "./tiles/ForestRoad_A.ts";
import { housesA } from "./tiles/Houses_A.ts";
import { meadowA } from "./tiles/Meadow_A.ts";
import { swampA } from "./tiles/Swamp_A.ts";
import { treehouse } from "./tiles/Treehouse.ts";

/** Every coded tile. A new tile: a file in tiles/, a line here, and its section in MAP.md. */
const TILES: Array<() => Tile> = [housesA, treehouse, meadowA, forestRoadA, swampA];

const OUT = "build/tiles/models";
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
