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

/** Length of one side of a pick-up pad's zone, in studs (the pads are painted in the hall: tools/tiles/lobby). */
export const ZONE_PLATFORM_SIZE = 10;
