import { Players, RunService, TweenService, Workspace } from "@rbxts/services";
import { folder, part } from "shared/parts";
import { gameConfig } from "./config";
import { forceReveal } from "./ghostVisibility";
import { recordStat } from "./roundStats";
import { setSpeedModifier } from "./speed";

/**
 * Ghost traps: hunters place them on the floor; when the ghost comes close, the trap snaps,
 * revealing the ghost for a few seconds and slowing it.
 *
 * Server-authoritative: the server owns each hunter's trap count, validates every placement
 * (role, round phase, cooldown, a real floor spot not through a wall), and does all detection
 * against the ghost's server-side position. Placing uses the Tool's own Activated event,
 * which the server receives directly — no custom remote needed.
 */

const TRAP_TOOL_NAME = "Ghost Trap";
/** Traps are placed this far in front of the hunter. */
const PLACE_DISTANCE = 3;
/** Traps can't be stacked closer than this. */
const MIN_TRAP_SPACING = 3;
const PLACE_COOLDOWN = 1;
const CHECK_RATE = 10;

const IDLE_GLOW = new Color3(0.35, 0.6, 1);
const SNAP_GLOW = new Color3(0.85, 0.95, 1);
const SNAP_SOUND = "rbxasset://sounds/electronicpingshort.wav";

export interface TrapHooks {
	/** Whether `player` may place a trap now (a hunter, during the hunt). */
	canPlace: (player: Player) => boolean;
	/** The current ghost. */
	getGhost: () => Player | undefined;
	/** Shows a short message to one player. */
	notify: (player: Player, text: string) => void;
	/** Everyone who should hear that a trap went off (the hunters). */
	getHunters: () => Player[];
}

interface Trap {
	owner: Player;
	position: Vector3;
	model: Model;
	ring: BasePart;
}

const remaining = new Map<Player, number>();
const tools = new Map<Player, Tool>();
const lastPlacedAt = new Map<Player, number>();
const traps: Trap[] = [];
let root: Folder | undefined;
let hooks: TrapHooks | undefined;

function trapFolder(): Folder {
	if (!root || !root.Parent) {
		root = folder(Workspace, "GhostTraps");
	}
	return root;
}

function toolName(count: number) {
	return `${TRAP_TOOL_NAME} (${count})`;
}

/** The trap device: a dark metal disc with a dim glowing ring and three prongs. */
function buildTrap(position: Vector3, owner: Player): Trap {
	const model = new Instance("Model");
	model.Name = "GhostTrap";
	model.Parent = trapFolder();
	const metal = { material: Enum.Material.Metal, color: new Color3(0.12, 0.12, 0.14), collide: false };
	const base = new CFrame(position);

	part(
		model,
		"Base",
		new Vector3(0.3, 2.2, 2.2),
		base.mul(new CFrame(0, 0.15, 0)).mul(CFrame.Angles(0, 0, math.pi / 2)),
		{
			...metal,
			shape: Enum.PartType.Cylinder,
		},
	);
	const ring = part(
		model,
		"Ring",
		new Vector3(0.12, 1.5, 1.5),
		base.mul(new CFrame(0, 0.33, 0)).mul(CFrame.Angles(0, 0, math.pi / 2)),
		{
			material: Enum.Material.Neon,
			color: IDLE_GLOW,
			collide: false,
			shadow: false,
			shape: Enum.PartType.Cylinder,
		},
	);
	for (let i = 0; i < 3; i++) {
		const a = (i / 3) * math.pi * 2;
		part(
			model,
			"Prong",
			new Vector3(0.12, 0.6, 0.12),
			base.mul(new CFrame(math.cos(a) * 0.9, 0.55, math.sin(a) * 0.9)),
			metal,
		);
	}
	// Dim on purpose: hunters can find their traps, and an attentive ghost can avoid them.
	const light = new Instance("PointLight");
	light.Color = IDLE_GLOW;
	light.Range = 5;
	light.Brightness = 0.6;
	light.Parent = ring;

	return { owner, position, model, ring };
}

/** A floor spot in front of `character`, not through a wall; undefined if there isn't one. */
function findPlacement(character: Model): Vector3 | undefined {
	const hrp = character.FindFirstChild("HumanoidRootPart");
	if (!hrp || !hrp.IsA("BasePart")) {
		return undefined;
	}
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	const ignore: Instance[] = [trapFolder()];
	Players.GetPlayers().forEach((p) => p.Character && ignore.push(p.Character));
	params.FilterDescendantsInstances = ignore;

	const forward = new Vector3(hrp.CFrame.LookVector.X, 0, hrp.CFrame.LookVector.Z).Unit;
	// If a wall is in the way, put the trap at the hunter's feet instead.
	const blocked = Workspace.Raycast(hrp.Position, forward.mul(PLACE_DISTANCE), params);
	const above = blocked ? hrp.Position : hrp.Position.add(forward.mul(PLACE_DISTANCE));
	const floor = Workspace.Raycast(above, new Vector3(0, -10, 0), params);
	if (!floor || floor.Normal.Y < 0.7) {
		return undefined;
	}
	return floor.Position;
}

