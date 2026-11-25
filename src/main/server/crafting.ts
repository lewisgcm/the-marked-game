import { craft, parseRecipe, RecipeStatus } from "shared/recipes";
import { UpgradeId } from "shared/upgrades";
import { walletOf } from "./wallet";

/** Making things from scrap at the workbench (list and rules in shared/recipes.ts). */

export interface CraftingHooks {
	/** Whether `player` is at the workbench and may use it. */
	canUseWorkbench: (player: Player) => boolean;
	/** The upgrades a kid has: the party's and their own. */
	upgradesOf: (player: Player) => UpgradeId[];
	notify: (player: Player, text: string) => void;
}

const REFUSAL: Record<RecipeStatus, string | undefined> = {
	ok: undefined, // what they made shows beside the inventory
	unknown: undefined, // not on their list
	needsScrap: "You need more scrap. Try garages and cars.",
	tooExpensive: "You can't afford that.",
	noRoom: "Your pockets are full.",
};

let hooks: CraftingHooks | undefined;

/** "Make" in the workbench's list: `payload` should be a recipe's ID (unknown — validated). */
export function onCraftRequest(player: Player, payload: unknown) {
	const recipe = parseRecipe(payload);
	if (!hooks || !recipe || !hooks.canUseWorkbench(player)) {
		return;
	}
	const refusal = REFUSAL[craft(recipe, hooks.upgradesOf(player), walletOf(player))];
	if (refusal !== undefined) {
		hooks.notify(player, refusal);
	}
}

export function startCrafting(craftingHooks: CraftingHooks) {
	hooks = craftingHooks;
}
