/**
 * A player's lifetime run stats (GAMEPLAY.md §1, the lobby's noticeboards): their best run (most nights
 * survived in one run) and their total nights across every run. Pure, so it's tested; saving them is
 * shared/lobby/stats.ts.
 */
export interface RunStats {
	best: number;
	total: number;
}

/** A whole number of nights, 0 or more (anything else counts as 0). */
function nights(value: unknown): number {
	return typeIs(value, "number") && value === value && value > 0 ? math.floor(value) : 0;
}

/** What was saved (or nothing, or something broken) as RunStats. */
export function readRunStats(saved: unknown): RunStats {
	if (!typeIs(saved, "table")) {
		return { best: 0, total: 0 };
	}
	const record = saved as { best?: unknown; total?: unknown };
	return { best: nights(record.best), total: nights(record.total) };
}

/** `saved` with a run of `survived` nights added: the best is the higher, the total grows. */
export function addRun(saved: unknown, survived: number): RunStats {
	const old = readRunStats(saved);
	const run = nights(survived);
	return { best: math.max(old.best, run), total: old.total + run };
}
