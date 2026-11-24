import { CollectionService, Workspace } from "@rbxts/services";
import { BaseId, findBase } from "shared/bases";
import { folder, limb, part, PartOptions } from "shared/parts";
import { TRADER_TAG } from "shared/tags";
import { slab, wall } from "./building";
import { loadModel, standMesh } from "./models";
import { buildNpc, NpcLook } from "./npc";

/**
 * The bases' buildings (blockouts): the Treehouse at the left end of Maple Street, the Fire Station
 * at the right. Each has a counter tagged for trading.ts, with its trader standing behind it.
 * Local -Z faces the street.
 */

/** The Fire Station's engine (tools/blender/assets/fire_engine.py), owned by the game's owner. */
const ENGINE_MODEL = 93513592432736;

const WOOD: PartOptions = { material: Enum.Material.Wood, color: new Color3(0.45, 0.33, 0.22) };
const BARK: PartOptions = { material: Enum.Material.Wood, color: new Color3(0.33, 0.24, 0.17) };
const LEAVES: PartOptions = { material: Enum.Material.Grass, color: new Color3(0.24, 0.4, 0.2), collide: false };
const BRICK: PartOptions = { material: Enum.Material.Brick, color: new Color3(0.6, 0.25, 0.2) };
const CONCRETE: PartOptions = { material: Enum.Material.Concrete, color: new Color3(0.55, 0.55, 0.55) };
const RED: PartOptions = { material: Enum.Material.Metal, color: new Color3(0.75, 0.12, 0.1) };

const KID: NpcLook = {
	name: findBase("Treehouse").trader,
	skin: new Color3(0.8, 0.62, 0.5),
	top: new Color3(0.3, 0.5, 0.35),
	legs: new Color3(0.25, 0.3, 0.45),
	scale: 0.75,
};
const CHIEF: NpcLook = {
	name: findBase("FireStation").trader,
	skin: new Color3(0.6, 0.45, 0.36),
	top: new Color3(0.2, 0.2, 0.24),
	legs: new Color3(0.75, 0.6, 0.2),
	scale: 1,
};

function sign(parent: Instance, text: string, size: Vector3, at: CFrame, style: PartOptions) {
	const board = part(parent, "Sign", size, at, style);
	const gui = new Instance("SurfaceGui");
	gui.Face = Enum.NormalId.Front;
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	gui.PixelsPerStud = 30;
	const label = new Instance("TextLabel");
	label.Size = new UDim2(1, 0, 1, 0);
	label.BackgroundTransparency = 1;
	label.Font = Enum.Font.GothamBlack;
	label.TextScaled = true;
	label.TextColor3 = new Color3(1, 0.95, 0.85);
	label.Text = text;
	label.Parent = gui;
	gui.Parent = board;
}

/** A counter kids trade over, with the trader behind it (+Z side) facing the street. */
function traderStall(parent: Instance, id: BaseId, look: NpcLook, at: CFrame, floorY: number) {
	const counter = part(parent, "Counter", new Vector3(8, 3, 1.5), at.mul(new CFrame(0, floorY + 1.5, 0)), WOOD);
	counter.SetAttribute("Base", id);
	CollectionService.AddTag(counter, TRADER_TAG);
	task.spawn(() => buildNpc(parent, look, at.mul(new CFrame(0, floorY, 3))));
}

function buildTreehouse(parent: Instance, at: CFrame) {
	const base = folder(parent, "Treehouse");
	const point = (x: number, y: number, z: number) => at.mul(new Vector3(x, y, z));
	const spot = (x: number, y: number, z: number) => at.mul(new CFrame(x, y, z));

	limb(base, "Trunk", point(0, -1, 0), point(0, 30, 0), 6, BARK);
	for (const [x, y, z, size] of [
		[0, 34, 0, 26],
		[-10, 30, 4, 16],
		[10, 31, -3, 17],
	]) {
		part(base, "Leaves", new Vector3(size, size, size), spot(x, y, z), { ...LEAVES, shape: Enum.PartType.Ball });
	}
	// The house up in the branches (for show: the gang trades from the foot of the tree).
	slab(base, "Deck", -11, 11, -9, 9, 14, WOOD, at);
	wall(base, "X", -7, -8, 8, 14, 7, [{ center: 0, width: 4, bottom: 2, top: 5 }], WOOD, at);
	wall(base, "X", 7, -8, 8, 14, 7, [], WOOD, at);
	wall(base, "Z", -8, -7, 7, 14, 7, [], WOOD, at);
	wall(base, "Z", 8, -7, 7, 14, 7, [], WOOD, at);
	slab(base, "Roof", -10, 10, -9, 9, 22, BARK, at);
	for (let y = 1; y < 14; y += 1.5) {
		part(base, "Rung", new Vector3(3, 0.4, 0.5), spot(0, y, -3.2), WOOD);
	}
	sign(base, "TREEHOUSE", new Vector3(14, 3, 0.5), spot(0, 11.5, -9), WOOD);
	traderStall(base, "Treehouse", KID, spot(0, 0, -12), 0);
}

/** The engine on the floor at `at`, facing the street; a plain block if its model can't be had. */
function parkEngine(parent: Instance, at: CFrame) {
	task.spawn(() => {
		const model = loadModel(ENGINE_MODEL, "the fire engine, so it's a plain block");
		if (!standMesh(model, "FireEngine", parent, at)) {
			part(parent, "Engine", new Vector3(8, 7, 20), at.mul(new CFrame(0, 4.2, 0)), RED);
		}
		model?.Destroy();
	});
}

function buildFireStation(parent: Instance, at: CFrame) {
	const base = folder(parent, "FireStation");
	const spot = (x: number, y: number, z: number) => at.mul(new CFrame(x, y, z));
	const floorY = 0.3;

	slab(base, "Floor", -22, 22, -16, 16, floorY, CONCRETE, at);
	slab(base, "Roof", -23, 23, -17, 17, 16, CONCRETE, at);
	wall(base, "X", 16, -22, 22, floorY, 15, [], BRICK, at);
	wall(base, "Z", -22, -16, 16, floorY, 15, [], BRICK, at);
	wall(base, "Z", 22, -16, 16, floorY, 15, [], BRICK, at);
	// The engine bay is open to the street on the left; the counter is in the opening on the right.
	const bays = [
		{ center: -10, width: 16, bottom: 0, top: 12 },
		{ center: 12, width: 12, bottom: 0, top: 9 },
	];
	wall(base, "X", -16, -22, 22, floorY, 15, bays, BRICK, at);

	parkEngine(base, spot(-10, floorY, 1));
	sign(base, "FIRE STATION", new Vector3(26, 3, 0.5), spot(0, 14, -17), RED);
	for (const x of [-11, 12]) {
		const light = part(base, "Light", new Vector3(4, 0.4, 1), spot(x, 14.7, 0), {
			material: Enum.Material.Neon,
			color: new Color3(1, 0.95, 0.85),
		});
		const glow = new Instance("PointLight");
		glow.Range = 28;
		glow.Brightness = 1.2;
		glow.Color = new Color3(1, 0.92, 0.8);
		glow.Parent = light;
	}
	traderStall(base, "FireStation", CHIEF, spot(12, 0, -12), floorY);
}

export function buildBases() {
	const bases = folder(Workspace, "Bases");
	buildTreehouse(bases, new CFrame(-155, 0, -14));
	buildFireStation(bases, new CFrame(155, 0, -14));
}
