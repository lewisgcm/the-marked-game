import { UsableItem } from "shared/items/inventory";
import { fitShutter } from "../house/barricades";
import { gameConfig } from "../core/config";
import { healKid } from "../combat/health";

/**
 * What using each usable item does: undefined if it worked (one is used up), or why it didn't.
 * Every usable item must be listed (leaving one out doesn't compile).
 */
export const ITEM_USES: Record<UsableItem, (player: Player) => string | undefined> = {
	Medkit: (player) => (healKid(player, gameConfig.medkitHeal.Value) ? undefined : "You're not hurt."),
	Shutter: (player) => fitShutter(player),
};
