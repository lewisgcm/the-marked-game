import { CFrame, turn, UPRIGHT } from "./cframe.ts";
import { hasKitMesh, kitMesh, kitSize, type KitName } from "./kit.ts";

export { hasKitMesh };
import { Random } from "./random.ts";
import * as S from "./styles.ts";
import type { Style } from "./styles.ts";
import type { Instance, LootKind, Tile } from "./tile.ts";

/**
 * Pieces tiles are made of: walls, trees, fences, loot, markers. Change one here and every tile changes.
 * Trees, hedges, fences, rocks, hay, reeds, lamps and the camp things are map kit meshes (kit.ts) with
 * plain-part colliders, or their blockouts until the kit is uploaded.
 */

/** A rectangle on the ground: x0..x1 by z0..z1. */
export type Area = [number, number, number, number];

/** A door or window cut into a wall: centre along the wall, width, bottom and top (from the wall's base). */
export type Opening = [number, number, number, number];
export const door = (center: number, width = 5): Opening => [center, width, 0, 8];
export const window = (center: number): Opening => [center, 5, 3, 8];

/**
 * The solid pieces of a wall from `start` to `finish` with `openings` cut out: full-height pieces
 * between openings, a sill below and a lintel above each. (The game's own walls: src/shared/world/walls.ts.)
 */
function wallPieces(start: number, finish: number, height: number, openings: Opening[]) {
	const pieces: Array<[number, number, number, number]> = [];
	const add = (from: number, to: number, bottom: number, top: number) => {
		if (to - from > 0.01 && top - bottom > 0.01) pieces.push([from, to, bottom, top]);
	};
	let cursor = start;
	for (const [center, width, bottom, top] of [...openings].sort((a, b) => a[0] - b[0])) {
		const left = Math.max(start, center - width / 2);
		const right = Math.min(finish, center + width / 2);
		add(cursor, left, 0, height);
		add(left, right, 0, bottom);
		add(left, right, top, height);
		cursor = right;
	}
	add(cursor, finish, 0, height);
	return pieces;
}

/** A wall along X at z = `at` (or along Z at x = `at`), from `from` to `to`, standing on `base`. */
export function wall(
	t: Tile,
	along: "X" | "Z",
	at: number,
	from: number,
	to: number,
	base: number,
	height: number,
	openings: Opening[],
	style: Style,
	frame = new CFrame(),
) {
	for (const [a, b, bottom, top] of wallPieces(from, to, height, openings)) {
		const [length, middle, tall, y] = [b - a, (a + b) / 2, top - bottom, base + (bottom + top) / 2];
		if (along === "X") t.box("Wall", middle, y, at, length, tall, 1, style, frame);
		else t.box("Wall", at, y, middle, 1, tall, length, style, frame);
	}
}

/** An upright cylinder from `y0` to `y1`. */
export function post(
	t: Tile,
	name: string,
	x: number,
	z: number,
	y0: number,
	y1: number,
	diameter: number,
	style: Style,
	frame = new CFrame(),
) {
	t.part(name, [y1 - y0, diameter, diameter], frame.at(x, (y0 + y1) / 2, z).mul(UPRIGHT), style, {
		shape: "Cylinder",
	});
}

/** A cylinder lying down along its frame's X. */
export function log(t: Tile, name: string, length: number, diameter: number, frame: CFrame, style = S.BARK) {
	t.part(name, [length, diameter, diameter], frame, style, { shape: "Cylinder" });
}

/** An invisible part that collides, for a mesh that doesn't. */
export function collider(t: Tile, size: [number, number, number], at: CFrame) {
	t.part("Collider", size, at, S.COLLIDER);
}

/** The kit variant for `value` in `from`..`to`: the range split evenly between `variants`. */
function variant(value: number, from: number, to: number, variants: KitName[]): KitName {
	const i = Math.floor(((value - from) / (to - from)) * variants.length);
	return variants[Math.min(variants.length - 1, Math.max(0, i))];
}

