import { CFrame, turn } from "../lib/cframe.ts";
import { bungalow, fence, oak, roadLines, streetLamp } from "../lib/build.ts";
import { Random } from "../lib/random.ts";
import * as S from "../lib/styles.ts";
import { Tile } from "../lib/tile.ts";

/**
 * Home: Maple Street with the family house on it, and four neighbours (GAMEPLAY.md §5, §8). Always at
 * the bottom middle of the map, never turned.
 *
 * The house itself isn't in the tile: the game builds it in code (src/main/server/world/world.ts),
 * because barricades, lamps, the generator and the infected all depend on it. The tile leaves a hole in
 * the ground for its basement and a blue HomePlot box showing where it goes.
 *
 * Lined up with today's map: this tile's middle is the game's (0, -61), the middle of the street, so the
 * house's own origin is (0, 61) here.
 */
export function home(): Tile {
	const t = new Tile("Home", { North: "Road/Grass", East: "Road/Town", South: "None/Grass", West: "Road/Town" });
	// The house's footprint (world.ts: x -30..30, z -22..22, plus its walls), here.
	const [plotX, plotZ0, plotZ1] = [30.5, 38.5, 83.5];

	// Grass all round, with a hole where the house (and its basement) goes.
	t.slab("Ground", -100, 100, -100, plotZ0, 0, S.GRASS, undefined, 2);
	t.slab("Ground", -100, 100, plotZ1, 100, 0, S.GRASS, undefined, 2);
	t.slab("Ground", -100, -plotX, plotZ0, plotZ1, 0, S.GRASS, undefined, 2);
	t.slab("Ground", plotX, 100, plotZ0, plotZ1, 0, S.GRASS, undefined, 2);

	t.folder("Road");
	t.slab("Road", -100, 100, -11, 11, 0.1, S.ROAD);
	t.slab("Road", -11, 11, -100, -11, 0.1, S.ROAD);
	t.slab("Pavement", -100, 100, 11, 17, 0.2, S.PAVING);
	t.slab("Pavement", -100, -11, -17, -11, 0.2, S.PAVING);
	t.slab("Pavement", 11, 100, -17, -11, 0.2, S.PAVING);
	t.slab("Pavement", -17, -11, -60, -17, 0.2, S.PAVING);
	t.slab("Pavement", 11, 17, -60, -17, 0.2, S.PAVING);
	roadLines(t, -98, 0, 98, 0);
	roadLines(t, 0, -98, 0, -12);

	t.folder("HomePlot");
	// From the basement floor (-12) to the roof (26).
	t.box("HomePlot", 0, 7, 61, plotX * 2, 38, plotZ1 - plotZ0, S.PLOT, undefined, { tags: ["HomePlot"] });
	t.slab("Driveway", 15, 27, 17, plotZ0, 0.15, S.PAVING);
	t.slab("Path", 4, 8, 17, plotZ0, 0.15, S.PAVING);

	// Next door either side, and two across the street.
	const left = new CFrame(-72, 0, 55);
	bungalow(t, left);
	bungalow(t, new CFrame(72, 0, 55));
	bungalow(t, new CFrame(-60, 0, -37).mul(turn(180)));
	bungalow(t, new CFrame(60, 0, -37).mul(turn(180)));
	t.inFolder("Markers", () =>
		// Day 1: Dad, in the left neighbour's front garden, staring in at the living-room TV.
		t.part("DadSpot", [2, 5, 1], left.at(-10, 2.5, -17).mul(turn(180)), S.MARKER, { tags: ["DadSpot"] }),
	);

	t.folder("Gardens");
	// Hedges between the gardens, and fences round the ones across the street.
	for (const x of [-42, 42]) t.box("Hedge", x, 1.5, 58, 3, 3, 36, S.HEDGE);
	for (const x of [-92, 92]) t.box("Hedge", x, 1.5, 58, 3, 3, 36, S.HEDGE);
	for (const [a, b] of [
		[-88, -32],
		[32, 88],
	]) {
		fence(t, a, -92, b, -92);
		fence(t, a, -92, a, -26);
		fence(t, b, -92, b, -26);
	}
	const random = new Random(13);
	for (const [x, z] of [
		[-50, 90],
		[-90, 88],
		[50, 92],
		[88, 86],
		[-80, -70],
		[80, -72],
		[-40, -84],
		[38, -82],
		[0, 92],
	]) {
		oak(t, x, z, random);
	}

	t.folder("StreetLamps");
	for (const x of [-82, -25, 25, 82]) streetLamp(t, new CFrame(x, 0, 15.5));
	return t;
}
