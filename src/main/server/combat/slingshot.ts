import { CollectionService, Players, TweenService, Workspace } from "@rbxts/services";
import { INFECTED_TAG, SLINGSHOT_TOOL_NAME } from "shared/combat/combat";
import { cooldownReady, normaliseAim } from "shared/combat/ranged";
import { gameConfig } from "../core/config";
import { takeItem } from "../items/inventory";
import { playSound } from "../core/effects";
import { damageInfected } from "./infectedDamage";

/**
 * The slingshot: a kid's first ranged weapon, firing stones (rules in shared/combat/ranged.ts).
 *
 * The client sends only its aim direction ("Shoot"); the server checks the kid may fire (in the
 * run, slingshot equipped, stones left, off cooldown), then casts the shot itself from the kid's
 * head, so a client can't claim hits. A visible stone flies to wherever it landed.
 */

export interface SlingshotHooks {
	canAttack: (player: Player) => boolean;
	sendHitResult: (attacker: Player, kind: "Hit" | "Kill") => void;
}

const STONE_SPEED = 120; // studs per second, for the visible stone
const SHOOT_SOUND = "rbxasset://sounds/swordslash.wav";

let hooks: SlingshotHooks | undefined;
const lastShotAt = new Map<Player, number>();
const tools = new Map<Player, Tool>();

Players.PlayerRemoving.Connect((player) => {
	lastShotAt.delete(player);
	tools.delete(player);
});

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
	if (!takeItem(player, "Stones", 1)) {
		return;
	}
	lastShotAt.set(player, now);

	const direction = new Vector3(aim[0], aim[1], aim[2]);
	const origin = head.Position;
	const range = gameConfig.slingshotRange.Value;
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	params.FilterDescendantsInstances = [character];
	const result = Workspace.Spherecast(origin, gameConfig.slingshotHitRadius.Value, direction.mul(range), params);
	const landed = result ? origin.add(direction.mul(result.Distance)) : origin.add(direction.mul(range));

	playSound(head, SHOOT_SOUND, { volume: 0.6, speed: 1.6 });
	flyStone(origin, landed);

	const target = result ? infectedOf(result.Instance) : undefined;
	const outcome = target && damageInfected(player, target, gameConfig.slingshotDamage.Value);
	if (outcome) {
		hooks.sendHitResult(player, outcome);
	}
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
