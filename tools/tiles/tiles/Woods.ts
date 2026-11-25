import { CFrame, turn } from "../lib/cframe.ts";
import { marker, oak, pine, scatter, type Area } from "../lib/build.ts";
import { Random } from "../lib/random.ts";
import * as S from "../lib/styles.ts";
import { Tile } from "../lib/tile.ts";

/**
 * The woods along the map's south edge, behind home's row: border tiles, 200 wide and 100 deep (z -50
 * to 50), not part of the planned grid. North (towards home's row) is grass, thickening into pines.
 */

/** Pines and a few oaks, keeping out of `clear`. */
function woods(t: Tile, clear: Area[], seed: number) {
	t.slab("Ground", -100, 100, -50, 50, 0, S.FOREST_FLOOR, undefined, 2);
	t.slab("GrassEdge", -100, 100, -50, -36, 0.05, S.GRASS);
	t.folder("Trees");
	// Only within the strip: keep out of z beyond +-44.
	const outside: Area[] = [
		[-100, 100, -100, -47],
		[-100, 100, 47, 100],
	];
	scatter(t, 30, 12, [...outside, ...clear, [-100, 100, -50, -30]], new Random(seed), pine);
	scatter(t, 6, 16, [...outside, ...clear, [-100, 100, -26, 50]], new Random(seed + 1), oak);
}

/** Behind a tile that isn't home. */
export function woodsSouth(): Tile {
	const t = new Tile("Woods_South", {
		North: "None/Grass",
		East: "None/Forest",
		South: "None/Forest",
		West: "None/Forest",
	});
	woods(t, [], 31);
	return t;
}

/**
 * Behind home: the night's infected come out of these trees, from three spawns facing the house. Its
 * back wall is at z -66.5 here (16.5 beyond the woods' north edge); the spawns are 48 straight behind
 * it, as on the old map, and off its two back corners, about 42 from them.
 */
export function woodsBehindHome(): Tile {
	const t = new Tile("Woods_BehindHome", {
		North: "None/Grass",
		East: "None/Forest",
		South: "None/Forest",
		West: "None/Forest",
	});
	const clearings: Area[] = [
		[-12, 12, -30, -6],
		[-74, -50, -50, -26],
		[50, 74, -50, -26],
	];
	woods(t, clearings, 41);
	t.folder("Markers");
	marker(t, "InfectedSpawn", new CFrame(0, 3, -18.5), 2);
	// Each facing the middle of the house: 62 across and 51 north, so 50.6 degrees off north.
	marker(t, "InfectedSpawn", new CFrame(-62, 3, -38).mul(turn(-50.6)), 3);
	marker(t, "InfectedSpawn", new CFrame(62, 3, -38).mul(turn(50.6)), 4);
	return t;
}