/** A small light, as a child of a part. */
export function pointLight(color: [number, number, number], range: number, brightness: number): Instance {
	return {
		name: "Glow",
		className: "PointLight",
		properties: { Color: color, Range: range, Brightness: brightness },
	};
}

/** Text on the front (-Z) face of a part. */
export function signText(text: string): Instance {
	return {
		name: "Text",
		className: "SurfaceGui",
		properties: { Face: "Front", SizingMode: "PixelsPerStud", PixelsPerStud: 30 },
		children: [
			{
				name: "Label",
				className: "TextLabel",
				properties: {
					Size: {
						UDim2: [
							[1, 0],
							[1, 0],
						],
					},
					BackgroundTransparency: 1,
					TextScaled: true,
					TextColor3: [1, 0.95, 0.85],
					Text: text,
				},
			},
		],
	};
}

// --- Things the game uses (tags; see MAP.md) ---------------------------------------------------------

/** Something kids can search; `kind` picks its loot table. */
export function loot(t: Tile, name: string, kind: LootKind, size: [number, number, number], at: CFrame, style: Style) {
	t.inFolder("Loot", () => t.part(name, size, at, style, { tags: ["LootContainer"], attributes: { Kind: kind } }));
}

/** A patch of stones to pick up. */
export function stones(t: Tile, x: number, z: number, frame = new CFrame()) {
	t.inFolder("Loot", () => t.part("Stones", [3, 0.6, 3], frame.at(x, 0.3, z), S.STONE, { tags: ["Stones"] }));
}

/**
 * A marker the game reads, then hides: `at` is where an infected's middle goes (3 above the floor),
 * its front (-Z) the way it faces. `tag` says what for (MAP.md). `order` sorts markers of a kind:
 * the night's first spawn (Order 1) is where Dad comes from.
 */
export function marker(t: Tile, tag: "DormantSpot" | "DadSpot" | "InfectedSpawn", at: CFrame, order?: number) {
	const attributes = order !== undefined ? { Order: `${order}` } : undefined;
	t.inFolder("Markers", () => t.part(tag, [2, 5, 1], at, S.MARKER, { tags: [tag], attributes }));
}

/** The parked cars' models (src/main/server/world/cars.ts), and their sizes for the markers. */
const CARS = {
	Minivan: [6.21, 6.46, 13.6],
	Hatchback: [5.61, 4.71, 11.4],
	Estate: [5.81, 6.3, 14.6],
	IceCreamVan: [7.25, 9.3, 13.4],
} satisfies Record<string, [number, number, number]>;
export type CarName = keyof typeof CARS;

/** The street wrecks (src/main/server/world/wrecks.ts, which has their colliders, loot and fires). */
const WRECKS = {
	SchoolBus: [8.4, 7.8, 22.2],
	Tank: [9, 5.8, 14],
	Ambulance: [5.8, 8, 13.4],
	CrashedCar: [5.2, 4.3, 11],
	BurntCar: [5, 4.1, 10.8],
} satisfies Record<string, [number, number, number]>;
export type WreckName = keyof typeof WRECKS;

/**
 * Where the game parks a car (its model, loaded in code, with a boot to search). `at` is on the
 * ground under its middle, its front (-Z) the way it faces; the marker is the car's size.
 */
export function car(t: Tile, name: CarName, at: CFrame) {
	const size = CARS[name];
	t.inFolder("Markers", () =>
		t.part("CarSpot", size, at.at(0, size[1] / 2, 0), S.MARKER, { tags: ["CarSpot"], attributes: { Car: name } }),
	);
}

/** Where the game puts a wreck (its model, colliders, loot and fires). Like `car`. */
export function wreck(t: Tile, name: WreckName, at: CFrame) {
	const size = WRECKS[name];
	t.inFolder("Markers", () =>
		t.part("WreckSpot", size, at.at(0, size[1] / 2, 0), S.MARKER, {
			tags: ["WreckSpot"],
			attributes: { Wreck: name },
		}),
	);
}

/** Where a dormant infected stands (its middle, 3 above the floor), facing its screen. */
export function dormant(t: Tile, at: CFrame) {
	marker(t, "DormantSpot", at);
}

