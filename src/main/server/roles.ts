import { Players } from "@rbxts/services";
import { loadPartyAsync, PartyRecord } from "shared/partyHandoff";
import { Role } from "shared/roles";

/**
 * Authoritative role table. Server-only: roles are never stored on replicated instances
 * (e.g. attributes), so a client can't read or spoof who the ghost is.
 */
const roles = new Map<Player, Role>();

Players.PlayerRemoving.Connect((player) => roles.delete(player));

export function getRole(player: Player): Role | undefined {
	return roles.get(player);
}

/** The current ghost, if roles have been assigned and they're still here. */
export function getGhost(): Player | undefined {
	for (const [player, role] of roles) {
		if (role === "Ghost") {
			return player;
		}
	}
	return undefined;
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

/** Outside a reserved server, how long to wait after the first player for others to join. */
const UNRESERVED_GRACE = 5;

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

/** Randomly picks one ghost from the party; everyone else is a hunter. */
export function assignRoles(party: Player[]): Player | undefined {
	roles.clear();
	if (party.size() === 0) {
		return undefined;
	}
	const ghost = party[new Random().NextInteger(0, party.size() - 1)];
	for (const player of party) {
		roles.set(player, player === ghost ? "Ghost" : "Hunter");
	}
	return ghost;
}

/**
 * Gives a hunter role to anyone who arrives after roles were assigned (e.g. a party member
 * whose teleport was slow), then calls `onAssigned`. Only invited players can join a
 * reserved server.
 */
export function assignLateJoiners(onAssigned: (player: Player) => void) {
	Players.PlayerAdded.Connect((player) => {
		// Only the party's own late arrivals; anyone else is sent to the lobby (gatekeeper.ts).
		if (roles.size() > 0 && !roles.has(player) && isInvited(player)) {
			roles.set(player, "Hunter");
			onAssigned(player);
		}
	});
}
