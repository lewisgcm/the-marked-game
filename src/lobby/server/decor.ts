import { CollectionService, Workspace } from "@rbxts/services";
import { findMeshAsset } from "shared/assets";
import { folder, limb, model, part, place } from "shared/parts";
import { PAGE_COLOR, RITUAL_ITEM_HEIGHT } from "shared/ritualItems";
import { FLICKER_LIGHT_TAG } from "shared/tags";
import { LOBBY_FLOOR_SIZE, LOBBY_ZONE_COUNT, zoneX } from "./config";
import { kitReady, placeKit } from "./kit";
import { buildKitDecor } from "./kitDecor";

/**
 * Set dressing for the lobby: a ruined churchyard at night.
 *
 *   north  ── chapel ruins (bell tower, glowing arched window)
 *            rows of graves, dead trees
 *   middle ── the three teleport pads as ritual circles: candles + an item pedestal each
 *   sides  ── grave columns
 *   south  ── iron gate and flagstone path up to the pads (players spawn on the path)
 *
 * Everything is plain parts built at runtime, so it's a blockout: the hero props (chapel,
 * gate, trees, ritual items) are slated to become Blender models later. A fixed seed keeps
 * the "random" layout identical on every run.
 */
const rng = new Random(1031);

const HALF = LOBBY_FLOOR_SIZE / 2;
const FENCE_EDGE = HALF - 0.6;
const GATE_HALF_WIDTH = 5;

const MOSS = new Color3(0.3, 0.35, 0.28);
const RUIN = new Color3(0.3, 0.29, 0.3);
const IRON = new Color3(0.09, 0.08, 0.09);
const BARK = new Color3(0.2, 0.17, 0.15);
const WAX = new Color3(0.9, 0.86, 0.74);
const FLAME = new Color3(1, 0.55, 0.15);
const FLAME_LIGHT = new Color3(1, 0.62, 0.3);
const CRIMSON = new Color3(0.6, 0.03, 0.05);

const SMOKE_TEXTURE = "rbxasset://textures/particles/smoke_main.dds";
const SPARK_TEXTURE = "rbxasset://textures/particles/sparkles_main.dds";

/**
 * Rotation that turns an imported mesh's front toward the players (south, -Z). Meshes are
 * modelled facing Blender's -Y, which imports as Roblox -Z (verified with the skull), so no
 * turn is needed.
 */
const SKULL_YAW = 0;

const BOOK_HEIGHT = RITUAL_ITEM_HEIGHT.Book;
const SKULL_HEIGHT = RITUAL_ITEM_HEIGHT.Skull;
const CANDLES_HEIGHT = RITUAL_ITEM_HEIGHT.Candles;

/**
 * Each candle wick's position relative to the mesh's bottom centre (x, height, z), where the
 * game adds a flame. The layout is mirror-symmetric in X, so it holds whichever way the
 * importer maps that axis (tools/blender/assets/candles.py).
 */
const CANDLE_WICKS = [
	new Vector3(0, 1.2, 0.25),
	new Vector3(-0.42, 0.8, 0),
	new Vector3(0.42, 0.8, 0),
	new Vector3(0, 0.5, -0.32),
];

export type RitualItem = "book" | "skull" | "candles";
const PAD_ITEMS: RitualItem[] = ["book", "skull", "candles"];

function between(min: number, max: number) {
	return rng.NextNumber(min, max);
}

const PATH_STONES = [Color3.fromHex("#73717e"), Color3.fromHex("#5f5d6a"), Color3.fromHex("#4d4b58")];

function stoneShade(base = 0.33, spread = 0.08) {
	const g = between(base - spread / 2, base + spread / 2);
	return new Color3(g, g * 0.97, g * 0.99);
}

// --- Path -----------------------------------------------------------------------------

