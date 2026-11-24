/**
 * Who attacks the house each night (GAMEPLAY.md §4 and §6). Pure (no Roblox services) so it's
 * unit-tested; main/server/infected/ spawns what it says.
 *
 * Night 1 is forgiving: two small waves, Dad plus a few shamblers. From Night 2, three waves
 * that grow every night, the last the biggest. Wave sizes scale with the party, so solo is
 * playable and six kids is chaos.
 */

export interface Wave {
	/** When the wave arrives, as a fraction of the night (0 = nightfall, 1 = dawn). */
	at: number;
	/** How many shamblers. */
	shamblers: number;
	/** Whether Dad comes with this wave. */
	dad: boolean;
}

/** Wave size multiplier for a party: 0.8 solo, 1.4 for four, 1.8 for six. */
export function partyFactor(kids: number): number {
	return 0.6 + 0.2 * math.clamp(kids, 1, 6);
}

/** The waves for `night` with `kids` in the party. */
export function planNight(night: number, kids: number): Wave[] {
	const factor = partyFactor(kids);
	if (night <= 1) {
		return [
			{ at: 0.07, shamblers: math.max(1, math.round(1 * factor)), dad: true },
			{ at: 0.45, shamblers: math.max(2, math.round(2 * factor)), dad: false },
		];
	}
	const base = 2 + night;
	const shares = [0.6, 0.8, 1.2];
	const times = [0.07, 0.33, 0.67];
	return shares.map((share, i) => ({
		at: times[i],
		shamblers: math.max(1, math.round(base * factor * share)),
		dad: i === 0,
	}));
}

/**
 * A wave's size once the generator is taken into account: with the power off the infected are
 * bolder and more come (`offMultiplier`). Night 1 is forgiving, so it never applies there.
 */
export function waveSize(shamblers: number, night: number, powered: boolean, offMultiplier: number): number {
	return powered || night <= 1 ? shamblers : math.max(shamblers, math.round(shamblers * offMultiplier));
}

/**
 * Whether the power counts for a wave: it has to have been on for `settle` seconds, so switching it
 * on just as they arrive doesn't. `onFor` is how long it's been on; undefined when it's off.
 */
export function powerCounts(onFor: number | undefined, settle: number): boolean {
	return onFor !== undefined && onFor >= settle;
}

/** An infected's health on `night`: `base`, plus `perNight` (a fraction) for every night after the first. */
export function infectedHealth(night: number, base: number, perNight: number): number {
	return base * (1 + perNight * math.max(0, night - 1));
}
