import { Players } from "@rbxts/services";
import { saveLastTitleAsync } from "shared/lobby/lastTitle";
import { LOBBY_PLACE_ID } from "shared/core/placeIds";
import { EndReason } from "shared/run/round";
import { ScoreCard } from "shared/run/scoreboard";
import { safeTeleport } from "shared/core/safeTeleport";
import { send } from "../core/gameRemote";
import { getLobbyPlaceId } from "../core/party";
import { getPhase } from "../core/round";
import { scoreboardCards } from "../core/roundStats";

/**
 * What happens when a run ends: everyone sees the scoreboard (and can head back early), each
 * kid's title is saved for the lobby, then everyone goes home.
 *
 * Nothing is recorded on the lobby leaderboard yet: it still counts ghost-game wins until M6
 * replaces it with best run + total nights.
 */

let scoreboard: ScoreCard[] | undefined;

/** The end-of-run cards, once the run is over (re-sent to clients that load late). */
export function getScoreboard(): ScoreCard[] | undefined {
	return scoreboard;
}

/** Anyone still here this long after the return teleport is kicked with a rejoin message. */
const RETURN_TIMEOUT = 30;

/** Builds and sends the scoreboard, and saves each kid's title for the lobby. */
export function onRunEnd(reason: EndReason) {
	print(`[Main] Run over: ${reason}.`);
	const cards = scoreboardCards();
	scoreboard = cards;
	Players.GetPlayers().forEach((p) => send(p, "Scoreboard", cards));
	for (const card of cards) {
		task.spawn(() => saveLastTitleAsync(card.userId, { title: card.title, taken: card.taken }));
	}
}

/** Players already sent home (via "Back to lobby"), so the final send doesn't repeat them. */
const sentHome = new Set<Player>();
Players.PlayerRemoving.Connect((player) => sentHome.delete(player));

/**
 * Sends `players` back to the lobby they came from; nobody is left stuck on the end screen.
 * Safe to call more than once (each player is only sent once).
 */
export function returnToLobby(players: Player[]) {
	const leaving = players.filter((p) => !sentHome.has(p));
	if (leaving.size() === 0) {
		return;
	}
	leaving.forEach((p) => sentHome.add(p));
	// Prefer the place the party actually came from (recorded by the lobby), so a wrong
	// configured ID can't strand anyone.
	const lobby = getLobbyPlaceId() ?? LOBBY_PLACE_ID;
	if (lobby === 0) {
		print("[Main] Lobby place ID not configured - staying here.");
		return;
	}
	// Anyone the teleport doesn't move (it failed outright, or later for one player) is sent
	// out with a message instead.
	const sendOff = () => {
		for (const player of leaving) {
			if (player.Parent === Players) {
				player.Kick("Run over! Rejoin the game to play again.");
			}
		}
	};
	if (!safeTeleport(lobby, leaving)) {
		warn(`[Main] Return teleport to ${lobby} failed; kicking with a rejoin message.`);
		sendOff();
	} else {
		task.delay(RETURN_TIMEOUT, sendOff);
	}
}

/** "Back to lobby" from the end screen: only once the run is over. */
export function onLeaveRequest(player: Player) {
	if (getPhase() === "Ended") {
		task.spawn(() => returnToLobby([player]));
	}
}
