import { CollectionService, Workspace } from "@rbxts/services";
import { ContainerKind } from "shared/items/loot";
import { folder, part, PartOptions } from "shared/world/parts";
import { LOOT_CONTAINER_TAG } from "shared/core/tags";
import { addFire, FireKind } from "./fire";
import { loadModel, standMesh } from "./models";

/**
 * Wrecks along Maple Street (models: tools/blender/assets/street_wrecks.py): a school bus across one end,
 * a tank at the other, and crashes between. Invisible boxes do the colliding (the meshes are hollow and
 * ragged, and infected would snag on them); without the models, the boxes show as plain blocks.
 */

/** One model holding every wreck, owned by the game's owner. */
const WRECKS_MODEL = 97064260351134;

const METAL: PartOptions = { material: Enum.Material.Metal, color: new Color3(0.5, 0.52, 0.56) };

interface Box {
	size: Vector3;
	at: Vector3;
}

interface Wreck {
	/** The mesh's name. */
	name: string;
	/** On the ground under its middle; it faces the LookVector. */
	at: CFrame;
	/** What it collides as, in its own space (y up from the ground). */
	boxes: Box[];
	/** Something to search, in its own space. */
	loot?: { name: string; kind: ContainerKind; size: Vector3; at: Vector3 };
	/** What's burning or smoking, in its own space. `scale` is how many studs across. */
	fires?: Array<{ kind: FireKind; at: Vector3; scale: number }>;
	/** How far the model is sunk into the ground. */
	sink?: number;
}

const box = (x: number, y: number, z: number, sizeX: number, sizeY: number, sizeZ: number): Box => ({
	size: new Vector3(sizeX, sizeY, sizeZ),
	at: new Vector3(x, y, z),
});

/** On the street (its surface is at 0.1), turned `degrees` from facing world -Z. */
const spot = (x: number, z: number, degrees: number) =>
	new CFrame(x, 0.1, z).mul(CFrame.Angles(0, math.rad(degrees), 0));

const WRECKS: Wreck[] = [
	{
		name: "SchoolBus", // across the road at the Treehouse end
		at: spot(-178, -61, 6),
		boxes: [box(0, 3.9, 0, 8.4, 7.8, 22.2)],
		sink: 0.15,
	},
	{
		name: "Tank", // facing home from the Fire Station end
		at: spot(174, -60, 82),
		boxes: [box(1.2, 1.9, -3.2, 8.8, 3.8, 14), box(1.2, 4.8, -3, 4.6, 2, 5)],
		fires: [
			{ kind: "Fire", at: new Vector3(1.2, 3.9, 1.5), scale: 1.4 }, // engine deck
			{ kind: "Smoke", at: new Vector3(1.2, 4.4, 1.5), scale: 1.6 },
		],
	},
	{
		name: "Ambulance", // by the kerb outside the Fire Station, clear of its engine bay
		at: spot(125, -57, 90),
		boxes: [box(0, 4.2, -0.75, 5.8, 8, 13.4)],
		loot: { name: "Medical bag", kind: "Car", size: new Vector3(2, 1, 1.3), at: new Vector3(0, 0.5, 8.6) },
		sink: 0.25,
	},
	{
		name: "CrashedCar", // into the lamp post (x -60, z -46)
		at: spot(-60, -53, 188),
		boxes: [box(0.6, 1.5, 0.6, 5.2, 2.8, 11), box(0.6, 3.4, 0.2, 4.2, 1.8, 4.5)],
		loot: { name: "Car boot", kind: "Car", size: new Vector3(2.4, 0.7, 0.3), at: new Vector3(0.6, 1.7, 6.2) },
		fires: [{ kind: "Steam", at: new Vector3(0.6, 2.8, -4.2), scale: 1.5 }], // under the bonnet
	},
	{
		name: "BurntCar",
		at: spot(78, -62, 110),
		boxes: [box(0, 1.2, 0, 5, 2.2, 10.8), box(0, 3.2, 1, 4, 1.8, 5)],
		fires: [
			{ kind: "Fire", at: new Vector3(0, 2.1, -3.8), scale: 2 }, // engine
			{ kind: "Fire", at: new Vector3(0.4, 4, 1), scale: 1.2 }, // through the roof
			{ kind: "Smoke", at: new Vector3(0, 4.4, -1), scale: 1.4 },
		],
	},
];

export function buildWrecks() {
	const wrecks = folder(Workspace, "Wrecks");
	const built = WRECKS.map((wreck) => {
		const holder = folder(wrecks, wreck.name);
		const blocks = wreck.boxes.map(({ size, at }) =>
			part(holder, "Collider", size, wreck.at.mul(new CFrame(at)), { ...METAL, transparency: 1, shadow: false }),
		);
		const loot = wreck.loot;
		if (loot) {
			const container = part(holder, loot.name, loot.size, wreck.at.mul(new CFrame(loot.at)), METAL);
			container.SetAttribute("Kind", loot.kind);
			CollectionService.AddTag(container, LOOT_CONTAINER_TAG);
		}
		for (const { kind, at, scale } of wreck.fires ?? []) {
			addFire(holder, kind, wreck.at.mul(new CFrame(at)), scale);
		}
		return { wreck, holder, blocks };
	});
	task.spawn(() => {
		const models = loadModel(WRECKS_MODEL, "the wrecks, so they're plain blocks");
		for (const { wreck, holder, blocks } of built) {
			const ground = wreck.at.mul(new CFrame(0, -(wreck.sink ?? 0), 0));
			const mesh = standMesh(models, wreck.name, holder, ground);
			if (mesh) {
				mesh.CanCollide = false;
			} else {
				blocks.forEach((block) => (block.Transparency = 0));
			}
		}
		models?.Destroy();
	});
}
