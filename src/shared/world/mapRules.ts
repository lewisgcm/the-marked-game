import type { LayoutRules, Placement } from "./layout";

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

/**
 * Where home's tile goes in the world: the middle of its street, so the family house (built in code,
 * src/main/server/world/world.ts) stays at the world's origin, on its plot.
 */
export const HOME_ORIGIN = { x: 0, z: -61 };

/** A map to use if the planner finds none (it never has, but a run must always start). Spec-checked. */
export const FALLBACK_TILES: Placement[] = [
	{ tile: "Treehouse", column: 0, row: 0, turns: 0 },
	{ tile: "Home", column: 1, row: 0, turns: 0 },
	{ tile: "FireStation", column: 2, row: 0, turns: 0 },
	{ tile: "Swamp_A", column: 0, row: 1, turns: 0 },
	{ tile: "ForestRoad_A", column: 1, row: 1, turns: 0 },
	{ tile: "Meadow_A", column: 2, row: 1, turns: 0 },
];
