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
	BORDER_DEPTH,
	borderPlacements,
	completeLayout,
	Layout,
	planLayout,
	seededRandom,
	TILE_SIZE,
	tilePlacement,
} from "shared/world/layout";
import { FALLBACK_TILES, HOME_ORIGIN, MAP_RULES, SOUTH_BORDER } from "shared/world/mapRules";
import { folder, part, place } from "shared/world/parts";
import { Edges, Side, TILE_RULES } from "shared/world/tiles";
import { gameConfig } from "../core/config";
import { staffBases } from "./bases";
import { isCarName, loadCars, parkCar } from "./cars";
import { buildMainWorld, MainWorld } from "./world";
import { buildWrecks, isWreckName, WreckName } from "./wrecks";

/**
 * The map (MAP.md): planned from a seed, built from tiles, with the family house on the Home tile's plot.
 * The tiles come in as models under ServerStorage.MapTiles (Rojo syncs build/tiles/models there; run
 * `npm run tiles:build`). Their markers say where things go; this reads them and hides them.
 */

const TILE_FOLDER = "MapTiles";
/** Pieces the map places itself (the roadblock): ServerStorage.MapKit, from build/tiles/kit. */
const KIT_FOLDER = "MapKit";

/** What the day's phases need from the map. */
export interface Street {
	/** Where dormant infected stand, looking at their screens. */
	dormantSpots: CFrame[];
	/** Where Dad stands on Day 1: in the garden next door, staring in at the TV. (Spec: there's one.) */
	dadSpot?: CFrame;
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

/**
 * Markers tagged `tag` in the map: where they are, sorted by their Order attribute (unordered ones
 * last), then removed.
 */
function takeMarkers(map: Instance, tag: string): CFrame[] {
	const found: Array<{ at: CFrame; order: number }> = [];
	for (const marker of CollectionService.GetTagged(tag)) {
		if (marker.IsA("BasePart") && marker.IsDescendantOf(map)) {
			found.push({ at: marker.CFrame, order: tonumber(marker.GetAttribute("Order")) ?? math.huge });
			marker.Destroy();
		}
	}
	found.sort((a, b) => a.order < b.order);
	return found.map((f) => f.at);
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

/**
 * A red and white barrier across a road where it runs off the map: a copy of the MapKit's Roadblock (its
 * mesh and collider, built standing at the origin: tools/tiles/build.ts), or plain boards without it.
 */
function roadblock(parent: Instance, at: CFrame) {
	const piece = ServerStorage.FindFirstChild(KIT_FOLDER)?.FindFirstChild("Roadblock");
	if (piece) {
		const copy = piece.Clone();
		for (const part of copy.GetDescendants()) {
			if (part.IsA("BasePart")) {
				part.CFrame = at.mul(part.CFrame);
			}
		}
		copy.Parent = parent;
		return;
	}
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

/** How to face out of each side of a tile. */
const FACING: Record<Side, CFrame> = {
	North: new CFrame(),
	East: CFrame.Angles(0, -math.pi / 2, 0),
	South: CFrame.Angles(0, math.pi, 0),
	West: CFrame.Angles(0, math.pi / 2, 0),
};

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

/**
 * A roadblock where each road runs off the map, and invisible walls round the map (and the woods
 * behind home's row). `frameOf` is where a cell's middle is.
 */
function closeEdges(map: Folder, layout: Layout, frameOf: (column: number, row: number, turns: number) => CFrame) {
	const extras = folder(map, "Extras");
	for (const open of layout.openEnds) {
		// From the cell's middle out to just inside its edge, facing out.
		const middle = frameOf(open.column, open.row, 0);
		roadblock(extras, middle.mul(FACING[open.side]).mul(new CFrame(0, 0, -(TILE_SIZE / 2 - 2))));
	}
	const xs = layout.tiles.map((p) => frameOf(p.column, p.row, 0).Position.X);
	const zs = layout.tiles.map((p) => frameOf(p.column, p.row, 0).Position.Z);
	const half = TILE_SIZE / 2;
	const [west, east] = [math.min(...xs) - half, math.max(...xs) + half];
	boundary(extras, west, east, math.min(...zs) - half, math.max(...zs) + half + BORDER_DEPTH);
}

/**
 * Builds the run's map: plans it from the seed (MapSeed, or a new one), places the tiles and the woods
 * behind home's row, builds the family house, and puts in what the markers say. Call before any system
 * starts: it removes the tile templates, which tag searches would find too.
 */
export function buildMap(): { world: MainWorld; street: Street } {
	const source = ServerStorage.FindFirstChild(TILE_FOLDER);
	if (!source) {
		error(`[Map] ServerStorage.${TILE_FOLDER} is missing: run \`npm run tiles:build\`, then sync again`);
	}
	const { models, catalogue } = readTiles(source);
	const configured = gameConfig.mapSeed.Value;
	const seed = configured !== 0 ? configured : new Random().NextInteger(1, 2147483646);
	let layout: Layout | undefined = planLayout(MAP_RULES, catalogue, TILE_RULES, seededRandom(seed));
	if (!layout) {
		warn(`[Map] No map fits the rules for seed ${seed}; using the fallback map.`);
		layout = completeLayout(FALLBACK_TILES, MAP_RULES, catalogue, TILE_RULES);
	}
	print(`[Map] Seed ${seed}: ${layout.tiles.map((p) => `${p.tile}@${p.column},${p.row}`).join(" ")}`);

	const map = folder(Workspace, "Map");
	const home = MAP_RULES.fixed[0];
	const frameOf = (column: number, row: number, turns: number) => {
		const { x, z, yaw } = tilePlacement({ tile: "", column, row, turns }, home, HOME_ORIGIN);
		return new CFrame(x, 0, z).mul(CFrame.Angles(0, yaw, 0));
	};
	const put = (name: string, at: CFrame) => {
		const template = models.get(name);
		if (!template) {
			warn(`[Map] There's no tile called ${name}.`);
			return;
		}
		const tile = template.Clone();
		place(tile, at);
		tile.Parent = map;
	};
	for (const placement of layout.tiles) {
		put(placement.tile, frameOf(placement.column, placement.row, placement.turns));
	}
	for (const border of borderPlacements(MAP_RULES, SOUTH_BORDER, home, HOME_ORIGIN)) {
		put(border.tile, new CFrame(border.x, 0, border.z));
	}
	source.Destroy();

	closeEdges(map, layout, frameOf);

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
	const world = buildMainWorld(takeMarkers(map, INFECTED_SPAWN_TAG));
	staffBases(map);
	return { world, street: { dormantSpots: takeMarkers(map, DORMANT_SPOT_TAG), dadSpot: dad[0] } };
}
