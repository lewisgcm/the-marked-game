import { CollectionService, Workspace } from "@rbxts/services";
import { folder, part, PartOptions } from "shared/parts";
import {
	BARRICADE_SLOT_TAG,
	FLICKER_LIGHT_TAG,
	GENERATOR_TAG,
	HOUSE_LIGHT_TAG,
	INFECTED_SPAWN_TAG,
	PLANK_PILE_TAG,
	SCREEN_TAG,
	WORKBENCH_TAG,
} from "shared/tags";
import { Opening } from "shared/walls";
import { Axis, slab, THICK, wall } from "./building";

/**
 * The family house (GAMEPLAY.md §5), a blockout built at runtime from plain parts. The street is
 * at -Z (the front); +X is the garage side.
 *
 *  Ground floor (y 0)                         Upstairs (y 13)
 *  z=+22 ┌──────────┬─────┬─────────┐         ┌──────────┬─────┬─────────┐
 *        │  dining  │ hall│ kitchen ▯ back    │ kid's    │ hall│ bathroom│
 *        │          │▒▒ ↑ │         │ door    │ bedroom  │   ▒ │         │
 *  z=+2  ├────  ────┤▒▒ ↑ ├──  ─────┤         ├──────────┤   ▒ ├─────────┤
 *        │  living  │     │ garage  │         │ bedroom  │     │ parents │
 *        │   (TV)   │     │         │         │          │     │         │
 *  z=-22 └──────────┴─▯───┴──▯▯▯────┘         └──────────┴─────┴─────────┘
 *       x=-30      x=0  x=12      x=30
 *                  front  garage door
 *
 *  ▒▒ in the hall: the basement stairs (x 0..4, down) beside the stairs up (x 8..12). The
 *  basement runs under the dining room and the back of the hall; kids spawn there.
 *
 * Openings: front, back and garage doors and six ground-floor windows, all open gaps with an
 * invisible tagged BarricadeSlot in each (where planks go). Upstairs windows are glazed.
 */

// Footprint and heights.
const X0 = -30;
const X1 = 30;
const Z0 = -22;
const Z1 = 22;
const HALL_X0 = 0;
const HALL_X1 = 12;
const MID_Z = 2; // wall between the front and back rooms
const STOREY = 12; // wall height per floor
const UPPER_Y = 13; // upstairs floor level (a 1-stud slab on top of the ground-floor walls)
const ROOF_Y = UPPER_Y + STOREY;
const BASEMENT_Y = -12;

// The two staircases in the hall.
const UP_STAIRS = { x0: 8, x1: 12, z0: 6, z1: 20 };
const DOWN_STAIRS = { x0: 0, x1: 4, z0: 8, z1: 20 };
// The basement: under the dining room and the back of the hall.
const BASEMENT = { x0: X0, x1: HALL_X1, z0: MID_Z, z1: Z1 };

const DOOR_W = 5;
const DOOR_H = 8;
const WINDOW_W = 5;
const WINDOW_SILL = 1; // low, so the infected can climb straight in
const WINDOW_TOP = 7;

const WALL: PartOptions = { material: Enum.Material.SmoothPlastic, color: new Color3(0.82, 0.78, 0.7) };
const OUTSIDE_WALL: PartOptions = { material: Enum.Material.Brick, color: new Color3(0.55, 0.36, 0.3) };
const BASEMENT_WALL: PartOptions = { material: Enum.Material.Concrete, color: new Color3(0.45, 0.45, 0.47) };
const FLOOR: PartOptions = { material: Enum.Material.WoodPlanks, color: new Color3(0.52, 0.38, 0.26) };
const TILE: PartOptions = { material: Enum.Material.Slate, color: new Color3(0.7, 0.7, 0.68) };
const ROOF: PartOptions = { material: Enum.Material.Slate, color: new Color3(0.25, 0.22, 0.22) };
const WOOD: PartOptions = { material: Enum.Material.Wood, color: new Color3(0.42, 0.3, 0.2) };
const FABRIC: PartOptions = { material: Enum.Material.Fabric, color: new Color3(0.32, 0.36, 0.45) };
const METAL: PartOptions = { material: Enum.Material.DiamondPlate, color: new Color3(0.45, 0.47, 0.5) };
const GLASS: PartOptions = {
	material: Enum.Material.Glass,
	color: new Color3(0.7, 0.8, 0.9),
	transparency: 0.7,
	shadow: false,
};
const GRASS: PartOptions = { material: Enum.Material.Grass, color: new Color3(0.3, 0.42, 0.22) };
const ROAD: PartOptions = { material: Enum.Material.Asphalt, color: new Color3(0.18, 0.18, 0.19) };
const PAVING: PartOptions = { material: Enum.Material.Concrete, color: new Color3(0.6, 0.6, 0.58) };

