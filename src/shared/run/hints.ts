import { DayPhase } from "shared/run/phases";

/**
 * Night 1's on-screen tips (GAMEPLAY.md §3): one short line saying what to do next. Pure so it's
 * unit-tested; main/server/run/hints.ts works out the situation and sends the result.
 */

export interface HintSituation {
	/** Tips only show on Day 1 and Night 1. */
	firstNight: boolean;
	phase: DayPhase;
	/** Planks this kid is carrying. */
	planks: number;
	/** Whether they're holding their hammer. */
	hammer: boolean;
	/** Whether any door or window has a plank up. */
	anyBoarded: boolean;
	/** Whether the generator is running. */
	powered: boolean;
	/** The opening being bashed right now, if any. */
	attacked?: string;
}

export const GRAB_PLANKS = "Grab planks from the pile in the garage.";
export const TAKE_HAMMER = "Take out your hammer to board up the windows and reinforce the doors.";
export const BOARD_UP = "Hold E at a window to nail a plank up (R at a door, to reinforce it).";
export const START_GENERATOR = "Start the generator in the garage.";
export const EXPLORE = "Search the houses on Maple Street. Be home before dark.";
export const GET_INSIDE = "Get inside. They come at night.";
export const FIGHT = "Swing the bat, or hold your flashlight on them to stun them.";

/** The tip for this situation, or undefined for none. */
export function chooseHint(s: HintSituation): string | undefined {
	if (!s.firstNight || s.phase === "Dawn") {
		return undefined;
	}
	if (s.phase === "Night") {
		return s.attacked !== undefined ? `They're at the ${s.attacked.lower()}!` : FIGHT;
	}
	if (s.planks > 0) {
		return s.hammer ? BOARD_UP : TAKE_HAMMER;
	}
	if (!s.anyBoarded) {
		return GRAB_PLANKS;
	}
	if (!s.powered) {
		return START_GENERATOR;
	}
	return s.phase === "Dusk" ? GET_INSIDE : EXPLORE;
}
