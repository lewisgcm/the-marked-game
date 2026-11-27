import { UpgradeId } from "shared/economy/upgrades";
import { refreshBarricades } from "../house/barricades";
import { gameConfig } from "../core/config";
import { refreshGenerator } from "../house/generator";
import { setSlots } from "../items/inventory";
import { unlockWallMap } from "../house/wallMap";

/**
 * What happens the moment each upgrade is bought. Every upgrade must be listed (leaving one out
 * doesn't compile). Upgrades that change how something works from then on need nothing here: that
 * system asks `hasUpgrade` (e.g. barricades.ts for reinforced planks). What the scrap press makes is in shared/economy/recipes.ts.
 */
export const UPGRADE_EFFECTS: Record<UpgradeId, (buyer: Player) => void> = {
	ReinforcedPlanks: () => {},
	DoorBar: () => refreshBarricades(),
	SchoolRucksack: (buyer) => setSlots(buyer, gameConfig.schoolSlots.Value),
	HikingRucksack: (buyer) => setSlots(buyer, gameConfig.hikingSlots.Value),
	TuneUp: () => refreshGenerator(),
	ScrapPress: () => {},
	WallMap: () => unlockWallMap(),
};