/** Irregular flagstones covering a rectangle; `keepClear` skips spots (e.g. the spawn). */
function flagstones(
	parent: Instance,
	minX: number,
	maxX: number,
	minZ: number,
	maxZ: number,
	keepClear: (x: number, z: number) => boolean,
) {
	for (let z = minZ; z <= maxZ; z += 2.3) {
		for (let x = minX; x <= maxX; x += 2.4) {
			const px = x + between(-0.2, 0.2);
			const pz = z + between(-0.2, 0.2);
			if (keepClear(px, pz) || rng.NextNumber() < 0.08) {
				continue; // a few missing stones read as old and broken
			}
			part(
				parent,
				"Flagstone",
				new Vector3(between(1.8, 2.3), 0.14, between(1.7, 2.1)),
				new CFrame(px, 0.07, pz).mul(CFrame.Angles(0, between(-0.12, 0.12), 0)),
				// Flat palette greys (tools/blender lib/palette.py stone swatches), no texture, to
				// match the low-poly kit.
				{
					color: PATH_STONES[rng.NextInteger(0, PATH_STONES.size() - 1)],
					material: Enum.Material.SmoothPlastic,
					shadow: false,
				},
			);
		}
	}
}

function buildPath(parent: Instance, spawnZ: number) {
	const path = folder(parent, "Path");
	const isSpawn = (x: number, z: number) => math.abs(x) < 5 && math.abs(z - spawnZ) < 5;
	// Gate -> pad row, then a cross path in front of the pads.
	flagstones(path, -2.4, 2.4, -FENCE_EDGE + 1, -12, isSpawn);
	const outer = math.abs(zoneX(0)) + 4;
	flagstones(path, -outer, outer, -11, -8.5, () => false);
}

// --- Fence & gate ---------------------------------------------------------------------

function fenceRun(parent: Instance, from: Vector3, to: Vector3) {
	const iron = { material: Enum.Material.CorrodedMetal, color: IRON };
	const offset = to.sub(from);
	const posts = math.max(1, math.floor(offset.Magnitude / 3));
	for (let i = 0; i <= posts; i++) {
		const at = from.add(offset.mul(i / posts));
		part(parent, "Post", new Vector3(0.3, 6, 0.3), new CFrame(at.add(new Vector3(0, 3, 0))), iron);
		part(parent, "Finial", new Vector3(0.45, 0.45, 0.45), new CFrame(at.add(new Vector3(0, 6.15, 0))), {
			...iron,
			shape: Enum.PartType.Ball,
		});
	}
	for (const y of [1, 5]) {
		limb(parent, "Rail", from.add(new Vector3(0, y, 0)), to.add(new Vector3(0, y, 0)), 0.2, iron);
	}
}

function buildFence(parent: Instance) {
	const fence = folder(parent, "Fence");
	const e = FENCE_EDGE;
	const gap = GATE_HALF_WIDTH + 1.5;
	fenceRun(fence, new Vector3(-e, 0, e), new Vector3(e, 0, e)); // north
	fenceRun(fence, new Vector3(e, 0, -e), new Vector3(e, 0, e)); // east
	fenceRun(fence, new Vector3(-e, 0, -e), new Vector3(-e, 0, e)); // west
	fenceRun(fence, new Vector3(-e, 0, -e), new Vector3(-gap, 0, -e)); // south, left of gate
	fenceRun(fence, new Vector3(gap, 0, -e), new Vector3(e, 0, -e)); // south, right of gate
}

function buildGate(parent: Instance) {
	const gate = folder(parent, "Gate");
	const z = -FENCE_EDGE;
	const pillarX = GATE_HALF_WIDTH + 0.5;
	const iron = { material: Enum.Material.CorrodedMetal, color: IRON };

	for (const side of [-1, 1]) {
		const x = side * pillarX;
		part(gate, "Pillar", new Vector3(2, 8, 2), new CFrame(x, 4, z), { color: stoneShade(0.3) });
		part(gate, "PillarCap", new Vector3(2.6, 0.5, 2.6), new CFrame(x, 8.25, z), { color: stoneShade(0.32) });
		part(gate, "PillarOrb", new Vector3(1.2, 1.2, 1.2), new CFrame(x, 9.1, z), {
			color: stoneShade(0.32),
			shape: Enum.PartType.Ball,
		});

		// Gate leaf swung open inward, hinged on the pillar.
		const hinge = new Vector3(side * GATE_HALF_WIDTH, 0, z + 1);
		const swing = math.rad(65);
		// Folded back toward the fence, so the gateway stays clear.
		const along = new Vector3(side * math.cos(swing), 0, math.sin(swing));
		const leafLength = GATE_HALF_WIDTH - 0.3;
		for (const y of [0.6, 6.4]) {
			const base = hinge.add(new Vector3(0, y, 0));
			limb(gate, "LeafRail", base, base.add(along.mul(leafLength)), 0.2, iron);
		}
		for (let i = 0; i <= 6; i++) {
			const at = hinge.add(along.mul((leafLength * i) / 6));
			limb(gate, "LeafBar", at.add(new Vector3(0, 0.4, 0)), at.add(new Vector3(0, 7, 0)), 0.15, iron);
		}
	}

	// Iron arch over the gateway.
	const archCentre = new Vector3(0, 8.6, z);
	const segments = 8;
	for (let i = 0; i < segments; i++) {
		const a0 = (math.pi * i) / segments;
		const a1 = (math.pi * (i + 1)) / segments;
		const p0 = archCentre.add(new Vector3(math.cos(a0) * pillarX, math.sin(a0) * 2.5, 0));
		const p1 = archCentre.add(new Vector3(math.cos(a1) * pillarX, math.sin(a1) * 2.5, 0));
		limb(gate, "Arch", p0, p1, 0.3, iron);
	}
}