export type EntryKind = "Door" | "Window" | "GarageDoor";

/** A door or window the infected can get in through, and kids can barricade. */
export interface Entry {
	name: string;
	kind: EntryKind;
	/** Centre of the opening; LookVector points out of the house. */
	cframe: CFrame;
	width: number;
	height: number;
	/** The invisible part filling the opening (tagged BarricadeSlot). */
	slot: BasePart;
}

/** A ceiling lamp. */
export interface Lamp {
	/** The point on the floor directly below the lamp. */
	floor: Vector3;
	light: PointLight;
	bulb: BasePart;
}

export interface MainWorld {
	/** Where kids start: the basement. */
	kidSpawn: CFrame;
	/** Everything that makes up the house, e.g. for raycasts. */
	house: Folder;
	lamps: Lamp[];
	/** Every door and window, ground floor. */
	entries: Entry[];
	/** Where infected appear, outside. */
	infectedSpawns: CFrame[];
}

/** Whether `position` is inside the house's walls (any floor, or the basement). */
export function isInsideHouse(position: Vector3): boolean {
	return position.X > X0 && position.X < X1 && position.Z > Z0 && position.Z < Z1;
}

/** A slab with a rectangular hole cut out (for a staircase): up to four slabs around it. */
function slabWithHole(
	parent: Instance,
	name: string,
	outer: { x0: number; x1: number; z0: number; z1: number },
	hole: { x0: number; x1: number; z0: number; z1: number },
	topY: number,
	style: PartOptions,
) {
	slab(parent, name, outer.x0, outer.x1, outer.z0, hole.z0, topY, style); // in front of the hole
	slab(parent, name, outer.x0, outer.x1, hole.z1, outer.z1, topY, style); // behind it
	slab(parent, name, outer.x0, hole.x0, hole.z0, hole.z1, topY, style); // left of it
	slab(parent, name, hole.x1, outer.x1, hole.z0, hole.z1, topY, style); // right of it
}

function rail(parent: Instance, from: Vector3, to: Vector3) {
	const mid = from.add(to).div(2);
	const length = to.sub(from).Magnitude;
	const alongX = math.abs(to.X - from.X) > math.abs(to.Z - from.Z);
	const size = alongX ? new Vector3(length, 3, 0.4) : new Vector3(0.4, 3, length);
	part(parent, "Rail", size, new CFrame(mid.add(new Vector3(0, 1.5, 0))), WOOD);
}

/** A wedge ramp filling a staircase's footprint, rising toward +Z (or toward -Z if asked). */
function stairs(
	parent: Instance,
	area: { x0: number; x1: number; z0: number; z1: number },
	bottomY: number,
	topY: number,
	risesTowardMinusZ: boolean,
) {
	const wedge = new Instance("WedgePart");
	wedge.Name = "Stairs";
	wedge.Size = new Vector3(area.x1 - area.x0, topY - bottomY, area.z1 - area.z0);
	// A WedgePart's tall end is its +Z face, so unrotated it rises toward +Z.
	wedge.CFrame = new CFrame((area.x0 + area.x1) / 2, (bottomY + topY) / 2, (area.z0 + area.z1) / 2).mul(
		risesTowardMinusZ ? CFrame.Angles(0, math.pi, 0) : new CFrame(),
	);
	wedge.Anchored = true;
	wedge.Material = Enum.Material.WoodPlanks;
	wedge.Color = new Color3(0.45, 0.32, 0.22);
	wedge.TopSurface = Enum.SurfaceType.Smooth;
	wedge.BottomSurface = Enum.SurfaceType.Smooth;
	wedge.Parent = parent;
}

function ceilingLamp(parent: Instance, x: number, z: number, ceilingY: number, flicker: boolean): Lamp {
	const bulb = part(parent, "Lamp", new Vector3(1.2, 0.6, 1.2), new CFrame(x, ceilingY - 0.3, z), {
		material: Enum.Material.Neon,
		color: new Color3(1, 0.85, 0.6),
		collide: false,
		shadow: false,
	});
	const light = new Instance("PointLight");
	light.Color = new Color3(1, 0.8, 0.55);
	light.Brightness = 1.2;
	light.Range = 22;
	light.Shadows = true;
	light.Parent = bulb;
	CollectionService.AddTag(light, HOUSE_LIGHT_TAG);
	if (flicker) {
		CollectionService.AddTag(light, FLICKER_LIGHT_TAG);
	}
	return { floor: new Vector3(x, ceilingY - STOREY, z), light, bulb };
}

