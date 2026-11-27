import { CollectionService, Players, Workspace } from "@rbxts/services";
import { aliveHumanoidOf, rootOf } from "shared/core/characters";
import { BAT_TOOL_NAME, INFECTED_TAG } from "shared/combat/combat";
import { checkMeleeReach, parseSwingCandidates } from "shared/combat/melee";
import { openingSlots } from "shared/combat/openings";
import { gameConfig } from "../core/config";
import { playSound } from "../core/effects";
import { damageInfected } from "./infectedDamage";

/**
 * Melee weapons (the baseball bat for now) against the infected.
 *
 * Hits: the client detects ("Swing" with the infected models it saw in reach — responsive,
 * matches what the player sees) and the server validates each candidate from its own positions
 * with a lag tolerance, plus a wall raycast, the Infected tag and a cooldown. This is Roblox's
 * recommended split (their Laser Tag tutorial). Damage is always decided here.
 *
 * What a hit does is shared with every other weapon (infectedDamage.ts).
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
/** How far swings and hits carry, in studs. */
const SOUND_RANGE = 60;

let hooks: CombatHooks | undefined;
const lastSwingAt = new Map<Player, number>();
const weapons = new Map<Player, Tool>();

Players.PlayerRemoving.Connect((player) => {
	lastSwingAt.delete(player);
	weapons.delete(player);
});

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

/**
 * Server re-check of one candidate the client says it hit, from the server's own positions:
 * reach and arc with lag tolerance (shared/combat/melee.ts), then a raycast so nothing solid is in
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
	const ignore: Instance[] = [target, ...openingSlots()];
	if (attacker.Character) {
		ignore.push(attacker.Character);
	}
	params.FilterDescendantsInstances = ignore;
	return Workspace.Raycast(from.Position, to.Position.sub(from.Position), params) === undefined;
}

function batSwing(player: Player, candidates: Model[]) {
	if (!hooks) {
		return;
	}
	const root = rootOf(player.Character);
	if (!root || !offCooldown(player, gameConfig.batCooldown.Value)) {
		return;
	}
	playSound(root, SWING_SOUND, { range: SOUND_RANGE });
	hooks.makeNoise(root.Position, gameConfig.batNoise.Value);

	const target = candidates.find(
		(m) => aliveHumanoidOf(m) !== undefined && canReach(player, m, gameConfig.batRange.Value),
	);
	if (!target) {
		return;
	}
	const targetRoot = rootOf(target);
	if (targetRoot) {
		playSound(targetRoot, HIT_SOUND, { range: SOUND_RANGE });
	}
	const result = damageInfected(player, target, gameConfig.batDamage.Value);
	if (result) {
		hooks.sendHitResult(player, result);
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
