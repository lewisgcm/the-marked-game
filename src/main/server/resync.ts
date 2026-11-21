import { publishAttackWindow } from "./combat";
import { send } from "./gameRemote";
import { isRevealed } from "./ghostVisibility";
import { isAlive } from "./life";
import { resendInventory } from "./objectives";
import { getRole } from "./roles";
import { getScoreboard } from "./roundEnd";
import { resendSpooks } from "./spooks";
import { livingHunters } from "./teams";

/**
 * Re-sends a player everything about their own state. Called when their client reports it has
 * loaded ("Ready"), so a message sent before it was listening — common on slow devices — isn't
 * lost. Every per-player message the server sends should be covered here.
 */
export function resync(player: Player) {
	const role = getRole(player);
	if (role === undefined) {
		return; // nothing assigned yet; they'll get it when roles are picked
	}
	send(player, "Role", role);
	const scoreboard = getScoreboard();
	if (scoreboard) {
		send(player, "Scoreboard", scoreboard);
	}
	if (role === "Ghost") {
		send(player, "GhostRevealed", isRevealed(player));
		resendSpooks();
		publishAttackWindow();
		return;
	}
	resendInventory(player);
	if (!isAlive(player)) {
		send(
			player,
			"Spectate",
			livingHunters().map((p) => p.UserId),
		);
	}
}
