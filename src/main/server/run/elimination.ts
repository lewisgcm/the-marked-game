import { Players, Workspace } from "@rbxts/services";
import { dropAll } from "../items/inventory";
import { removeWeapon } from "../combat/combat";
import { removeFlashlight } from "../combat/flashlight";
import { removeSlingshot } from "../combat/slingshot";
import { removeHammer } from "../house/hammer";
import { alertAll, alertPlayer, send } from "../core/gameRemote";
import { gameConfig } from "../core/config";
import { returnKid, startLife, takenKids } from "../core/life";
import { noteTaken } from "./nightReport";
import { isMember } from "../core/party";
import { endRun, getClock } from "../core/round";
import { canKidAct, isPlaying, livingKids } from "../core/teams";
import { inReach, makePrompt, promptAnchor } from "../core/prompts";
import { addCoins } from "../economy/coins";
import { rootOf } from "shared/core/characters";
import { HELD_AT_ATTRIBUTE } from "shared/combat/combat";
import { folder, part } from "shared/world/parts";
import { spawnNextAt } from "./loadout";

/**
 * Kids being taken (life.ts), coming back, or leaving. Handles what a taken kid loses, who they
 * can spectate, bringing them back (at dawn, or after FirstNightTakenSeconds on Night 1), and the
 * run ending when every kid is taken at once (never on Night 1).
 *
 * **Rescue:** a kid taken at night while there's a nest (a fallen base, economy/signal.ts) is dragged
 * to the nearest one. Until dawn, a teammate who gets there can hold "Free them" at the nest: the
 * held kids come back beside them, and the rescuer's paid. The map shows where they're held.
 */

export interface RescueHooks {
	/** Where each fallen base's nest is. */
	getNests: () => CFrame[];
}

let rescueHooks: RescueHooks | undefined;
/** Taken kids held at a nest, and which (its index in getNests). */
const held = new Map<Player, number>();
/** Each nest's "Free them" prompt, by index. */
const rescuePrompts = new Map<number, ProximityPrompt>();

function isFirstNight(): boolean {
	return getClock().night === 1;
}

/** Tells every taken kid who they can spectate: the kids still in. */
export function updateSpectators() {
	const alive = livingKids();
	const aliveIds = alive.map((p) => p.UserId);
	for (const player of Players.GetPlayers()) {
		if (isMember(player) && !alive.includes(player)) {
			send(player, "Spectate", aliveIds);
		}
	}
}

/** The run ends once no kid is left (`leaving` is about to go). Not on Night 1. */
function checkAllTaken(leaving?: Player) {
	if (
		isPlaying() &&
		!isFirstNight() &&
		livingKids()
			.filter((p) => p !== leaving)
			.size() === 0
	) {
		endRun("AllTaken");
	}
}

/** The held kids' names at nest `index`. */
function heldAt(index: number): Player[] {
	const kids: Player[] = [];
	held.forEach((nest, kid) => nest === index && kids.push(kid));
	return kids;
}

function refreshRescuePrompts() {
	rescuePrompts.forEach((prompt, index) => {
		const kids = heldAt(index);
		prompt.Enabled = kids.size() > 0;
		prompt.ObjectText = kids.map((k) => k.DisplayName).join(", ");
	});
}

function onFree(index: number, rescuer: Player, prompt: ProximityPrompt) {
	const kids = heldAt(index);
	const root = rootOf(rescuer.Character);
	if (kids.size() === 0 || !root || !canKidAct(rescuer) || !inReach(rescuer, prompt)) {
		return;
	}
	kids.forEach((kid, i) => {
		held.delete(kid);
		kid.SetAttribute(HELD_AT_ATTRIBUTE, undefined);
		spawnNextAt(kid, root.CFrame.mul(new CFrame(3 + i * 2, 0, 2)));
		bringBack(kid);
	});
	const reward = gameConfig.rescueReward.Value;
	addCoins(rescuer, reward);
	alertAll(`${rescuer.DisplayName} got ${kids.map((k) => k.DisplayName).join(" and ")} out of the nest!`);
	alertPlayer(rescuer, `You got them out! ${reward} coins. Now run.`);
	refreshRescuePrompts();
}

