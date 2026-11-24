import { Players } from "@rbxts/services";
import { dropAll } from "./inventory";
import { removeWeapon } from "./combat";
import { removeFlashlight } from "./flashlight";
import { removeSlingshot } from "./slingshot";
import { alertAll, alertPlayer, send } from "./gameRemote";
import { gameConfig } from "./config";
import { returnKid, startLife, takenKids } from "./life";
import { noteTaken } from "./nightReport";
import { isMember } from "./party";
import { endRun, getClock } from "./round";
import { canKidAct, isPlaying, livingKids } from "./teams";

/**
 * Kids being taken (life.ts), coming back, or leaving. Handles what a taken kid loses, who they
 * can spectate, bringing them back (at dawn, or after FirstNightTakenSeconds on Night 1), and the
 * run ending when every kid is taken at once (never on Night 1).
 */

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

function onTaken(player: Player, position: Vector3 | undefined) {
	removeFlashlight(player);
	removeWeapon(player);
	dropAll(player, position);
	removeSlingshot(player);
	noteTaken(player.DisplayName);
	const firstNight = isFirstNight();
	alertPlayer(player, firstNight ? "You were taken! Back in a moment..." : "You were taken. You'll be back at dawn.");
	alertAll(`${player.DisplayName} was taken!`, player);
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

/** Dawn: every taken kid comes back to the basement. */
export function returnAllTaken() {
	takenKids().forEach(bringBack);
}

/** Takes over spawning and being taken. Call once, before players join if possible. */
export function startElimination() {
	startLife({
		onTaken,
		deathIsTaken: (player) => canKidAct(player) && getClock().phase === "Night",
	});
	Players.PlayerRemoving.Connect((player) => {
		if (isMember(player)) {
			checkAllTaken(player);
			task.defer(updateSpectators);
		}
	});
}
