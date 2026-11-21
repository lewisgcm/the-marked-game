import { Players, ReplicatedStorage, RunService, Workspace } from "@rbxts/services";
import { Inventory, RITUAL_PLACED_ATTRIBUTE } from "shared/objectives";
import { clientSender } from "shared/net";
import { folder, part } from "shared/parts";
import { GameServerMessages } from "shared/remotes";
import { buildRitualItem, RITUAL_ITEMS, RitualItemKind } from "shared/ritualItems";
import { gameConfig } from "./config";
import { recordStat } from "./roundStats";
import { MainWorld, Room } from "./world";

/**
 * The hunters' objective: find keys, unlock the chests holding the book, candles and skull,
 * carry them to the altar in the centre room, then hold to banish the ghost.
 *
 * Server-authoritative: the server places everything, tracks what each hunter carries, and
 * decides every interaction. Clients only press ProximityPrompts; each trigger is re-checked
 * here (role, round phase, distance, whether the hunter really has a key).
 */

export interface ObjectiveHooks {
	/** Whether `player` may interact right now (a hunter, during the hunt). */
	canInteract: (player: Player) => boolean;
	/** Sends one player a message about their own state. */
	send: ReturnType<typeof clientSender<GameServerMessages>>;
	/** The banishing was completed. */
	/** `site` is the altar room's floor centre (where the cutscene plays). */
	onBanished: (site: Vector3) => void;
}

/** Keys only spawn on surfaces at most this high (floor, tables, low crates — not shelves). */
const MAX_SPOT_HEIGHT = 4;
/** Prompts are re-checked against this distance on the server (a little over the prompt's). */
const MAX_INTERACT_DISTANCE = 12;
const PROMPT_DISTANCE = 8;

const KEY_COLOR = new Color3(0.95, 0.75, 0.25);
const ITEM_GLOW = new Color3(0.8, 0.7, 1);
const CRIMSON = new Color3(0.6, 0.03, 0.05);

const rng = new Random();
const carrying = new Map<Player, Inventory>();
const placed = new Set<RitualItemKind>();

function inventoryOf(player: Player): Inventory {
	let inventory = carrying.get(player);
	if (!inventory) {
		inventory = { keys: 0, items: [] };
		carrying.set(player, inventory);
	}
	return inventory;
}

/** Is `player`'s character actually near `target`? (Never trust a prompt trigger alone.) */
function isNear(player: Player, target: BasePart): boolean {
	const root = player.Character?.FindFirstChild("HumanoidRootPart");
	return (
		root !== undefined &&
		root.IsA("BasePart") &&
		root.Position.sub(target.Position).Magnitude <= MAX_INTERACT_DISTANCE
	);
}

function addPrompt(parent: BasePart, action: string, object: string, hold = 0): ProximityPrompt {
	const prompt = new Instance("ProximityPrompt");
	prompt.ActionText = action;
	prompt.ObjectText = object;
	prompt.HoldDuration = hold;
	prompt.MaxActivationDistance = PROMPT_DISTANCE;
	prompt.RequiresLineOfSight = false;
	prompt.Parent = parent;
	return prompt;
}

function glow(parent: BasePart, color: Color3, range: number, brightness: number) {
	const light = new Instance("PointLight");
	light.Color = color;
	light.Range = range;
	light.Brightness = brightness;
	light.Shadows = false;
	light.Parent = parent;
}

/** A faint rising glitter, so pickups catch the eye from across a dark room. */
function sparkle(parent: BasePart) {
	const emitter = new Instance("ParticleEmitter");
	emitter.Texture = "rbxasset://textures/particles/sparkles_main.dds";
	emitter.Color = new ColorSequence(KEY_COLOR);
	emitter.LightEmission = 1;
	emitter.Size = new NumberSequence(0.25, 0);
	emitter.Transparency = new NumberSequence(0.2, 1);
	emitter.Lifetime = new NumberRange(0.8, 1.4);
	emitter.Rate = 4;
	emitter.Speed = new NumberRange(0.5, 1.2);
	emitter.SpreadAngle = new Vector2(30, 30);
	emitter.Parent = parent;
}

export interface Objectives {
	/** Drops everything `player` carries at `position` (e.g. they were killed). */
	drop: (player: Player, position: Vector3) => void;
	/** Re-sends `player` what they're carrying. */
	sendInventory: (player: Player) => void;
}

/** The running objective (set by setupObjectives), for the helpers below. */
let active: Objectives | undefined;

/** Drops everything `player` carries at `position` (e.g. they were killed). No-op before setup. */
export function dropCarried(player: Player, position: Vector3) {
	active?.drop(player, position);
}

