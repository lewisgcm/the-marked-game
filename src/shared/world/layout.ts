import type { Edges, Side } from "./tiles";

/**
 * Picks a run's map: which tiles go where on the grid, and which way round (MAP.md). Pure, with the
 * random numbers passed in, so it's unit-tested; the same seed always gives the same map.
 *
 * Imports only types (Lune can't load roblox-ts runtime imports), so the edge rules come in through
 * `TileRules`: pass in `edgesJoin`, `turnEdges` and the rest from shared/world/tiles.ts.
 *
 * The grid is `columns` wide and `rows` deep. Row 0 is the south (home's) row; rows count north.
 */

/** A tile on the grid. `turns` is clockwise quarter turns. */
export interface Placement {
	tile: string;
	column: number;
	row: number;
	turns: number;
}

/** A road or path that runs off the edge of the map: the game blocks it (a roadblock, say). */
export interface OpenEnd {
	column: number;
	row: number;
	side: Side;
	/** The edge label, after turning. */
	edge: string;
}

export interface Layout {
	tiles: Placement[];
	openEnds: OpenEnd[];
}

export interface LayoutRules {
	columns: number;
	rows: number;
	/** Tiles always in the same place, e.g. home. */
	fixed: Placement[];
	/** Places every run has exactly once, somewhere in rows `nearest` to `furthest`. */
	places: Array<{ tile: string; nearest: number; furthest: number }>;
	/** Tiles to fill the rest with, each used at most `most` times. */
	fillers: Array<{ tile: string; most: number }>;
	/** Every place must be reachable from this tile by road or path. */
	start: string;
}

/** The edge rules, from shared/world/tiles.ts. */
export interface TileRules {
	sides: Side[];
	opposite: Record<Side, Side>;
	edgesJoin: (a: string, b: string) => boolean;
	turnEdges: (edges: Edges, turns: number) => Edges;
	/** Whether an edge carries a road or path. */
	hasRoute: (edge: string) => boolean;
}

/** Each tile's edges, by name. */
export type Catalogue = Record<string, Edges>;

/** How many tries at placing the places, and how many steps each try may take. */
const PLACE_TRIES = 40;
const STEPS_PER_TRY = 4000;

const STEP: Record<Side, [number, number]> = { North: [0, 1], East: [1, 0], South: [0, -1], West: [-1, 0] };

/** Shuffles a copy of `list`. */
function shuffled<T extends defined>(list: T[], random: () => number): T[] {
	const copy = [...list];
	for (let i = copy.size() - 1; i > 0; i--) {
		const j = math.min(i, math.floor(random() * (i + 1)));
		const swap = copy[i];
		copy[i] = copy[j];
		copy[j] = swap;
	}
	return copy;
}

/** A grid of placements, indexed by column and row. */
class Grid {
	private readonly cells: Array<Placement | undefined> = [];
	constructor(
		readonly columns: number,
		readonly rows: number,
	) {}
	inside(column: number, row: number) {
		return column >= 0 && column < this.columns && row >= 0 && row < this.rows;
	}
	get(column: number, row: number): Placement | undefined {
		return this.inside(column, row) ? this.cells[row * this.columns + column] : undefined;
	}
	set(column: number, row: number, placement: Placement | undefined) {
		this.cells[row * this.columns + column] = placement;
	}
}

/** The edges of a placement, after turning. */
function edgesOf(placement: Placement, catalogue: Catalogue, rules: TileRules): Edges {
	return rules.turnEdges(catalogue[placement.tile], placement.turns);
}

/** Whether `placement` joins every neighbour already on the grid. */
function fits(placement: Placement, grid: Grid, catalogue: Catalogue, rules: TileRules): boolean {
	const mine = edgesOf(placement, catalogue, rules);
	for (const side of rules.sides) {
		const [dx, dy] = STEP[side];
		const other = grid.get(placement.column + dx, placement.row + dy);
		if (other && !rules.edgesJoin(mine[side], edgesOf(other, catalogue, rules)[rules.opposite[side]])) {
			return false;
		}
	}
	return true;
}

