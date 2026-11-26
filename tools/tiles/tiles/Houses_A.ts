import { CFrame, turn } from "../lib/cframe.ts";
import { bungalow, edgeLines, fence, giveWay, oak, pavement, roadLines, streetLamp, verge } from "../lib/build.ts";
import { Random } from "../lib/random.ts";
import * as S from "../lib/styles.ts";
import { Tile } from "../lib/tile.ts";

/** A residential street with a side road north: four bungalows in fenced gardens, and a small green. */
export function housesA(): Tile {
	const t = new Tile("Houses_A", { North: "Road/Grass", East: "Road/Town", South: "None/Grass", West: "Road/Town" });
	t.slab("Ground", -100, 100, -100, 100, 0, S.GRASS, undefined, 2);

	t.folder("Road");
	t.slab("Road", -100, 100, -11, 11, 0.1, S.ROAD);
	t.slab("Road", -11, 11, -100, -11, 0.1, S.ROAD);
	pavement(t, -100, 100, 11, 17, ["minZ"]);
	pavement(t, -100, -11, -17, -11, ["maxZ", "maxX"]);
	pavement(t, 11, 100, -17, -11, ["maxZ", "minX"]);
	// The side road's pavements stop short of its (grass) north edge; past them it's a country road.
	pavement(t, -17, -11, -60, -17, ["maxX"]);
	pavement(t, 11, 17, -60, -17, ["minX"]);
	verge(t, -11, 11, -100, -60);
	edgeLines(t, 0, -100, 0, -60);
	roadLines(t, -98, 0, 98, 0);
	roadLines(t, 0, -98, 0, -16);
	giveWay(t, 0.3, 10.7, -11.8, -1);

	// The front gardens are short, so the cars are parked along the kerb.
	const kerb = new CFrame(13, 0.1, -37.5).mul(turn(90));
	bungalow(t, new CFrame(-50, 0, 45), { car: "Estate", at: kerb });
	bungalow(t, new CFrame(50, 0, 45), { car: "Hatchback", at: kerb });
	bungalow(t, new CFrame(-50, 0, -45).mul(turn(180)), { car: "Minivan", at: kerb });
	bungalow(t, new CFrame(50, 0, -45).mul(turn(180)));

	t.folder("Gardens");
	for (const x of [-78, -22, 22, 78]) {
		fence(t, x, 26, x, 86);
		fence(t, x, -86, x, -26);
	}
	for (const [a, b] of [
		[-78, -22],
		[22, 78],
	]) {
		fence(t, a, 86, b, 86);
		fence(t, a, -86, b, -86);
	}
	const random = new Random(3);
	const trees = [
		[-68, 76],
		[-32, 74],
		[68, 76],
		[34, 78],
		[-68, -76],
		[-34, -78],
		[66, -76],
		[32, -74],
		[0, 62],
		[-8, 84],
		[9, 82],
		[90, 60],
		[-90, 66],
		[-90, -50],
		[90, -44],
	];
	for (const [x, z] of trees) oak(t, x, z, random);
	t.box("Bench", 0, 1.6, 40, 6, 0.4, 2, S.WOOD);
	for (const x of [-2.4, 2.4]) t.box("BenchLeg", x, 0.7, 40, 0.5, 1.4, 1.8, S.METAL);

	t.folder("StreetLamps");
	for (const x of [-82, -25, 25, 82]) streetLamp(t, new CFrame(x, 0, 15.5));
	return t;
}
