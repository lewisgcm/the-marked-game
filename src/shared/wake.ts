/**
 * What wakes a dormant infected (one frozen in front of a screen by day). Pure so it's
 * unit-tested; main/server/infected/ asks it for the nearest kid.
 *
 * It stares at its screen, so you can slip past behind it; crossing in front, bumping into it,
 * or a torch beam wakes it. (Noise and being hit wake it too: infected/.)
 */

export interface WakeSituation {
	/** Distance to the kid, in studs. */
	distance: number;
	/** Cosine of the angle between where it's looking and the kid (1 = straight ahead). */
	facing: number;
	/** Nothing solid in between. */
	canSee: boolean;
	/** A flashlight beam is on it. */
	lit: boolean;
}

export interface WakeSettings {
	/** How far it notices a kid in front of it. */
	sightRange: number;
	/** Half its field of view, in degrees. */
	halfAngle: number;
	/** Any kid this close wakes it, whichever way it faces. */
	touchRange: number;
}

export function shouldWake(s: WakeSituation, settings: WakeSettings): boolean {
	if (s.lit) {
		return true;
	}
	if (!s.canSee) {
		return false;
	}
	if (s.distance <= settings.touchRange) {
		return true;
	}
	return s.distance <= settings.sightRange && s.facing >= math.cos(math.rad(settings.halfAngle));
}
