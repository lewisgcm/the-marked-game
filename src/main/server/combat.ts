import { Players, ReplicatedStorage, Workspace } from "@rbxts/services";
import {
	GHOST_HEALTH_ATTRIBUTE,
	GHOST_MAX_HEALTH_ATTRIBUTE,
	KNIFE_TOOL_NAME,
	AttackWindowState,
	WEAPON_TOOL_NAME,
} from "shared/combat";
import { checkMeleeReach, parseSwingCandidates } from "shared/melee";
import { gameConfig } from "./config";
import { recordStat } from "./roundStats";
import { isRevealed } from "./ghostVisibility";
import { setSpeedModifier } from "./speed";

/**
 * The ghost's knife, the hunters' fire poker, and the ghost's health.
 *
 * - **Knife** (ghost): only works in the window after a scream (ScreamRevealSeconds), while
 *   the ghost is visible. Kills a hunter below VulnerableBelowSanity;
 *   anyone else just loses KnifeSanityDamage sanity.
 * - **Fire poker** (hunters): only hurts the ghost while it's visible (flashlight, trap or
 *   scream). At 0 health the ghost is destroyed and the hunters win.
 *
 * Hits: the client detects ("Swing" with the players it saw in reach — responsive, matches
 * what the player sees) and the server validates each candidate from its own positions with a
 * lag tolerance, plus a wall raycast, role, visibility, vulnerability and cooldown. This is
 * Roblox's recommended split (their Laser Tag tutorial). Damage is always decided here.
 */

export interface CombatHooks {
	getGhost: () => Player | undefined;
	/** Living hunters (dead ones can't be hit or swing). */
	getLivingHunters: () => Player[];
	isActive: () => boolean;
	getSanity: (player: Player) => number;
	addSanity: (player: Player, amount: number) => void;
	killHunter: (player: Player) => void;
	notify: (player: Player, text: string) => void;
	sendAttackWindow: (ghost: Player, state: AttackWindowState) => void;
	/** Tells an attacker their swing connected. */
	sendHitResult: (attacker: Player, kind: "Hit" | "Kill") => void;
	/** Tells a player they were struck. */
	sendHurt: (victim: Player) => void;
	onGhostDestroyed: () => void;
	/** The ghost's knife connected (feeds its spook recharge). */
	onKnifeHit: (kind: "Hit" | "Kill") => void;
}

const SWING_SOUND = "rbxasset://sounds/swordslash.wav";
const HIT_SOUND = "rbxasset://sounds/swordlunge.wav";
const HIT_SLOW_SECONDS = 1;
const HIT_FLASH = new Color3(1, 0.15, 0.15);
const HIT_FLASH_SECONDS = 0.3;

let hooks: CombatHooks | undefined;
/** The ghost can use its knife until this time (os.clock()); a scream opens the window. */
let attackUntil = 0;
let ghostHealth = 0;
const lastSwingAt = new Map<Player, number>();
const weapons = new Map<Player, Tool>();

