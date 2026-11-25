/** CollectionService tags shared between server-built worlds and client effects. */

/** PointLights that flicker like a flame or a failing bulb; clients animate them locally. */
export const FLICKER_LIGHT_TAG = "FlickerLight";

/** Invisible parts filling each door and window opening of the house: where planks go (M1). */
export const BARRICADE_SLOT_TAG = "BarricadeSlot";

/** Door and window prompts: clients show them only while the hammer is held. */
export const BUILD_PROMPT_TAG = "BuildPrompt";

/** Invisible markers outside the house where infected appear (built by world.ts, or in the Home tile). */
export const INFECTED_SPAWN_TAG = "InfectedSpawn";

/** The house's own ceiling lights (they'll follow the generator). */
export const HOUSE_LIGHT_TAG = "HouseLight";

/** Screens in the house (the living-room TV). */
export const SCREEN_TAG = "Screen";

/** Things kids can search for loot; the "Kind" attribute says what's in them (shared/items/loot.ts). */
export const LOOT_CONTAINER_TAG = "LootContainer";

/** Stone patches in gardens: pick stones up, back every dawn. */
export const STONES_TAG = "Stones";

/** Street lamps' lights: on from late afternoon until dawn. */
export const STREET_LIGHT_TAG = "StreetLight";

/** Counters kids trade at; the "Base" attribute says whose (shared/economy/bases.ts). */
export const TRADER_TAG = "Trader";

/** Garage props the later systems hook into. */
export const GENERATOR_TAG = "Generator";
export const WORKBENCH_TAG = "Workbench";
export const PLANK_PILE_TAG = "PlankPile";

/** Map tiles' markers (MAP.md): where a dormant infected stands, and where Dad waits on Day 1. */
export const DORMANT_SPOT_TAG = "DormantSpot";
export const DAD_SPOT_TAG = "DadSpot";
/** The Home tile's box showing where the family house goes (removed in the game). */
export const HOME_PLOT_TAG = "HomePlot";
