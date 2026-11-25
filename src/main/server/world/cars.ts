import { CollectionService } from "@rbxts/services";
import { folder, part, PartOptions } from "shared/world/parts";
import { LOOT_CONTAINER_TAG } from "shared/core/tags";
import { loadModel, standMesh } from "./models";

/**
 * Parked cars (models: tools/blender/assets/street_cars.py). Each has a boot to search, there from
 * the start; the models load in the background, and a car whose model can't be had is a plain block.
 */

/** One model holding every car, owned by the game's owner. */
const CARS_MODEL = 95765761953856;

/** Each car's size (the mesh's own), for its boot and its plain block. */
const CAR_SIZES = {
	Minivan: new Vector3(6.21, 6.46, 13.6),
	Hatchback: new Vector3(5.61, 4.71, 11.4),
	Estate: new Vector3(5.81, 6.3, 14.6),
	IceCreamVan: new Vector3(7.25, 9.3, 13.4),
};
export type CarName = keyof typeof CAR_SIZES;

/** Whether `name` is a car there's a model for. */
export function isCarName(name: unknown): name is CarName {
	return typeIs(name, "string") && name in CAR_SIZES;
}

const METAL: PartOptions = { material: Enum.Material.Metal, color: new Color3(0.5, 0.52, 0.56) };
/** The boot panel: between the tail lights and above the bumper of every car. */
const BOOT_SIZE = new Vector3(2.4, 0.7, 0.3);
const BOOT_HEIGHT = 1.75;

interface ParkedCar {
	name: CarName;
	parent: Instance;
	/** On the ground under its middle; it faces the LookVector. */
	at: CFrame;
}

const waiting: ParkedCar[] = [];

/** Parks `name` on the ground at `at`, facing its LookVector, with its boot behind. */
export function parkCar(parent: Instance, name: CarName, at: CFrame) {
	const car = folder(parent, "Car");
	const boot = part(
		car,
		"Car boot",
		BOOT_SIZE,
		at.mul(new CFrame(0, BOOT_HEIGHT, CAR_SIZES[name].Z / 2 - 0.1)),
		METAL,
	);
	boot.SetAttribute("Kind", "Car");
	CollectionService.AddTag(boot, LOOT_CONTAINER_TAG);
	waiting.push({ name, parent: car, at });
}

function placeBlock(car: ParkedCar) {
	const size = CAR_SIZES[car.name];
	part(car.parent, "Body", new Vector3(size.X, 3, size.Z - 0.6), car.at.mul(new CFrame(0, 2, 0)), METAL);
	part(car.parent, "Cabin", new Vector3(size.X - 0.5, 2, size.Z / 2), car.at.mul(new CFrame(0, 4.5, 1)), METAL);
}

/** Puts a model on every car parked so far. Loads them in the background. */
export function loadCars() {
	const cars = [...waiting];
	waiting.clear();
	task.spawn(() => {
		const models = loadModel(CARS_MODEL, "the cars, so they're plain blocks");
		for (const car of cars) {
			if (!standMesh(models, car.name, car.parent, car.at)) {
				placeBlock(car);
			}
		}
		models?.Destroy();
	});
}
