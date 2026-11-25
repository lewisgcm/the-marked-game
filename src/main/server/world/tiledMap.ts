import { CollectionService, ServerStorage, Workspace } from "@rbxts/services";
import {
	CAR_SPOT_TAG,
	DAD_SPOT_TAG,
	DORMANT_SPOT_TAG,
	HOME_PLOT_TAG,
	INFECTED_SPAWN_TAG,
	WRECK_SPOT_TAG,
} from "shared/core/tags";
import {
	completeLayout,
	Layout,
	OpenEnd,
	planLayout,
	seededRandom,
	TILE_SIZE,
	tilePlacement,
} from "shared/world/layout";
import { FALLBACK_TILES, HOME_ORIGIN, MAP_RULES } from "shared/world/mapRules";
import { folder, part, place } from "shared/world/parts";
import { edgesJoin, Edges, OPPOSITE, parseEdge, SIDES, turnEdges } from "shared/world/tiles";
import { isCarName, loadCars, parkCar } from "./cars";
import type { Neighbourhood } from "./neighbourhood";
import { buildWrecks, isWreckName, WreckName } from "./wrecks";

/**
 * The map built from tiles (MAP.md): plans it from a seed, places the tiles, and reads their markers.
 * The tiles come in as models under ServerStorage.MapTiles (Rojo syncs build/tiles/models there; run
 * `npm run tiles:build`). The family house is still built in code (world.ts), on the Home tile's plot.
 */

const TILE_FOLDER = "MapTiles";

const EDGE_RULES = {
	sides: SIDES,
	opposite: OPPOSITE,
	edgesJoin,
	turnEdges,
	hasRoute: (edge: string) => parseEdge(edge)?.route !== "None",
};

export interface TiledMap extends Neighbourhood {
	/** Where infected appear at night (the Home tile's markers), each facing the house. */
	infectedSpawns: CFrame[];
	seed: number;
	/** Everything placed (Workspace.Map). */
	map: Folder;
}

/** The tile models, by name, with each one's edge labels. */
function readTiles(source: Instance) {
	const models = new Map<string, Model>();
	const catalogue: Record<string, Edges> = {};
	for (const model of source.GetChildren()) {
		if (!model.IsA("Model")) {
			continue;
		}
		const edge = (side: string) => (model.GetAttribute(side) as string | undefined) ?? "";
		models.set(model.Name, model);
		catalogue[model.Name] = { North: edge("North"), East: edge("East"), South: edge("South"), West: edge("West") };
	}
	return { models, catalogue };
}

/** Markers tagged `tag` in the map: hidden, and taken out of raycasts. Returns where they were. */
function takeMarkers(map: Instance, tag: string): CFrame[] {
	const found: CFrame[] = [];
	for (const marker of CollectionService.GetTagged(tag)) {
		if (marker.IsA("BasePart") && marker.IsDescendantOf(map)) {
			found.push(marker.CFrame);
			marker.Transparency = 1;
			marker.CanCollide = false;
			marker.CanQuery = false;
			marker.CanTouch = false;
		}
	}
	return found;
}

/**
 * Spot markers tagged `tag` in the map (a car's or a wreck's box, sitting on the ground): calls `use`
 * with each one's `attribute` and the ground under its middle, then removes it.
 */
function takeSpots(map: Instance, tag: string, attribute: string, use: (name: unknown, at: CFrame) => void) {
	for (const spot of CollectionService.GetTagged(tag)) {
		if (spot.IsA("BasePart") && spot.IsDescendantOf(map)) {
			use(spot.GetAttribute(attribute), spot.CFrame.mul(new CFrame(0, -spot.Size.Y / 2, 0)));
			spot.Destroy();
		}
	}
}

/** Parks the cars and puts the wrecks where the tiles' markers say. */
function placeCarsAndWrecks(map: Folder) {
	const cars = folder(map, "Cars");
	takeSpots(map, CAR_SPOT_TAG, "Car", (name, at) => {
		if (isCarName(name)) {
			parkCar(cars, name, at);
		} else {
			warn(`[Map] A CarSpot says Car = ${name}, which isn't a car.`);
		}
	});
	loadCars();
	const wrecks: Array<{ name: WreckName; at: CFrame }> = [];
	takeSpots(map, WRECK_SPOT_TAG, "Wreck", (name, at) => {
		if (isWreckName(name)) {
			wrecks.push({ name, at });
		} else {
			warn(`[Map] A WreckSpot says Wreck = ${name}, which isn't a wreck.`);
		}
	});
	buildWrecks(wrecks);
}

