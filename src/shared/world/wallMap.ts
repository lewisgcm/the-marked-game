import type { Ground, Route, Side } from "./tiles";

/**
 * The neighbourhood map on the hall wall (a workbench upgrade; main/client/hud/wallMap.tsx): where the
 * run's tiles, the bases and the kids go on it. Pure (only type imports), so it's unit-tested.
 *
 * The map is drawn north up: u runs west to east (0..1), v north (-Z) to south (0..1).
 */

/** A placed tile, as the client finds it: its middle in the world, and each side's route and ground (after turning). */
export interface MapTile {
	name: string;
	x: number;
	z: number;
	sides: Record<Side, { route: Route; ground: Ground } | undefined>;
}

export interface MapBounds {
	west: number;
	east: number;
	north: number;
	south: number;
}

/** The world area the tiles cover (each `tileSize` square). */
export function mapBounds(tiles: MapTile[], tileSize: number): MapBounds {
	const half = tileSize / 2;
	let [west, east, north, south] = [math.huge, -math.huge, math.huge, -math.huge];
	for (const tile of tiles) {
		west = math.min(west, tile.x - half);
		east = math.max(east, tile.x + half);
		north = math.min(north, tile.z - half);
		south = math.max(south, tile.z + half);
	}
	return { west, east, north, south };
}

/** Where a world position goes on the map (0..1 each way, clamped to its edge). */
export function toMap(bounds: MapBounds, x: number, z: number): { u: number; v: number } {
	const width = math.max(1, bounds.east - bounds.west);
	const depth = math.max(1, bounds.south - bounds.north);
	return { u: math.clamp((x - bounds.west) / width, 0, 1), v: math.clamp((z - bounds.north) / depth, 0, 1) };
}

/** What a tile is coloured as: the ground most of its sides have (Town first on a tie, then Grass, Forest, Swamp). */
export function tileGround(tile: MapTile): Ground {
	const order: Ground[] = ["Town", "Grass", "Forest", "Swamp"];
	let best: Ground = "Grass";
	let most = 0;
	for (const ground of order) {
		let count = 0;
		for (const [, side] of pairs(tile.sides)) {
			if (side?.ground === ground) {
				count += 1;
			}
		}
		if (count > most) {
			best = ground;
			most = count;
		}
	}
	return best;
}

/** The sides a road or path leaves the tile by, for drawing them from its middle. */
export function routesOut(tile: MapTile): Array<{ side: Side; route: Route }> {
	const out: Array<{ side: Side; route: Route }> = [];
	for (const side of ["North", "East", "South", "West"] as Side[]) {
		const edge = tile.sides[side];
		if (edge && edge.route !== "None") {
			out.push({ side, route: edge.route });
		}
	}
	return out;
}