/** An exterior opening: cut into the wall by the caller, recorded here with its barricade slot. */
interface EntrySpec {
	name: string;
	kind: EntryKind;
	/** Which outside wall. */
	side: "Front" | "Back" | "Left" | "Right";
	/** Position along that wall. */
	center: number;
	width: number;
	bottom: number;
	top: number;
}

const ENTRY_SPECS: EntrySpec[] = [
	{ name: "Front door", kind: "Door", side: "Front", center: 6, width: DOOR_W, bottom: 0, top: DOOR_H },
	{ name: "Garage door", kind: "GarageDoor", side: "Front", center: 21, width: 12, bottom: 0, top: 9 },
	{ name: "Back door", kind: "Door", side: "Back", center: 21, width: DOOR_W, bottom: 0, top: DOOR_H },
	{
		name: "Living room front window",
		kind: "Window",
		side: "Front",
		center: -24,
		width: WINDOW_W,
		bottom: WINDOW_SILL,
		top: WINDOW_TOP,
	},
	{
		name: "Living room side window",
		kind: "Window",
		side: "Left",
		center: -10,
		width: WINDOW_W,
		bottom: WINDOW_SILL,
		top: WINDOW_TOP,
	},
	{
		name: "Dining room side window",
		kind: "Window",
		side: "Left",
		center: 12,
		width: WINDOW_W,
		bottom: WINDOW_SILL,
		top: WINDOW_TOP,
	},
	{
		name: "Dining room back window",
		kind: "Window",
		side: "Back",
		center: -15,
		width: WINDOW_W,
		bottom: WINDOW_SILL,
		top: WINDOW_TOP,
	},
	{
		name: "Kitchen back window",
		kind: "Window",
		side: "Back",
		center: 15,
		width: WINDOW_W,
		bottom: WINDOW_SILL,
		top: WINDOW_TOP,
	},
	{
		name: "Kitchen side window",
		kind: "Window",
		side: "Right",
		center: 12,
		width: WINDOW_W,
		bottom: WINDOW_SILL,
		top: WINDOW_TOP,
	},
];

/** Where an outside wall is, and which way is out. */
function sideFrame(side: EntrySpec["side"], center: number, y: number): CFrame {
	switch (side) {
		case "Front":
			return CFrame.lookAt(new Vector3(center, y, Z0), new Vector3(center, y, Z0 - 1));
		case "Back":
			return CFrame.lookAt(new Vector3(center, y, Z1), new Vector3(center, y, Z1 + 1));
		case "Left":
			return CFrame.lookAt(new Vector3(X0, y, center), new Vector3(X0 - 1, y, center));
		default:
			return CFrame.lookAt(new Vector3(X1, y, center), new Vector3(X1 + 1, y, center));
	}
}

function openingsOn(side: EntrySpec["side"]): Opening[] {
	return ENTRY_SPECS.filter((e) => e.side === side).map((e) => ({
		center: e.center,
		width: e.width,
		bottom: e.bottom,
		top: e.top,
	}));
}

function buildEntries(parent: Instance): Entry[] {
	const slots = folder(parent, "BarricadeSlots");
	return ENTRY_SPECS.map((spec) => {
		const height = spec.top - spec.bottom;
		const cframe = sideFrame(spec.side, spec.center, spec.bottom + height / 2);
		const slot = part(slots, spec.name, new Vector3(spec.width, height, THICK), cframe, {
			collide: false,
			transparency: 1,
			shadow: false,
		});
		// Invisible and ignored by raycasts (weapons, flashlights) until planks go in.
		slot.CanQuery = false;
		slot.CanTouch = false;
		slot.SetAttribute("Kind", spec.kind);
		CollectionService.AddTag(slot, BARRICADE_SLOT_TAG);
		return { name: spec.name, kind: spec.kind, cframe, width: spec.width, height, slot };
	});
}

