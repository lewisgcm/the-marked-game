import { isAlive } from "./life";
import { getMembers, isMember } from "./party";
import { getPhase } from "./round";

/** Who can do what, combining the party (party.ts), life (life.ts) and the run phase (round.ts). */

/** Kids still in the run (not taken). */
export function livingKids(): Player[] {
	return getMembers().filter((p) => isAlive(p));
}

/** Whether the run is being played (after the countdown, before the end screen). */
export function isPlaying(): boolean {
	return getPhase() === "Playing";
}

/** A kid who's still in, while the run is being played: may use prompts and weapons. */
export function canKidAct(player: Player): boolean {
	return isMember(player) && isAlive(player) && isPlaying();
}