function place(player: Player) {
	if (!hooks || !hooks.canPlace(player)) {
		return;
	}
	const count = remaining.get(player) ?? 0;
	const now = os.clock();
	if (count < 1 || now - (lastPlacedAt.get(player) ?? -math.huge) < PLACE_COOLDOWN) {
		return;
	}
	const character = player.Character;
	const spot = character && findPlacement(character);
	if (!spot) {
		hooks.notify(player, "Can't place a trap here.");
		return;
	}
	if (traps.some((t) => t.position.sub(spot).Magnitude < MIN_TRAP_SPACING)) {
		hooks.notify(player, "There's already a trap here.");
		return;
	}

	lastPlacedAt.set(player, now);
	remaining.set(player, count - 1);
	traps.push(buildTrap(spot, player));

	const tool = tools.get(player);
	if (count - 1 <= 0) {
		removeTrapTool(player);
	} else if (tool) {
		tool.Name = toolName(count - 1);
	}
}

/** Slows the ghost for TrapEffectSeconds. A second trap extends the slow; it doesn't stack. */
let slowedUntil = 0;
function slow(ghost: Player) {
	setSpeedModifier(ghost, "trap", gameConfig.trapSlowFactor.Value);
	const seconds = gameConfig.trapEffectSeconds.Value;
	slowedUntil = os.clock() + seconds;
	task.delay(seconds, () => {
		if (os.clock() >= slowedUntil) {
			setSpeedModifier(ghost, "trap", undefined);
		}
	});
}

function spring(trap: Trap, ghost: Player) {
	traps.remove(traps.indexOf(trap));
	recordStat(trap.owner, "trapCatches");
	forceReveal(ghost, gameConfig.trapEffectSeconds.Value);
	slow(ghost);

	// Flash and ping, then fade out.
	trap.ring.Color = SNAP_GLOW;
	const light = trap.ring.FindFirstChildOfClass("PointLight");
	if (light) {
		light.Color = SNAP_GLOW;
		light.Brightness = 8;
		light.Range = 22;
		TweenService.Create(light, new TweenInfo(1.5), { Brightness: 0 }).Play();
	}
	const sound = new Instance("Sound");
	sound.SoundId = SNAP_SOUND;
	sound.Volume = 1;
	sound.RollOffMaxDistance = 80;
	sound.Parent = trap.ring;
	sound.Play();
	task.delay(1.6, () => trap.model.Destroy());

	if (hooks) {
		hooks.notify(ghost, "You walked into a trap!");
		for (const hunter of hooks.getHunters()) {
			hooks.notify(hunter, hunter === trap.owner ? "Your trap caught the ghost!" : "A trap caught the ghost!");
		}
	}
}

function removeTrapTool(player: Player) {
	tools.get(player)?.Destroy();
	tools.delete(player);
}

/** Gives a hunter their trap tool for this life, if they have traps left. Call on each spawn. */
export function giveTrapTool(player: Player) {
	removeTrapTool(player);
	if (!remaining.has(player)) {
		remaining.set(player, gameConfig.trapsPerHunter.Value);
	}
	const count = remaining.get(player)!;
	const backpack = player.FindFirstChildOfClass("Backpack");
	if (count < 1 || !backpack) {
		return;
	}

	const tool = new Instance("Tool");
	tool.Name = toolName(count);
	tool.ToolTip = "Click to set a trap on the floor in front of you";
	tool.CanBeDropped = false;
	const handle = new Instance("Part");
	handle.Name = "Handle";
	handle.Size = new Vector3(0.9, 0.3, 0.9);
	handle.Material = Enum.Material.Metal;
	handle.Color = new Color3(0.12, 0.12, 0.14);
	handle.CanCollide = false;
	handle.Massless = true;
	handle.Parent = tool;
	tool.Activated.Connect(() => place(player));
	tool.Parent = backpack;
	tools.set(player, tool);
}

/** Takes the trap tool away (e.g. the player is the ghost). Their count is kept. */
export { removeTrapTool };

/** Starts trap detection. Call once. */
export function startTraps(trapHooks: TrapHooks) {
	hooks = trapHooks;
	Players.PlayerRemoving.Connect((player) => {
		removeTrapTool(player);
		remaining.delete(player);
		lastPlacedAt.delete(player);
	});

	let elapsed = 0;
	RunService.Heartbeat.Connect((dt) => {
		elapsed += dt;
		if (elapsed < 1 / CHECK_RATE) {
			return;
		}
		elapsed = 0;
		const ghost = trapHooks.getGhost();
		const hrp = ghost?.Character?.FindFirstChild("HumanoidRootPart");
		if (!ghost || !hrp || !hrp.IsA("BasePart")) {
			return;
		}
		// Copy: springing removes from the list.
		for (const trap of [...traps]) {
			if (trap.position.sub(hrp.Position).Magnitude <= gameConfig.trapTriggerRadius.Value) {
				spring(trap, ghost);
			}
		}
	});
}
