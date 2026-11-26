import { CFrame, turn } from "../lib/cframe.ts";
import {
	buildingMesh,
	fence,
	GRASS_PATCHES,
	hasKitMesh,
	keepClear,
	oak,
	patches,
	pavement,
	pointLight,
	post,
	roadLines,
	signText,
	streetLamp,
	wall,
	wreck,
} from "../lib/build.ts";
import { Random } from "../lib/random.ts";
import * as S from "../lib/styles.ts";
import { Tile } from "../lib/tile.ts";

/**
 * The Fire Station (an adult base, GAMEPLAY.md §7): the station on a straight street, with its trading
 * counter in the side bay, and a car park and training tower across the road. A safe place: no loot.
 * The station is today's (src/main/server/world/bases.ts), with a plain red block for the engine until
 * meshes go in tiles.
 */
export function fireStation(): Tile {
	const t = new Tile("FireStation", {
		North: "None/Grass",
		East: "Road/Town",
		South: "None/Grass",
		West: "Road/Town",
	});
	t.slab("Ground", -100, 100, -100, 100, 0, S.GRASS, undefined, 2);
	patches(t, 14, [], new Random(33), GRASS_PATCHES);

	t.folder("Road");
	t.slab("Road", -100, 100, -11, 11, 0.1, S.ROAD);
	pavement(t, -100, 100, 11, 17, ["minZ"]);
	pavement(t, -100, 100, -17, -11, ["maxZ"]);
	roadLines(t, -98, 0, 98, 0);
	// Keep the road clear in front of the engine bay.
	keepClear(t, -18, -2, -10.5, 10.5);

	// The station's front (-Z) faces the road.
	const station = new CFrame(0, 0, 47);
	const floor = 0.3;
	t.folder("Station");
	const shell = buildingMesh(t, "FireStationBuilding", station);
	t.slab("Apron", -22, 22, 17, 31, 0.15, S.CONCRETE);
	t.slab("Floor", -22, 22, -16, 16, floor, S.CONCRETE, station);
	t.slab("Roof", -23, 23, -17, 17, 16, shell(S.CONCRETE), station);
	wall(t, "X", 16, -22, 22, floor, 15, [], shell(S.BRICK), station);
	wall(t, "Z", -21.5, -15.5, 15.5, floor, 15, [], shell(S.BRICK), station);
	wall(t, "Z", 21.5, -15.5, 15.5, floor, 15, [], shell(S.BRICK), station);
	// The engine bay is open to the street on the left; the counter is in the opening on the right.
	wall(
		t,
		"X",
		-16,
		-22,
		22,
		floor,
		15,
		[
			[-10, 16, 0, 12],
			[12, 12, 0, 9],
		],
		shell(S.BRICK),
		station,
	);
	t.box("Engine", -10, floor + 4.2, 1, 8, 7, 20, S.FIRE_RED, station);
	t.part("Sign", [26, 3, 0.5], station.at(0, 14, -17), S.FIRE_RED, { children: [signText("FIRE STATION")] });
	for (const x of [-11, 12]) {
		t.part("Light", [4, 0.4, 1], station.at(x, 14.7, 0), S.LAMP, {
			children: [pointLight([1, 0.92, 0.8], 28, 1.2)],
		});
	}
	t.box("Counter", 12, floor + 1.5, -12, 8, 3, 1.5, S.WOOD, station, {
		tags: ["Trader"],
		attributes: { Base: "FireStation" },
	});
	t.box("HoseRack", -20, floor + 3, 10, 1, 6, 8, S.FIRE_RED, station);
	// An ambulance by the kerb, clear of the engine bay (search its medical bag), and a burning tank up the road.
	wreck(t, "Ambulance", new CFrame(-30, 0.1, 4).mul(turn(90)));
	wreck(t, "Tank", new CFrame(72, 0.1, -2).mul(turn(82)));

	t.folder("Yard");
	// Across the road: the car park and the training tower.
	t.slab("CarPark", -70, 10, -66, -17, 0.12, S.ROAD);
	for (let x = -66; x <= 6; x += 12) t.box("BayLine", x, 0.13, -58, 0.4, 0.1, 16, S.ROAD_LINE);
	const tower = new CFrame(52, 0, -58);
	const towerShell = buildingMesh(t, "TrainingTower", tower);
	t.box("Tower", 0, 15, 0, 12, 30, 12, towerShell(S.BRICK), tower);
	if (!hasKitMesh("TrainingTower")) {
		t.box("TowerDoor", 0, 4, 6.05, 4, 8, 0.2, S.WOOD, tower);
		for (const y of [12, 20, 27]) t.box("TowerWindow", 0, y, 6.05, 3, 3, 0.2, S.ROAD, tower);
	}
	fence(t, -70, -66, 10, -66);
	for (const x of [-84, 30, 70]) post(t, "Hydrant", x, -19, 0, 2.4, 1, S.FIRE_RED);

	t.folder("Trees");
	const random = new Random(17);
	for (const [x, z] of [
		[-60, 50],
		[-70, 80],
		[62, 48],
		[75, 82],
		[-30, 88],
		[30, 90],
		[-88, -40],
		[85, -30],
		[-40, -86],
		[20, -84],
	]) {
		oak(t, x, z, random);
	}

	t.folder("StreetLamps");
	for (const x of [-60, 60]) streetLamp(t, new CFrame(x, 0, 15.5));
	return t;
}
