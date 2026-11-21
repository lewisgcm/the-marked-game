/**
 * Melee reach: is a target within an attacker's reach and swing arc? Pure geometry, shared by
 * the client (picking what it hit, from what the player sees) and the server (validating that
 * claim from its own positions, with tolerance for network lag). Unit-tested (tests/unit).
 *
 * Follows Roblox's own pattern (Laser Tag tutorial, "Detect hits"): the client detects, the
 * server re-checks range and angle with tolerances and raycasts for walls.
 */

/** Why a swing can't hit a target, or "ok". */
export type MeleeCheck = "ok" | "tooFar" | "outsideArc";

/**
 * Checks `target` against a swing from `attacker` facing `look` (any vector; only its
 * horizontal direction is used). `reach` is in studs; `halfArcDegrees` is half the swing arc.
 * Targets almost directly above/below the attacker count as in the arc.
 */
export function checkMeleeReach(
	attacker: Vector3,
	look: Vector3,
	target: Vector3,
	reach: number,
	halfArcDegrees: number,
): MeleeCheck {
	const offset = target.sub(attacker);
	if (offset.Magnitude > reach) {
		return "tooFar";
	}
	// Horizontal (X/Z) maths on plain numbers, so this never constructs a Vector3 and runs in
	// any Luau runtime (the unit tests use Lune).
	const offsetLength = math.sqrt(offset.X * offset.X + offset.Z * offset.Z);
	const lookLength = math.sqrt(look.X * look.X + look.Z * look.Z);
	if (offsetLength < 0.5 || lookLength < 1e-6) {
		return "ok";
	}
	const cosine = (offset.X * look.X + offset.Z * look.Z) / (offsetLength * lookLength);
	return cosine >= math.cos(math.rad(halfArcDegrees)) ? "ok" : "outsideArc";
}

/** What a client may send as its swing's candidate targets: up to this many user IDs. */
export const MAX_SWING_CANDIDATES = 6;

/**
 * Parses a client's "Swing" payload: a list of user IDs, nearest first. Anything else is
 * reduced to a safe list (non-numbers dropped, NaN dropped, at most MAX_SWING_CANDIDATES).
 */
export function parseSwingCandidates(payload: unknown): number[] {
	if (!typeIs(payload, "table")) {
		return [];
	}
	const ids: number[] = [];
	for (const value of payload as unknown[]) {
		if (ids.size() >= MAX_SWING_CANDIDATES) {
			break;
		}
		if (typeIs(value, "number") && value === value) {
			ids.push(value);
		}
	}
	return ids;
}
