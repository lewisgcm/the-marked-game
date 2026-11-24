import { CollectionService, Workspace } from "@rbxts/services";
import { BAT_TOOL_NAME, INFECTED_TAG } from "shared/combat";
import { checkMeleeReach, parseSwingCandidates } from "shared/melee";
import { gameConfig } from "./config";
import { recordStat } from "./roundStats";

/**
 * Melee weapons (the baseball bat for now) against the infected.
 *
 * Hits: the client detects ("Swing" with the infected models it saw in reach — responsive,
 * matches what the player sees) and the server validates each candidate from its own positions
 * with a lag tolerance, plus a wall raycast, the Infected tag and a cooldown. This is Roblox's
 * recommended split (their Laser Tag tutorial). Damage is always decided here.
 *
 * Infected health is their Humanoid's Health, which only the server changes.
 */

export interface CombatHooks {
	/** Whether `player` may swing right now (a kid who's still in, during play). */
	canAttack: (player: Player) => boolean;
	/** Something made a noise here (wakes dormant infected nearby). */
	makeNoise: (position: Vector3, radius: number) => void;
	/** Tells an attacker their swing connected. */
	sendHitResult: (attacker: Player, kind: "Hit" | "Kill") => void;
}

const SWING_SOUND = "rbxasset://sounds/swordslash.wav";
const HIT_SOUND = "rbxasset://sounds/swordlunge.wav";
const HIT_FLASH = new Color3(1, 0.15, 0.15);
const HIT_FLASH_SECONDS = 0.3;

let hooks: CombatHooks | undefined;
const lastSwingAt = new Map<Player, number>();
const weapons = new Map<Player, Tool>();

function rootOf(model: Model | undefined): BasePart | undefined {
	const hrp = model?.FindFirstChild("HumanoidRootPart");
	return hrp && hrp.IsA("BasePart") ? hrp : undefined;
}

function playSound(parent: Instance, id: string) {
	const sound = new Instance("Sound");
	sound.SoundId = id;
	sound.Volume = 1;
	sound.RollOffMaxDistance = 60;
	sound.Parent = parent;
	sound.Play();
	task.delay(2, () => sound.Destroy());
}

function offCooldown(player: Player, cooldown: number): boolean {
	const now = os.clock();
	if (now - (lastSwingAt.get(player) ?? -math.huge) < cooldown) {
		return false;
	}
	lastSwingAt.set(player, now);
	return true;
}

/** A swing candidate from the client: a live, tagged infected model in the workspace. */
function isInfectedModel(value: unknown): value is Model {
	return (
		typeIs(value, "Instance") &&
		value.IsA("Model") &&
		value.IsDescendantOf(Workspace) &&
		CollectionService.HasTag(value, INFECTED_TAG)
	);
}

function humanoidOf(model: Model): Humanoid | undefined {
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	return humanoid && humanoid.Health > 0 ? humanoid : undefined;
}

/**
 * Server re-check of one candidate the client says it hit, from the server's own positions:
 * reach and arc with lag tolerance (shared/melee.ts), then a raycast so nothing solid is in
 * between.
 */
function canReach(attacker: Player, target: Model, reach: number): boolean {
	const from = rootOf(attacker.Character);
	const to = rootOf(target);
	if (!from || !to) {
		return false;
	}
	const check = checkMeleeReach(
		from.Position,
		from.CFrame.LookVector,
		to.Position,
		reach + gameConfig.meleeReachTolerance.Value,
		gameConfig.meleeHalfArc.Value + gameConfig.meleeAngleTolerance.Value,
	);
	if (check !== "ok") {
		return false;
	}
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	const ignore: Instance[] = [target];
	if (attacker.Character) {
		ignore.push(attacker.Character);
	}
	params.FilterDescendantsInstances = ignore;
	return Workspace.Raycast(from.Position, to.Position.sub(from.Position), params) === undefined;
}

