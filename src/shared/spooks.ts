/** The ghost's spooks: limited-charge abilities. Rules and numbers live on the server. */

export type SpookKind = "Scream" | "LightsOut";
export const SPOOK_KINDS: SpookKind[] = ["Scream", "LightsOut"];

/** What the ghost's HUD shows, sent to the ghost whenever it changes. */
export interface SpookState {
	charges: number;
	maxCharges: number;
	/** Seconds until the next charge, or undefined when full. */
	nextChargeIn?: number;
}

/** The ghost's charge bookkeeping. `nextChargeAt` is a clock time (os.clock on the server). */
export interface ChargeState {
	charges: number;
	nextChargeAt: number;
}

/**
 * Brings the charges up to `now`, after first pulling the next charge `bonusSeconds` closer
 * (a scare reward). A bonus bigger than the wait grants the charge and carries the rest into
 * the next one. At max charges the clock is parked and bonuses are wasted. Pure, for tests.
 */
export function advanceCharges(
	state: ChargeState,
	now: number,
	bonusSeconds: number,
	maxCharges: number,
	rechargeSeconds: number,
): ChargeState {
	let { charges, nextChargeAt } = state;
	if (charges >= maxCharges) {
		return { charges, nextChargeAt };
	}
	nextChargeAt -= math.max(0, bonusSeconds);
	while (charges < maxCharges && now >= nextChargeAt) {
		charges += 1;
		nextChargeAt += rechargeSeconds;
	}
	return { charges, nextChargeAt };
}
