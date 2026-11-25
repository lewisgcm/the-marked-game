import { UsableItem } from "shared/inventory";
import { fitShutter } from "./barricades";
import { gameConfig } from "./config";
import { healKid } from "./health";

/**
 * What using each usable item does: undefined if it worked (one is used up), or why it didn't.
 * Every usable item must be listed (leaving one out doesn't compile).
 */
export const ITEM_USES: Record<UsableItem, (player: Player) => string | undefined> = {
	Medkit: (player) => (healKid(player, gameConfig.medkitHeal.Value) ? undefined : "You're not hurt."),
	Shutter: (player) => fitShutter(player),
};
