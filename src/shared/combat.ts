/** The ghost's knife, the hunters' weapon and ghost health: shared names and state. */

export const KNIFE_TOOL_NAME = "Knife";
export const WEAPON_TOOL_NAME = "Fire Poker";

/** ReplicatedStorage attributes (numbers): the ghost's current and maximum health. */
export const GHOST_HEALTH_ATTRIBUTE = "GhostHealth";
export const GHOST_MAX_HEALTH_ATTRIBUTE = "GhostMaxHealth";

/** Player attribute (boolean): set when a hunter has been killed by the ghost and is spectating. */
export const DEAD_ATTRIBUTE = "Dead";

/** The ghost's knife window (opened by a scream), sent to the ghost whenever it changes. */
export interface AttackWindowState {
	/** Seconds left to use the knife, if the window is open now. */
	activeFor?: number;
}