function buildShell(house: Instance) {
	const shell = folder(house, "Shell");
	const footprint = { x0: X0 - 0.5, x1: X1 + 0.5, z0: Z0 - 0.5, z1: Z1 + 0.5 };

	// Floors and roof.
	slabWithHole(shell, "GroundFloor", footprint, DOWN_STAIRS, 0, FLOOR);
	slabWithHole(shell, "UpperFloor", footprint, UP_STAIRS, UPPER_Y, FLOOR);
	slab(shell, "KitchenTiles", 12.5, X1, MID_Z + 0.5, Z1, 0.05, TILE);
	slab(
		shell,
		"Roof",
		footprint.x0 - 1.5,
		footprint.x1 + 1.5,
		footprint.z0 - 1.5,
		footprint.z1 + 1.5,
		ROOF_Y + THICK,
		ROOF,
	);

	// Outside walls, both storeys. Upstairs windows are glazed gaps.
	const upperWindows: Record<EntrySpec["side"], number[]> = {
		Front: [-15, 21],
		Back: [-15, 21],
		Left: [-10, 12],
		Right: [-10, 12],
	};
	const sides: Array<[EntrySpec["side"], Axis, number, number, number]> = [
		["Front", "X", Z0, X0 - 0.5, X1 + 0.5],
		["Back", "X", Z1, X0 - 0.5, X1 + 0.5],
		["Left", "Z", X0, Z0 + 0.5, Z1 - 0.5],
		["Right", "Z", X1, Z0 + 0.5, Z1 - 0.5],
	];
	for (const [side, axis, at, from, to] of sides) {
		wall(shell, axis, at, from, to, 0, STOREY, openingsOn(side), OUTSIDE_WALL);
		const glazed = upperWindows[side].map((center) => ({ center, width: 5, bottom: 3, top: 8 }));
		wall(shell, axis, at, from, to, UPPER_Y, STOREY, glazed, OUTSIDE_WALL);
		for (const w of glazed) {
			const frame = sideFrame(side, w.center, UPPER_Y + (w.bottom + w.top) / 2);
			part(shell, "Glass", new Vector3(w.width, w.top - w.bottom, 0.2), frame, GLASS);
		}
	}

	// Ground-floor inside walls (door gaps 5 wide, 8 tall).
	const doorAt = (center: number): Opening => ({ center, width: DOOR_W, bottom: 0, top: DOOR_H });
	const narrowDoorAt = (center: number): Opening => ({ center, width: 4, bottom: 0, top: DOOR_H });
	wall(shell, "Z", HALL_X0, Z0 + 0.5, Z1 - 0.5, 0, STOREY, [doorAt(-10), narrowDoorAt(4.5)], WALL);
	wall(shell, "Z", HALL_X1, Z0 + 0.5, Z1 - 0.5, 0, STOREY, [doorAt(-11), narrowDoorAt(4)], WALL);
	wall(shell, "X", MID_Z, X0 + 0.5, HALL_X0 - 0.5, 0, STOREY, [doorAt(-15)], WALL);
	wall(shell, "X", MID_Z, HALL_X1 + 0.5, X1 - 0.5, 0, STOREY, [], WALL);

	// Upstairs inside walls.
	wall(shell, "Z", HALL_X0, Z0 + 0.5, Z1 - 0.5, UPPER_Y, STOREY, [doorAt(-10), doorAt(12)], WALL);
	wall(shell, "Z", HALL_X1, Z0 + 0.5, Z1 - 0.5, UPPER_Y, STOREY, [doorAt(-10), narrowDoorAt(4)], WALL);
	wall(shell, "X", MID_Z, X0 + 0.5, HALL_X0 - 0.5, UPPER_Y, STOREY, [], WALL);
	wall(shell, "X", MID_Z, HALL_X1 + 0.5, X1 - 0.5, UPPER_Y, STOREY, [], WALL);

	// Stairs, with rails along the open sides of each stairwell.
	stairs(shell, UP_STAIRS, 0, UPPER_Y, false);
	rail(shell, new Vector3(UP_STAIRS.x0, UPPER_Y, UP_STAIRS.z0), new Vector3(UP_STAIRS.x0, UPPER_Y, UP_STAIRS.z1));
	rail(shell, new Vector3(UP_STAIRS.x0, UPPER_Y, UP_STAIRS.z0), new Vector3(UP_STAIRS.x1, UPPER_Y, UP_STAIRS.z0));
	stairs(shell, DOWN_STAIRS, BASEMENT_Y, 0, true);
	rail(shell, new Vector3(DOWN_STAIRS.x1, 0, DOWN_STAIRS.z0), new Vector3(DOWN_STAIRS.x1, 0, DOWN_STAIRS.z1));
	rail(shell, new Vector3(DOWN_STAIRS.x0, 0, DOWN_STAIRS.z1), new Vector3(DOWN_STAIRS.x1, 0, DOWN_STAIRS.z1));

	// Basement: floor and four walls below ground.
	const b = BASEMENT;
	slab(shell, "BasementFloor", b.x0 - 0.5, b.x1 + 0.5, b.z0 - 0.5, b.z1 + 0.5, BASEMENT_Y, BASEMENT_WALL);
	const below = BASEMENT_Y;
	const deep = -BASEMENT_Y - THICK; // up to the underside of the ground floor
	wall(shell, "X", b.z0, b.x0 - 0.5, b.x1 + 0.5, below, deep, [], BASEMENT_WALL);
	wall(shell, "X", b.z1, b.x0 - 0.5, b.x1 + 0.5, below, deep, [], BASEMENT_WALL);
	wall(shell, "Z", b.x0, b.z0 + 0.5, b.z1 - 0.5, below, deep, [], BASEMENT_WALL);
	wall(shell, "Z", b.x1, b.z0 + 0.5, b.z1 - 0.5, below, deep, [], BASEMENT_WALL);
}

