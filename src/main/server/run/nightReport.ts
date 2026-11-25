import { addTaken, emptyTally, NightSummary, summarise } from "shared/run/nightSummary";

/**
 * Counts what each night cost, for the dawn card (rules in shared/run/nightSummary.ts). A leaf module:
 * the server entry and elimination.ts report into it.
 */

let tally = emptyTally();
let current: NightSummary | undefined;

/** Nightfall: start counting afresh. */
export function beginNight() {
	tally = emptyTally();
	current = undefined;
}

export function notePlankLost() {
	tally.planksLost += 1;
}

export function noteInfectedDowned() {
	tally.infectedDowned += 1;
}

export function noteTaken(name: string) {
	addTaken(tally, name);
}

/** Dawn: the card for `night`. */
export function endNight(night: number): NightSummary {
	current = summarise(night, tally);
	return current;
}

/** The card while it's showing (for resync); undefined once the day starts. */
export function currentSummary(): NightSummary | undefined {
	return current;
}

export function clearSummary() {
	current = undefined;
}
