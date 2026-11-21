import { CollectionService, Lighting, Workspace } from "@rbxts/services";
import { folder, part } from "shared/parts";
import { gameConfig } from "./config";
import { FLICKER_LIGHT_TAG } from "shared/tags";

/**
 * Test map for the main game: an abandoned house, 3×3 rooms joined by doorways, under one
 * roof. It's a blockout for testing the hunt (hiding, line of sight, the flashlight), not
 * the final map. Built at runtime from plain parts with a fixed seed.
 *
 *   ┌────────┬────────┬────────┐
 *   │        │        │ ghost  │   +Z
 *   ├──  ────┼──  ────┼──  ────┤
 *   │        │        │        │
 *   ├──  ────┼──  ────┼──  ────┤
 *   │hunters │        │        │   -Z
 *   └────────┴────────┴────────┘
 *    -X                     +X
 */
const ROOM = 32;
const GRID = 3;
const HALF = (ROOM * GRID) / 2;
const WALL_HEIGHT = 12;
const DOOR_WIDTH = 6;
const DOOR_HEIGHT = 8;

const rng = new Random(2024);

const WALL = { material: Enum.Material.Concrete, color: new Color3(0.42, 0.38, 0.34) };
const FLOOR = { material: Enum.Material.WoodPlanks, color: new Color3(0.36, 0.27, 0.2) };
const WOOD = { material: Enum.Material.Wood, color: new Color3(0.3, 0.22, 0.16) };

/** A ceiling lamp. It comforts hunters only while `light.Enabled` (spooks can switch it off). */
export interface Lamp {
	/** The point on the floor directly below the lamp. */
	floor: Vector3;
	light: PointLight;
	bulb: BasePart;
}

export interface Room {
	col: number;
	row: number;
	/** Centre of the room, on the floor. Kept clear of furniture within ~4 studs. */
	centre: Vector3;
}

export interface MainWorld {
	/** Where hunters start (bottom-left room) and the ghost starts (top-right room). */
	hunterSpawn: CFrame;
	ghostSpawn: CFrame;
	rooms: Room[];
	hunterRoom: Room;
	ghostRoom: Room;
	/** The centre room, where the banishing ritual happens. */
	ritualRoom: Room;
	/** Half the width of a room, wall to wall. */
	roomHalfSize: number;
	/** Height of the ceiling's underside. */
	ceilingHeight: number;
	/** Everything that makes up the house (walls, furniture), e.g. for raycasts. */
	house: Folder;
	lamps: Lamp[];
}

/** Centre of room (col, row), with col/row in 0..GRID-1. */
function roomCentre(col: number, row: number): Vector3 {
	return new Vector3(-HALF + ROOM * (col + 0.5), 0, -HALF + ROOM * (row + 0.5));
}

/** A wall from `a` to `b` (on the floor, axis-aligned) with a doorway at each `doors` point. */
function wallWithDoors(parent: Instance, a: Vector3, b: Vector3, doors: Vector3[]) {
	const alongX = math.abs(b.X - a.X) > math.abs(b.Z - a.Z);
	const start = alongX ? a.X : a.Z;
	const finish = alongX ? b.X : b.Z;
	const fixed = alongX ? a.Z : a.X;

	// Split the wall around each doorway; put a lintel over the gap.
	const cuts = doors.map((d) => (alongX ? d.X : d.Z)).sort((x, y) => x < y);
	let cursor = start;
	const segment = (from: number, to: number, height: number, baseY: number) => {
		if (to - from < 0.05) {
			return;
		}
		const centre = (from + to) / 2;
		const size = alongX ? new Vector3(to - from, height, 1) : new Vector3(1, height, to - from);
		const position = alongX
			? new Vector3(centre, baseY + height / 2, fixed)
			: new Vector3(fixed, baseY + height / 2, centre);
		part(parent, "Wall", size, new CFrame(position), WALL);
	};
	for (const cut of cuts) {
		segment(cursor, cut - DOOR_WIDTH / 2, WALL_HEIGHT, 0);
		segment(cut - DOOR_WIDTH / 2, cut + DOOR_WIDTH / 2, WALL_HEIGHT - DOOR_HEIGHT, DOOR_HEIGHT);
		cursor = cut + DOOR_WIDTH / 2;
	}
	segment(cursor, finish, WALL_HEIGHT, 0);
}

