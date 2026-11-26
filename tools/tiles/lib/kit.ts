import { CFrame } from "./cframe.ts";
import { MAP_BUILDINGS } from "./mapBuildings.ts";
import { MAP_KIT } from "./mapKit.ts";
import { MAP_KIT_IDS, MAP_KIT_TEXTURE } from "./mapKitIds.ts";
import type { Tile } from "./tile.ts";

/**
 * The map's meshes in tiles: the kit (tools/blender/assets/map_kit.py: trees, fences, props) and the
 * buildings (map_buildings.py). Until a mesh is uploaded and its ID is in mapKitIds.ts, the pieces in
 * build.ts build their old blockout instead.
 */

/** A mesh: its size, and its middle from its base point (Roblox axes, before KIT_X_SIGN). */
export interface KitMesh {
	size: [number, number, number];
	centre: [number, number, number];
}

const MESHES = { ...MAP_KIT, ...MAP_BUILDINGS };
export type KitName = keyof typeof MESHES;

/**
 * The importer turns the mesh round, so a mesh's middle is on the other side in X from where Blender has
 * it (as the lobby kit found: KIT_X_SIGN in src/lobby/server/kit.ts). Matters only for lopsided meshes.
 */
const KIT_X_SIGN = -1;

/** Whether `name` has been uploaded. */
export function hasKitMesh(name: KitName): boolean {
	return MAP_KIT_IDS[name] !== undefined;
}

/** A kit mesh's size (Roblox axes). */
export function kitSize(name: KitName): [number, number, number] {
	return MESHES[name].size;
}

/**
 * Stands kit mesh `name` with its base point at `base` (its front, -Z, the way `base` faces). It doesn't
 * collide: add plain-part colliders (`collider` in build.ts). False if it isn't uploaded yet.
 */
export function kitMesh(t: Tile, name: KitName, base: CFrame): boolean {
	const id = MAP_KIT_IDS[name];
	if (id === undefined) return false;
	const { size, centre } = MESHES[name];
	t.mesh(name, size, base.mul(new CFrame(centre[0] * KIT_X_SIGN, centre[1], centre[2])), {
		MeshId: id,
		TextureID: MAP_KIT_TEXTURE,
		CanCollide: false,
		CanQuery: false,
		CanTouch: false,
	});
	return true;
}
