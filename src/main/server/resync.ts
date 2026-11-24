import { resendCoins } from "./coins";
import { send } from "./gameRemote";
import { resendHint } from "./hints";
import { resendInventory } from "./inventory";
import { isAlive } from "./life";
import { currentSummary } from "./nightReport";
import { isMember } from "./party";
import { getScoreboard } from "./roundEnd";
import { livingKids } from "./teams";
import { resendWalkie } from "./walkie";
import { resendUpgrades } from "./workbench";

/**
 * Re-sends a player everything about their own state. Called when their client reports it has
 * loaded ("Ready"), so a message sent before it was listening — common on slow devices — isn't
 * lost. Every per-player message the server sends should be covered here.
 */
export function resync(player: Player) {
	if (!isMember(player)) {
		return; // not in the run yet; they'll get their state when they join
	}
	resendInventory(player);
	resendCoins(player);
	resendUpgrades(player);
	resendHint(player);
	resendWalkie(player);
	const summary = currentSummary();
	if (summary) {
		send(player, "NightSummary", summary);
	}
	const scoreboard = getScoreboard();
	if (scoreboard) {
		send(player, "Scoreboard", scoreboard);
	}
	if (!isAlive(player)) {
		send(
			player,
			"Spectate",
			livingKids().map((p) => p.UserId),
		);
	}
}