function buildShell(parent: Instance) {
	const size = HALF * 2;
	part(parent, "Floor", new Vector3(size, 1, size), new CFrame(0, -0.5, 0), FLOOR);
	part(parent, "Ceiling", new Vector3(size, 1, size), new CFrame(0, WALL_HEIGHT + 0.5, 0), {
		material: Enum.Material.WoodPlanks,
		color: new Color3(0.2, 0.16, 0.13),
	});

	// Outer walls (no doors), slightly overlapping at the corners.
	const outer: Array<[Vector3, Vector3]> = [
		[new Vector3(size + 1, WALL_HEIGHT, 1), new Vector3(0, WALL_HEIGHT / 2, HALF + 0.5)],
		[new Vector3(size + 1, WALL_HEIGHT, 1), new Vector3(0, WALL_HEIGHT / 2, -HALF - 0.5)],
		[new Vector3(1, WALL_HEIGHT, size + 1), new Vector3(HALF + 0.5, WALL_HEIGHT / 2, 0)],
		[new Vector3(1, WALL_HEIGHT, size + 1), new Vector3(-HALF - 0.5, WALL_HEIGHT / 2, 0)],
	];
	for (const [wallSize, position] of outer) {
		part(parent, "OuterWall", wallSize, new CFrame(position), WALL);
	}

	// Inner walls between rooms, each with a doorway into every neighbouring room.
	for (let i = 1; i < GRID; i++) {
		const line = -HALF + ROOM * i;
		const doorsAlongX: Vector3[] = [];
		const doorsAlongZ: Vector3[] = [];
		for (let j = 0; j < GRID; j++) {
			const mid = -HALF + ROOM * (j + 0.5);
			doorsAlongX.push(new Vector3(mid, 0, line));
			doorsAlongZ.push(new Vector3(line, 0, mid));
		}
		wallWithDoors(parent, new Vector3(-HALF, 0, line), new Vector3(HALF, 0, line), doorsAlongX);
		wallWithDoors(parent, new Vector3(line, 0, -HALF), new Vector3(line, 0, HALF), doorsAlongZ);
	}
}

/** Crates, tables and tall shelves to hide behind, kept clear of the doorways. */
function furnishRoom(parent: Instance, centre: Vector3) {
	const count = rng.NextInteger(3, 5);
	const inner = ROOM / 2 - 5; // stay off the walls
	for (let i = 0; i < count; i++) {
		const kind = rng.NextNumber();
		let x = 0;
		let z = 0;
		// Re-roll positions that would block a doorway (the doors sit mid-wall) or the centre.
		for (let attempt = 0; attempt < 10; attempt++) {
			x = rng.NextNumber(-inner, inner);
			z = rng.NextNumber(-inner, inner);
			const nearDoorX = math.abs(x) < DOOR_WIDTH && math.abs(z) > inner - 4;
			const nearDoorZ = math.abs(z) < DOOR_WIDTH && math.abs(x) > inner - 4;
			const nearCentre = math.abs(x) < 4 && math.abs(z) < 4;
			if (!nearDoorX && !nearDoorZ && !nearCentre) {
				break;
			}
		}
		const yaw = CFrame.Angles(0, rng.NextNumber(-0.3, 0.3), 0);
		const at = centre.add(new Vector3(x, 0, z));
		if (kind < 0.45) {
			const s = rng.NextNumber(3, 5);
			part(parent, "Crate", new Vector3(s, s, s), new CFrame(at.add(new Vector3(0, s / 2, 0))).mul(yaw), WOOD);
		} else if (kind < 0.75) {
			part(parent, "Table", new Vector3(7, 0.6, 4), new CFrame(at.add(new Vector3(0, 3.2, 0))).mul(yaw), WOOD);
			for (const [lx, lz] of [
				[-3, -1.6],
				[3, -1.6],
				[-3, 1.6],
				[3, 1.6],
			]) {
				part(
					parent,
					"TableLeg",
					new Vector3(0.5, 3, 0.5),
					new CFrame(at.add(new Vector3(0, 1.5, 0))).mul(yaw).mul(new CFrame(lx, 0, lz)),
					WOOD,
				);
			}
		} else {
			part(parent, "Shelf", new Vector3(8, 9, 2), new CFrame(at.add(new Vector3(0, 4.5, 0))).mul(yaw), WOOD);
		}
	}
}

