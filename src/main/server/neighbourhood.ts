import { CollectionService, Workspace } from "@rbxts/services";
import { ContainerKind } from "shared/loot";
import { folder, part, PartOptions } from "shared/parts";
import { LOOT_CONTAINER_TAG, STONES_TAG, STREET_LIGHT_TAG } from "shared/tags";
import { slab, wall } from "./building";
import { CarName, loadCars, parkCar } from "./cars";

/**
 * Maple Street (GAMEPLAY.md §8), a blockout: two houses either side of home and two across the
 * street, each with things to search, a car outside, stones in the garden, and a dormant
 * infected staring at the TV. Street lamps line the road, and invisible walls ring the map.
 */

const HALF_W = 18;
const HALF_D = 13;
const HEIGHT = 11;
const FLOOR_Y = 0.3;
/** Half the width of the map (the grass in world.ts). */
const MAP_HALF = 195;

const WALL: PartOptions = { material: Enum.Material.SmoothPlastic, color: new Color3(0.72, 0.74, 0.7) };
const FLOOR: PartOptions = { material: Enum.Material.WoodPlanks, color: new Color3(0.46, 0.36, 0.27) };
const ROOF: PartOptions = { material: Enum.Material.Slate, color: new Color3(0.3, 0.2, 0.18) };
const WOOD: PartOptions = { material: Enum.Material.Wood, color: new Color3(0.45, 0.33, 0.22) };
const METAL: PartOptions = { material: Enum.Material.Metal, color: new Color3(0.5, 0.52, 0.56) };
const STONE: PartOptions = { material: Enum.Material.Slate, color: new Color3(0.5, 0.49, 0.47) };
const SCREEN: PartOptions = { material: Enum.Material.Neon, color: new Color3(0.55, 0.75, 0.95), shadow: false };

export interface Neighbourhood {
	/** Where dormant infected stand, looking at their screens. */
	dormantSpots: CFrame[];
	/** Where Dad stands on Day 1: in the garden next door, staring in at the TV. */
	dadSpot: CFrame;
}

interface House {
	/** Its origin; the front (local -Z) faces the street. */
	frame: CFrame;
	car: CarName;
	/** Where the car is, on the ground in the house's space. The boot is at local +Z of this. */
	carAt: CFrame;
}

/** The houses across the street have short lawns: a short car, and one at the kerb. */
const HOUSES: House[] = [
	{ frame: new CFrame(-95, 0, -6), car: "Minivan", carAt: new CFrame(13, 0, -23.3) },
	{ frame: new CFrame(95, 0, -6), car: "Estate", carAt: new CFrame(13, 0, -23.8) },
	{
		frame: new CFrame(-60, 0, -98).mul(CFrame.Angles(0, math.pi, 0)),
		car: "Hatchback",
		carAt: new CFrame(13, 0, -21),
	},
	{
		frame: new CFrame(60, 0, -98).mul(CFrame.Angles(0, math.pi, 0)),
		car: "IceCreamVan",
		carAt: new CFrame(13, 0.1, -30.5).mul(CFrame.Angles(0, math.pi / 2, 0)),
	},
];

function container(parent: Instance, name: string, kind: ContainerKind, size: Vector3, at: CFrame, style: PartOptions) {
	const p = part(parent, name, size, at, style);
	p.SetAttribute("Kind", kind);
	CollectionService.AddTag(p, LOOT_CONTAINER_TAG);
}