// --- Graveyard ------------------------------------------------------------------------

function headstone(m: Model) {
	const height = between(1.6, 2.6);
	const width = between(1.9, 2.4);
	const thickness = 0.55;
	const color = rng.NextNumber() < 0.3 ? MOSS : stoneShade(0.36);
	part(m, "Body", new Vector3(width, height, thickness), new CFrame(0, height / 2, 0), { color });
	// Rounded top: a cylinder whose axis points through the stone's face.
	part(
		m,
		"Top",
		new Vector3(thickness, width, width),
		new CFrame(0, height, 0).mul(CFrame.Angles(0, math.pi / 2, 0)),
		{ color, shape: Enum.PartType.Cylinder },
	);
}

function cross(m: Model) {
	const color = stoneShade(0.38);
	part(m, "Upright", new Vector3(0.5, 3.6, 0.5), new CFrame(0, 1.8, 0), { color });
	part(m, "Arm", new Vector3(2, 0.45, 0.5), new CFrame(0, 2.7, 0), { color });
}

function obelisk(m: Model) {
	const color = stoneShade(0.34);
	part(m, "Base", new Vector3(1.8, 0.6, 1.8), new CFrame(0, 0.3, 0), { color });
	part(m, "Shaft", new Vector3(1, 3.6, 1), new CFrame(0, 2.4, 0), { color });
	part(m, "Cap", new Vector3(1.3, 0.4, 1.3), new CFrame(0, 4.4, 0), { color });
}

function grave(parent: Instance, x: number, z: number, facing: number) {
	const m = model(parent, "Grave");
	const roll = rng.NextNumber();
	if (roll < 0.65) {
		headstone(m);
	} else if (roll < 0.85) {
		cross(m);
	} else {
		obelisk(m);
	}
	// Sunk slightly and leaning, as old graves do.
	const lean = CFrame.Angles(between(-0.12, 0.12), 0, between(-0.1, 0.1));
	place(m, new CFrame(x, -0.25, z).mul(CFrame.Angles(0, facing + between(-0.1, 0.1), 0)).mul(lean));
}