/** A glowing screen: what a dormant infected stares at. */
export function tv(t: Tile, at: CFrame, size: [number, number, number] = [5, 3, 0.3]) {
	t.part("TV", size, at, S.SCREEN, { children: [pointLight([0.55, 0.75, 1], 14, 1.2)] });
}

/** A street lamp on the pavement; its light hangs out over the road (-Z) and comes on at sundown. */
export function streetLamp(t: Tile, frame: CFrame) {
	const mesh = kitMesh(t, "StreetLamp", frame);
	if (mesh) collider(t, [0.6, 14, 0.6], frame.at(0, 7, 0));
	else t.box("LampPost", 0, 7, 0, 0.6, 14, 0.6, S.METAL, frame);
	const light: Instance = {
		name: "Light",
		className: "SpotLight",
		properties: {
			Face: "Bottom",
			Angle: 110,
			Range: 34,
			Brightness: 3,
			Color: [1, 0.82, 0.55],
			Enabled: false,
			Tags: ["StreetLight"],
		},
	};
	// With the mesh, the head is an invisible part that holds the light.
	t.box("LampHead", 0, 14, -1, 2, 0.5, 3, mesh ? S.COLLIDER : S.METAL, frame, { children: [light] });
}

// --- Buildings ---------------------------------------------------------------------------------------

/**
 * Building mesh `name` (map_buildings.py) at `frame`, and the style for its blockout's shell (walls, roof,
 * posts): invisible colliders under the mesh, or the blockout's own look until the mesh is uploaded. The
 * mesh is modelled on the blockout's numbers, so change both together. Floors, loot and so on stay.
 */
export function buildingMesh(t: Tile, name: KitName, frame: CFrame): (style: Style) => Style {
	const meshed = kitMesh(t, name, frame);
	return (style) => (meshed ? S.COLLIDER : style);
}

/**
 * A neighbour's bungalow, 36 x 26, its front (-Z) to the street: living room (TV, someone watching it,
 * drawers) on the left, kitchen (cupboards, tool chest) on the right, a path and stones out front.
 */
export function bungalow(t: Tile, frame: CFrame, parked?: { car: CarName; at: CFrame }) {
	const [floor, halfW, halfD, height] = [0.3, 18, 13, 11];
	t.folder("Houses");
	const shell = buildingMesh(t, "Bungalow", frame);
	t.slab("Floor", -halfW, halfW, -halfD, halfD, floor, S.FLOORBOARDS, frame);
	t.slab("Roof", -19.5, 19.5, -14.5, 14.5, floor + height + 1, shell(S.ROOF), frame);
	wall(t, "X", -halfD, -halfW, halfW, floor, height, [window(-10), door(6)], shell(S.HOUSE_WALL), frame);
	wall(t, "X", halfD, -halfW, halfW, floor, height, [door(10)], shell(S.HOUSE_WALL), frame);
	// The side walls stop inside the front and back walls, so the corners don't overlap.
	wall(t, "Z", -halfW + 0.5, -halfD + 0.5, halfD - 0.5, floor, height, [window(4)], shell(S.HOUSE_WALL), frame);
	wall(t, "Z", halfW - 0.5, -halfD + 0.5, halfD - 0.5, floor, height, [window(-4)], shell(S.HOUSE_WALL), frame);
	wall(t, "Z", 0, -halfD + 0.5, halfD - 0.5, floor, height, [door(4)], shell(S.HOUSE_WALL), frame);

	t.box("TVStand", -10, floor + 1, 11, 6, 2, 2, S.WOOD, frame);
	tv(t, frame.at(-10, floor + 3.6, 11.6));
	dormant(t, frame.at(-10, floor + 3, 4).mul(turn(180)));
	loot(t, "Drawers", "Drawers", [2, 3.5, 5], frame.at(-16, floor + 1.75, -5), S.WOOD);
	loot(t, "Cupboards", "Kitchen", [2.5, 3.5, 8], frame.at(15.5, floor + 1.75, 4), S.WOOD);
	loot(t, "Tool chest", "Garage", [4, 2.5, 2.5], frame.at(3.5, floor + 1.25, 10.5), S.METAL);

	t.folder("Gardens");
	t.slab("Path", 4, 8, -28, -halfD - 0.5, 0.12, S.PAVING, frame);
	stones(t, -3, -21, frame);
	if (parked) car(t, parked.car, frame.mul(parked.at));
}

