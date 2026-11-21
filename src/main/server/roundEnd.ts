import { Players, RunService } from "@rbxts/services";
import { saveLastTitleAsync } from "shared/lastTitle";
import { LOBBY_PLACE_ID } from "shared/placeIds";
import { EndReason, Winner } from "shared/round";
import { ScoreCard } from "shared/scoreboard";
import { safeTeleport } from "shared/safeTeleport";
import { recordWin } from "shared/stats";
import { send } from "./gameRemote";
import { setRevealed } from "./ghostVisibility";
import { getGhost, getLobbyPlaceId, getRole } from "./roles";
import { getPhase } from "./round";
import { scoreboardCards } from "./roundStats";
import { allHunters } from "./teams";

/**
 * What happens when a round ends: wins are recorded, the ghost is shown, everyone sees the
 * scoreboard (and can head back early), then everyone goes home.
 */

let scoreboard: ScoreCard[] | undefined;

/** The end-of-round cards, once the round is over (re-sent to clients that load late). */
export function getScoreboard(): ScoreCard[] | undefined {
	return scoreboard;
}

/** Anyone still here this long after the return teleport is kicked with a rejoin message. */
const RETURN_TIMEOUT = 30;

/** Records wins and shows the ghost. `stopReveals` stops the flashlight loop from hiding it. */
export function onRoundEnd(winner: Winner, reason: EndReason, stopReveals: () => void) {
	print(`[Main] Round over: ${winner} win.`);

	// A win for everyone on the winning side (all hunters — dead ones too — for a team win).
	// Not in Studio, so test rounds never touch the live leaderboard.
	const ghost = getGhost();
	const winners = winner === "Ghost" ? (ghost ? [ghost] : []) : allHunters();
	if (RunService.IsStudio()) {
		print(`[Main] Studio: not recording wins for ${winners.size()} player(s).`);
	} else {
		winners.forEach((player) => task.spawn(() => recordWin(player.UserId)));
	}

	// The scoreboard, and each player's title for the lobby to show.
	const cards = scoreboardCards((p) => getRole(p), winner === "Ghost");
	scoreboard = cards;
	Players.GetPlayers().forEach((p) => send(p, "Scoreboard", cards));
	for (const card of cards) {
		const won = (card.role === "Ghost") === (winner === "Ghost");
		task.spawn(() => saveLastTitleAsync(card.userId, { title: card.title, role: card.role, won }));
	}

	// Show the ghost to everyone for the end screen (unless the banishing just dissolved it).
	stopReveals();
	if (reason !== "Banished" && ghost && setRevealed(ghost, true)) {
		send(ghost, "GhostRevealed", true);
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
				player.Kick("Round over! Rejoin the game to play again.");
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

/** "Back to lobby" from the end screen: only once the round is over. */
export function onLeaveRequest(player: Player) {
	if (getPhase() === "Ended") {
		task.spawn(() => returnToLobby([player]));
	}
}
