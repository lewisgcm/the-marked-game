import { Players, RunService } from "@rbxts/services";
import { LOBBY_PLACE_ID } from "shared/placeIds";
import { safeTeleport } from "shared/safeTeleport";
import { decideAdmission } from "./admission";
import { getLobbyPlaceId, whenPartyKnown } from "./party";

/**
 * Keeps people who aren't part of this round out of it.
 *
 * Rounds only happen in the reserved servers the lobby creates for a party. Anyone who gets
 * into a main-game server any other way — following a friend, or joining the main place
 * directly into a public server — is sent to the lobby to queue up properly. In a reserved
 * server, anyone not on the lobby's party list is sent too (party members who arrive late
 * still join; see assignLateJoiners). If the teleport fails they're kicked with a message,
 * never left wandering into a round in progress.
 *
 * Studio is exempt so testing works.
 */

const KICK_MESSAGE = "A round is in progress — join from the lobby to play.";
/** If someone we sent to the lobby is still here after this, kick them with the message. */
const SEND_TIMEOUT = 20;

/** A server created by the lobby for one party (not a public server, not a VIP server). */
export function isRoundServer(): boolean {
	return RunService.IsStudio() || (game.PrivateServerId !== "" && game.PrivateServerOwnerId === 0);
}

function sendToLobby(player: Player) {
	const lobby = getLobbyPlaceId() ?? LOBBY_PLACE_ID;
	if (lobby === 0 || !safeTeleport(lobby, [player])) {
		player.Kick(KICK_MESSAGE);
		return;
	}
	task.delay(SEND_TIMEOUT, () => {
		if (player.Parent) {
			player.Kick(KICK_MESSAGE);
		}
	});
}

function check(player: Player) {
	const base = { studio: RunService.IsStudio(), roundServer: isRoundServer() };
	const first = decideAdmission({ ...base, partyKnown: false }, player.UserId);
	if (first === "lobby") {
		print(`[Gatekeeper] ${player.Name} joined a public main-game server; sending to the lobby.`);
		sendToLobby(player);
	} else if (first === "wait") {
		// In a reserved server: decide once we know who the party is.
		whenPartyKnown((record) => {
			const decision = decideAdmission(
				{ ...base, partyKnown: true, partyUserIds: record?.userIds },
				player.UserId,
			);
			if (decision === "lobby" && player.Parent) {
				print(`[Gatekeeper] ${player.Name} isn't in this round's party; sending to the lobby.`);
				sendToLobby(player);
			}
		});
	}
}

/** Starts checking everyone who joins. Call once, at server start. */
export function startGatekeeper() {
	Players.GetPlayers().forEach(check);
	Players.PlayerAdded.Connect(check);
}
