import { Players } from "@rbxts/services";
import { removeWeapon } from "./combat";
import { removeFlashlight } from "./flashlight";
import { notify, notifyAllBut, send } from "./gameRemote";
import { startLife } from "./life";
import { isMember } from "./party";
import { endRun } from "./round";
import { isPlaying, livingKids } from "./teams";

/**
 * Kids being taken out of the run (life.ts decides who stays out), or leaving. Handles what a
 * taken kid loses, who they can spectate, and the run ending when no kid is left.
 */

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

/** The run ends once no kid is left (`leaving` is about to go). */
function checkAllTaken(leaving?: Player) {
	if (
		isPlaying() &&
		livingKids()
			.filter((p) => p !== leaving)
			.size() === 0
	) {
		endRun("AllTaken");
	}
}

function onTaken(player: Player) {
	removeFlashlight(player);
	removeWeapon(player);
	notify(player, "You were taken. Spectating.");
	notifyAllBut(livingKids(), player, `${player.DisplayName} was taken!`);
	updateSpectators();
	checkAllTaken();
}

/** Takes over spawning and being taken. Call once, before players join if possible. */
export function startElimination() {
	startLife({ onTaken });
	Players.PlayerRemoving.Connect((player) => {
		if (isMember(player)) {
			checkAllTaken(player);
			task.defer(updateSpectators);
		}
	});
}