function rootOf(player: Player | undefined): BasePart | undefined {
	const hrp = player?.Character?.FindFirstChild("HumanoidRootPart");
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

export function isAttackWindowOpen(): boolean {
	return os.clock() < attackUntil;
}

/** Sends the ghost its knife-window timer (also used to re-sync a client that just loaded). */
export function publishAttackWindow() {
	const ghost = hooks?.getGhost();
	if (!hooks || !ghost) {
		return;
	}
	const now = os.clock();
	hooks.sendAttackWindow(ghost, { activeFor: now < attackUntil ? attackUntil - now : undefined });
}

/**
 * Opens (or extends) the ghost's knife window for `seconds`. Called when the ghost screams; the
 * scream itself makes the ghost visible for the same time.
 */
export function openAttackWindow(seconds: number) {
	if (!hooks || !hooks.isActive()) {
		return;
	}
	attackUntil = math.max(attackUntil, os.clock() + seconds);
	publishAttackWindow();
	task.delay(seconds, publishAttackWindow); // tell the HUD when it closes
}

/**
 * Server re-check of one candidate the client says it hit, from the server's own positions:
 * reach and arc with lag tolerance (shared/melee.ts), then a raycast so nothing solid is in
 * between. Mirrors the checks in Roblox's Laser Tag tutorial.
 */
function canReach(attacker: Player, target: Player, reach: number): boolean {
	const from = rootOf(attacker);
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
	const ignore: Instance[] = [];
	for (const character of [attacker.Character, target.Character]) {
		if (character) {
			ignore.push(character);
		}
	}
	params.FilterDescendantsInstances = ignore;
	return Workspace.Raycast(from.Position, to.Position.sub(from.Position), params) === undefined;
}

/** A red flash on the struck ghost, for everyone. */
function flashGhost(ghost: Player) {
	const character = ghost.Character;
	if (!character) {
		return;
	}
	const flash = new Instance("Highlight");
	flash.Name = "HitFlash";
	flash.FillColor = HIT_FLASH;
	flash.FillTransparency = 0.3;
	flash.OutlineColor = HIT_FLASH;
	flash.DepthMode = Enum.HighlightDepthMode.Occluded;
	flash.Parent = character;
	task.delay(HIT_FLASH_SECONDS, () => flash.Destroy());
}

function knifeSwing(ghost: Player, candidates: Player[]) {
	if (!hooks) {
		return;
	}
	if (!isAttackWindowOpen()) {
		hooks.notify(ghost, "Scream first (Q) to use the knife.");
		return;
	}
	const root = rootOf(ghost);
	if (!root || !offCooldown(ghost, gameConfig.knifeCooldown.Value)) {
		return;
	}
	playSound(root, SWING_SOUND);

	const living = hooks.getLivingHunters();
	const target = candidates.find((p) => living.includes(p) && canReach(ghost, p, gameConfig.knifeRange.Value));
	if (!target) {
		return;
	}
	playSound(root, HIT_SOUND);
	hooks.sendHurt(target);
	if (hooks.getSanity(target) < gameConfig.vulnerableBelowSanity.Value) {
		hooks.killHunter(target);
		recordStat(ghost, "kills");
		hooks.sendHitResult(ghost, "Kill");
		hooks.onKnifeHit("Kill");
	} else {
		hooks.addSanity(target, -gameConfig.knifeSanityDamage.Value);
		hooks.notify(target, "The ghost slashed at you!");
		hooks.sendHitResult(ghost, "Hit");
		hooks.onKnifeHit("Hit");
	}
}

function weaponSwing(hunter: Player, candidates: Player[]) {
	if (!hooks || !hooks.getLivingHunters().includes(hunter)) {
		return;
	}
	const root = rootOf(hunter);
	if (!root || !offCooldown(hunter, gameConfig.weaponCooldown.Value)) {
		return;
	}
	playSound(root, SWING_SOUND);

	// Only the ghost can be struck, and only while it's visible.
	const ghost = hooks.getGhost();
	if (
		!ghost ||
		!candidates.includes(ghost) ||
		!isRevealed(ghost) ||
		!canReach(hunter, ghost, gameConfig.weaponRange.Value)
	) {
		return;
	}
	const ghostRoot = rootOf(ghost);
	if (ghostRoot) {
		playSound(ghostRoot, HIT_SOUND);
	}
	const damage = math.min(ghostHealth, gameConfig.weaponDamage.Value);
	ghostHealth -= damage;
	recordStat(hunter, "pokerHits");
	recordStat(ghost, "damageTaken", damage);
	if (ghostHealth <= 0) {
		recordStat(hunter, "killingBlow");
	}
	ReplicatedStorage.SetAttribute(GHOST_HEALTH_ATTRIBUTE, ghostHealth);
	flashGhost(ghost);
	hooks.sendHurt(ghost);
	hooks.sendHitResult(hunter, ghostHealth <= 0 ? "Kill" : "Hit");
	hooks.notify(ghost, "You were hit!");

	setSpeedModifier(ghost, "hit", gameConfig.hitSlowFactor.Value);
	task.delay(HIT_SLOW_SECONDS, () => setSpeedModifier(ghost, "hit", undefined));

	if (ghostHealth <= 0) {
		hooks.onGhostDestroyed();
	}
}

/**
 * Handles a client's "Swing": the attacker's equipped weapon decides what it is. `payload` is
 * the client's candidate list (unknown — parsed, then every candidate re-checked).
 */
export function onSwingRequest(player: Player, payload: unknown) {
	if (!hooks || !hooks.isActive()) {
		return;
	}
	const character = player.Character;
	const candidates: Player[] = [];
	for (const userId of parseSwingCandidates(payload)) {
		const target = Players.GetPlayerByUserId(userId);
		if (target && target !== player) {
			candidates.push(target);
		}
	}
	// An equipped Tool is parented to the character.
	if (player === hooks.getGhost() && character?.FindFirstChild(KNIFE_TOOL_NAME)) {
		knifeSwing(player, candidates);
	} else if (character?.FindFirstChild(WEAPON_TOOL_NAME)) {
		weaponSwing(player, candidates);
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

/** The ghost's knife. Hidden along with the ghost (it's part of the character when held). */
export function giveKnife(player: Player) {
	removeWeapon(player);
	const backpack = player.FindFirstChildOfClass("Backpack");
	if (!backpack) {
		return;
	}
	const tool = buildTool(
		KNIFE_TOOL_NAME,
		"Scream (Q), then click to stab",
		new Vector3(0.15, 0.25, 1.6),
		new Color3(0.75, 0.76, 0.8),
		Enum.Material.Metal,
		0.5,
	);
	// Swings arrive as "Swing" messages from the client (see onSwingRequest).
	tool.Parent = backpack;
	weapons.set(player, tool);
}

/** A hunter's fire poker. */
export function giveWeapon(player: Player) {
	removeWeapon(player);
	const backpack = player.FindFirstChildOfClass("Backpack");
	if (!backpack) {
		return;
	}
	const tool = buildTool(
		WEAPON_TOOL_NAME,
		"Click to strike — only hurts the ghost while it's visible",
		new Vector3(0.2, 0.2, 3.2),
		new Color3(0.1, 0.1, 0.11),
		Enum.Material.CorrodedMetal,
		1.2,
	);
	// Swings arrive as "Swing" messages from the client (see onSwingRequest).
	tool.Parent = backpack;
	weapons.set(player, tool);
}

/** Starts combat for a round. Call once, after roles are assigned. */
export function startCombat(combatHooks: CombatHooks) {
	hooks = combatHooks;
	ghostHealth = gameConfig.ghostMaxHealth.Value;
	ReplicatedStorage.SetAttribute(GHOST_MAX_HEALTH_ATTRIBUTE, ghostHealth);
	ReplicatedStorage.SetAttribute(GHOST_HEALTH_ATTRIBUTE, ghostHealth);
}
