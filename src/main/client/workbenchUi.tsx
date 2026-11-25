import React from "@rbxts/react";
import { CollectionService } from "@rbxts/services";
import { serverSender } from "shared/net";
import { countOf, Inventory, roomFor } from "shared/inventory";
import { coinsText } from "shared/pricing";
import { isKnown, Recipe, RECIPES, recipeStatus, RecipeStatus } from "shared/recipes";
import { GameClientMessages } from "shared/remotes";
import { WORKBENCH_TAG } from "shared/tags";
import { findUpgrade, Upgrade, UpgradeId, UPGRADES, UpgradeStatus, upgradeStatus } from "shared/upgrades";
import { coinsStore, inventoryStore, upgradesStore, useStore, workbenchOpenStore } from "./gameState";
import { ShopPanel, ShopRowProps } from "./shopPanel";
import { useTaken } from "./spectate";

/** The workbench's list, opened by its prompt: things to make from scrap, then upgrades. */

function buttonText(upgrade: Upgrade, status: UpgradeStatus): string {
	if (status === "owned") {
		return "Owned";
	}
	if (status === "needsOther" && upgrade.needs) {
		return `Needs ${findUpgrade(upgrade.needs).name.lower()}`;
	}
	return coinsText(upgrade.cost);
}

function makeButton(recipe: Recipe, status: RecipeStatus): string {
	if (status === "noRoom") {
		return "No room";
	}
	if (status === "needsScrap") {
		return "Needs scrap";
	}
	return recipe.coins > 0 ? coinsText(recipe.coins) : "Make";
}

/** What can be made. Press recipes join the list once the party has the press. */
function recipeRows(
	coins: number,
	inventory: Inventory,
	owned: UpgradeId[],
	make: (recipe: Recipe) => void,
): ShopRowProps[] {
	const scrap = countOf(inventory, "Scrap");
	return RECIPES.filter((recipe) => isKnown(recipe, owned)).map((recipe, i) => {
		const status = recipeStatus(recipe, owned, { coins, scrap, room: roomFor(inventory, recipe.makes) });
		return {
			order: i,
			name: recipe.count > 1 ? `${recipe.name} x${recipe.count}` : recipe.name,
			description: `Uses ${recipe.scrap} scrap. You have ${scrap}`,
			button: makeButton(recipe, status),
			enabled: status === "ok",
			onPress: () => make(recipe),
		};
	});
}

export function WorkbenchUi({ remote }: { remote: RemoteEvent }) {
	const send = React.useMemo(() => serverSender<GameClientMessages>(remote), [remote]);
	const open = useStore(workbenchOpenStore);
	const coins = useStore(coinsStore);
	const owned = useStore(upgradesStore);
	const inventory = useStore(inventoryStore);
	const taken = useTaken();

	if (!open || taken) {
		return undefined;
	}
	const recipes = recipeRows(coins, inventory, owned, (recipe) => send("Craft", recipe.id));
	return (
		<ShopPanel
			title={`Workbench  -  ${coinsText(coins)}`}
			target={CollectionService.GetTagged(WORKBENCH_TAG)[0]}
			onClose={() => workbenchOpenStore.set(false)}
			rows={[
				...recipes,
				...UPGRADES.map((upgrade, i) => {
					const status = upgradeStatus(upgrade.id, coins, owned);
					return {
						order: recipes.size() + i,
						name: upgrade.name,
						description: upgrade.description,
						button: buttonText(upgrade, status),
						enabled: status === "ok",
						onPress: () => send("BuyUpgrade", upgrade.id),
					};
				}),
			]}
		/>
	);
}
