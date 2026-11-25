import { ReplicatedStorage } from "@rbxts/services";
import { sized } from "shared/world/assets";
import { KIT_PROPS, KitPropName } from "shared/lobby/kitManifest";

/**
 * The low-poly lobby kit (tools/blender/assets/lobby_kit.py): MeshParts in
 * ReplicatedStorage.Assets.LobbyKit, placed by their *base* (where they stand on the ground)
 * rather than their centre.
 *
 * Roblox centres each mesh on its bounding box, so the generated manifest
 * (shared/lobby/kitManifest.ts) says where that centre sits relative to the base. Meshes never
 * collide (Rojo can't bake mesh collision data); `collide` adds an invisible Part instead.
 */

/**
 * Blender X arrives mirrored in Roblox: the importer maps Blender -Y to Roblox -Z (verified with
 * the skull) and Z to Y, which for a proper rotation means X -> -X. Only matters for the
 * off-centre props (trees); flip to 1 if a tree's trunk doesn't sit on its spot.
 */
const KIT_X_SIGN = -1;

function template(name: KitPropName): MeshPart | undefined {
	// Lobby props live in Assets.LobbyKit; the ritual items (shared with the main game) in Assets.
	const assets = ReplicatedStorage.FindFirstChild("Assets");
	const mesh = assets?.FindFirstChild("LobbyKit")?.FindFirstChild(name) ?? assets?.FindFirstChild(name);
	return mesh && mesh.IsA("MeshPart") && mesh.MeshId !== "" ? sized(mesh) : undefined;
}

/** True once every kit mesh has been uploaded (otherwise the lobby keeps its blockout). */
export function kitReady(): boolean {
	// Build the real-size templates (one web request each) all at once rather than in turn.
	const started = os.clock();
	let pending = 0;
	for (const [name] of pairs(KIT_PROPS)) {
		pending += 1;
		task.spawn(() => {
			template(name);
			pending -= 1;
		});
	}
	while (pending > 0) {
		task.wait();
	}
	print(`[LobbyKit] Meshes ready in ${string.format("%.1f", os.clock() - started)}s.`);
	for (const [name] of pairs(KIT_PROPS)) {
		if (!template(name)) {
			warn(`[LobbyKit] ${name} has no MeshId yet — using the blockout lobby.`);
			return false;
		}
	}
	return true;
}

export type Collider =
	/** The prop's whole bounding box. */
	| "box"
	/** A trunk/post: a narrow column `width` wide and `height` tall at the base. */
	| { width: number; height: number }
	| undefined;

export interface KitOptions {
	/** Scale (1 = as modelled); a Vector3 stretches per axis, e.g. taller candles. */
	scale?: number | Vector3;
	collide?: Collider;
}

/** The prop's bounding box centre relative to its base, at `scale`. */
function centreOffset(name: KitPropName, scale: Vector3): Vector3 {
	const c = KIT_PROPS[name].centre;
	return new Vector3(c.X * KIT_X_SIGN, c.Y, c.Z).mul(scale);
}

/**
 * Places `name` standing at `base` (its LookVector is the way the prop faces). Returns the
 * MeshPart, or undefined if the kit isn't uploaded.
 */
export function placeKit(
	name: KitPropName,
	parent: Instance,
	base: CFrame,
	options: KitOptions = {},
): MeshPart | undefined {
	const source = template(name);
	if (!source) {
		return undefined;
	}
	const raw = options.scale ?? 1;
	const scale = typeIs(raw, "number") ? new Vector3(raw, raw, raw) : raw;
	const mesh = source.Clone();
	mesh.Size = source.Size.mul(scale); // real-size template (shared/world/assets.ts sized)
	mesh.CFrame = base.mul(new CFrame(centreOffset(name, scale)));
	mesh.Parent = parent;

	const collide = options.collide;
	if (collide !== undefined) {
		const box = new Instance("Part");
		box.Name = `${name}Collider`;
		box.Anchored = true;
		box.Transparency = 1;
		box.CanQuery = false;
		box.CanTouch = false;
		if (collide === "box") {
			box.Size = KIT_PROPS[name].size.mul(scale);
			box.CFrame = mesh.CFrame;
		} else {
			box.Size = new Vector3(collide.width, collide.height, collide.width).mul(scale);
			box.CFrame = base.mul(new CFrame(0, (collide.height * scale.Y) / 2, 0));
		}
		box.Parent = parent;
	}
	return mesh;
}
