import { findMeshAsset } from "shared/assets";

/**
 * The three ritual items (book, candles, skull): their models and how to place them.
 * Used by the lobby pedestals (as decoration) and the main game (as pickups / on the altar).
 */

export type RitualItemKind = "Book" | "Candles" | "Skull";
export const RITUAL_ITEMS: RitualItemKind[] = ["Book", "Candles", "Skull"];

/**
 * Mesh heights in studs (the low-poly lobby kit, tools/blender/assets/lobby_kit.py; see
 * src/shared/kitManifest.ts). A MeshPart's position is its centre, so placing one on a surface
 * means lifting it by half of this.
 */
export const RITUAL_ITEM_HEIGHT: Record<RitualItemKind, number> = {
	Book: 0.545,
	Candles: 1.27,
	Skull: 1.1,
};

/** Page colour for the plain-part fallback book (the low-poly mesh has its pages built in). */
export const PAGE_COLOR = new Color3(0.85, 0.8, 0.66);

const FALLBACK_COLOR: Record<RitualItemKind, Color3> = {
	Book: new Color3(0.35, 0.05, 0.05),
	Candles: new Color3(0.9, 0.86, 0.74),
	Skull: new Color3(0.85, 0.82, 0.7),
};

/**
 * Builds a ritual item standing on the surface at `base` (facing `yaw` radians), inside a
 * Model. Uses the uploaded mesh, or a plain block if it isn't available. Returns the Model and
 * its main part (where a ProximityPrompt or light can go).
 */
export function buildRitualItem(kind: RitualItemKind, parent: Instance, base: Vector3, yaw = 0): [Model, BasePart] {
	const model = new Instance("Model");
	model.Name = kind;
	const height = RITUAL_ITEM_HEIGHT[kind];
	const cframe = new CFrame(base.add(new Vector3(0, height / 2, 0))).mul(CFrame.Angles(0, yaw, 0));

	let main: BasePart;
	const template = findMeshAsset(kind);
	if (template) {
		main = template.Clone();
		main.CFrame = cframe;
	} else {
		main = new Instance("Part");
		main.Size = new Vector3(1, height, 1);
		main.CFrame = cframe;
		main.Color = FALLBACK_COLOR[kind];
	}
	main.Name = "Body";
	main.Anchored = true;
	main.CanCollide = false;
	main.Parent = model;

	model.PrimaryPart = main;
	model.Parent = parent;
	return [model, main];
}