function buildGraveyard(parent: Instance) {
	const yard = folder(parent, "Graveyard");

	// Rows behind the pads, facing south toward the players. A clear aisle runs up the
	// middle to the chapel door.
	for (const z of [20, 27, 34]) {
		for (let x = -52; x <= 52; x += 5.5) {
			if (math.abs(x) < 7 || rng.NextNumber() < 0.25) {
				continue;
			}
			grave(yard, x + between(-0.6, 0.6), z + between(-0.8, 0.8), 0);
		}
	}

	// Columns along both sides, facing in toward the path.
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

// --- Dead trees -----------------------------------------------------------------------

function deadTree(parent: Instance, base: Vector3) {
	const tree = folder(parent, "DeadTree");
	const bark = { material: Enum.Material.Wood, color: BARK };
	const height = between(9, 12);
	const top = base.add(new Vector3(between(-0.8, 0.8), height, between(-0.8, 0.8)));
	limb(tree, "Trunk", base.sub(new Vector3(0, 0.5, 0)), top, 1.5, bark);

	for (let i = 0; i < 3; i++) {
		const a = (i / 3) * math.pi * 2 + between(0, 1);
		const root = base.add(new Vector3(math.cos(a) * 2.2, -0.3, math.sin(a) * 2.2));
		limb(tree, "Root", base.add(new Vector3(0, 0.8, 0)), root, 0.7, bark);
	}

	for (let i = 0; i < 5; i++) {
		const start = base.Lerp(top, between(0.45, 0.95));
		const a = between(0, math.pi * 2);
		const dir = new Vector3(math.cos(a), between(0.5, 1.1), math.sin(a)).Unit;
		const tip = start.add(dir.mul(between(3.5, 6)));
		limb(tree, "Branch", start, tip, 0.55, bark);

		for (let j = 0; j < 2; j++) {
			const b = a + between(-1, 1);
			const twigDir = new Vector3(math.cos(b), between(0.3, 1.2), math.sin(b)).Unit;
			const from = start.Lerp(tip, between(0.6, 1));
			limb(tree, "Twig", from, from.add(twigDir.mul(between(1.5, 2.5))), 0.25, bark);
		}
	}
}

function buildTrees(parent: Instance) {
	const trees = folder(parent, "Trees");
	for (const [x, z] of [
		[-50, 44],
		[50, 44],
		[-34, -44],
		[34, -44],
	]) {
		deadTree(trees, new Vector3(x, 0, z));
	}
}

// --- Chapel ruins ---------------------------------------------------------------------

function buildChapel(parent: Instance) {
	const chapel = folder(parent, "ChapelRuins");
	const wallZ = 52;
	const thickness = 2;
	const stone = { material: Enum.Material.Cobblestone, color: RUIN };

	// Broken wall, highest next to the window and crumbling toward the ends.
	const leftHeights = [3, 5, 4, 8, 10, 9, 12, 14, 13, 16]; // x = -26 .. -6
	const rightHeights = [16, 13, 14, 11, 9, 10, 6, 4, 5, 2]; // x = 6 .. 26
	leftHeights.forEach((h, i) => {
		const x = -25 + i * 2;
		part(chapel, "Wall", new Vector3(2, h, thickness), new CFrame(x, h / 2, wallZ + between(-0.15, 0.15)), stone);
	});
	rightHeights.forEach((h, i) => {
		const x = 7 + i * 2;
		part(chapel, "Wall", new Vector3(2, h, thickness), new CFrame(x, h / 2, wallZ + between(-0.15, 0.15)), stone);
	});

	// Piers framing the arched window, the wall under it, and a dark doorway.
	for (const side of [-1, 1]) {
		part(chapel, "Pier", new Vector3(2, 20, thickness + 0.4), new CFrame(side * 4, 10, wallZ), stone);
		limb(chapel, "ArchRib", new Vector3(side * 3, 15, wallZ - 0.6), new Vector3(0, 19, wallZ - 0.6), 1.1, stone);
	}
	part(chapel, "UnderWindow", new Vector3(6, 5, thickness), new CFrame(0, 2.5, wallZ), stone);
	part(chapel, "Doorway", new Vector3(3.4, 4.4, 0.1), new CFrame(0, 2.2, wallZ - thickness / 2 - 0.05), {
		color: new Color3(0.03, 0.02, 0.03),
		material: Enum.Material.SmoothPlastic,
	});

	// Red glow through the empty window, with iron tracery in front of it.
	part(chapel, "WindowGlow", new Vector3(6, 14, 0.2), new CFrame(0, 12, wallZ + 0.6), {
		material: Enum.Material.Neon,
		color: CRIMSON,
		transparency: 0.15,
		collide: false,
		shadow: false,
	});
	const iron = { material: Enum.Material.CorrodedMetal, color: IRON };
	limb(chapel, "Tracery", new Vector3(0, 5, wallZ - 0.3), new Vector3(0, 18, wallZ - 0.3), 0.25, iron);
	limb(chapel, "Tracery", new Vector3(-3, 11, wallZ - 0.3), new Vector3(3, 11, wallZ - 0.3), 0.25, iron);
	const glowAnchor = part(chapel, "WindowLight", new Vector3(0.2, 0.2, 0.2), new CFrame(0, 10, wallZ - 4), {
		collide: false,
		transparency: 1,
		shadow: false,
	});
	const glow = new Instance("PointLight");
	glow.Color = CRIMSON;
	glow.Brightness = 2.5;
	glow.Range = 26;
	glow.Parent = glowAnchor;

	// Leaning bell tower.
	const tower = model(chapel, "BellTower");
	part(tower, "Tower", new Vector3(7, 22, 7), new CFrame(0, 11, 0), stone);
	for (const [cx, cz] of [
		[-2.9, -2.9],
		[2.9, -2.9],
		[-2.9, 2.9],
		[2.9, 2.9],
	]) {
		part(tower, "BelfryPillar", new Vector3(1.2, 5, 1.2), new CFrame(cx, 24.5, cz), stone);
	}
	part(tower, "Roof", new Vector3(8, 1, 8), new CFrame(0, 27.5, 0), stone);
	part(tower, "Spire1", new Vector3(5.5, 1.2, 5.5), new CFrame(0, 28.6, 0), stone);
	part(tower, "Spire2", new Vector3(3, 1.4, 3), new CFrame(0, 29.9, 0), stone);
	part(tower, "Spire3", new Vector3(1.2, 2, 1.2), new CFrame(0, 31.6, 0), stone);
	part(tower, "Bell", new Vector3(2.6, 2.6, 2.6), new CFrame(0, 24.3, 0), {
		shape: Enum.PartType.Ball,
		material: Enum.Material.Metal,
		color: new Color3(0.35, 0.25, 0.12),
	});
	place(tower, new CFrame(-17, 0, wallZ - 3).mul(CFrame.Angles(0, 0, math.rad(2.5))));

	// Rubble fallen from the walls (kept clear of the doorway).
	for (let i = 0; i < 16; i++) {
		let x = between(-25, 25);
		if (math.abs(x) < 4) {
			x += x < 0 ? -4 : 4;
		}
		const s = between(0.6, 2);
		part(
			chapel,
			"Rubble",
			new Vector3(s, s * between(0.5, 0.9), s * between(0.7, 1.2)),
			new CFrame(x, s * 0.25, between(45, 50)).mul(
				CFrame.Angles(between(-0.4, 0.4), between(0, 3), between(-0.4, 0.4)),
			),
			{ ...stone, color: stoneShade(0.3) },
		);
	}
}

// --- Ritual circles -------------------------------------------------------------------

/** A wax candle with a flickering flame (the flicker runs on clients, see shared/flicker). */
function candle(parent: Instance, base: Vector3, height: number, diameter = 0.45) {
	// The kit candle is 1 stud tall and ~0.44 across; stretch it to this height and width.
	const width = diameter / 0.44;
	if (placeKit("RitualCandle", parent, new CFrame(base), { scale: new Vector3(width, height, width) })) {
		flame(parent, base.add(new Vector3(0, height + 0.2, 0)), 0.28);
		return;
	}
	part(
		parent,
		"Candle",
		new Vector3(height, diameter, diameter),
		new CFrame(base.add(new Vector3(0, height / 2, 0))).mul(CFrame.Angles(0, 0, math.pi / 2)),
		{
			shape: Enum.PartType.Cylinder,
			material: Enum.Material.SmoothPlastic,
			color: WAX,
			collide: false,
			shadow: false,
		},
	);
	flame(parent, base.add(new Vector3(0, height + 0.2, 0)), 0.28);
}

/** A glowing flame with a flickering light (the flicker runs on clients, see shared/flicker). */
function flame(parent: Instance, position: Vector3, size: number) {
	const flamePart = part(parent, "Flame", new Vector3(size, size, size), new CFrame(position), {
		shape: Enum.PartType.Ball,
		material: Enum.Material.Neon,
		color: FLAME,
		collide: false,
		shadow: false,
	});
	const light = new Instance("PointLight");
	light.Color = FLAME_LIGHT;
	light.Brightness = 1.4;
	light.Range = 9;
	light.Shadows = false;
	light.Parent = flamePart;
	CollectionService.AddTag(light, FLICKER_LIGHT_TAG);
}

function embers(parent: Instance, centre: Vector3) {
	const source = part(parent, "Embers", new Vector3(12, 0.2, 12), new CFrame(centre.add(new Vector3(0, 0.5, 0))), {
		collide: false,
		transparency: 1,
		shadow: false,
	});
	source.CanQuery = false;
	source.CanTouch = false;
	const emitter = new Instance("ParticleEmitter");
	emitter.Texture = SPARK_TEXTURE;
	emitter.Color = new ColorSequence(new Color3(1, 0.6, 0.2), new Color3(0.8, 0.1, 0.05));
	emitter.LightEmission = 1;
	emitter.Size = new NumberSequence(0.18, 0);
	emitter.Transparency = new NumberSequence(0.1, 1);
	emitter.Lifetime = new NumberRange(2.5, 4.5);
	emitter.Rate = 5;
	emitter.Speed = new NumberRange(1, 2.5);
	emitter.SpreadAngle = new Vector2(25, 25);
	emitter.Acceleration = new Vector3(0, 0.6, 0);
	emitter.Drag = 0.5;
	emitter.Parent = source;
}

function pedestal(parent: Instance, base: Vector3): number {
	if (placeKit("Pedestal", parent, new CFrame(base), { collide: "box" })) {
		return base.Y + 3.3; // the kit pedestal's top (tools/blender lib/lowpoly.py)
	}
	const color = stoneShade(0.34);
	part(parent, "PedestalBase", new Vector3(2.4, 0.4, 2.4), new CFrame(base.add(new Vector3(0, 0.2, 0))), { color });
	part(parent, "PedestalColumn", new Vector3(1.6, 2.6, 1.6), new CFrame(base.add(new Vector3(0, 1.7, 0))), { color });
	part(parent, "PedestalTop", new Vector3(2.2, 0.3, 2.2), new CFrame(base.add(new Vector3(0, 3.15, 0))), { color });
	return base.Y + 3.3;
}

/** Stand-in ritual items until the Blender models exist. They face south, toward players. */
function ritualItem(parent: Instance, item: RitualItem, at: Vector3) {
	if (item === "book") {
		const book = findMeshAsset("Book");
		if (book) {
			const cf = new CFrame(at.add(new Vector3(0, BOOK_HEIGHT / 2, 0))).mul(CFrame.Angles(0, math.rad(15), 0));
			const model = book.Clone();
			model.CFrame = cf;
			model.Parent = parent;
			return;
		}
		const cf = new CFrame(at).mul(CFrame.Angles(0, math.rad(15), 0));
		part(parent, "BookCover", new Vector3(1.4, 0.3, 1), cf.mul(new CFrame(0, 0.15, 0)), {
			material: Enum.Material.Fabric,
			color: new Color3(0.35, 0.05, 0.05),
		});
		part(parent, "BookPages", new Vector3(1.3, 0.22, 0.92), cf.mul(new CFrame(0.04, 0.2, 0)), {
			material: Enum.Material.SmoothPlastic,
			color: PAGE_COLOR,
		});
		part(parent, "BookTopCover", new Vector3(1.4, 0.06, 1), cf.mul(new CFrame(0, 0.34, 0)), {
			material: Enum.Material.Fabric,
			color: new Color3(0.35, 0.05, 0.05),
		});
	} else if (item === "skull") {
		const skull = findMeshAsset("Skull");
		if (skull) {
			const model = skull.Clone();
			// MeshPart.Position is the mesh's centre; lift it so it rests on the pedestal.
			model.CFrame = new CFrame(at.add(new Vector3(0, SKULL_HEIGHT / 2, 0))).mul(CFrame.Angles(0, SKULL_YAW, 0));
			model.Parent = parent;
			return;
		}
		const bone = { material: Enum.Material.SmoothPlastic, color: new Color3(0.85, 0.82, 0.7) };
		part(parent, "Cranium", new Vector3(1.1, 1.1, 1.1), new CFrame(at.add(new Vector3(0, 0.75, 0))), {
			...bone,
			shape: Enum.PartType.Ball,
		});
		part(parent, "Jaw", new Vector3(0.7, 0.35, 0.6), new CFrame(at.add(new Vector3(0, 0.2, -0.2))), bone);
		for (const side of [-1, 1]) {
			part(
				parent,
				"EyeSocket",
				new Vector3(0.3, 0.3, 0.3),
				new CFrame(at.add(new Vector3(side * 0.22, 0.8, -0.45))),
				{
					shape: Enum.PartType.Ball,
					material: Enum.Material.SmoothPlastic,
					color: new Color3(0.03, 0.02, 0.02),
					collide: false,
				},
			);
		}
	} else {
		const candles = findMeshAsset("Candles");
		if (candles) {
			const model = candles.Clone();
			model.CFrame = new CFrame(at.add(new Vector3(0, CANDLES_HEIGHT / 2, 0)));
			model.Parent = parent;
			for (const wick of CANDLE_WICKS) {
				flame(parent, at.add(wick).add(new Vector3(0, 0.1, 0)), 0.2);
			}
			return;
		}
		candle(parent, at.add(new Vector3(-0.5, 0, 0.2)), 1.1, 0.35);
		candle(parent, at.add(new Vector3(0.1, 0, -0.3)), 0.7, 0.35);
		candle(parent, at.add(new Vector3(0.55, 0, 0.3)), 0.45, 0.35);
	}
}

function ritualCircle(parent: Instance, centre: Vector3, item: RitualItem) {
	const circle = folder(parent, `RitualCircle_${item}`);

	// Candles around the pad, leaving a gap at the front where the path arrives.
	const radius = 6.6;
	const count = 8;
	const gap = 0.6;
	const start = -math.pi / 2 + gap;
	const span = math.pi * 2 - gap * 2;
	for (let i = 0; i < count; i++) {
		const a = start + (span * i) / (count - 1);
		const at = centre.add(new Vector3(math.cos(a) * radius, 0, math.sin(a) * radius));
		candle(circle, at, between(0.7, 1.7));
	}

	embers(circle, centre);

	// The ritual item this circle stands for, on a pedestal behind the pad.
	const top = pedestal(circle, centre.add(new Vector3(0, 0, 10)));
	ritualItem(circle, item, new Vector3(centre.X, top, centre.Z + 10));
}

// --- Ground fog -----------------------------------------------------------------------

function buildGroundFog(parent: Instance) {
	const fog = folder(parent, "GroundFog");
	for (const x of [-38, 0, 38]) {
		for (const z of [-38, 0, 38]) {
			const source = part(fog, "FogSource", new Vector3(38, 0.5, 38), new CFrame(x, 0.6, z), {
				collide: false,
				transparency: 1,
				shadow: false,
			});
			source.CanQuery = false;
			source.CanTouch = false;
			const emitter = new Instance("ParticleEmitter");
			emitter.Texture = SMOKE_TEXTURE;
			emitter.Color = new ColorSequence(new Color3(0.7, 0.66, 0.72));
			emitter.Size = new NumberSequence(8, 14);
			emitter.Transparency = new NumberSequence([
				new NumberSequenceKeypoint(0, 1),
				new NumberSequenceKeypoint(0.25, 0.88),
				new NumberSequenceKeypoint(0.75, 0.9),
				new NumberSequenceKeypoint(1, 1),
			]);
			emitter.Lifetime = new NumberRange(10, 16);
			emitter.Rate = 1.5;
			emitter.Speed = new NumberRange(0.2, 0.6);
			emitter.SpreadAngle = new Vector2(180, 180);
			emitter.Rotation = new NumberRange(0, 360);
			emitter.RotSpeed = new NumberRange(-6, 6);
			emitter.LightInfluence = 1;
			emitter.Parent = source;
		}
	}
}

// --- Entry point ----------------------------------------------------------------------

/** Builds all lobby set dressing. `spawnZ` is where the SpawnLocation sits on the path. */
export function buildDecor(spawnZ: number) {
	const decor = folder(Workspace, "Decor");
	buildPath(decor, spawnZ);
	if (kitReady()) {
		// The low-poly kit (kitDecor.ts); the builders below are the blockout fallback.
		buildKitDecor(decor, spawnZ);
	} else {
		buildFence(decor);
		buildGate(decor);
		buildGraveyard(decor);
		buildTrees(decor);
		buildChapel(decor);
	}
	for (let i = 0; i < LOBBY_ZONE_COUNT; i++) {
		ritualCircle(decor, new Vector3(zoneX(i), 0, 0), PAD_ITEMS[i % PAD_ITEMS.size()]);
	}
	buildGroundFog(decor);
}