/** A red and white barrier across a road where it runs off the map. */
function roadblock(parent: Instance, at: CFrame) {
	for (let i = 0; i < 4; i++) {
		const white = i % 2 === 1;
		part(parent, "Barrier", new Vector3(6.5, 1, 0.4), at.mul(new CFrame(-10.5 + 7 * i, 2.4, 0)), {
			material: Enum.Material.SmoothPlastic,
			color: white ? new Color3(0.95, 0.95, 0.95) : new Color3(0.8, 0.12, 0.1),
		});
	}
	for (const x of [-10.5, -3.5, 3.5, 10.5]) {
		part(parent, "BarrierLeg", new Vector3(0.4, 2.4, 0.4), at.mul(new CFrame(x, 1.2, 0)), {
			material: Enum.Material.Metal,
		});
	}
}

/** Invisible walls round the outside of the map, so nobody walks off the edge. */
function boundary(parent: Instance, minX: number, maxX: number, minZ: number, maxZ: number) {
	const [midX, midZ] = [(minX + maxX) / 2, (minZ + maxZ) / 2];
	const [width, depth] = [maxX - minX, maxZ - minZ];
	const walls: Array<[number, number, number, number]> = [
		[minX - 1, midZ, 2, depth],
		[maxX + 1, midZ, 2, depth],
		[midX, minZ - 1, width, 2],
		[midX, maxZ + 1, width, 2],
	];
	for (const [x, z, sx, sz] of walls) {
		part(parent, "Boundary", new Vector3(sx, 120, sz), new CFrame(x, 40, z), { transparency: 1, shadow: false });
	}
}

/** Picks the run's seed: the configured one, or a new one. */
export function pickSeed(configured: number): number {
	return configured !== 0 ? configured : new Random().NextInteger(1, 2147483646);
}

/** Builds the run's map from tiles. Call before any system starts: it removes the tile templates. */
export function buildTiledMap(seed: number): TiledMap {
	const source = ServerStorage.FindFirstChild(TILE_FOLDER);
	if (!source) {
		error(`[Map] ServerStorage.${TILE_FOLDER} is missing: run \`npm run tiles:build\`, then sync again`);
	}
	const { models, catalogue } = readTiles(source);
	let layout: Layout | undefined = planLayout(MAP_RULES, catalogue, EDGE_RULES, seededRandom(seed));
	if (!layout) {
		warn(`[Map] No map fits the rules for seed ${seed}; using the fallback map.`);
		layout = completeLayout(FALLBACK_TILES, MAP_RULES, catalogue, EDGE_RULES);
	}
	print(`[Map] Seed ${seed}: ${layout.tiles.map((p) => `${p.tile}@${p.column},${p.row}`).join(" ")}`);

	const map = folder(Workspace, "Map");
	const home = MAP_RULES.fixed[0];
	const frameOf = (column: number, row: number, turns: number) => {
		const { x, z, yaw } = tilePlacement({ tile: "", column, row, turns }, home, HOME_ORIGIN);
		return new CFrame(x, 0, z).mul(CFrame.Angles(0, yaw, 0));
	};
	for (const placement of layout.tiles) {
		const template = models.get(placement.tile);
		if (!template) {
			warn(`[Map] There's no tile called ${placement.tile}.`);
			continue;
		}
		const tile = template.Clone();
		place(tile, frameOf(placement.column, placement.row, placement.turns));
		tile.Parent = map;
	}
	// The templates go now, before any system looks for tagged things (it would find them too).
	source.Destroy();

	const extras = folder(map, "Extras");
	const out: Record<string, CFrame> = {
		North: new CFrame(),
		East: CFrame.Angles(0, -math.pi / 2, 0),
		South: CFrame.Angles(0, math.pi, 0),
		West: CFrame.Angles(0, math.pi / 2, 0),
	};
	layout.openEnds.forEach((open: OpenEnd) => {
		// From the cell's middle out to just inside its edge, facing out.
		roadblock(
			extras,
			frameOf(open.column, open.row, 0)
				.mul(out[open.side])
				.mul(new CFrame(0, 0, -(TILE_SIZE / 2 - 2))),
		);
	});
	const xs = layout.tiles.map((p) => frameOf(p.column, p.row, 0).Position.X);
	const zs = layout.tiles.map((p) => frameOf(p.column, p.row, 0).Position.Z);
	const half = TILE_SIZE / 2;
	boundary(extras, math.min(...xs) - half, math.max(...xs) + half, math.min(...zs) - half, math.max(...zs) + half);

	for (const plot of CollectionService.GetTagged(HOME_PLOT_TAG)) {
		if (plot.IsDescendantOf(map)) {
			plot.Destroy(); // only there to show where the house goes
		}
	}
	placeCarsAndWrecks(map);
	const dad = takeMarkers(map, DAD_SPOT_TAG);
	if (dad.size() !== 1) {
		warn(`[Map] Expected one Dad spot, found ${dad.size()}.`);
	}
	return {
		dormantSpots: takeMarkers(map, DORMANT_SPOT_TAG),
		dadSpot: dad[0] ?? new CFrame(0, 3, -40),
		infectedSpawns: takeMarkers(map, INFECTED_SPAWN_TAG),
		seed,
		map,
	};
}
