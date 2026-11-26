/**
 * What the lobby's server and clients share about the gym hall (GAMEPLAY.md §1; the hall itself is built
 * from tools/tiles/lobby/Hall.ts).
 */

/** The parents waiting at the pads (lobby/server/parents.ts); their `Habit` says how they wait. */
export const PARENT_TAG = "LobbyParent";

/** The hall's screens (the news trolley): they glitch. */
export const SCREEN_TAG = "HallScreen";

/** Strip lights on their way out: they stutter now and then. */
export const FAULTY_LIGHT_TAG = "FaultyLight";

/**
 * An attribute on Workspace.Hall the server counts up each time every screen in the hall glitches at once;
 * each client plays it then (lobby/client/hallGlitch.ts), and the parents freeze for it.
 */
export const HALL_GLITCH_ATTRIBUTE = "Glitch";

/** How long a hall-wide glitch (and the parents' freeze) lasts, in seconds. */
export const HALL_GLITCH_SECONDS = 1.3;

/** How the parents wait (the hall's ParentSpot markers say which is at which pad). */
export type Habit = "Keys" | "Coat" | "Phone";
export const HABITS: readonly Habit[] = ["Keys", "Coat", "Phone"];