/** Every tile that can be reached from `start` along roads and paths. (A tile's routes all join inside it.) */
function reachable(start: Placement, grid: Grid, catalogue: Catalogue, rules: TileRules): Set<Placement> {
	const seen = new Set<Placement>([start]);
	const queue = [start];
	while (queue.size() > 0) {
		const here = queue.remove(0)!;
		const edges = edgesOf(here, catalogue, rules);
		for (const side of rules.sides) {
			const [dx, dy] = STEP[side];
			const neighbour = grid.get(here.column + dx, here.row + dy);
			if (neighbour && !seen.has(neighbour) && rules.hasRoute(edges[side])) {
				seen.add(neighbour);
				queue.push(neighbour);
			}
		}
	}
	return seen;
}

/** Everything wrong with a finished layout, as messages (empty when it's good). */
export function checkLayout(
	layout: Layout,
	layoutRules: LayoutRules,
	catalogue: Catalogue,
	rules: TileRules,
): string[] {
	const problems: string[] = [];
	const grid = new Grid(layoutRules.columns, layoutRules.rows);
	for (const placement of layout.tiles) {
		if (!catalogue[placement.tile]) {
			problems.push(`${placement.tile} isn't a tile`);
		} else if (!grid.inside(placement.column, placement.row)) {
			problems.push(`${placement.tile} is off the grid`);
		} else if (grid.get(placement.column, placement.row)) {
			problems.push(`two tiles at ${placement.column}, ${placement.row}`);
		} else {
			grid.set(placement.column, placement.row, placement);
		}
	}
	if (problems.size() > 0) {
		return problems;
	}
	for (let row = 0; row < layoutRules.rows; row++) {
		for (let column = 0; column < layoutRules.columns; column++) {
			const placement = grid.get(column, row);
			if (!placement) {
				problems.push(`nothing at ${column}, ${row}`);
			} else if (!fits(placement, grid, catalogue, rules)) {
				problems.push(`${placement.tile} at ${column}, ${row} doesn't join its neighbours`);
			}
		}
	}
	for (const fixed of layoutRules.fixed) {
		const placed = grid.get(fixed.column, fixed.row);
		if (!placed || placed.tile !== fixed.tile || placed.turns !== fixed.turns) {
			problems.push(`${fixed.tile} isn't where it's fixed`);
		}
	}
	const start = layout.tiles.find((p) => p.tile === layoutRules.start);
	const reached = start ? reachable(start, grid, catalogue, rules) : new Set<Placement>();
	for (const place of layoutRules.places) {
		const found = layout.tiles.filter((p) => p.tile === place.tile);
		if (found.size() !== 1) {
			problems.push(`${place.tile} is there ${found.size()} times`);
		} else if (found[0].row < place.nearest || found[0].row > place.furthest) {
			problems.push(`${place.tile} is in row ${found[0].row}, not ${place.nearest}-${place.furthest}`);
		} else if (!reached.has(found[0])) {
			problems.push(`${place.tile} can't be reached by road from ${layoutRules.start}`);
		}
	}
	for (const filler of layoutRules.fillers) {
		const fixedCount = layoutRules.fixed.filter((p) => p.tile === filler.tile).size();
		const count = layout.tiles.filter((p) => p.tile === filler.tile).size() - fixedCount;
		if (count > filler.most) {
			problems.push(`${filler.tile} is used ${count} times (at most ${filler.most})`);
		}
	}
	return problems;
}

/** The roads and paths that run off the edge of the map. */
function openEnds(tiles: Placement[], grid: Grid, catalogue: Catalogue, rules: TileRules): OpenEnd[] {
	const ends: OpenEnd[] = [];
	for (const placement of tiles) {
		const edges = edgesOf(placement, catalogue, rules);
		for (const side of rules.sides) {
			const [dx, dy] = STEP[side];
			if (!grid.inside(placement.column + dx, placement.row + dy) && rules.hasRoute(edges[side])) {
				ends.push({ column: placement.column, row: placement.row, side, edge: edges[side] });
			}
		}
	}
	return ends;
}

/** A layout from a list of placements (a hand-made one, say), with its open ends worked out. */
export function completeLayout(
	tiles: Placement[],
	layoutRules: LayoutRules,
	catalogue: Catalogue,
	rules: TileRules,
): Layout {
	const grid = new Grid(layoutRules.columns, layoutRules.rows);
	tiles.forEach((p) => grid.set(p.column, p.row, p));
	return { tiles, openEnds: openEnds(tiles, grid, catalogue, rules) };
}

/** Tiles' size, in studs. */
export const TILE_SIZE = 200;

