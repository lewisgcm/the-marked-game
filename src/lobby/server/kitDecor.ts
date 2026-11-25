import { CollectionService, ReplicatedStorage, Workspace } from "@rbxts/services";
import { sized } from "shared/world/assets";
import { folder, part } from "shared/world/parts";
import { FLICKER_LIGHT_TAG } from "shared/core/tags";
import { LOBBY_FLOOR_SIZE } from "./config";
import { KitPropName } from "shared/lobby/kitManifest";
import { placeKit } from "./kit";

/**
 * The lobby's set dressing from the low-poly kit (Synty-style meshes, tools/blender): fence,
 * gate, graves, trees, chapel ruins, crypts and lanterns, in the same layout as the blockout in
 * decor.ts (which is still used until the kit's meshes are uploaded).
 *
 *   north  ── chapel ruins + bell tower, a crypt either side
 *   middle ── grave rows behind the pads, grave columns down both sides
 *   south  ── iron gate, lanterns up the path to the pads
 */

const rng = new Random(1031);
const HALF = LOBBY_FLOOR_SIZE / 2;
const FENCE_EDGE = HALF - 0.6;
const GATE_HALF_WIDTH = 5;
const CRIMSON = new Color3(0.6, 0.03, 0.05);
const LANTERN_LIGHT = new Color3(1, 0.66, 0.35);
/** Where the lantern glass sits relative to a LanternPost's base (tools/blender lib/lowpoly.py). */
const LANTERN_GLASS = new Vector3(0, 5.7, -1.35);

function between(min: number, max: number) {
	return min + rng.NextNumber() * (max - min);
}

/** A CFrame at `position` whose X axis runs along `along` (for fence runs and gate leaves). */
function alongX(position: Vector3, along: Vector3): CFrame {
	return CFrame.fromMatrix(position, along.Unit, new Vector3(0, 1, 0));
}

// --- Fence & gate -----------------------------------------------------------------------

const SECTION = 6;
const PILLAR_EVERY = 4; // sections

function fenceRun(parent: Instance, from: Vector3, to: Vector3) {
	const offset = to.sub(from);
	const count = math.max(1, math.ceil(offset.Magnitude / SECTION));
	const step = offset.Magnitude / count;
	const along = offset.Unit;
	for (let i = 0; i < count; i++) {
		// Stretched a touch along the run so the sections meet exactly.
		const at = from.add(along.mul((i + 0.5) * step));
		placeKit("FenceSection", parent, alongX(at, along), {
			scale: new Vector3(step / SECTION, 1, 1),
			collide: "box",
		});
	}
	for (let i = 0; i <= count; i += PILLAR_EVERY) {
		placeKit("FencePillar", parent, new CFrame(from.add(along.mul(i * step))), { collide: "box" });
	}
	placeKit("FencePillar", parent, new CFrame(to), { collide: "box" });
}

function buildFence(parent: Instance) {
	const fence = folder(parent, "Fence");
	const e = FENCE_EDGE;
	const gap = GATE_HALF_WIDTH + 1.5;
	fenceRun(fence, new Vector3(-e, 0, e), new Vector3(e, 0, e));
	fenceRun(fence, new Vector3(e, 0, -e), new Vector3(e, 0, e));
	fenceRun(fence, new Vector3(-e, 0, -e), new Vector3(-e, 0, e));
	fenceRun(fence, new Vector3(-e, 0, -e), new Vector3(-gap, 0, -e));
	fenceRun(fence, new Vector3(gap, 0, -e), new Vector3(e, 0, -e));
}