// --- Nature ------------------------------------------------------------------------------------------

/** A pine: a trunk and three tiers of needles, 20-30 tall. */
export function pine(t: Tile, x: number, z: number, random: Random) {
	const height = random.between(20, 30);
	const width = random.between(8, 10.5);
	const spin = random.between(0, 90);
	const name = variant(height, 20, 30, ["Pine_A", "Pine_B", "Pine_C"]);
	if (kitMesh(t, name, new CFrame(x, 0, z).mul(turn(spin * 4)))) {
		const tall = kitSize(name)[1] * 0.6;
		collider(t, [1.4, tall, 1.4], new CFrame(x, tall / 2, z));
		return;
	}
	const frame = new CFrame(x, 0, z).mul(turn(spin));
	post(t, "Trunk", 0, 0, 0, height * 0.7, 1.8, S.BARK, frame);
	[1, 0.72, 0.42].forEach((scale, i) => {
		const w = width * scale;
		t.box("Leaves", 0, height * (0.34 + 0.25 * i), 0, w, height * 0.27, w, S.PINE_NEEDLES, frame.mul(turn(45 * i)));
	});
}

/** A broad tree: a trunk and two blocks of leaves, 9-13 to the crown. */
export function oak(t: Tile, x: number, z: number, random: Random) {
	const height = random.between(9, 13);
	const width = random.between(8, 11);
	const spin = random.between(0, 90);
	const name = variant(height, 9, 13, ["Oak_A", "Oak_B", "Oak_C"]);
	if (kitMesh(t, name, new CFrame(x, 0, z).mul(turn(spin * 4)))) {
		const tall = kitSize(name)[1] * 0.45;
		collider(t, [1.8, tall, 1.8], new CFrame(x, tall / 2, z));
		return;
	}
	const frame = new CFrame(x, 0, z).mul(turn(spin));
	post(t, "Trunk", 0, 0, 0, height, 2, S.BARK, frame);
	t.box("Leaves", 0, height + 1.5, 0, width, width * 0.7, width, S.LEAVES, frame);
	t.box(
		"Leaves",
		0,
		height + width * 0.45,
		0,
		width * 0.65,
		width * 0.5,
		width * 0.65,
		S.LEAVES,
		frame.mul(turn(45)),
	);
}

/** A bare, dead tree standing in the water (from y = -1). */
export function deadTree(t: Tile, x: number, z: number, random: Random) {
	const height = random.between(10, 17);
	const frame = new CFrame(x, 0, z).mul(turn(random.between(0, 360)));
	const branches = [random.between(0, 360), random.between(0, 360)];
	const name = variant(height, 10, 17, ["DeadTree_A", "DeadTree_B", "DeadTree_C"]);
	if (kitMesh(t, name, frame.at(0, -1, 0))) {
		const tall = kitSize(name)[1] * 0.5;
		collider(t, [1.4, tall, 1.4], new CFrame(x, tall / 2 - 1, z));
		return;
	}
	post(t, "DeadTrunk", 0, 0, -1, height, 1.6, S.DEAD_WOOD, frame);
	[0.55, 0.75].forEach((k, i) => {
		t.box("Branch", 1.6, height * k, 0, 4, 0.5, 0.5, S.DEAD_WOOD, frame.mul(turn(branches[i])));
	});
}

/** A clump of three reeds. */
export function reeds(t: Tile, x: number, z: number, random: Random) {
	const stems = [0, 1, 2].map(() => [random.between(-1.5, 1.5), random.between(-1.5, 1.5), random.between(3, 4.5)]);
	if (kitMesh(t, "Reeds", new CFrame(x, 0, z).mul(turn(stems[0][0] * 120)))) return;
	for (const [dx, dz, height] of stems) t.box("Reed", x + dx, 0.9, z + dz, 0.35, height, 0.35, S.REEDS);
}