/** A red flash on a struck model, for everyone. */
function flash(model: Model) {
	const highlight = new Instance("Highlight");
	highlight.Name = "HitFlash";
	highlight.FillColor = HIT_FLASH;
	highlight.FillTransparency = 0.3;
	highlight.OutlineColor = HIT_FLASH;
	highlight.DepthMode = Enum.HighlightDepthMode.Occluded;
	highlight.Parent = model;
	task.delay(HIT_FLASH_SECONDS, () => highlight.Destroy());
}

function batSwing(player: Player, candidates: Model[]) {
	if (!hooks) {
		return;
	}
	const root = rootOf(player.Character);
	if (!root || !offCooldown(player, gameConfig.batCooldown.Value)) {
		return;
	}
	playSound(root, SWING_SOUND);
	hooks.makeNoise(root.Position, gameConfig.batNoise.Value);

	const target = candidates.find(
		(m) => humanoidOf(m) !== undefined && canReach(player, m, gameConfig.batRange.Value),
	);
	const humanoid = target ? humanoidOf(target) : undefined;
	if (!target || !humanoid) {
		return;
	}
	const targetRoot = rootOf(target);
	if (targetRoot) {
		playSound(targetRoot, HIT_SOUND);
	}
	humanoid.Health = math.max(0, humanoid.Health - gameConfig.batDamage.Value);
	flash(target);
	recordStat(player, "hits");
	const downed = humanoid.Health <= 0;
	hooks.sendHitResult(player, downed ? "Kill" : "Hit");
	if (downed) {
		recordStat(player, "kills");
	}
}

/**
 * Handles a client's "Swing": the attacker's equipped weapon decides what it is. `payload` is
 * the client's candidate list (unknown — parsed, then every candidate re-checked).
 */
export function onSwingRequest(player: Player, payload: unknown) {
	if (!hooks || !hooks.canAttack(player)) {
		return;
	}
	const candidates = parseSwingCandidates(payload, isInfectedModel);
	// An equipped Tool is parented to the character.
	if (player.Character?.FindFirstChild(BAT_TOOL_NAME)) {
		batSwing(player, candidates);
	}
}

function buildTool(
	name: string,
	tip: string,
	handleSize: Vector3,
	color: Color3,
	material: Enum.Material,
	gripOffset: number,
): Tool {
	const tool = new Instance("Tool");
	tool.Name = name;
	tool.ToolTip = tip;
	tool.CanBeDropped = false;
	// Held like a classic sword: the long axis (Z) points out of the fist, gripped
	// `gripOffset` studs from the handle's centre.
	tool.GripForward = new Vector3(-1, 0, 0);
	tool.GripRight = new Vector3(0, 1, 0);
	tool.GripUp = new Vector3(0, 0, 1);
	tool.GripPos = new Vector3(0, 0, -gripOffset);
	const handle = new Instance("Part");
	handle.Name = "Handle";
	handle.Size = handleSize;
	handle.Color = color;
	handle.Material = material;
	handle.CanCollide = false;
	handle.Massless = true;
	handle.Parent = tool;
	return tool;
}

export function removeWeapon(player: Player) {
	weapons.get(player)?.Destroy();
	weapons.delete(player);
}

/** A kid's baseball bat (a blockout until it gets a model). */
export function giveBat(player: Player) {
	removeWeapon(player);
	const backpack = player.FindFirstChildOfClass("Backpack");
	if (!backpack) {
		return;
	}
	const tool = buildTool(
		BAT_TOOL_NAME,
		"Click to swing",
		new Vector3(0.35, 0.35, 3),
		new Color3(0.72, 0.55, 0.36),
		Enum.Material.Wood,
		1.1,
	);
	// Swings arrive as "Swing" messages from the client (see onSwingRequest).
	tool.Parent = backpack;
	weapons.set(player, tool);
}

/** Starts combat. Call once. */
export function startCombat(combatHooks: CombatHooks) {
	hooks = combatHooks;
}
