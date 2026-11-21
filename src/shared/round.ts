/**
 * Public run state. The server sets these as attributes on ReplicatedStorage; clients only
 * read them to draw the countdown, clock and end screen. Times are server time
 * (`Workspace.GetServerTimeNow()`), so every client counts down in sync without the server
 * sending a message every second.
 *
 * M0 placeholder: a single timed "Playing" phase. The day/night clock replaces it in M1.
 */

export type RunPhase = "Waiting" | "Countdown" | "Playing" | "Ended";

/** Why the run ended, for the end screen. */
export type EndReason = "Time" | "AllTaken";

export const RUN_PHASE_ATTRIBUTE = "RunPhase";
/** Server time at which the current phase ends (Countdown, Playing and Ended). */
export const RUN_ENDS_AT_ATTRIBUTE = "RunEndsAt";
export const RUN_REASON_ATTRIBUTE = "RunEndReason";
