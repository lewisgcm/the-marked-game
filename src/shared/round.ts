/**
 * Public round state. The server sets these as attributes on ReplicatedStorage; clients only
 * read them to draw the countdown, clock and end screen. Times are server time
 * (`Workspace.GetServerTimeNow()`), so every client counts down in sync without the server
 * sending a message every second.
 */

/** "Banishing" is the short cutscene between a completed ritual and the end screen. */
export type RoundPhase = "Waiting" | "Countdown" | "Hunt" | "Banishing" | "Ended";
export type Winner = "Ghost" | "Hunters";

/** Why the round ended, for the end screen. */
export type EndReason = "Time" | "Banished" | "Destroyed" | "AllDead";

export const ROUND_PHASE_ATTRIBUTE = "RoundPhase";
/** Server time at which the current phase ends (Countdown and Hunt only). */
export const ROUND_ENDS_AT_ATTRIBUTE = "RoundEndsAt";
export const ROUND_WINNER_ATTRIBUTE = "RoundWinner";
export const ROUND_REASON_ATTRIBUTE = "RoundEndReason";
/** Where the banishing happens (the altar room's floor centre, a Vector3), for the cutscene camera. */
export const BANISH_SITE_ATTRIBUTE = "BanishSite";
