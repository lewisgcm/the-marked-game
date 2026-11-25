import { DataStoreService } from "@rbxts/services";

/**
 * Lifetime player stats, saved with DataStore. Server only (DataStoreService errors on the
 * client). Every call is wrapped in pcall: a DataStore outage (or Studio without API access)
 * must never break a round — stats just don't update.
 *
 * - "PlayerWins" (DataStore): userId -> total wins. The source of truth.
 * - "WinsLeaderboard" (OrderedDataStore): userId -> total wins, kept in step, for the top-10 board.
 */

const WINS_STORE = "PlayerWins";
const LEADERBOARD_STORE = "WinsLeaderboard";

function key(userId: number) {
	return tostring(userId);
}

/** Adds one win for `userId`. Returns the new total, or undefined if saving failed. */
export function recordWin(userId: number): number | undefined {
	const [ok, total] = pcall(() => {
		const [result] = DataStoreService.GetDataStore(WINS_STORE).UpdateAsync(key(userId), (old: unknown) => {
			const previous = typeIs(old, "number") ? old : 0;
			// UpdateAsync's callback must return a LuaTuple; $tuple is the roblox-ts way to build
			// one. (The roblox-ts lint "fix" rewrites it to a plain array, which doesn't compile.)
			// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple
			return $tuple(previous + 1);
		});
		return result as number;
	});
	if (!ok) {
		warn(`[Stats] Couldn't save a win for ${userId}: ${total}`);
		return undefined;
	}
	pcall(() => DataStoreService.GetOrderedDataStore(LEADERBOARD_STORE).SetAsync(key(userId), total));
	return total;
}

/** Total wins for `userId` (0 if none), or undefined if loading failed. */
export function loadWins(userId: number): number | undefined {
	// GetAsync returns (value, keyInfo): unwrap it inside the pcall, where it's a real tuple.
	const [ok, value] = pcall(() => {
		const [stored] = DataStoreService.GetDataStore(WINS_STORE).GetAsync(key(userId));
		return stored;
	});
	if (!ok) {
		warn(`[Stats] Couldn't load wins for ${userId}: ${value}`);
		return undefined;
	}
	return typeIs(value, "number") ? value : 0;
}

export interface LeaderboardEntry {
	userId: number;
	wins: number;
}

/** The top `count` players by wins, or undefined if loading failed. */
export function loadTopWins(count: number): LeaderboardEntry[] | undefined {
	const [ok, result] = pcall(() => {
		const pages = DataStoreService.GetOrderedDataStore(LEADERBOARD_STORE).GetSortedAsync(false, count);
		const entries: LeaderboardEntry[] = [];
		for (const entry of pages.GetCurrentPage()) {
			const userId = tonumber(entry.key);
			if (userId !== undefined && typeIs(entry.value, "number") && entry.value > 0) {
				entries.push({ userId, wins: entry.value });
			}
		}
		return entries;
	});
	if (!ok) {
		warn(`[Stats] Couldn't load the leaderboard: ${result}`);
		return undefined;
	}
	return result;
}
