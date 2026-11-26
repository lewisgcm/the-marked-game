import { CFrame, turn } from "../lib/cframe.ts";
import {
	buildingMesh,
	deadTree,
	door,
	loot,
	post,
	reeds,
	scatter,
	stones,
	wall,
	window,
	type Area,
} from "../lib/build.ts";
import { Random } from "../lib/random.ts";
import * as S from "../lib/styles.ts";
import { Tile } from "../lib/tile.ts";

/** Shallow water, dead trees and mud islands, with a shack in the middle. No road: boardwalks cross it. */
export function swampA(): Tile {
	const t = new Tile("Swamp_A", {
		North: "None/Swamp",
		East: "None/Swamp",
		South: "None/Grass",
		West: "None/Forest",
	});
	// The swamp bed is 1 below the ground; dry banks round the edge keep every edge at height 0.
	t.slab("Ground", -100, 100, -100, 100, -1, S.MUD, undefined, 2);
	t.slab("Bank", -100, 100, -100, -82, 0, S.MUD);
	t.slab("Bank", -100, 100, 76, 100, 0, S.GRASS);
	t.slab("Bank", -100, -78, -82, 76, 0, S.FOREST_FLOOR);
	t.slab("Bank", 82, 100, -82, 76, 0, S.MUD);
	const islands: Area[] = [
		[-60, -30, -60, -36],
		[-14, 22, -14, 18],
		[40, 66, -66, -40],
		[36, 60, 30, 58],
		[-64, -40, 24, 50],
	];
	for (const [x0, x1, z0, z1] of islands) t.slab("Island", x0, x1, z0, z1, 0, S.MUD);

	t.folder("Water");
	t.box("Water", 2, -0.4, -3, 160, 0.2, 158, S.WATER);

	t.folder("Boardwalk");
	t.slab("Boardwalk", 1, 7, 18, 76, 0.3, S.WOOD, undefined, 0.5); // from the south bank to the shack
	t.slab("Boardwalk", -40, -14, 2, 8, 0.3, S.WOOD, undefined, 0.5); // shack to the south-west island
	t.slab("Boardwalk", -46, -40, 2, 24, 0.3, S.WOOD, undefined, 0.5);
	t.slab("Boardwalk", 22, 82, -4, 2, 0.3, S.WOOD, undefined, 0.5); // shack to the east bank
	for (const [x, z] of [
		[1, 30],
		[7, 30],
		[1, 46],
		[7, 46],
		[1, 62],
		[7, 62],
		[38, -4],
		[38, 2],
		[54, -4],
		[54, 2],
		[70, -4],
		[70, 2],
	]) {
		post(t, "Pile", x, z, -1, 1.8, 0.7, S.DEAD_WOOD);
	}

	const shack = new CFrame(4, 0, 0);
	const floor = 0.3;
	t.folder("Shack");
	const shell = buildingMesh(t, "SwampShack", shack);
	t.slab("Floor", -11, 11, -9, 9, floor, S.FLOORBOARDS, shack);
	wall(t, "X", 9, -11, 11, floor, 9, [door(0)], shell(S.DEAD_WOOD), shack);
	wall(t, "X", -9, -11, 11, floor, 9, [window(0)], shell(S.DEAD_WOOD), shack);
	wall(t, "Z", -10.5, -8.5, 8.5, floor, 9, [], shell(S.DEAD_WOOD), shack);
	wall(t, "Z", 10.5, -8.5, 8.5, floor, 9, [door(-1)], shell(S.DEAD_WOOD), shack);
	t.slab("Roof", -12.5, 12.5, -10.5, 10.5, floor + 10, shell(S.ROOF), shack);
	loot(t, "Tackle box", "Garage", [3, 1.5, 2], shack.at(-8, floor + 0.75, -6.5), S.METAL);
	loot(t, "Cupboards", "Kitchen", [2, 3.5, 5], shack.at(-9, floor + 1.75, 2), S.WOOD);
	// Out on the north-east island: only reached by wading.
	loot(t, "Sunken crate", "Garage", [3, 3, 3], new CFrame(53, 1.5, -53).mul(turn(20)), S.WOOD);
	stones(t, -52, 38);

	t.folder("Plants");
	const walkways: Area[] = [
		[-20, 28, -20, 24],
		[-4, 12, 18, 100],
		[-48, -10, -2, 30],
		[20, 100, -10, 8],
		[46, 60, -60, -46],
		[-57, -47, 33, 43],
	];
	scatter(t, 22, 17, walkways, new Random(9), deadTree);
	const banks: Area[] = [
		[-100, 100, -100, -82],
		[-100, 100, 72, 100],
		[-100, -78, -100, 100],
		[82, 100, -100, 100],
	];
	scatter(t, 26, 9, [...walkways, ...banks], new Random(2), reeds);
	return t;
}
