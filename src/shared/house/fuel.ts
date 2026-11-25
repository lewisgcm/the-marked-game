/**
 * Generator fuel (GAMEPLAY.md §4), measured in nights of running: a tank of 1 lasts one whole night
 * with the power on. Pure so it's unit-tested; main/server/house/generator.ts owns the real tank.
 */

/** What's left after running for `seconds`. `rate` is 1 normally, less with a tune-up. */
export function burnFuel(fuel: number, seconds: number, nightSeconds: number, rate: number): number {
	return math.max(0, fuel - (seconds * rate) / math.max(1, nightSeconds));
}

/** Nights the fuel will last at this rate. */
export function nightsLeft(fuel: number, rate: number): number {
	return fuel / rate;
}

/** Whether a whole can fits: none is ever poured away. */
export function canPour(fuel: number, perCan: number, tank: number): boolean {
	return fuel + perCan <= tank + 1e-6;
}

/** Whether the tank has just dropped to the warning level (both in nights left), but isn't empty. */
export function justRanLow(before: number, after: number, low: number): boolean {
	return before > low && after <= low && after > 0;
}

/** For the generator's prompt: "empty", "1 night of fuel", "1.5 nights of fuel". */
export function fuelText(nights: number): string {
	if (nights <= 0) {
		return "empty";
	}
	const shown = math.max(0.1, math.round(nights * 10) / 10);
	return `${shown} ${shown === 1 ? "night" : "nights"} of fuel`;
}
