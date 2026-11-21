import { Players } from "@rbxts/services";
import { removeWeapon } from "./combat";
import { removeFlashlight } from "./flashlight";
import { notify, notifyAllBut, send } from "./gameRemote";
import { startLife } from "./life";
import { dropCarried } from "./objectives";
import { setPanicEffects } from "./panic";
import { getRole } from "./roles";
import { endRound } from "./round";
import { isHunting, livingHunters } from "./teams";
import { removeTrapTool } from "./traps";

/**
 * Hunters being taken out of the round: killed by the ghost's knife (life.ts decides who stays
 * dead), or leaving. Handles what a dead hunter drops and loses, who they can spectate, and
 * the ghost's win when no hunter is left.
 */

/** Tells every dead hunter who they can spectate: living hunters only, never the ghost. */
export function updateSpectators() {
	const alive = livingHunters();
	const aliveIds = alive.map((p) => p.UserId);
	for (const player of Players.GetPlayers()) {
		if (getRole(player) === "Hunter" && !alive.includes(player)) {
			send(player, "Spectate", aliveIds);
		}
	}
}

/** The ghost wins once no hunter is left alive (`leaving` is about to go). */
function checkAllDead(leaving?: Player) {
	if (
		isHunting() &&
		livingHunters()
			.filter((p) => p !== leaving)
			.size() === 0
	) {
		endRound("Ghost", "AllDead");
	}
}

function onKilled(player: Player, position: Vector3 | undefined) {
	if (position) {
		dropCarried(player, position);
	}
	removeFlashlight(player);
	removeTrapTool(player);
	removeWeapon(player);
	setPanicEffects(player, false);
	notify(player, "The ghost got you. You're out — spectating.");
	notifyAllBut(livingHunters(), player, `${player.DisplayName} was killed by the ghost!`);
	updateSpectators();
	checkAllDead();
}

/** Takes over spawning and death. Call once, before players join if possible. */
export function startElimination() {
	startLife({ onKilled });
	Players.PlayerRemoving.Connect((player) => {
		if (getRole(player) === "Hunter") {
			checkAllDead(player);
			task.defer(updateSpectators);
		}
	});
}
