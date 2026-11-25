import { MemoryStoreService } from "@rbxts/services";

/**
 * Server-to-server handoff of a party from the lobby to its reserved main-game server.
 *
 * The lobby writes a record to MemoryStore, keyed by the reserved server's PrivateServerId;
 * the main server reads it back with `game.PrivateServerId`. This is used instead of
 * TeleportData, which passes through the client and can be forged.
 *
 * The record also carries the lobby's own place ID, so the main game can send players back to
 * exactly where they came from without relying on a configured ID.
 *
 * Server only — MemoryStoreService errors on the client.
 */
const PARTY_MAP_NAME = "PartyHandoff";

/** Long enough for any teleport to land; the entry is only read at round start. */
const PARTY_TTL_SECONDS = 600;

export interface PartyRecord {
	userIds: number[];
	/** The lobby place the party came from (its `game.PlaceId`). */
	lobbyPlaceId?: number;
}

export function savePartyAsync(privateServerId: string, record: PartyRecord): boolean {
	const [ok, err] = pcall(() =>
		MemoryStoreService.GetHashMap(PARTY_MAP_NAME).SetAsync(privateServerId, record, PARTY_TTL_SECONDS),
	);
	if (!ok) {
		warn(`[PartyHandoff] Failed to save party: ${err}`);
	}
	return ok;
}

/** Returns the party record, or undefined if there is no (valid) entry yet. */
export function loadPartyAsync(privateServerId: string): PartyRecord | undefined {
	const [ok, value] = pcall(() => MemoryStoreService.GetHashMap(PARTY_MAP_NAME).GetAsync(privateServerId));
	if (!ok) {
		warn(`[PartyHandoff] Failed to load party: ${value}`);
		return undefined;
	}
	if (!typeIs(value, "table")) {
		return undefined;
	}
	const raw = value as { userIds?: unknown; lobbyPlaceId?: unknown };
	if (!typeIs(raw.userIds, "table")) {
		return undefined;
	}
	const userIds: number[] = [];
	for (const id of raw.userIds as unknown[]) {
		if (typeIs(id, "number")) {
			userIds.push(id);
		}
	}
	return { userIds, lobbyPlaceId: typeIs(raw.lobbyPlaceId, "number") ? raw.lobbyPlaceId : undefined };
}