/** Builds one house and returns where its dormant infected stands. */
function buildHouse(parent: Instance, { frame, car, carAt }: House): CFrame {
	const house = folder(parent, "Neighbour");
	const at = (x: number, y: number, z: number) => frame.mul(new CFrame(x, FLOOR_Y + y, z));
	const door = (center: number) => ({ center, width: 5, bottom: 0, top: 8 });
	const window = (center: number) => ({ center, width: 5, bottom: 3, top: 8 });

	slab(house, "Floor", -HALF_W, HALF_W, -HALF_D, HALF_D, FLOOR_Y, FLOOR, frame);
	slab(house, "Roof", -HALF_W - 1.5, HALF_W + 1.5, -HALF_D - 1.5, HALF_D + 1.5, FLOOR_Y + HEIGHT + 1, ROOF, frame);
	wall(house, "X", -HALF_D, -HALF_W, HALF_W, FLOOR_Y, HEIGHT, [window(-10), door(6)], WALL, frame);
	wall(house, "X", HALF_D, -HALF_W, HALF_W, FLOOR_Y, HEIGHT, [door(10)], WALL, frame);
	wall(house, "Z", -HALF_W, -HALF_D, HALF_D, FLOOR_Y, HEIGHT, [window(4)], WALL, frame);
	wall(house, "Z", HALF_W, -HALF_D, HALF_D, FLOOR_Y, HEIGHT, [window(-4)], WALL, frame);
	// Living room on the left, kitchen on the right.
	wall(house, "Z", 0, -HALF_D, HALF_D, FLOOR_Y, HEIGHT, [door(4)], WALL, frame);

	// Living room: the TV on the back wall; the drawers are close enough that searching
	// them wakes whoever is watching it.
	part(house, "TVStand", new Vector3(6, 2, 2), at(-10, 1, 11.5), WOOD);
	const tv = part(house, "TV", new Vector3(5, 3, 0.3), at(-10, 3.6, 11.6), SCREEN);
	const glow = new Instance("PointLight");
	glow.Color = new Color3(0.55, 0.75, 1);
	glow.Range = 14;
	glow.Brightness = 1.2;
	glow.Parent = tv;
	container(house, "Drawers", "Drawers", new Vector3(2, 3.5, 5), at(-16.4, 1.75, -5), WOOD);

	// Kitchen: cupboards and a tool chest by the back door.
	container(house, "Cupboards", "Kitchen", new Vector3(2.5, 3.5, 8), at(16, 1.75, 4), WOOD);
	container(house, "Tool chest", "Garage", new Vector3(4, 2.5, 2.5), at(3.5, 1.25, 11), METAL);

	// Outside: a car and stones in the garden.
	parkCar(house, car, frame.mul(carAt));
	const stones = part(house, "Stones", new Vector3(3, 0.6, 3), at(0, 0, -21), STONE);
	CollectionService.AddTag(stones, STONES_TAG);

	// In the middle of the living room, facing the TV (local +Z).
	return at(-10, 3, 4).mul(CFrame.Angles(0, math.pi, 0));
}

function buildStreetLamps(parent: Instance) {
	for (const x of [-120, -60, 0, 60, 120]) {
		part(parent, "LampPost", new Vector3(0.6, 14, 0.6), new CFrame(x, 7, -46), METAL);
		const head = part(parent, "LampHead", new Vector3(2, 0.5, 3), new CFrame(x, 14, -47), METAL);
		const light = new Instance("SpotLight");
		light.Face = Enum.NormalId.Bottom;
		light.Angle = 110;
		light.Range = 34;
		light.Brightness = 3;
		light.Color = new Color3(1, 0.82, 0.55);
		light.Enabled = false;
		light.Parent = head;
		CollectionService.AddTag(light, STREET_LIGHT_TAG);
	}
}

/** Invisible walls, so nobody walks off the edge of the map. */
function buildBoundary(parent: Instance) {
	const size = MAP_HALF * 2;
	for (const [x, z, sx, sz] of [
		[MAP_HALF, 0, 2, size],
		[-MAP_HALF, 0, 2, size],
		[0, MAP_HALF, size, 2],
		[0, -MAP_HALF, size, 2],
	]) {
		part(parent, "Boundary", new Vector3(sx, 80, sz), new CFrame(x, 40, z), { transparency: 1, shadow: false });
	}
}

export function buildNeighbourhood(): Neighbourhood {
	const street = folder(Workspace, "MapleStreet");
	const dormantSpots = HOUSES.map((house) => buildHouse(street, house));
	loadCars();
	buildStreetLamps(street);
	buildBoundary(street);
	// In the left neighbour's front garden, facing the living-room window (local +Z).
	const dadSpot = HOUSES[0].frame.mul(new CFrame(-10, FLOOR_Y + 3, -17)).mul(CFrame.Angles(0, math.pi, 0));
	return { dormantSpots, dadSpot };
}
