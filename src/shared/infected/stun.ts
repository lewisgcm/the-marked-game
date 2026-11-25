/**
 * The flashlight stun (GAMEPLAY.md §5): hold a beam on an infected for a moment and it's
 * stunned for a couple of seconds, then it shrugs off beams for a while (so a group of kids
 * can't keep one stunned forever). Pure so it's unit-tested; main/server/infected/ steps it
 * every think.
 */

export interface StunState {
	/** Seconds the beam has been on it, continuously. */
	litFor: number;
	/** Stunned until this time (0 if not). */
	stunnedUntil: number;
	/** Ignores beams until this time. */
	immuneUntil: number;
}

export interface StunSettings {
	/** Seconds of beam needed to stun. */
	litSeconds: number;
	/** How long the stun lasts. */
	stunSeconds: number;
	/** How long after a stun ends before beams work again. */
	immuneSeconds: number;
}

export function newStun(): StunState {
	return { litFor: 0, stunnedUntil: 0, immuneUntil: 0 };
}

/**
 * Advances the stun by `dt` seconds at time `now`, with `lit` saying whether any beam is on it.
 * Returns true if a new stun started this step.
 */
export function stepStun(state: StunState, lit: boolean, dt: number, now: number, settings: StunSettings): boolean {
	if (now < state.stunnedUntil || now < state.immuneUntil || !lit) {
		state.litFor = 0;
		return false;
	}
	state.litFor += dt;
	if (state.litFor < settings.litSeconds) {
		return false;
	}
	state.litFor = 0;
	state.stunnedUntil = now + settings.stunSeconds;
	state.immuneUntil = state.stunnedUntil + settings.immuneSeconds;
	return true;
}

export function isStunned(state: StunState, now: number): boolean {
	return now < state.stunnedUntil;
}
