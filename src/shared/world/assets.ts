import { AssetService, ReplicatedStorage, RunService } from "@rbxts/services";

/**
 * Looks up a mesh model shared by both places, from `ReplicatedStorage.Assets`.
 *
 * The models live in `assets/rojo/*.model.json` and are mapped in by Rojo. They are
 * committed *without* a MeshId: build the FBX with `npm run models`, upload it though
 * Studio's 3D Importer, then paste the resulting ID into the model file's `MeshId`
 * property. In code, `MeshPart.MeshId` is read-only, which is why the ID has to be
 * data rather than something set at runtime.
 *
 * Returns undefined when there is no mesh yet, so callers can fall back to plain
 * parts and a fresh clone of this repo still runs.
 *
 * On the server the template is a real-size copy (see `sized`); on the client it is the Rojo
 * MeshPart itself, whose Size is a multiplier (the flashlight cone relies on that).
 */
export function findMeshAsset(name: string): MeshPart | undefined {
	const folder = ReplicatedStorage.FindFirstChild("Assets");
	const template = folder?.FindFirstChild(name);
	if (template === undefined || !template.IsA("MeshPart")) {
		warn(`[assets] ReplicatedStorage.Assets.${name} is missing — using the fallback.`);
		return undefined;
	}
	if (template.MeshId === "") {
		warn(
			`[assets] ${name} has no MeshId yet — build and upload its FBX from assets/models, then paste the ID into its assets/rojo model file.`,
		);
		return undefined;
	}
	return RunService.IsServer() ? sized(template) : template;
}

const sizedCache = new Map<MeshPart, MeshPart>();

/**
 * A copy of a Rojo-built MeshPart with its real size.
 *
 * Rojo can't write a MeshPart's mesh size, so a synced MeshPart reports Size 1,1,1 and the
 * mesh is drawn at its own scale around that. Roblox then culls it by that 1-stud box: big
 * meshes (the chapel, the crypts) vanished whenever their centre left the screen. A MeshPart
 * made by AssetService.CreateMeshPartAsync has its true Size, so it culls (and collides)
 * correctly; to scale it, multiply that Size. Made once per mesh and cached. Server only.
 */
export function sized(source: MeshPart): MeshPart {
	const cached = sizedCache.get(source);
	if (cached) {
		return cached;
	}
	const [ok, result] = pcall(() =>
		AssetService.CreateMeshPartAsync(Content.fromUri(source.MeshId), {
			CollisionFidelity: source.CollisionFidelity,
		}),
	);
	if (!ok) {
		warn(`[assets] Couldn't build ${source.Name} at full size (${result}); it may pop out of view up close.`);
		sizedCache.set(source, source);
		return source;
	}
	const part = result as MeshPart;
	part.Name = source.Name;
	part.TextureID = source.TextureID;
	part.Material = source.Material;
	part.Color = source.Color;
	part.Transparency = source.Transparency;
	part.Anchored = source.Anchored;
	part.CanCollide = source.CanCollide;
	part.CanQuery = source.CanQuery;
	part.CanTouch = source.CanTouch;
	part.CastShadow = source.CastShadow;
	sizedCache.set(source, part);
	return part;
}
