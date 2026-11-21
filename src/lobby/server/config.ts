/**
 * Lobby tunables, written into `ServerStorage.LobbyConfig` as IntValues at server start.
 * Code is the source of truth (see shared/serverConfig); values can be tweaked live in
 * Studio during a session. ServerStorage never replicates, so clients can't see or change them.
 */

/** Name of the Configuration instance in ServerStorage. */
export const LOBBY_CONFIG_NAME = "LobbyConfig";

/** Seconds to count down once a party has enough players. */
export const DEFAULT_COUNTDOWN = 5;

/** Minimum party size: one ghost plus at least one hunter. */
export const DEFAULT_LOWEST_PLAYERS = 2;

/** Studio-only minimum, so the pad flow can be tested solo. */
export const STUDIO_LOWEST_PLAYERS = 1;

/** Maximum party size the host can choose. */
export const DEFAULT_HIGHEST_PLAYERS = 6;

/** Seconds the host has to create the party before being kicked. */
export const DEFAULT_TIME_BEFORE_EXPIRES = 20;

/** Lobby world geometry. */
export const LOBBY_FLOOR_SIZE = 120;

/** How many teleport zones to build side by side. */
export const LOBBY_ZONE_COUNT = 3;

/** Length of one side of each teleport platform, in studs. */
export const ZONE_PLATFORM_SIZE = 10;

/** Distance between the centers of two adjacent zones, in studs. */
export const ZONE_SPACING = 30;

/** World X of teleport zone `index`; the zones are centred on the lobby along X at z = 0. */
export function zoneX(index: number): number {
	return (index - (LOBBY_ZONE_COUNT - 1) / 2) * ZONE_SPACING;
}
