/**
 * Ranged weapons (the slingshot for now): validating a client's aim, and ammo. Pure (plain
 * numbers, no Roblox services) so it's unit-tested; main/server/slingshot.ts uses it.
 *
 * The client only says which way it's aiming; the server casts the shot itself from the kid's
 * head, so a client can't claim a hit.
 */

/**
 * A client's aim direction as a unit vector, or undefined if it's not usable (not finite, or
 * too short to have a direction). Takes the components so it works on plain numbers.
 */
export function normaliseAim(x: number, y: number, z: number): [number, number, number] | undefined {
	// NaN fails every comparison, so `!(v === v)` catches it; huge values give an infinite length.
	if (!(x === x && y === y && z === z)) {
		return undefined;
	}
	const length = math.sqrt(x * x + y * y + z * z);
	if (length < 1e-3 || length === math.huge) {
		return undefined;
	}
	return [x / length, y / length, z / length];
}

/** Whether a weapon used at `lastAt` can fire again at `now`, `cooldown` seconds apart. */
export function cooldownReady(now: number, lastAt: number | undefined, cooldown: number): boolean {
	return lastAt === undefined || now - lastAt >= cooldown;
}

/** Ammo after a dawn refill: `refill` more, but never above `max` (and never taken away). */
export function refillAmmo(current: number, refill: number, max: number): number {
	return math.max(current, math.min(max, current + refill));
}
