/**
 * Hunter sanity: 100 (calm) to 0 (terrified). The rules are pure functions so they can be
 * unit-tested without a running game; the server (main/server/sanity.ts) feeds them what it
 * sees plus the tuning numbers (main/server/config.ts), and publishes the result.
 */

export const SANITY_MAX = 100;

/** Player attribute (number, 0..100) the server sets so the HUD can show it. */
export const SANITY_ATTRIBUTE = "Sanity";

/** Player attribute (boolean) the server sets while a hunter is panicking. */
export const PANIC_ATTRIBUTE = "Panicking";

export interface SanityContext {
	/** Near a working lamp. */
	lit: boolean;
	/** Another hunter nearby. */
	company: boolean;
	/** The ghost is close, seen or not. */
	ghostNear: boolean;
}

/** Per-second rates (all positive numbers; drains are subtracted). */
export interface SanityRates {
	drainAlone: number;
	recoverOne: number;
	recoverBoth: number;
	ghostChill: number;
}

/**
 * Sanity change per second.
 *
 * - Alone in the dark: drains by `drainAlone`.
 * - In the light *or* with company: recovers by `recoverOne`. Both: by `recoverBoth`.
 * - The ghost nearby: an extra `ghostChill` drain on top, so a hunter can feel it coming.
 */
export function sanityRate({ lit, company, ghostNear }: SanityContext, rates: SanityRates): number {
	let rate: number;
	if (lit && company) {
		rate = rates.recoverBoth;
	} else if (lit || company) {
		rate = rates.recoverOne;
	} else {
		rate = -rates.drainAlone;
	}
	if (ghostNear) {
		rate -= rates.ghostChill;
	}
	return rate;
}

/** Applies `rate` for `dt` seconds, clamped to 0..SANITY_MAX. */
export function stepSanity(current: number, rate: number, dt: number): number {
	return math.clamp(current + rate * dt, 0, SANITY_MAX);
}

/**
 * Panic starts when sanity drops to `startAt` and lasts until it climbs back to `recoverAt`.
 * The gap means a hunter can't flicker in and out of panic.
 */
export function nextPanicState(panicking: boolean, sanity: number, startAt: number, recoverAt: number): boolean {
	if (!panicking) {
		return sanity <= startAt;
	}
	return sanity < recoverAt;
}