/** A dim ceiling lamp. Some flicker; the flicker runs on clients (shared/flicker). */
function ceilingLamp(parent: Instance, centre: Vector3, flicker: boolean): Lamp {
	const bulb = part(
		parent,
		"Lamp",
		new Vector3(1.2, 0.6, 1.2),
		new CFrame(centre.add(new Vector3(0, WALL_HEIGHT - 0.3, 0))),
		{
			material: Enum.Material.Neon,
			color: new Color3(1, 0.78, 0.5),
			collide: false,
			shadow: false,
		},
	);
	const light = new Instance("PointLight");
	light.Color = new Color3(1, 0.75, 0.5);
	light.Brightness = 1.2;
	light.Range = 22;
	light.Shadows = true;
	light.Parent = bulb;
	if (flicker) {
		CollectionService.AddTag(light, FLICKER_LIGHT_TAG);
	}
	return { floor: centre, light, bulb };
}

/** Cool moonlight tint for the ambient: a touch of blue reads as "night" rather than "grey". */
function applyAmbient(level: number) {
	const l = math.clamp(level, 0, 1);
	Lighting.Ambient = new Color3(l * 0.92, l * 0.94, math.min(1, l * 1.12));
	Lighting.OutdoorAmbient = new Color3(l * 0.6, l * 0.6, math.min(1, l * 0.72));
}

/**
 * Dark, but navigable: a low, slightly blue ambient (DarkRoomLight in config) lets players make
 * out walls and furniture in unlit rooms, and the lamps make warm pools of light. The
 * flashlight is what lets hunters see clearly.
 */
function setupLighting() {
	Lighting.ClockTime = 0;
	Lighting.Brightness = 0;
	applyAmbient(gameConfig.darkness.Value);
	gameConfig.darkness.Changed.Connect(applyAmbient);
	Lighting.EnvironmentDiffuseScale = 0;
	Lighting.EnvironmentSpecularScale = 0;
	Lighting.GlobalShadows = true;
	Lighting.FogEnd = 100000;

	const grade = new Instance("ColorCorrectionEffect");
	grade.Name = "HouseGrade";
	grade.Saturation = -0.25;
	grade.Contrast = 0.04; // more contrast crushed the dark rooms to black
	grade.Parent = Lighting;
}

export function buildMainWorld(): MainWorld {
	setupLighting();
	const house = folder(Workspace, "House");
	buildShell(house);

	const furniture = folder(house, "Furniture");
	const lamps = folder(house, "Lamps");
	const lampList: Lamp[] = [];
	for (let col = 0; col < GRID; col++) {
		for (let row = 0; row < GRID; row++) {
			const centre = roomCentre(col, row);
			// The centre room holds the ritual circle, so it stays empty.
			const isRitualRoom = col === math.floor(GRID / 2) && row === math.floor(GRID / 2);
			if (!isRitualRoom) {
				furnishRoom(furniture, centre);
			}
			// About half the rooms have a working lamp, and some of those flicker.
			if (rng.NextNumber() < 0.55) {
				lampList.push(ceilingLamp(lamps, centre, rng.NextNumber() < 0.5));
			}
		}
	}

	const rooms: Room[] = [];
	for (let col = 0; col < GRID; col++) {
		for (let row = 0; row < GRID; row++) {
			rooms.push({ col, row, centre: roomCentre(col, row) });
		}
	}
	const roomAt = (col: number, row: number) => rooms.find((r) => r.col === col && r.row === row)!;
	const hunterRoom = roomCentre(0, 0);
	const ghostRoom = roomCentre(GRID - 1, GRID - 1);

	// Players first load in the hunters' room; the ghost is moved once roles are picked.
	const spawn = new Instance("SpawnLocation");
	spawn.Name = "StartSpawn";
	spawn.Size = new Vector3(6, 0.2, 6);
	spawn.Position = hunterRoom.add(new Vector3(0, 0.1, 0));
	spawn.Anchored = true;
	spawn.Neutral = true;
	spawn.Duration = 0;
	spawn.Transparency = 1;
	spawn.CanCollide = false;
	spawn.Parent = house;

	const middle = math.floor(GRID / 2);
	return {
		hunterSpawn: new CFrame(hunterRoom.add(new Vector3(0, 3, 0))),
		ghostSpawn: new CFrame(ghostRoom.add(new Vector3(0, 3, 0))),
		rooms,
		hunterRoom: roomAt(0, 0),
		ghostRoom: roomAt(GRID - 1, GRID - 1),
		ritualRoom: roomAt(middle, middle),
		roomHalfSize: ROOM / 2,
		ceilingHeight: WALL_HEIGHT,
		house,
		lamps: lampList,
	};
}
