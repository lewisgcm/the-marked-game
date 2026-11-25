import { CFrame, turn, UPRIGHT } from "../lib/cframe.ts";
import { campfire, logSeat, oak, pine, post, roadLines, scatter, signText, stones, wall } from "../lib/build.ts";
import { Random } from "../lib/random.ts";
import * as S from "../lib/styles.ts";
import { Tile } from "../lib/tile.ts";

/** The kids' base: a clearing in a pine forest at the end of the road. Safe, so nothing to loot. */
export function treehouse(): Tile {
	const t = new Tile("Treehouse", {
		North: "None/Forest",
		East: "Road/Grass",
		South: "None/Forest",
		West: "None/Forest",
	});
	t.slab("Ground", -100, 100, -100, 100, 0, S.FOREST_FLOOR, undefined, 2);
	t.slab("GrassEdge", 72, 100, -100, 100, 0.05, S.GRASS);
	t.part("Clearing", [0.5, 84, 84], new CFrame(0, -0.17, 0).mul(UPRIGHT), S.DIRT, { shape: "Cylinder" });

	t.folder("Road");
	t.slab("Road", 34, 100, -11, 11, 0.1, S.ROAD);
	roadLines(t, 40, 0, 98, 0);

	// The tree's front (-Z) faces the road, to the east.
	const tree = new CFrame(-14, 0, 0).mul(turn(-90));
	t.folder("Treehouse");
	post(t, "Trunk", 0, 0, -1, 30, 6, S.BARK, tree);
	for (const [x, y, z, size] of [
		[0, 34, 0, 26],
		[-10, 30, 4, 16],
		[10, 31, -3, 17],
	]) {
		t.part("Leaves", [size, size, size], tree.at(x, y, z), S.LEAVES, { shape: "Ball" });
	}
	// The house up in the branches (for show: the gang trades from the foot of the tree).
	t.slab("Deck", -11, 11, -9, 9, 14, S.WOOD, tree);
	wall(t, "X", -7, -8, 8, 14, 7, [[0, 4, 2, 5]], S.WOOD, tree);
	wall(t, "X", 7, -8, 8, 14, 7, [], S.WOOD, tree);
	wall(t, "Z", -7.5, -6.5, 6.5, 14, 7, [], S.WOOD, tree);
	wall(t, "Z", 7.5, -6.5, 6.5, 14, 7, [], S.WOOD, tree);
	t.slab("Roof", -10, 10, -9, 9, 22, S.BARK, tree);
	for (let i = 0; i < 9; i++) t.box("Rung", 0, 1 + 1.5 * i, -3.2, 3, 0.4, 0.5, S.WOOD, tree);
	t.part("Sign", [14, 3, 0.5], tree.at(0, 11.5, -9), S.WOOD, { children: [signText("TREEHOUSE")] });
	t.box("Counter", 0, 1.5, -12, 8, 3, 1.5, S.WOOD, tree, { tags: ["Trader"], attributes: { Base: "Treehouse" } });

	t.folder("Camp");
	campfire(t, 16, 24);
	logSeat(t, 9, 24, 90);
	logSeat(t, 16, 31, 0);
	logSeat(t, 23, 24, 90);
	stones(t, 18, -28);

	t.folder("Trees");
	scatter(
		t,
		44,
		13,
		[
			[-44, 44, -44, 44],
			[30, 100, -16, 16],
			[74, 100, -100, 100],
		],
		new Random(11),
		pine,
	);
	// A few broad trees in the grass by the road.
	scatter(
		t,
		4,
		16,
		[
			[-100, 78, -100, 100],
			[0, 100, -18, 18],
		],
		new Random(5),
		oak,
	);
	return t;
}
