/**
 * Public run state. The server sets these as attributes on ReplicatedStorage; clients only
 * read them to draw the title card, the day/night clock and the end screen. Times are server
 * time (`Workspace.GetServerTimeNow()`), so every client counts down in sync without the server
 * sending a message every second.
 */

/**
 * The run as a whole: "Starting" is the "DAY 1" title card (everyone frozen) while the party
 * settles in; "Playing" is the day/night clock (see shared/run/phases.ts).
 */
export type RunPhase = "Waiting" | "Starting" | "Playing" | "Ended";

/** Why the run ended, for the end screen. */
export type EndReason = "AllTaken";

export const RUN_PHASE_ATTRIBUTE = "RunPhase";
export const RUN_REASON_ATTRIBUTE = "RunEndReason";

/** The day/night clock while playing: phase ("Day" | "Dusk" | "Night" | "Dawn") and night number. */
export const DAY_PHASE_ATTRIBUTE = "DayPhase";
export const NIGHT_ATTRIBUTE = "Night";
/** Server time at which the current phase (run or day/night) ends. */
export const PHASE_ENDS_AT_ATTRIBUTE = "PhaseEndsAt";
/** Nights fully survived so far (a night counts once its dawn arrives). */
export const NIGHTS_SURVIVED_ATTRIBUTE = "NightsSurvived";