function buildGate(parent: Instance) {
	const gate = folder(parent, "Gate");
	const z = -FENCE_EDGE;
	const pillarX = GATE_HALF_WIDTH + 0.5;
	for (const side of [-1, 1]) {
		placeKit("GatePillar", gate, new CFrame(side * pillarX, 0, z), { collide: "box" });
		// Each leaf swung open inward, hinged at the pillar (centred on its length).
		const hinge = new Vector3(side * GATE_HALF_WIDTH, 0, z + 1);
		const swing = math.rad(65);
		const along = new Vector3(side * math.cos(swing), 0, math.sin(swing));
		placeKit("GateLeaf", gate, alongX(hinge.add(along.mul(2.3)), along), { collide: "box" });
	}
	placeKit("GateArch", gate, new CFrame(0, 8.5, z));
}

// --- Graves, trees, crypts ----------------------------------------------------------------

const GRAVES: KitPropName[] = ["Grave_Round", "Grave_Gothic", "Grave_Broken", "Grave_Cross", "Grave_Obelisk"];
const GRAVE_ODDS = [0.25, 0.45, 0.6, 0.82, 1];

function grave(parent: Instance, x: number, z: number, facing: number) {
	const roll = rng.NextNumber();
	const index = GRAVE_ODDS.findIndex((odds) => roll < odds);
	const name = GRAVES[index >= 0 ? index : 0];
	// Sunk slightly and leaning, as old graves do.
	const lean = CFrame.Angles(between(-0.1, 0.1), 0, between(-0.08, 0.08));
	const base = new CFrame(x, -0.15, z).mul(CFrame.Angles(0, facing + between(-0.15, 0.15), 0)).mul(lean);
	placeKit(name, parent, base, { scale: between(0.95, 1.2), collide: "box" });
}

function buildGraveyard(parent: Instance) {
	const yard = folder(parent, "Graveyard");
	// Rows behind the pads, facing south; a clear aisle up the middle to the chapel door.
	for (const z of [20, 27, 34]) {
		for (let x = -52; x <= 52; x += 5.5) {
			if (math.abs(x) < 7 || rng.NextNumber() < 0.25) {
				continue;
			}
			grave(yard, x + between(-0.6, 0.6), z + between(-0.8, 0.8), 0);
		}
	}
	// Columns down both sides, facing in toward the path.
	for (const x of [42, 48, 54]) {
		for (let z = -50; z <= 12; z += 6) {
			for (const side of [-1, 1]) {
				if (rng.NextNumber() < 0.3) {
					continue;
				}
				grave(yard, side * x + between(-0.6, 0.6), z + between(-1, 1), (side * math.pi) / 2);
			}
		}
	}
}

function buildTrees(parent: Instance) {
	const trees = folder(parent, "Trees");
	const spots: Array<[number, number]> = [
		[-50, 44],
		[50, 44],
		[-34, -44],
		[34, -44],
		[-24, -30],
		[24, -30],
	];
	spots.forEach(([x, z], i) => {
		const base = new CFrame(x, -0.2, z).mul(CFrame.Angles(0, between(0, math.pi * 2), 0));
		placeKit(i % 2 === 0 ? "Tree_A" : "Tree_B", trees, base, {
			scale: between(1, 1.25),
			collide: { width: 1.3, height: 7 },
		});
	});
}

function buildCrypts(parent: Instance) {
	const crypts = folder(parent, "Crypts");
	for (const side of [-1, 1]) {
		const base = new CFrame(side * 38, 0, 44).mul(CFrame.Angles(0, side * math.rad(-12), 0));
		placeKit("Crypt", crypts, base, { collide: "box" });
	}
}

// --- Chapel ruins ---------------------------------------------------------------------------