/**
 * Puts `count` things at random spots at least `gap` apart, keeping out of `avoid` (and 3 studs
 * round it), within `reach` of the middle. Fails the build if they don't fit.
 */
export function scatter(
	t: Tile,
	count: number,
	gap: number,
	avoid: Area[],
	random: Random,
	place: (t: Tile, x: number, z: number, random: Random) => void,
	reach = 93,
) {
	const placed: Array<[number, number]> = [];
	for (let tries = 0; placed.length < count && tries < 6000; tries++) {
		const [x, z] = [random.between(-reach, reach), random.between(-reach, reach)];
		if (avoid.some(([x0, x1, z0, z1]) => x0 - 3 < x && x < x1 + 3 && z0 - 3 < z && z < z1 + 3)) continue;
		if (placed.some(([a, b]) => (x - a) ** 2 + (z - b) ** 2 < gap * gap)) continue;
		placed.push([x, z]);
		place(t, x, z, random);
	}
	if (placed.length < count) {
		throw new Error(
			`${t.name}: only room for ${placed.length} of ${count} things (spread them less, or avoid less)`,
		);
	}
}

// --- Props -------------------------------------------------------------------------------------------

/** A straight wooden fence from (x0, z0) to (x1, z1), along X or Z. */
export function fence(t: Tile, x0: number, z0: number, x1: number, z1: number) {
	const length = Math.hypot(x1 - x0, z1 - z0);
	const frame = new CFrame((x0 + x1) / 2, 0, (z0 + z1) / 2).mul(turn(Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 0 : 90));
	if (hasKitMesh("FencePost")) {
		meshFence(t, length, frame);
		return;
	}
	for (const y of [1.2, 2.4]) t.box("Rail", 0, y, 0, length, 0.5, 0.3, S.WOOD, frame);
	const posts = Math.max(1, Math.round(length / 8));
	for (let i = 0; i <= posts; i++)
		t.box("Post", -length / 2 + (length * i) / posts, 1.5, 0, 0.6, 3, 0.6, S.WOOD, frame);
}

/**
 * A fence from the kit: posts 8 apart, and a shorter last run (6, 4 or 2), so it may end up to a stud
 * short of or past `length`. One collider the length of it.
 */
function meshFence(t: Tile, length: number, frame: CFrame) {
	const runs: number[] = [];
	for (let left = Math.round(length / 2) * 2; left > 0; left -= Math.min(8, left)) runs.push(Math.min(8, left));
	const total = runs.reduce((a, b) => a + b, 0);
	let x = -total / 2;
	kitMesh(t, "FencePost", frame.at(x, 0, 0));
	for (const run of runs) {
		kitMesh(t, `FenceRails_${run}` as KitName, frame.at(x + run / 2, 0, 0));
		x += run;
		kitMesh(t, "FencePost", frame.at(x, 0, 0));
	}
	collider(t, [total, 3, 0.6], frame.at(0, 1.5, 0));
}

/**
 * A red and white barrier across a road, 28 wide along `frame`'s X, standing at `frame`. The game puts one
 * wherever a road runs off the map (world/map.ts, from the MapKit piece build.ts writes).
 */
export function roadblock(t: Tile, frame: CFrame) {
	if (kitMesh(t, "Roadblock", frame)) {
		collider(t, [28, 3, 0.8], frame.at(0, 1.5, 0));
		return;
	}
	for (let i = 0; i < 4; i++) {
		t.box("Barrier", -10.5 + 7 * i, 2.4, 0, 6.5, 1, 0.4, i % 2 === 1 ? S.BARRIER_WHITE : S.BARRIER_RED, frame);
	}
	for (const x of [-10.5, -3.5, 3.5, 10.5]) t.box("BarrierLeg", x, 1.2, 0, 0.4, 2.4, 0.4, S.METAL, frame);
}

