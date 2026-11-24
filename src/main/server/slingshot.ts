import { CollectionService, Players, TweenService, Workspace } from "@rbxts/services";
import { INFECTED_TAG, SLINGSHOT_TOOL_NAME } from "shared/combat";
import { cooldownReady, normaliseAim, refillAmmo } from "shared/ranged";
import { gameConfig } from "./config";
import { recordStat } from "./roundStats";

/**
 * The slingshot: a kid's first ranged weapon, firing stones (rules in shared/ranged.ts).
 *
 * The client sends only its aim direction ("Shoot"); the server checks the kid may fire (in the
 * run, slingshot equipped, stones left, off cooldown), then casts the shot itself from the kid's
 * head, so a client can't claim hits. A visible stone flies to wherever it landed.
 */

export interface SlingshotHooks {
	canAttack: (player: Player) => boolean;
	sendHitResult: (attacker: Player, kind: "Hit" | "Kill") => void;
	/** Tells a kid how many stones they have. */
	sendStones: (player: Player, count: number) => void;
}

const STONE_SPEED = 120; // studs per second, for the visible stone
const SHOT_RADIUS = 0.6; // a stone is a small sphere: a little forgiving
const SHOOT_SOUND = "rbxasset://sounds/swordslash.wav";
const HIT_FLASH = new Color3(1, 0.15, 0.15);

let hooks: SlingshotHooks | undefined;
const stones = new Map<Player, number>();
const lastShotAt = new Map<Player, number>();
const tools = new Map<Player, Tool>();

Players.PlayerRemoving.Connect((player) => {
	stones.delete(player);
	lastShotAt.delete(player);
	tools.delete(player);
});

function stonesOf(player: Player): number {
	return stones.get(player) ?? gameConfig.stonesStart.Value;
}

function setStones(player: Player, count: number) {
	stones.set(player, count);
	hooks?.sendStones(player, count);
}

/** Re-sends `player` their stone count (for resync). */
export function resendStones(player: Player) {
	hooks?.sendStones(player, stonesOf(player));
}

/** Dawn: everyone gets some stones back. */
export function refillStones(kids: Player[]) {
	for (const player of kids) {
		setStones(player, refillAmmo(stonesOf(player), gameConfig.stonesDawnRefill.Value, gameConfig.stonesMax.Value));
	}
}

/** A stone flying from `from` to `to`, for everyone to see. */
function flyStone(from: Vector3, to: Vector3) {
	const stone = new Instance("Part");
	stone.Name = "Stone";
	stone.Shape = Enum.PartType.Ball;
	stone.Size = new Vector3(0.4, 0.4, 0.4);
	stone.Material = Enum.Material.Slate;
	stone.Color = new Color3(0.45, 0.43, 0.4);
	stone.Anchored = true;
	stone.CanCollide = false;
	stone.CanQuery = false;
	stone.CastShadow = false;
	stone.Position = from;
	stone.Parent = Workspace;
	const seconds = math.max(0.05, to.sub(from).Magnitude / STONE_SPEED);
	TweenService.Create(stone, new TweenInfo(seconds, Enum.EasingStyle.Linear), { Position: to }).Play();
	task.delay(seconds + 0.1, () => stone.Destroy());
}

function flash(model: Model) {
	const highlight = new Instance("Highlight");
	highlight.FillColor = HIT_FLASH;
	highlight.FillTransparency = 0.3;
	highlight.OutlineColor = HIT_FLASH;
	highlight.DepthMode = Enum.HighlightDepthMode.Occluded;
	highlight.Parent = model;
	task.delay(0.3, () => highlight.Destroy());
}

/** The tagged infected model `part` belongs to, if any. */
function infectedOf(part: Instance): Model | undefined {
	let node: Instance | undefined = part;
	while (node) {
		if (node.IsA("Model") && CollectionService.HasTag(node, INFECTED_TAG)) {
			return node;
		}
		node = node.Parent;
	}
	return undefined;
}

/** Handles a client's "Shoot": `payload` should be its aim direction (unknown — validated). */
export function onShootRequest(player: Player, payload: unknown) {
	if (!hooks || !hooks.canAttack(player) || !typeIs(payload, "Vector3")) {
		return;
	}
	const character = player.Character;
	const head = character?.FindFirstChild("Head");
	if (!character || !head || !head.IsA("BasePart") || !character.FindFirstChild(SLINGSHOT_TOOL_NAME)) {
		return; // only with the slingshot in hand
	}
	const aim = normaliseAim(payload.X, payload.Y, payload.Z);
	const now = os.clock();
	if (!aim || !cooldownReady(now, lastShotAt.get(player), gameConfig.slingshotCooldown.Value)) {
		return;
	}
	const left = stonesOf(player);
	if (left <= 0) {
		return;
	}
	lastShotAt.set(player, now);
	setStones(player, left - 1);

	const direction = new Vector3(aim[0], aim[1], aim[2]);
	const origin = head.Position;
	const range = gameConfig.slingshotRange.Value;
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	params.FilterDescendantsInstances = [character];
	const result = Workspace.Spherecast(origin, SHOT_RADIUS, direction.mul(range), params);
	const landed = result ? origin.add(direction.mul(result.Distance)) : origin.add(direction.mul(range));

	const sound = new Instance("Sound");
	sound.SoundId = SHOOT_SOUND;
	sound.PlaybackSpeed = 1.6;
	sound.Volume = 0.6;
	sound.Parent = head;
	sound.Play();
	task.delay(1, () => sound.Destroy());
	flyStone(origin, landed);

	const target = result ? infectedOf(result.Instance) : undefined;
	const humanoid = target?.FindFirstChildOfClass("Humanoid");
	if (!target || !humanoid || humanoid.Health <= 0) {
		return;
	}
	humanoid.Health = math.max(0, humanoid.Health - gameConfig.slingshotDamage.Value);
	flash(target);
	recordStat(player, "hits");
	const downed = humanoid.Health <= 0;
	if (downed) {
		recordStat(player, "kills");
	}
	hooks.sendHitResult(player, downed ? "Kill" : "Hit");
}

/** A kid's slingshot (a blockout until it gets a model). */
export function giveSlingshot(player: Player) {
	tools.get(player)?.Destroy();
	const backpack = player.FindFirstChildOfClass("Backpack");
	if (!backpack) {
		return;
	}
	const tool = new Instance("Tool");
	tool.Name = SLINGSHOT_TOOL_NAME;
	tool.ToolTip = "Click to fire a stone";
	tool.CanBeDropped = false;
	const handle = new Instance("Part");
	handle.Name = "Handle";
	handle.Size = new Vector3(0.3, 1.4, 0.3);
	handle.Material = Enum.Material.Wood;
	handle.Color = new Color3(0.5, 0.36, 0.22);
	handle.CanCollide = false;
	handle.Massless = true;
	handle.Parent = tool;
	tool.Parent = backpack;
	tools.set(player, tool);
}

export function removeSlingshot(player: Player) {
	tools.get(player)?.Destroy();
	tools.delete(player);
}

export function startSlingshot(slingshotHooks: SlingshotHooks) {
	hooks = slingshotHooks;
}
