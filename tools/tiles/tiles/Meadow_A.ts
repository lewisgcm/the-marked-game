import { CFrame, turn } from "../lib/cframe.ts";
import {
	buildingMesh,
	door,
	EDGE_LINE_AT,
	fence,
	GRASS_PATCHES,
	hayBale,
	line,
	loot,
	oak,
	patches,
	roadLines,
	rock,
	scatter,
	stones,
	verge,
	wall,
} from "../lib/build.ts";
import { Random } from "../lib/random.ts";
import * as S from "../lib/styles.ts";
import { Tile } from "../lib/tile.ts";

/** Open fields round a bend in the road: a barn, broken fences, hay bales. Little cover. */
export function meadowA(): Tile {
	const t = new Tile("Meadow_A", {
		North: "Road/Grass",
		East: "None/Grass",
		South: "None/Grass",
		West: "Road/Grass",
	});
	t.slab("Ground", -100, 100, -100, 100, 0, S.GRASS, undefined, 2);
	patches(t, 16, [], new Random(34), GRASS_PATCHES);

	t.folder("Road");
	t.slab("Road", -11, 11, -100, 11, 0.1, S.ROAD);
	t.slab("Road", -100, -11, -11, 11, 0.1, S.ROAD);
	roadLines(t, -98, 0, -12, 0);
	roadLines(t, 0, -98, 0, -12);
	// Country road: worn verges, and edge lines that turn the corner without overlapping.
	verge(t, -11, 11, -100, 11);
	verge(t, -100, -11, -11, 11, 0.004);
	line(t, EDGE_LINE_AT, -100, EDGE_LINE_AT, EDGE_LINE_AT + 0.2, 0.4);
	line(t, -100, EDGE_LINE_AT, EDGE_LINE_AT - 0.2, EDGE_LINE_AT, 0.4);
	line(t, -EDGE_LINE_AT, -100, -EDGE_LINE_AT, -EDGE_LINE_AT + 0.2, 0.4);
	line(t, -100, -EDGE_LINE_AT, -EDGE_LINE_AT - 0.2, -EDGE_LINE_AT, 0.4);

	// The barn's wide door faces the bend.
	const barn = new CFrame(48, 0, 38).mul(turn(45));
	t.folder("Barn");
	const shell = buildingMesh(t, "Barn", barn);
	t.slab("Floor", -14, 14, -10, 10, 0.2, S.DIRT, barn);
	wall(t, "X", -10, -14, 14, 0.2, 12, [[0, 10, 0, 9]], shell(S.BARN_WALL), barn);
	wall(t, "X", 10, -14, 14, 0.2, 12, [door(-8)], shell(S.BARN_WALL), barn);
	for (const x of [-13.5, 13.5]) wall(t, "Z", x, -9.5, 9.5, 0.2, 12, [], shell(S.BARN_WALL), barn);
	t.slab("Roof", -15.5, 15.5, -11.5, 11.5, 13.2, shell(S.ROOF), barn);
	for (const [x, y, z] of [
		[10, 1.7, 6],
		[10, 1.7, 1.5],
		[10, 4.7, 4],
	])
		hayBale(t, barn.at(x, y - 1.5, z));
	loot(t, "Tool chest", "Garage", [4, 2.5, 2.5], barn.at(-10, 1.45, -7), S.METAL);
	loot(t, "Workshop drawers", "Drawers", [2, 3.5, 5], barn.at(-12, 1.95, 2), S.WOOD);

	t.folder("Field");
	for (const [x, z, degrees] of [
		[24, 74, 20],
		[-30, 60, 70],
		[-62, 40, 10],
		[70, -40, 50],
		[44, -70, 0],
		[-70, 78, 35],
	]) {
		hayBale(t, new CFrame(x, 0, z).mul(turn(degrees)));
	}
	fence(t, 17, -92, 17, -24);
	fence(t, -92, 17, -28, 17);
	fence(t, 88, -88, 88, -20);
	fence(t, -88, 90, -20, 90);
	stones(t, -46, -46);
	stones(t, 74, 74);
	for (const [x, z, w] of [
		[-60, -70, 6],
		[-54, -66, 3.5],
		[30, -30, 4],
	]) {
		rock(t, w, new CFrame(x, 0, z).mul(turn(w * 20)));
	}

	t.folder("Trees");
	const clear: Array<[number, number, number, number]> = [
		[-100, 20, -20, 20],
		[-20, 20, -100, 20],
		[22, 74, 12, 64],
		[-76, -20, 24, 96],
		[10, 34, 64, 84],
	];
	scatter(t, 14, 16, clear, new Random(8), oak);
	return t;
}
