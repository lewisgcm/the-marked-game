import { MemoryStoreService } from "@rbxts/services";

/**
 * A player's title from their last run (e.g. "Slugger"), handed from the main game to
 * the lobby so it can float above their head until they play again. Server to server through
 * MemoryStore (never TeleportData, which the client could forge). Expires after a while, so an
 * old title doesn't follow someone around forever.
 *
 * Server only — MemoryStoreService errors on the client.
 */
const TITLE_MAP_NAME = "LastRoundTitle";
const TITLE_TTL_SECONDS = 60 * 60;

export interface LastTitle {
	title: string;
	/** Whether they were taken during the run. */
	taken: boolean;
}

export function saveLastTitleAsync(userId: number, entry: LastTitle) {
	const [ok, err] = pcall(() =>
		MemoryStoreService.GetHashMap(TITLE_MAP_NAME).SetAsync(tostring(userId), entry, TITLE_TTL_SECONDS),
	);
	if (!ok) {
		warn(`[LastTitle] Failed to save: ${err}`);
	}
}

/** The player's last title, or undefined if none (or it can't be read / looks wrong). */
export function loadLastTitleAsync(userId: number): LastTitle | undefined {
	const [ok, value] = pcall(() => MemoryStoreService.GetHashMap(TITLE_MAP_NAME).GetAsync(tostring(userId)));
	if (!ok || !typeIs(value, "table")) {
		return undefined;
	}
	const raw = value as { title?: unknown; taken?: unknown };
	if (!typeIs(raw.title, "string") || raw.title.size() > 40) {
		return undefined;
	}
	return { title: raw.title, taken: raw.taken === true };
}
