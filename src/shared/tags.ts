/** CollectionService tags shared between server-built worlds and client effects. */

/** PointLights that flicker like a flame or a failing bulb; clients animate them locally. */
export const FLICKER_LIGHT_TAG = "FlickerLight";

/** Invisible parts filling each door and window opening of the house: where planks go (M1). */
export const BARRICADE_SLOT_TAG = "BarricadeSlot";

/** Invisible markers outside the house where infected appear. */
export const INFECTED_SPAWN_TAG = "InfectedSpawn";

/** The house's own ceiling lights (they'll follow the generator). */
export const HOUSE_LIGHT_TAG = "HouseLight";

/** Screens in the house (the living-room TV). */
export const SCREEN_TAG = "Screen";

/** Garage props the later systems hook into. */
export const GENERATOR_TAG = "Generator";
export const WORKBENCH_TAG = "Workbench";
export const PLANK_PILE_TAG = "PlankPile";
