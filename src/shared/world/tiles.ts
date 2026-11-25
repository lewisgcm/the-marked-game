/**
 * Map tiles' edges (MAP.md): which tiles can sit side by side. Pure, so it's unit-tested, and the
 * same rules serve the game, the layout planner and the tile checks (tools/tiles/tiles.luau).
 *
 * Every edge is "Route/Ground", e.g. "Road/Forest". Two edges join when the route is the same and
 * the grounds can meet. North is -Z, east is +X.
 */

export type Side = "North" | "East" | "South" | "West";
export type Route = "Road" | "Path" | "None";
export type Ground = "Town" | "Grass" | "Forest" | "Swamp";

/** Clockwise from above: turning a tile a quarter turn moves each edge one step along this list. */
export const SIDES: Side[] = ["North", "East", "South", "West"];

/** A tile's four edge labels. */
export type Edges = Record<Side, string>;

const ROUTES: Route[] = ["Road", "Path", "None"];

/** Which grounds may meet at a seam (the same both ways round). */
export const GROUND_JOINS: Record<Ground, Ground[]> = {
	Town: ["Town", "Grass"],
	Grass: ["Town", "Grass", "Forest", "Swamp"],
	Forest: ["Grass", "Forest", "Swamp"],
	Swamp: ["Grass", "Forest", "Swamp"],
};

/** The side facing `side` across a seam. */
export const OPPOSITE: Record<Side, Side> = { North: "South", East: "West", South: "North", West: "East" };

/** "Road/Forest" -> its route and ground; undefined if it isn't a valid label. */
export function parseEdge(label: unknown): { route: Route; ground: Ground } | undefined {
	if (!typeIs(label, "string")) {
		return undefined;
	}
	const parts = label.split("/");
	if (parts.size() !== 2) {
		return undefined;
	}
	const route = ROUTES.find((r) => r === parts[0]);
	const ground = (["Town", "Grass", "Forest", "Swamp"] as Ground[]).find((g) => g === parts[1]);
	return route && ground ? { route, ground } : undefined;
}

/** Whether two edges may touch: the same route, and grounds that can meet. */
export function edgesJoin(a: string, b: string): boolean {
	const edgeA = parseEdge(a);
	const edgeB = parseEdge(b);
	return (
		edgeA !== undefined &&
		edgeB !== undefined &&
		edgeA.route === edgeB.route &&
		GROUND_JOINS[edgeA.ground].includes(edgeB.ground)
	);
}

/** A tile's edges after `turns` clockwise quarter turns: one turn puts its north edge on the east. */
export function turnEdges(edges: Edges, turns: number): Edges {
	const at = (i: number) => edges[SIDES[(((i - turns) % 4) + 4) % 4]];
	return { North: at(0), East: at(1), South: at(2), West: at(3) };
}

/** Whether an edge carries a road or path. */
export function hasRoute(edge: string): boolean {
	const parsed = parseEdge(edge);
	return parsed !== undefined && parsed.route !== "None";
}

/**
 * The edge rules, bundled for the layout planner (shared/world/layout.ts), which imports only types
 * and so is handed these.
 */
export interface TileRules {
	sides: Side[];
	opposite: Record<Side, Side>;
	edgesJoin: (a: string, b: string) => boolean;
	turnEdges: (edges: Edges, turns: number) => Edges;
	hasRoute: (edge: string) => boolean;
}

export const TILE_RULES: TileRules = { sides: SIDES, opposite: OPPOSITE, edgesJoin, turnEdges, hasRoute };
