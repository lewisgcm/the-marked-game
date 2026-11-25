import type { LayoutRules } from "./layout";

/**
 * The run's map (MAP.md): what's fixed, which places every run has and how far out, and what fills
 * the rest. A trial for now: 3 x 2 tiles, Houses_A standing in for home until the home tile exists.
 */
export const MAP_RULES: LayoutRules = {
	columns: 3,
	rows: 2,
	fixed: [{ tile: "Houses_A", column: 1, row: 0, turns: 0 }],
	places: [{ tile: "Treehouse", nearest: 0, furthest: 0 }],
	fillers: [
		{ tile: "Meadow_A", most: 2 },
		{ tile: "ForestRoad_A", most: 2 },
		{ tile: "Swamp_A", most: 1 },
		{ tile: "Houses_A", most: 1 },
	],
	start: "Houses_A",
};