function buildChapel(parent: Instance) {
	const chapel = folder(parent, "ChapelRuins");
	const wallZ = 52;
	placeKit("ChapelFront", chapel, new CFrame(0, 0, wallZ), { collide: "box" });
	placeKit("BellTower", chapel, new CFrame(-17, 0, wallZ - 2).mul(CFrame.Angles(0, 0, math.rad(2.5))), {
		collide: "box",
	});

	// Red glow through the empty window, behind the wall, and its light spilling out the front.
	part(chapel, "WindowGlow", new Vector3(6, 14, 0.2), new CFrame(0, 12, wallZ + 1.3), {
		material: Enum.Material.Neon,
		color: CRIMSON,
		transparency: 0.15,
		collide: false,
		shadow: false,
	});
	const glowAnchor = part(chapel, "WindowLight", new Vector3(0.2, 0.2, 0.2), new CFrame(0, 10, wallZ - 4), {
		collide: false,
		transparency: 1,
		shadow: false,
	});
	const glow = new Instance("PointLight");
	glow.Color = CRIMSON;
	// Soft: up close a strong red light turns the moonlit stone magenta.
	glow.Brightness = 1.2;
	glow.Range = 22;
	glow.Parent = glowAnchor;

	// Rubble fallen from the walls, kept clear of the doorway.
	for (let i = 0; i < 16; i++) {
		let x = between(-25, 25);
		if (math.abs(x) < 4) {
			x += x < 0 ? -4 : 4;
		}
		const base = new CFrame(x, -0.1, between(45, 49.5)).mul(CFrame.Angles(0, between(0, math.pi * 2), 0));
		placeKit(rng.NextNumber() < 0.5 ? "Rock_A" : "Rock_B", chapel, base, { scale: between(0.5, 1.3) });
	}
}

// --- Lanterns -------------------------------------------------------------------------------

function lantern(parent: Instance, position: Vector3, lookAt: Vector3) {
	const base = CFrame.lookAt(position, new Vector3(lookAt.X, position.Y, lookAt.Z));
	placeKit("LanternPost", parent, base, { collide: { width: 0.6, height: 7 } });
	const anchor = part(parent, "LanternLight", new Vector3(0.2, 0.2, 0.2), base.mul(new CFrame(LANTERN_GLASS)), {
		collide: false,
		transparency: 1,
		shadow: false,
	});
	const light = new Instance("PointLight");
	light.Color = LANTERN_LIGHT;
	// Gentle: on the faceted ground a bright lantern lights up every triangle.
	light.Brightness = 0.6;
	light.Range = 16;
	light.Parent = anchor;
	CollectionService.AddTag(light, FLICKER_LIGHT_TAG);
}

function buildLanterns(parent: Instance, spawnZ: number) {
	const lanterns = folder(parent, "Lanterns");
	// Up both sides of the path from the gate to the pads, leaving the spawn clear.
	for (const z of [-54, -40, -28, -16]) {
		if (math.abs(z - spawnZ) < 6) {
			continue;
		}
		for (const side of [-1, 1]) {
			lantern(lanterns, new Vector3(side * 4.6, 0, z), new Vector3(0, 0, z));
		}
	}
}

/** Depth of the ground mesh's dips; its top is at y = 0 (tools/blender/assets/lobby_ground.py). */
const GROUND_DIP = 0.3;

/**
 * The faceted low-poly ground sheet. The flat floor Part stays underneath for walking on (the
 * mesh dips at most 0.3 studs below it), just made invisible.
 */
function buildGround(parent: Instance) {
	const source = ReplicatedStorage.FindFirstChild("Assets")?.FindFirstChild("LobbyGround");
	const floor = Workspace.FindFirstChild("LobbyFloor");
	if (!source || !source.IsA("MeshPart") || source.MeshId === "" || !floor || !floor.IsA("BasePart")) {
		return;
	}
	const ground = sized(source).Clone();
	ground.CFrame = new CFrame(0, -GROUND_DIP / 2, 0);
	ground.Parent = parent;
	floor.Transparency = 1;
}

/** Builds the kit-based set dressing (everything but the path and the ritual circles). */
export function buildKitDecor(parent: Instance, spawnZ: number) {
	buildGround(parent);
	buildFence(parent);
	buildGate(parent);
	buildGraveyard(parent);
	buildTrees(parent);
	buildCrypts(parent);
	buildChapel(parent);
	buildLanterns(parent, spawnZ);
}