/**
 * Where a tile goes in the world: the middle of its cell, and how far to turn it about the vertical
 * (radians, as `CFrame.Angles(0, yaw, 0)`). `origin` is where the middle of `anchor`'s cell is
 * (home's); rows count north (-Z). A positive turn is clockwise from above, so yaw is negative.
 */
export function tilePlacement(
	placement: Placement,
	anchor: { column: number; row: number },
	origin: { x: number; z: number },
): { x: number; z: number; yaw: number } {
	return {
		x: origin.x + (placement.column - anchor.column) * TILE_SIZE,
		z: origin.z - (placement.row - anchor.row) * TILE_SIZE,
		yaw: (-placement.turns * math.pi) / 2,
	};
}

/**
 * A map following `layoutRules`, or undefined if none could be found (the caller should have a
 * known-good one to fall back on). `random` gives 0..1.
 */
export function planLayout(
	layoutRules: LayoutRules,
	catalogue: Catalogue,
	rules: TileRules,
	random: () => number,
): Layout | undefined {
	const { columns, rows } = layoutRules;
	for (let attempt = 0; attempt < PLACE_TRIES; attempt++) {
		const grid = new Grid(columns, rows);
		layoutRules.fixed.forEach((p) => grid.set(p.column, p.row, p));

		// Where each place goes this try (it's turned later, to fit).
		const placeAt = new Map<number, string>();
		let placed = true;
		for (const place of layoutRules.places) {
			const free: number[] = [];
			for (let row = place.nearest; row <= math.min(place.furthest, rows - 1); row++) {
				for (let column = 0; column < columns; column++) {
					if (!grid.get(column, row) && !placeAt.has(row * columns + column)) {
						free.push(row * columns + column);
					}
				}
			}
			if (free.size() === 0) {
				placed = false;
				break;
			}
			placeAt.set(free[math.min(free.size() - 1, math.floor(random() * free.size()))], place.tile);
		}
		if (!placed) {
			continue;
		}

		// Fill the grid a cell at a time, row by row, backing up when a cell has nothing that fits.
		const used = new Map<string, number>();
		let steps = 0;
		const fill = (index: number): boolean => {
			if (++steps > STEPS_PER_TRY) {
				return false;
			}
			if (index === columns * rows) {
				return checkLayout(finish(grid), layoutRules, catalogue, rules).size() === 0;
			}
			const [column, row] = [index % columns, math.floor(index / columns)];
			if (grid.get(column, row)) {
				return fill(index + 1); // fixed
			}
			const place = placeAt.get(index);
			const choices: Placement[] = [];
			const tiles = place !== undefined ? [place] : layoutRules.fillers.map((f) => f.tile);
			for (const tile of tiles) {
				const filler = layoutRules.fillers.find((f) => f.tile === tile);
				if (place === undefined && (!filler || (used.get(tile) ?? 0) >= filler.most)) {
					continue;
				}
				for (let turns = 0; turns < 4; turns++) {
					choices.push({ tile, column, row, turns });
				}
			}
			for (const choice of shuffled(choices, random)) {
				if (!fits(choice, grid, catalogue, rules)) {
					continue;
				}
				grid.set(column, row, choice);
				if (place === undefined) used.set(choice.tile, (used.get(choice.tile) ?? 0) + 1);
				if (fill(index + 1)) {
					return true;
				}
				if (place === undefined) used.set(choice.tile, used.get(choice.tile)! - 1);
				grid.set(column, row, undefined);
			}
			return false;
		};
		const finish = (g: Grid): Layout => {
			const tiles: Placement[] = [];
			for (let row = 0; row < rows; row++) {
				for (let column = 0; column < columns; column++) {
					const p = g.get(column, row);
					if (p) tiles.push(p);
				}
			}
			return completeLayout(tiles, layoutRules, catalogue, rules);
		};
		if (fill(0)) {
			return finish(grid);
		}
	}
	return undefined;
}

/**
 * Random numbers (0..1) from a seed, the same in the game and the tools, so a seed always gives the
 * same map (Park-Miller: plain arithmetic, exact in doubles).
 */
export function seededRandom(seed: number): () => number {
	let state = (math.floor(math.abs(seed)) % 2147483646) + 1;
	const step = () => {
		state = (state * 48271) % 2147483647;
		return (state - 1) / 2147483646;
	};
	// The first few numbers from nearby seeds are tiny and alike; skip them.
	for (let i = 0; i < 10; i++) {
		step();
	}
	return step;
}
