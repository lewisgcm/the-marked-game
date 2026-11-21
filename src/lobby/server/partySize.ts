/**
 * The party size a host asked for, made safe. The value comes from the client, so it can be
 * anything: non-numbers and NaN fall back to `lowest`, fractions round down, and the result
 * is always within `lowest`..`highest`. Pure, so it's unit-tested (tests/unit).
 */
export function parsePartySize(requested: unknown, lowest: number, highest: number): number {
	// `requested === requested` rejects NaN.
	const size = typeIs(requested, "number") && requested === requested ? math.floor(requested) : lowest;
	return math.clamp(size, lowest, highest);
}
