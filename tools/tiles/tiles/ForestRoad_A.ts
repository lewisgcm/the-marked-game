import { CFrame, turn } from "../lib/cframe.ts";
import {
	buildingMesh,
	campfire,
	door,
	dormant,
	logSeat,
	loot,
	oak,
	pine,
	roadLines,
	scatter,
	stones,
	tent,
	tv,
	wall,
	window,
} from "../lib/build.ts";
import { Random } from "../lib/random.ts";
import * as S from "../lib/styles.ts";
import { Tile } from "../lib/tile.ts";

/** A bend in the road through dense pines, with a ranger hut and an abandoned camp. */
export function forestRoadA(): Tile {
	const t = new Tile("ForestRoad_A", {
		North: "None/Forest",
		East: "Road/Forest",
		South: "Road/Grass",
		West: "None/Forest",
	});
	t.slab("Ground", -100, 100, -100, 100, 0, S.FOREST_FLOOR, undefined, 2);
	t.slab("GrassEdge", -100, 100, 76, 100, 0.05, S.GRASS);

	t.folder("Road");
	t.slab("Road", -11, 11, -11, 100, 0.1, S.ROAD);
	t.slab("Road", 11, 100, -11, 11, 0.1, S.ROAD);
	roadLines(t, 12, 0, 98, 0);
	roadLines(t, 0, 12, 0, 98);

	// The hut's porch faces the bend.
	const hut = new CFrame(-46, 0, -40).mul(turn(-135));
	const floor = 0.3;
	t.folder("RangerHut");
	const shell = buildingMesh(t, "RangerHut", hut);
	t.slab("Floor", -12, 12, -9, 9, floor, S.FLOORBOARDS, hut);
	t.slab("Porch", -12, 12, -14, -9, floor, S.WOOD, hut);
	wall(t, "X", -9, -12, 12, floor, 10, [window(-6), door(5)], shell(S.WOOD), hut);
	wall(t, "X", 9, -12, 12, floor, 10, [], shell(S.WOOD), hut);
	for (const x of [-11.5, 11.5]) wall(t, "Z", x, -8.5, 8.5, floor, 10, [window(0)], shell(S.WOOD), hut);
	t.slab("Roof", -13.5, 13.5, -15, 10.5, floor + 11, shell(S.ROOF), hut);
	for (const x of [-11, 11]) t.box("PorchPost", x, floor + 5, -13.5, 0.7, 10, 0.7, shell(S.WOOD), hut);
	t.box("Desk", -4, floor + 1.5, 6.8, 7, 3, 2.5, S.WOOD, hut);
	tv(t, hut.at(-4, floor + 4.4, 7.4), [4, 2.6, 0.3]);
	dormant(t, hut.at(-4, floor + 3, 0).mul(turn(180)));
	loot(t, "Supply locker", "Garage", [3, 6, 2], hut.at(6.5, floor + 3, 7), S.METAL);
	loot(t, "Cupboards", "Kitchen", [2, 3.5, 5], hut.at(9.8, floor + 1.75, -4.5), S.WOOD);

	t.folder("Camp");
	campfire(t, 48, 48);
	tent(t, new CFrame(64, 0, 58).mul(turn(40)));
	logSeat(t, 42, 48, 90);
	logSeat(t, 48, 41, 0);
	loot(t, "Rucksack", "Drawers", [2, 2, 1.5], new CFrame(55, 1, 44), S.CANVAS);
	stones(t, -60, 40);

	t.folder("Trees");
	const clear: Array<[number, number, number, number]> = [
		[-17, 17, -17, 100],
		[-17, 100, -17, 17],
		[-68, -22, -64, -16],
		[34, 78, 34, 74],
		[-64, -56, 36, 44],
		[-100, 100, 80, 100],
	];
	scatter(t, 58, 12, clear, new Random(21), pine);
	// Broad trees where the forest thins out to grass, by the south edge.
	scatter(
		t,
		5,
		18,
		[
			[-100, 100, -100, 84],
			[-20, 20, 0, 100],
		],
		new Random(4),
		oak,
	);
	return t;
}
