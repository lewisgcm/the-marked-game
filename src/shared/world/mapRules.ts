import type { LayoutRules } from "./layout";

/**
 * The run's map (MAP.md): what's fixed, which places every run has and how far out, and what fills
 * the rest. A trial for now: 3 x 2 tiles. Home is at the bottom middle; the Treehouse is always on
 * home's row, the Fire Station there or the row behind.
 */
export const MAP_RULES: LayoutRules = {
	columns: 3,
	rows: 2,
	fixed: [{ tile: "Home", column: 1, row: 0, turns: 0 }],
	places: [
		{ tile: "Treehouse", nearest: 0, furthest: 0 },
		{ tile: "FireStation", nearest: 0, furthest: 1 },
	],
	fillers: [
		{ tile: "Houses_A", most: 2 },
		{ tile: "Meadow_A", most: 2 },
		{ tile: "ForestRoad_A", most: 2 },
		{ tile: "Swamp_A", most: 1 },
	],
	start: "Home",
};