/** Dashes down the middle of a road, from one point to another. */
export function roadLines(t: Tile, x0: number, z0: number, x1: number, z1: number) {
	const count = Math.floor(Math.hypot(x1 - x0, z1 - z0) / 16);
	const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
	for (let i = 0; i < count; i++) {
		const k = (i + 0.5) / count;
		t.box(
			"RoadLine",
			x0 + (x1 - x0) * k,
			0.1,
			z0 + (z1 - z0) * k,
			alongX ? 6 : 0.6,
			0.1,
			alongX ? 0.6 : 6,
			S.ROAD_LINE,
		);
	}
}

/** A cold campfire: a ring of stones round two logs. */
export function campfire(t: Tile, x: number, z: number) {
	if (kitMesh(t, "Campfire", new CFrame(x, 0, z))) return;
	for (let i = 0; i < 6; i++) {
		const a = (i * Math.PI) / 3;
		t.box("FireStone", x + 2 * Math.cos(a), 0.3, z + 2 * Math.sin(a), 1.1, 0.8, 1.1, S.STONE);
	}
	t.box("Log", x, 0.4, z, 3, 0.6, 0.6, S.BARK);
	t.box("Log", 0, 0, 0, 3, 0.6, 0.6, S.BARK, new CFrame(x, 0.8, z).mul(turn(70)));
}

/** A log to sit on, turned `degrees`. */
export function logSeat(t: Tile, x: number, z: number, degrees: number) {
	const frame = new CFrame(x, 0, z).mul(turn(degrees));
	if (kitMesh(t, "LogSeat", frame)) collider(t, [7, 1.6, 1.6], frame.at(0, 0.8, 0));
	else log(t, "LogSeat", 7, 1.6, frame.at(0, 0.8, 0));
}

/** A ridge tent, its ridge along the frame's Z. */
export function tent(t: Tile, frame: CFrame) {
	// The blockout's two wedges are the mesh's colliders.
	const style = kitMesh(t, "Tent", frame) ? S.COLLIDER : S.CANVAS;
	const name = style === S.COLLIDER ? "Collider" : "Tent";
	t.part(name, [10, 5.5, 4.5], frame.at(-2.25, 2.75, 0).mul(turn(90)), style, { className: "WedgePart" });
	t.part(name, [10, 5.5, 4.5], frame.at(2.25, 2.75, 0).mul(turn(-90)), style, { className: "WedgePart" });
}

/** A hay bale, 5 long (X), 4 deep and 3 tall, standing at `frame`. */
export function hayBale(t: Tile, frame: CFrame) {
	if (kitMesh(t, "HayBale", frame)) collider(t, [5, 3, 4], frame.at(0, 1.5, 0));
	else t.box("HayBale", 0, 1.5, 0, 5, 3, 4, S.HAY, frame);
}

/** A rock about `width` across, standing at `frame` (three sizes in the kit). */
export function rock(t: Tile, width: number, frame: CFrame) {
	const name = width >= 5 ? "Rock_A" : width >= 3.75 ? "Rock_B" : "Rock_C";
	if (kitMesh(t, name, frame)) {
		const [sx, sy, sz] = kitSize(name);
		collider(t, [sx * 0.8, sy * 0.9, sz * 0.8], frame.at(0, (sy * 0.9) / 2, 0));
	} else {
		t.box("Rock", 0, width * 0.3, 0, width, width * 0.8, width * 0.8, S.STONE, frame);
	}
}

/** A clipped hedge, 3 wide and 3 tall, `length` long along `frame`'s X (in 12-stud sections in the kit). */
export function hedge(t: Tile, length: number, frame: CFrame) {
	if (!hasKitMesh("Hedge")) {
		t.box("Hedge", 0, 1.5, 0, length, 3, 3, S.HEDGE, frame);
		return;
	}
	const count = Math.max(1, Math.round(length / 12));
	for (let i = 0; i < count; i++) kitMesh(t, "Hedge", frame.at(-length / 2 + (length * (i + 0.5)) / count, 0, 0));
	collider(t, [length, 3, 3], frame.at(0, 1.5, 0));
}
