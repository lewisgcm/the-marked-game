import { Clock } from "shared/phases";

/**
 * How each phase change is announced: the less the better. Pure (only type imports); client/
 * roundHud.tsx draws it. Dawn has its own card (client/dawnCard.tsx), and Day 1 the title card.
 */

export interface Announcement {
	/** The big title in the middle of the screen. */
	banner: boolean;
	/** The line of advice under it. */
	advice: boolean;
	/** The clock swells for a moment instead. */
	pulse: boolean;
	chime: boolean;
}

/** The last day and night that still get advice. */
export const ADVICE_NIGHTS = 2;

export function announcementFor(clock: Clock): Announcement {
	if (clock.phase === "Day" && clock.night === 1) {
		return { banner: false, advice: false, pulse: false, chime: false };
	}
	const banner = clock.phase === "Day" || clock.phase === "Night";
	return { banner, advice: banner && clock.night <= ADVICE_NIGHTS, pulse: clock.phase === "Dusk", chime: true };
}