/** Grass all round (with a gap for the house), the street out front and the driveway. */
function buildGrounds(parent: Instance) {
	const grounds = folder(parent, "Grounds");
	const reach = 200;
	const hx0 = X0 - 0.5;
	const hx1 = X1 + 0.5;
	const hz0 = Z0 - 0.5;
	const hz1 = Z1 + 0.5;
	// Four strips around the footprint, so nothing fills the basement or blocks its stairs.
	slab(grounds, "Grass", -reach, reach, -reach, hz0, 0, GRASS);
	slab(grounds, "Grass", -reach, reach, hz1, reach, 0, GRASS);
	slab(grounds, "Grass", -reach, hx0, hz0, hz1, 0, GRASS);
	slab(grounds, "Grass", hx1, reach, hz0, hz1, 0, GRASS);
	slab(grounds, "Pavement", -reach, reach, -50, -44, 0.2, PAVING);
	slab(grounds, "Street", -reach, reach, -72, -50, 0.1, ROAD);
	slab(grounds, "Driveway", 15, 27, -44, Z0 - 0.5, 0.15, PAVING);
	slab(grounds, "Path", 4, 8, -44, Z0 - 0.5, 0.15, PAVING);
}

/** Simple blockout furniture, plus the tagged props later systems use. */
function furnish(parent: Instance) {
	const f = folder(parent, "Furniture");
	const tag = (p: BasePart, name: string) => CollectionService.AddTag(p, name);
	const at = (x: number, y: number, z: number) => new CFrame(x, y, z);

	// Living room: sofa facing the TV on the front wall.
	part(f, "Sofa", new Vector3(10, 2, 3.5), at(-13, 1, -9), FABRIC);
	part(f, "SofaBack", new Vector3(10, 2.5, 1), at(-13, 3, -7.5), FABRIC);
	part(f, "TVStand", new Vector3(7, 2.2, 2), at(-12, 1.1, -20), WOOD);
	const tv = part(f, "TV", new Vector3(6, 3.5, 0.4), at(-12, 4, -20.2), {
		material: Enum.Material.SmoothPlastic,
		color: new Color3(0.05, 0.05, 0.06),
	});
	tag(tv, SCREEN_TAG);

	// Dining room.
	part(f, "DiningTable", new Vector3(8, 0.6, 4), at(-17, 3.2, 14), WOOD);
	for (const [x, z] of [
		[-20.5, 12.5],
		[-13.5, 12.5],
		[-20.5, 15.5],
		[-13.5, 15.5],
	]) {
		part(f, "TableLeg", new Vector3(0.5, 3, 0.5), at(x, 1.5, z), WOOD);
	}

	// Kitchen: a counter along the right wall, clear of the side window.
	part(f, "Counter", new Vector3(3, 3.5, 6), at(28, 1.75, 6), {
		material: Enum.Material.Marble,
		color: new Color3(0.85, 0.85, 0.82),
	});
	part(f, "Fridge", new Vector3(3.5, 7, 3), at(28, 3.5, 19.5), METAL);

	// Garage: workbench, generator, the plank pile.
	const bench = part(f, "Workbench", new Vector3(3, 3.5, 7), at(28, 1.75, -6), WOOD);
	tag(bench, WORKBENCH_TAG);
	const generator = part(f, "Generator", new Vector3(3, 3, 4), at(28, 1.5, -16), {
		material: Enum.Material.Metal,
		color: new Color3(0.75, 0.55, 0.15),
	});
	tag(generator, GENERATOR_TAG);
	const pile = folder(f, "PlankPile");
	for (let i = 0; i < 6; i++) {
		const plank = part(pile, "Plank", new Vector3(6, 0.4, 1), at(15, 0.2 + i * 0.4, -16 + (i % 2) * 0.3), WOOD);
		if (i === 0) {
			tag(plank, PLANK_PILE_TAG);
		}
	}

	// Upstairs: beds.
	part(f, "Bed", new Vector3(5, 2, 8), at(-24, UPPER_Y + 1, 15), FABRIC);
	part(f, "Bed", new Vector3(5, 2, 8), at(-24, UPPER_Y + 1, -15), FABRIC);
	part(f, "DoubleBed", new Vector3(8, 2, 9), at(24, UPPER_Y + 1, -14), FABRIC);
	part(f, "Bath", new Vector3(4, 2.5, 8), at(27, UPPER_Y + 1.25, 16), {
		material: Enum.Material.SmoothPlastic,
		color: new Color3(0.95, 0.95, 0.95),
	});

	// Basement: shelves and boxes.
	part(f, "Shelf", new Vector3(10, 7, 2), at(-15, BASEMENT_Y + 3.5, 20.5), WOOD);
	part(f, "Box", new Vector3(3, 3, 3), at(-26, BASEMENT_Y + 1.5, 6), WOOD);
	part(f, "Box", new Vector3(2.5, 2.5, 2.5), at(-24, BASEMENT_Y + 1.25, 8), WOOD);
}

