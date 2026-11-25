/**
 * The day/night clock: Day → Dusk → Night → Dawn, then the next day, forever (GAMEPLAY.md §4).
 * Pure (no Roblox services) so it's unit-tested; the server drives it (main/server/core/round.ts)
 * and publishes it as attributes (shared/run/round.ts).
 *
 * Day N comes before Night N: a run starts on Day 1, and surviving Night 1 brings Dawn 1, then
 * Day 2.
 */

export type DayPhase = "Day" | "Dusk" | "Night" | "Dawn";

/** Where the clock is: which night it is, and the phase within it. */
export interface Clock {
	night: number;
	phase: DayPhase;
}

/** Seconds each phase lasts. */
export type PhaseLengths = Record<DayPhase, number>;

const NEXT: Record<DayPhase, DayPhase> = { Day: "Dusk", Dusk: "Night", Night: "Dawn", Dawn: "Day" };

/** The clock at the start of a run: Day 1. */
export function firstClock(): Clock {
	return { night: 1, phase: "Day" };
}

/** The phase after `clock`. Dawn rolls over to the next day. */
export function nextClock(clock: Clock): Clock {
	const phase = NEXT[clock.phase];
	return { night: phase === "Day" ? clock.night + 1 : clock.night, phase };
}

/** How long `clock`'s phase lasts, in seconds. */
export function phaseLength(clock: Clock, lengths: PhaseLengths): number {
	return lengths[clock.phase];
}

/** Nights fully survived by this point: a night counts once its dawn arrives. */
export function nightsSurvived(clock: Clock): number {
	return clock.phase === "Dawn" ? clock.night : clock.night - 1;
}

/** What the HUD calls this phase: "DAY 2", "DUSK", "NIGHT 2", "DAWN". */
export function phaseTitle(clock: Clock): string {
	if (clock.phase === "Day") {
		return `DAY ${clock.night}`;
	}
	if (clock.phase === "Night") {
		return `NIGHT ${clock.night}`;
	}
	return clock.phase === "Dusk" ? "DUSK" : "DAWN";
}
