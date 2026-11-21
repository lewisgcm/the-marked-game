import { Players } from "@rbxts/services";
import { loadPartyAsync, PartyRecord } from "shared/partyHandoff";

/**
 * Who's in this run. Everyone in the party is a kid (there are no roles). Server-only: the
 * member list is never stored on replicated instances, so a client can't spoof membership.
 */
const members = new Set<Player>();

Players.PlayerRemoving.Connect((player) => members.delete(player));

/** Whether `player` is one of this run's kids. */
export function isMember(player: Player): boolean {
	return members.has(player);
}

/** Every kid in the run who is still in the server. */
export function getMembers(): Player[] {
	return [...members];
}

/** The lobby's party record, once loaded (in a reserved server). */
let partyRecord: PartyRecord | undefined;

/** Whether waitForParty has finished (with or without a record). */
let partySettled = false;
const partyWaiters: Array<(record: PartyRecord | undefined) => void> = [];

/** The lobby place this party came from, if the lobby recorded it. */
export function getLobbyPlaceId(): number | undefined {
	return partyRecord?.lobbyPlaceId;
}

/**
 * Calls `callback` with the party record once it's known (immediately if it already is). The
 * record is undefined outside a reserved server or if it couldn't be loaded.
 */
export function whenPartyKnown(callback: (record: PartyRecord | undefined) => void) {
	if (partySettled) {
		callback(partyRecord);
	} else {
		partyWaiters.push(callback);
	}
}

/** Whether `player` was in the party the lobby sent. True when there's no record to check. */
export function isInvited(player: Player): boolean {
	return partyRecord === undefined || partyRecord.userIds.includes(player.UserId);
}

function settleParty() {
	partySettled = true;
	for (const waiter of partyWaiters) {
		task.spawn(waiter, partyRecord);
	}
	partyWaiters.clear();
}

/**
 * Outside a reserved server (e.g. a Studio playtest), how long to wait after the first player for
 * others to join. Anyone slower still joins as a late arrival (addLateJoiners).
 */
const UNRESERVED_GRACE = 2;

/**
 * Waits for the party sent by the lobby to arrive, up to `timeout` seconds.
 *
 * The party list comes from MemoryStore (written by the lobby server), keyed by this
 * reserved server's PrivateServerId. Outside a reserved server (e.g. a Studio playtest)
 * there is no party, so everyone who joins within a few seconds of the first player counts.
 */
export function waitForParty(timeout: number): Player[] {
	const isReserved = game.PrivateServerId !== "";
	if (!isReserved) {
		while (Players.GetPlayers().size() === 0) {
			Players.PlayerAdded.Wait();
		}
		task.wait(math.min(UNRESERVED_GRACE, timeout));
		settleParty();
		return Players.GetPlayers();
	}

	const deadline = os.clock() + timeout;
	let expected: number[] | undefined;

	while (os.clock() < deadline) {
		if (expected === undefined) {
			partyRecord = loadPartyAsync(game.PrivateServerId);
			expected = partyRecord?.userIds;
		}
		if (expected !== undefined && expected.every((id) => Players.GetPlayerByUserId(id) !== undefined)) {
			break;
		}
		task.wait(1);
	}

	settleParty();
	if (expected === undefined) {
		warn("[Roles] No party record found; using everyone in the server.");
		return Players.GetPlayers();
	}
	return Players.GetPlayers().filter((p) => expected!.includes(p.UserId));
}

/** Starts the run with `party` as its kids. */
export function setMembers(party: Player[]) {
	members.clear();
	party.forEach((player) => members.add(player));
}

/**
 * Adds anyone from the party who arrives after the run started (e.g. a slow teleport), then
 * calls `onJoined`. Only invited players can join a reserved server.
 */
export function addLateJoiners(onJoined: (player: Player) => void) {
	Players.PlayerAdded.Connect((player) => {
		// Only the party's own late arrivals; anyone else is sent to the lobby (gatekeeper.ts).
		if (members.size() > 0 && !members.has(player) && isInvited(player)) {
			members.add(player);
			onJoined(player);
		}
	});
}
