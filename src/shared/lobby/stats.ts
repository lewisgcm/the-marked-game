import { DataStoreService } from "@rbxts/services";
import { addRun, readRunStats, RunStats } from "./runStats";

/**
 * Lifetime run stats, saved with DataStore (GAMEPLAY.md §1): each player's best run and total nights. Server
 * only (DataStoreService errors on the client). Every call is wrapped in pcall: a DataStore outage (or
 * Studio without API access) must never break a run or the lobby; stats just don't update.
 *
 * - "PlayerRuns" (DataStore): userId -> { best, total }. The source of truth (shared/lobby/runStats.ts).
 * - "BestRunBoard" and "TotalNightsBoard" (OrderedDataStores): userId -> best / total, kept in step, for the
 *   lobby's two noticeboards.
 */

const RUNS_STORE = "PlayerRuns";

/** The lobby's two boards, and the ordered store behind each. */
export type Board = "BestRun" | "TotalNights";
const BOARD_STORES: Record<Board, string> = { BestRun: "BestRunBoard", TotalNights: "TotalNightsBoard" };

function key(userId: number) {
	return tostring(userId);
}

/** Adds a run of `nights` to `userId`'s stats. Returns the new stats, or undefined if saving failed. Yields. */
export function recordRun(userId: number, nights: number): RunStats | undefined {
	const [ok, stats] = pcall(() => {
		const [result] = DataStoreService.GetDataStore(RUNS_STORE).UpdateAsync(key(userId), (old: unknown) => {
			// UpdateAsync's callback must return a LuaTuple; $tuple is the roblox-ts way to build
			// one. (The roblox-ts lint "fix" rewrites it to a plain array, which doesn't compile.)
			// eslint-disable-next-line roblox-ts/no-user-defined-lua-tuple
			return $tuple(addRun(old, nights));
		});
		return readRunStats(result);
	});
	if (!ok) {
		warn(`[Stats] Couldn't save a run for ${userId}: ${stats}`);
		return undefined;
	}
	pcall(() => DataStoreService.GetOrderedDataStore(BOARD_STORES.BestRun).SetAsync(key(userId), stats.best));
	pcall(() => DataStoreService.GetOrderedDataStore(BOARD_STORES.TotalNights).SetAsync(key(userId), stats.total));
	return stats;
}

/** `userId`'s stats (0s if none), or undefined if loading failed. Yields. */
export function loadRunStats(userId: number): RunStats | undefined {
	// GetAsync returns (value, keyInfo): unwrap it inside the pcall, where it's a real tuple.
	const [ok, value] = pcall(() => {
		const [stored] = DataStoreService.GetDataStore(RUNS_STORE).GetAsync(key(userId));
		return stored;
	});
	if (!ok) {
		warn(`[Stats] Couldn't load runs for ${userId}: ${value}`);
		return undefined;
	}
	return readRunStats(value);
}

export interface LeaderboardEntry {
	userId: number;
	nights: number;
}

/** The top `count` players on `board`, or undefined if loading failed. Yields. */
export function loadTop(board: Board, count: number): LeaderboardEntry[] | undefined {
	const [ok, result] = pcall(() => {
		const pages = DataStoreService.GetOrderedDataStore(BOARD_STORES[board]).GetSortedAsync(false, count);
		const entries: LeaderboardEntry[] = [];
		for (const entry of pages.GetCurrentPage()) {
			const userId = tonumber(entry.key);
			if (userId !== undefined && typeIs(entry.value, "number") && entry.value > 0) {
				entries.push({ userId, nights: entry.value });
			}
		}
		return entries;
	});
	if (!ok) {
		warn(`[Stats] Couldn't load the ${board} board: ${result}`);
		return undefined;
	}
	return result;
}