/** Re-sends `player` what they're carrying (e.g. their client just loaded). No-op before setup. */
export function resendInventory(player: Player) {
	active?.sendInventory(player);
}

export function setupObjectives(world: MainWorld, hooks: ObjectiveHooks): Objectives {
	const root = folder(Workspace, "Objectives");
	ReplicatedStorage.SetAttribute(RITUAL_PLACED_ATTRIBUTE, 0);

	const sendInventory = (player: Player) => hooks.send(player, "Inventory", inventoryOf(player));
	const allowed = (player: Player, target: BasePart) => hooks.canInteract(player) && isNear(player, target);

	const raycastParams = () => {
		const params = new RaycastParams();
		params.FilterType = Enum.RaycastFilterType.Exclude;
		const ignore: Instance[] = [root];
		for (const player of Players.GetPlayers()) {
			if (player.Character) {
				ignore.push(player.Character);
			}
		}
		params.FilterDescendantsInstances = ignore;
		return params;
	};

	/** A random surface in `room` low enough to reach, away from the room's centre. */
	const findSpot = (room: Room): Vector3 | undefined => {
		const inner = world.roomHalfSize - 3;
		for (let attempt = 0; attempt < 30; attempt++) {
			const x = rng.NextNumber(-inner, inner);
			const z = rng.NextNumber(-inner, inner);
			if (math.abs(x) < 3 && math.abs(z) < 3) {
				continue; // the centre is where chests go
			}
			const from = room.centre.add(new Vector3(x, world.ceilingHeight - 0.5, z));
			const hit = Workspace.Raycast(from, new Vector3(0, -world.ceilingHeight, 0), raycastParams());
			if (hit && hit.Normal.Y > 0.7 && hit.Position.Y <= MAX_SPOT_HEIGHT) {
				return hit.Position;
			}
		}
		return undefined;
	};

	/** The surface directly below `position` (for dropping things). */
	const groundBelow = (position: Vector3): Vector3 => {
		const hit = Workspace.Raycast(position.add(new Vector3(0, 1, 0)), new Vector3(0, -30, 0), raycastParams());
		return hit ? hit.Position : position;
	};

	// --- Keys -------------------------------------------------------------------------

	const spawnKey = (at: Vector3) => {
		const model = new Instance("Model");
		model.Name = "Key";
		model.Parent = root;
		const base = new CFrame(at).mul(CFrame.Angles(0, rng.NextNumber(0, math.pi * 2), 0));
		// Neon so the key itself glows in the dark, not just the floor around it.
		const metal = { material: Enum.Material.Neon, color: KEY_COLOR, collide: false, shadow: false };
		// Lying flat: a shaft along X, a ring bow at one end, two teeth at the other.
		const shaft = part(model, "Shaft", new Vector3(1.2, 0.15, 0.15), base.mul(new CFrame(0, 0.1, 0)), metal);
		part(
			model,
			"Bow",
			new Vector3(0.12, 0.6, 0.6),
			base.mul(new CFrame(-0.8, 0.08, 0)).mul(CFrame.Angles(0, 0, math.pi / 2)),
			{
				...metal,
				shape: Enum.PartType.Cylinder,
			},
		);
		for (const x of [0.4, 0.58]) {
			part(model, "Tooth", new Vector3(0.12, 0.12, 0.28), base.mul(new CFrame(x, 0.1, 0.18)), metal);
		}
		glow(shaft, KEY_COLOR, 10, 2.5);
		sparkle(shaft);

		addPrompt(shaft, "Pick up", "Key").Triggered.Connect((player) => {
			if (!model.Parent || !allowed(player, shaft)) {
				return;
			}
			model.Destroy();
			inventoryOf(player).keys += 1;
			recordStat(player, "keys");
			sendInventory(player);
		});
	};

	// --- Ritual items -----------------------------------------------------------------

	const spawnItemPickup = (kind: RitualItemKind, at: Vector3) => {
		const [model, body] = buildRitualItem(kind, root, at, rng.NextNumber(0, math.pi * 2));
		glow(body, ITEM_GLOW, 6, 0.8);
		addPrompt(body, "Pick up", kind).Triggered.Connect((player) => {
			if (!model.Parent || !allowed(player, body)) {
				return;
			}
			model.Destroy();
			inventoryOf(player).items.push(kind);
			sendInventory(player);
		});
	};

	// --- Chests -----------------------------------------------------------------------

	const spawnChest = (room: Room, item: RitualItemKind) => {
		const model = new Instance("Model");
		model.Name = "Chest";
		model.Parent = root;
		const base = new CFrame(room.centre).mul(CFrame.Angles(0, (rng.NextInteger(0, 3) * math.pi) / 2, 0));
		const wood = { material: Enum.Material.Wood, color: new Color3(0.28, 0.18, 0.1) };
		const iron = { material: Enum.Material.CorrodedMetal, color: new Color3(0.15, 0.14, 0.14) };

		const box = part(model, "Box", new Vector3(3, 1.6, 2), base.mul(new CFrame(0, 0.8, 0)), wood);
		const lid = part(model, "Lid", new Vector3(3.1, 0.5, 2.1), base.mul(new CFrame(0, 1.85, 0)), wood);
		for (const x of [-1.1, 1.1]) {
			part(model, "Band", new Vector3(0.25, 1.65, 2.05), base.mul(new CFrame(x, 0.82, 0)), iron);
		}
		part(model, "Lock", new Vector3(0.45, 0.55, 0.15), base.mul(new CFrame(0, 1.45, -1.08)), {
			material: Enum.Material.Metal,
			color: KEY_COLOR,
		});

		const prompt = addPrompt(box, "Unlock", "Locked chest", 1);
		prompt.Triggered.Connect((player) => {
			if (!prompt.Parent || !allowed(player, box)) {
				return;
			}
			const inventory = inventoryOf(player);
			if (inventory.keys < 1) {
				hooks.send(player, "Notice", "You need a key to open this chest.");
				return;
			}
			inventory.keys -= 1;
			recordStat(player, "chests");
			prompt.Destroy();
			sendInventory(player);

			// Swing the lid open on its back edge, and put the item on top of the box.
			const hinge = base.mul(new CFrame(0, 2.1, 1.05));
			lid.CFrame = hinge.mul(CFrame.Angles(math.rad(105), 0, 0)).mul(new CFrame(0, -0.25, -1.05));
			spawnItemPickup(item, base.mul(new CFrame(0, 1.6, 0)).Position);
		});
	};

	// --- Altar ------------------------------------------------------------------------

	const buildAltar = (room: Room) => {
		const site = folder(root, "RitualSite");
		const c = room.centre;

		// A ring of crimson marks on the floor around the altar.
		const radius = 6;
		for (let i = 0; i < 16; i++) {
			const a = (i / 16) * math.pi * 2;
			const at = c.add(new Vector3(math.cos(a) * radius, 0.03, math.sin(a) * radius));
			part(
				site,
				"RingMark",
				new Vector3(0.3, 0.05, 2),
				CFrame.lookAt(at, c.add(new Vector3(0, 0.03, 0))).mul(CFrame.Angles(0, math.pi / 2, 0)),
				{
					material: Enum.Material.Neon,
					color: CRIMSON,
					collide: false,
					shadow: false,
				},
			);
		}

		const altar = part(site, "Altar", new Vector3(5, 1.2, 2.5), new CFrame(c.add(new Vector3(0, 0.6, 0))), {
			material: Enum.Material.Slate,
			color: new Color3(0.3, 0.29, 0.3),
		});
		const lightAnchor = part(
			site,
			"AltarLight",
			new Vector3(0.2, 0.2, 0.2),
			new CFrame(c.add(new Vector3(0, 4, 0))),
			{
				collide: false,
				transparency: 1,
				shadow: false,
			},
		);
		const altarLight = new Instance("PointLight");
		altarLight.Color = CRIMSON;
		altarLight.Range = 16;
		altarLight.Brightness = 0.8;
		altarLight.Parent = lightAnchor;

		const spots: Record<RitualItemKind, Vector3> = {
			Book: c.add(new Vector3(-1.6, 1.2, 0)),
			Candles: c.add(new Vector3(0, 1.2, 0)),
			Skull: c.add(new Vector3(1.6, 1.2, 0)),
		};

		// Each player's client builds its prompt UI when the prompt appears, so editing a prompt
		// that's already on screen (e.g. raising HoldDuration to 10s) doesn't reach them until they
		// walk away and back. So the altar's prompt is replaced, not edited, whenever its state
		// changes: a new prompt always shows up with the right text and hold time.
		let prompt: ProximityPrompt | undefined;

		const onBanish = (player: Player) => {
			if (allowed(player, altar) && placed.size() === RITUAL_ITEMS.size()) {
				recordStat(player, "banisher");
				hooks.onBanished(c);
			}
		};

		const onPlace = (player: Player) => {
			if (!allowed(player, altar)) {
				return;
			}
			const inventory = inventoryOf(player);
			const toPlace = inventory.items.filter((kind) => !placed.has(kind));
			if (toPlace.size() === 0) {
				hooks.send(player, "Notice", "Bring the book, the candles and the skull to the altar.");
				return;
			}
			recordStat(player, "items", toPlace.size());
			for (const kind of toPlace) {
				placed.add(kind);
				buildRitualItem(kind, site, spots[kind]);
			}
			inventory.items = inventory.items.filter((kind) => !placed.has(kind));
			sendInventory(player);
			showPrompt();
		};

		const showPrompt = () => {
			const count = placed.size();
			ReplicatedStorage.SetAttribute(RITUAL_PLACED_ATTRIBUTE, count);
			altarLight.Brightness = 0.8 + count * 0.8;

			prompt?.Destroy();
			if (count === RITUAL_ITEMS.size()) {
				prompt = addPrompt(altar, "Banish the ghost", "Altar", gameConfig.banishHoldSeconds.Value);
				prompt.Triggered.Connect(onBanish);
			} else {
				prompt = addPrompt(altar, "Place items", `Altar (${count}/${RITUAL_ITEMS.size()})`, 0.5);
				prompt.Triggered.Connect(onPlace);
			}
		};

		showPrompt();
	};

	// --- Dropping on reset / leaving ----------------------------------------------------

	const dropAll = (player: Player, position: Vector3) => {
		const inventory = carrying.get(player);
		carrying.delete(player);
		if (!inventory) {
			return;
		}
		const ground = groundBelow(position);
		const scatter = () => ground.add(new Vector3(rng.NextNumber(-1.5, 1.5), 0, rng.NextNumber(-1.5, 1.5)));
		for (let i = 0; i < inventory.keys; i++) {
			spawnKey(scatter());
		}
		for (const kind of inventory.items) {
			spawnItemPickup(kind, scatter());
		}
		if (player.Parent) {
			sendInventory(player);
		}
	};

	// Where each carrier was last seen. When a player leaves, their character may already be
	// gone; without this, what they carried would vanish and the round could be unwinnable.
	const lastSeen = new Map<Player, Vector3>();
	const positionOf = (player: Player): Vector3 | undefined => {
		const hrp = player.Character?.FindFirstChild("HumanoidRootPart");
		return hrp && hrp.IsA("BasePart") ? hrp.Position : undefined;
	};
	let sinceUpdate = 0;
	RunService.Heartbeat.Connect((dt) => {
		sinceUpdate += dt;
		if (sinceUpdate < 0.5) {
			return;
		}
		sinceUpdate = 0;
		for (const [player] of carrying) {
			const position = positionOf(player);
			if (position) {
				lastSeen.set(player, position);
			}
		}
	});

	const watchPlayer = (player: Player) => {
		player.CharacterRemoving.Connect(() => {
			const position = positionOf(player) ?? lastSeen.get(player);
			if (position) {
				dropAll(player, position);
			}
		});
	};
	Players.GetPlayers().forEach(watchPlayer);
	Players.PlayerAdded.Connect(watchPlayer);
	Players.PlayerRemoving.Connect((player) => {
		// Usually already handled by CharacterRemoving; this catches a leave without it.
		const position =
			positionOf(player) ?? lastSeen.get(player) ?? world.ritualRoom.centre.add(new Vector3(0, 1, 4));
		dropAll(player, position);
		lastSeen.delete(player);
	});

	// --- Layout -----------------------------------------------------------------------

	// Chests: one per item, in different rooms.
	// Never in a start room: players spawn at the room's centre, which is exactly where a chest
	// goes (a chest in the ghost's room once trapped the ghost inside it).
	const chestRooms = world.rooms.filter(
		(r) => r !== world.ritualRoom && r !== world.hunterRoom && r !== world.ghostRoom,
	);
	for (let i = chestRooms.size() - 1; i > 0; i--) {
		const j = rng.NextInteger(0, i);
		[chestRooms[i], chestRooms[j]] = [chestRooms[j], chestRooms[i]];
	}
	RITUAL_ITEMS.forEach((item, i) => spawnChest(chestRooms[i], item));

	// Keys: anywhere but the ritual room.
	const keyRooms = world.rooms.filter((r) => r !== world.ritualRoom);
	for (let i = 0; i < RITUAL_ITEMS.size() + gameConfig.spareKeys.Value; i++) {
		const room = keyRooms[rng.NextInteger(0, keyRooms.size() - 1)];
		// Every key must spawn, or the round could be unwinnable: fall back to the floor
		// beside the room's centre (kept clear of furniture), next to any chest there.
		spawnKey(findSpot(room) ?? groundBelow(room.centre.add(new Vector3(2.8, 2, 2.8))));
	}

	buildAltar(world.ritualRoom);
	active = { drop: dropAll, sendInventory };
	return active;
}
