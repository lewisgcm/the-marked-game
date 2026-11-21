/** How the ghost looks, shared by the server (what hunters see) and the ghost's own client. */

/** Ghost body parts as replicated by the server while hidden: fully invisible to hunters. */
export const GHOST_HIDDEN_TRANSPARENCY = 1;

/** Ghost body parts while revealed (by a flashlight or trap): a faint, see-through figure. */
export const GHOST_REVEALED_TRANSPARENCY = 0.45;

/**
 * How the ghost sees *itself* while hidden. Applied only on the ghost's own client, so the
 * player can tell where their character is without making it visible to anyone else.
 */
export const GHOST_SELF_TRANSPARENCY = 0.7;

/** Ghost's tint while revealed, so a reveal reads instantly. */
export const GHOST_REVEALED_COLOR = new Color3(0.75, 0.85, 1);
