import { ItemId } from "shared/inventory";
import { Wallet } from "shared/trade";
import { UpgradeId } from "shared/upgrades";

/**
 * What kids can make at the workbench from scrap (GAMEPLAY.md "Workbench upgrades"). Pure (only type
 * imports), and used by both sides: the server (main/server/crafting.ts) decides; the client draws the
 * list. Adding something to make is an ID and an entry here.
 *
 * Bases never buy what's made here, and pressing never beats buying. The spec checks both.
 */

export type RecipeId = "Shutter" | "PressNails" | "PressStones";

export interface Recipe {
	id: RecipeId;
	name: string;
	/** Coins it costs, as well as the scrap. */
	coins: number;
	scrap: number;
	makes: ItemId;
	count: number;
	/** The party must have this first. */
	needs?: UpgradeId;
}

export const RECIPES: Recipe[] = [
	{ id: "Shutter", name: "Window shutter", coins: 30, scrap: 5, makes: "Shutter", count: 1 },
	{ id: "PressNails", name: "Press nails", coins: 0, scrap: 2, makes: "Nails", count: 3, needs: "ScrapPress" },
	{ id: "PressStones", name: "Press stones", coins: 0, scrap: 2, makes: "Stones", count: 8, needs: "ScrapPress" },
];

/** Whether a recipe is on the list at all: it isn't until the party has what it needs. */
export function isKnown(recipe: Recipe, owned: UpgradeId[]): boolean {
	return recipe.needs === undefined || owned.includes(recipe.needs);
}

/** Whether something can be made, or why not. */
export type RecipeStatus = "ok" | "unknown" | "needsScrap" | "tooExpensive" | "noRoom";

/** What a kid has to make something with. `room` is how many more of what it makes they can carry. */
export interface Means {
	coins: number;
	scrap: number;
	room: number;
}

export function recipeStatus(recipe: Recipe, owned: UpgradeId[], means: Means): RecipeStatus {
	if (!isKnown(recipe, owned)) {
		return "unknown";
	}
	if (means.scrap < recipe.scrap) {
		return "needsScrap";
	}
	if (means.coins < recipe.coins) {
		return "tooExpensive";
	}
	return means.room >= recipe.count ? "ok" : "noRoom";
}

/** Makes one: the kid pays and gets it. Nothing happens unless "ok". */
export function craft(recipe: Recipe, owned: UpgradeId[], wallet: Wallet): RecipeStatus {
	const means = { coins: wallet.coins(), scrap: wallet.count("Scrap"), room: wallet.room(recipe.makes) };
	const status = recipeStatus(recipe, owned, means);
	if (status !== "ok") {
		return status;
	}
	if (!wallet.take("Scrap", recipe.scrap)) {
		return "needsScrap";
	}
	if (recipe.coins > 0 && !wallet.spend(recipe.coins)) {
		wallet.give("Scrap", recipe.scrap);
		return "tooExpensive";
	}
	wallet.give(recipe.makes, recipe.count);
	return "ok";
}

/** A client's choice: a real recipe, or undefined. */
export function parseRecipe(payload: unknown): Recipe | undefined {
	return RECIPES.find((r) => r.id === payload);
}