function buildLamps(parent: Instance): Lamp[] {
	const lampFolder = folder(parent, "Lamps");
	const lamps: Lamp[] = [];
	const ground: Array<[number, number]> = [
		[-15, -10], // living
		[-15, 12], // dining
		[21, 12], // kitchen
		[21, -10], // garage
		[6, -10], // hall
	];
	const upper: Array<[number, number]> = [
		[-15, -10],
		[-15, 12],
		[21, -10],
		[21, 12],
		[4, -10],
	];
	ground.forEach(([x, z]) => lamps.push(ceilingLamp(lampFolder, x, z, STOREY, false)));
	upper.forEach(([x, z]) => lamps.push(ceilingLamp(lampFolder, x, z, ROOF_Y, false)));
	lamps.push(ceilingLamp(lampFolder, -15, 12, -THICK, true)); // basement: a failing bulb
	return lamps;
}

function buildInfectedSpawns(parent: Instance): CFrame[] {
	const spawns = folder(parent, "InfectedSpawns");
	// Across the street, the back garden, and both sides; each faces the house.
	const points = [new Vector3(0, 3, -80), new Vector3(0, 3, 70), new Vector3(-62, 3, 0), new Vector3(62, 3, 0)];
	return points.map((point) => {
		const cframe = CFrame.lookAt(point, new Vector3(0, 3, 0));
		const marker = part(spawns, "InfectedSpawn", new Vector3(4, 1, 4), cframe, {
			collide: false,
			transparency: 1,
			shadow: false,
		});
		CollectionService.AddTag(marker, INFECTED_SPAWN_TAG);
		return cframe;
	});
}

export function buildMainWorld(): MainWorld {
	const house = folder(Workspace, "House");
	buildShell(house);
	furnish(house);
	const lamps = buildLamps(house);
	const entries = buildEntries(house);
	buildGrounds(Workspace);
	const infectedSpawns = buildInfectedSpawns(Workspace);

	// Kids start in the basement.
	const basementCentre = new Vector3(-15, BASEMENT_Y, 12);
	const spawn = new Instance("SpawnLocation");
	spawn.Name = "StartSpawn";
	spawn.Size = new Vector3(6, 0.2, 6);
	spawn.Position = basementCentre.add(new Vector3(0, 0.1, 0));
	spawn.Anchored = true;
	spawn.Neutral = true;
	spawn.Duration = 0;
	spawn.Transparency = 1;
	spawn.CanCollide = false;
	spawn.Parent = house;

	return {
		kidSpawn: new CFrame(basementCentre.add(new Vector3(0, 3, 0))),
		house,
		lamps,
		entries,
		infectedSpawns,
	};
}
