/**
 * The Signal takes the adult bases on its own schedule (GAMEPLAY.md §7). Pure (no Roblox services), so
 * it's unit-tested; main/server/economy/signal.ts plays it out.
 *
 * At the start of a run each adult base draws the night it falls from its window (`Base.falls`), and two
 * earlier nights for its first two marks. Each mark lands at that night's dusk broadcast; the third is
 * the turning ("Something's wrong with us…"). Kids can't stop it: the world just gets worse.
 */

/** The nights a base can fall on (its third mark), first to last. */
export interface FallWindow {
	first: number;
	last: number;
}

/** When each of a base's three marks lands: the nights whose broadcasts bring them, in order. */
export type MarkSchedule = [number, number, number];

/** Marks it takes to turn a base. */
export const MARKS_TO_FALL = 3;

/**
 * A base's marks: it falls on a night in `window` (or on `fallOverride`, if given, for testing), with the
 * first two marks on two different earlier nights, from about when it opens (`opens`). `random` gives
 * numbers in 0..1.
 */
export function planMarks(
	window: FallWindow,
	opens: number,
	random: () => number,
	fallOverride?: number,
): MarkSchedule {
	const pick = (lo: number, hi: number) => lo + math.min(hi - lo, math.floor(random() * (hi - lo + 1)));
	// Two earlier nights are needed, so a base can't fall before Night 3.
	const falls = math.max(3, fallOverride ?? pick(window.first, window.last));
	// From the night before it opens (it's already "off" when kids first meet it), but early enough
	// to leave two nights.
	const earliest = math.max(1, math.min(opens - 1, falls - 2));
	const first = pick(earliest, falls - 2);
	const second = pick(first + 1, falls - 1);
	return [first, second, falls];
}

/** How many marks a base has after `night`'s broadcast (0 before it, until the broadcast comes). */
export function marksAfter(schedule: MarkSchedule, night: number): number {
	return schedule.filter((n) => n <= night).size();
}

/** Whether `night`'s broadcast gives the base a mark. */
export function markTonight(schedule: MarkSchedule, night: number): boolean {
	return schedule.includes(night);
}

/** What the walkie's meter shows: "●●○". */
export function markMeter(marks: number): string {
	let meter = "";
	for (let i = 1; i <= MARKS_TO_FALL; i++) {
		meter += i <= marks ? "●" : "○";
	}
	return meter;
}

/**
 * Whether a base calls "We're under attack!" tonight: never on Nights 1–2, and more likely the more
 * marks it has (`chances[marks]`). `roll` is a random number in 0..1.
 */
export function underAttackTonight(night: number, marks: number, chances: number[], roll: number): boolean {
	return night >= 3 && marks < MARKS_TO_FALL && roll < (chances[marks] ?? 0);
}

/**
 * How a wave of `count` splits between the usual spawns round the house and each nest: each nest takes
 * `share` of the wave (rounded), the house's spawns at least one (if there's anyone at all).
 */
export function splitWave(count: number, nests: number, share: number): { house: number; perNest: number } {
	if (nests <= 0 || count <= 1) {
		return { house: count, perNest: 0 };
	}
	const perNest = math.min(math.round(count * share), math.floor((count - 1) / nests));
	return { house: count - perNest * nests, perNest };
}
