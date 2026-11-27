/** Melee weapons and their targets: shared names and attributes. */

export const BAT_TOOL_NAME = "Baseball Bat";
export const SLINGSHOT_TOOL_NAME = "Slingshot";

/** Melee tools the client treats as weapons (face the camera, swing on click). */
export const MELEE_TOOL_NAMES = [BAT_TOOL_NAME];

/**
 * CollectionService tag on every infected NPC model (a Model with a Humanoid). Weapons can only
 * hit models with this tag; the server checks it on every hit.
 */
export const INFECTED_TAG = "Infected";

/** Player attribute (boolean): set while a kid has been taken and is spectating. */
export const TAKEN_ATTRIBUTE = "Taken";
/** On a taken kid held at a nest (run/elimination.ts): where it is, for the wall map. */
export const HELD_AT_ATTRIBUTE = "HeldAt";
