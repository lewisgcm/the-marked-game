import { InsertService } from "@rbxts/services";

/** Uploaded models, loaded whole by asset ID. They have to belong to the game's owner. */

/** Loads model `assetId` (`what` names it in warnings). Yields. Undefined if it can't be had. */
export function loadModel(assetId: number, what: string): Model | undefined {
	const [ok, loaded] = pcall(() => InsertService.LoadAsset(assetId));
	const model = ok ? loaded.FindFirstChildOfClass("Model") : undefined;
	if (!model) {
		warn(`[Models] Couldn't load ${what}: ${loaded}`);
	}
	return model;
}

/**
 * Stands a copy of `name` from `models` on the ground at `at`, facing its LookVector, and returns
 * it; undefined if it isn't there. Its bounding box's middle goes over `at`.
 */
export function standMesh(
	models: Instance | undefined,
	name: string,
	parent: Instance,
	at: CFrame,
): MeshPart | undefined {
	const source = models?.FindFirstChild(name);
	if (!source || !source.IsA("MeshPart")) {
		return undefined;
	}
	const mesh = source.Clone();
	mesh.Anchored = true;
	mesh.CFrame = at.mul(new CFrame(0, mesh.Size.Y / 2, 0));
	mesh.Parent = parent;
	return mesh;
}