/** The prompt at nest `index` (made the first time someone's held there). */
function rescuePrompt(index: number, nest: CFrame) {
	if (rescuePrompts.has(index)) {
		return;
	}
	const nests = Workspace.FindFirstChild("Nests") ?? folder(Workspace, "Nests");
	const spot = part(nests, "Rescue", new Vector3(1, 1, 1), nest, {
		transparency: 1,
		collide: false,
	});
	spot.CanQuery = false; // only there to hold the prompt
	const prompt = makePrompt(
		promptAnchor(spot, new Vector3()),
		"Free them",
		Enum.KeyCode.E,
		gameConfig.rescueHoldSeconds.Value,
	);
	prompt.MaxActivationDistance = 10;
	prompt.Triggered.Connect((player) => onFree(index, player, prompt));
	rescuePrompts.set(index, prompt);
}

/** At night, with a nest about, a taken kid is dragged to the nearest one. Returns whether they were. */
function holdAtNest(player: Player, position: Vector3 | undefined): boolean {
	const nests = rescueHooks?.getNests() ?? [];
	if (getClock().phase !== "Night" || isFirstNight() || nests.size() === 0) {
		return false;
	}
	let index = 0;
	nests.forEach((nest, i) => {
		const from = position ?? nests[0].Position;
		if (nest.Position.sub(from).Magnitude < nests[index].Position.sub(from).Magnitude) {
			index = i;
		}
	});
	held.set(player, index);
	player.SetAttribute(HELD_AT_ATTRIBUTE, nests[index].Position);
	rescuePrompt(index, nests[index]);
	refreshRescuePrompts();
	return true;
}

function onTaken(player: Player, position: Vector3 | undefined) {
	removeFlashlight(player);
	removeWeapon(player);
	dropAll(player, position);
	removeSlingshot(player);
	removeHammer(player);
	noteTaken(player.DisplayName);
	const firstNight = isFirstNight();
	if (holdAtNest(player, position)) {
		alertPlayer(player, "You were dragged off to the nest. Back at dawn, unless someone comes for you.");
		alertAll(`${player.DisplayName} was dragged off to the nest!`, player);
	} else {
		alertPlayer(
			player,
			firstNight ? "You were taken! Back in a moment..." : "You were taken. You'll be back at dawn.",
		);
		alertAll(`${player.DisplayName} was taken!`, player);
	}
	updateSpectators();
	checkAllTaken();
	if (firstNight) {
		task.delay(gameConfig.firstNightTakenSeconds.Value, () => bringBack(player));
	}
}

function bringBack(player: Player) {
	if (player.Parent && isPlaying()) {
		returnKid(player);
		updateSpectators();
	}
}

/** Dawn: every taken kid comes back to the basement (the nests let theirs go). */
export function returnAllTaken() {
	held.forEach((_, kid) => kid.SetAttribute(HELD_AT_ATTRIBUTE, undefined));
	held.clear();
	refreshRescuePrompts();
	takenKids().forEach(bringBack);
}

/** Lets taken kids be held at the nests. */
export function startRescue(hooks: RescueHooks) {
	rescueHooks = hooks;
}

/** Takes over spawning and being taken. Call once, before players join if possible. */
export function startElimination() {
	startLife({
		onTaken,
		deathIsTaken: (player) => canKidAct(player) && getClock().phase === "Night",
	});
	Players.PlayerRemoving.Connect((player) => {
		if (isMember(player)) {
			held.delete(player);
			refreshRescuePrompts();
			checkAllTaken(player);
			task.defer(updateSpectators);
		}
	});
}
