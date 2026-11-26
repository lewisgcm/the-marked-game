/**
 * Lobby tunables, written into `ServerStorage.LobbyConfig` as IntValues at server start.
 * Code is the source of truth (see shared/serverConfig); values can be tweaked live in
 * Studio during a session. ServerStorage never replicates, so clients can't see or change them.
 */

/** Name of the Configuration instance in ServerStorage. */
export const LOBBY_CONFIG_NAME = "LobbyConfig";

/** Seconds to count down once a party has enough players. */
export const DEFAULT_COUNTDOWN = 5;

/** Minimum party size: solo is allowed (GAMEPLAY.md §1). */
export const DEFAULT_LOWEST_PLAYERS = 1;

/** Maximum party size the host can choose. */
export const DEFAULT_HIGHEST_PLAYERS = 6;

/** Seconds the host has to create the party before being kicked. */
export const DEFAULT_TIME_BEFORE_EXPIRES = 20;

/**
 * The parents' models (tools/blender/assets/parent_*.py), by habit: the model's asset ID once it's imported
 * (MODELLING.md → Import), 0 until then (a plain avatar stands in).
 */
export const PARENT_MODELS = { Keys: 101541542749262, Coat: 83028498644523, Phone: 82184380612314 };

/** The parents are drawn at this times their model's size (the infected's 1.1: grown-ups, over the kids). */
export const PARENT_SCALE = 1.1;

/** Seconds from the countdown's end to the teleport: the parent leads the party out and the screen fades. */
export const WALK_OUT_SECONDS = 3.5;

/** Seconds between hall-wide glitches (every screen at once; the parents freeze): a random time in this range. */
export const GLITCH_EVERY: [number, number] = [35, 75];

/** Length of one side of a pick-up pad's zone, in studs (the pads are painted in the hall: tools/tiles/lobby). */
export const ZONE_PLATFORM_SIZE = 10;
