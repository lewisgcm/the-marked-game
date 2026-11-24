import React from "@rbxts/react";
import { CollectionService } from "@rbxts/services";
import { serverSender } from "shared/net";
import { GameClientMessages } from "shared/remotes";
import { WORKBENCH_TAG } from "shared/tags";
import { findUpgrade, Upgrade, UPGRADES, UpgradeStatus, upgradeStatus } from "shared/upgrades";
import { coinsStore, upgradesStore, useStore, workbenchOpenStore } from "./gameState";
import { ShopPanel } from "./shopPanel";
import { useTaken } from "./spectate";

/** The workbench's list, opened by its prompt. */

function buttonText(upgrade: Upgrade, status: UpgradeStatus): string {
	if (status === "owned") {
		return "Owned";
	}
	if (status === "needsOther" && upgrade.needs) {
		return `Needs ${findUpgrade(upgrade.needs).name.lower()}`;
	}
	return `${upgrade.cost} coins`;
}

export function WorkbenchUi({ remote }: { remote: RemoteEvent }) {
	const send = React.useMemo(() => serverSender<GameClientMessages>(remote), [remote]);
	const open = useStore(workbenchOpenStore);
	const coins = useStore(coinsStore);
	const owned = useStore(upgradesStore);
	const taken = useTaken();

	if (!open || taken) {
		return undefined;
	}
	return (
		<ShopPanel
			title={`Workbench  -  ${coins} coins`}
			target={CollectionService.GetTagged(WORKBENCH_TAG)[0]}
			onClose={() => workbenchOpenStore.set(false)}
			rows={UPGRADES.map((upgrade, i) => {
				const status = upgradeStatus(upgrade.id, coins, owned);
				return {
					order: i,
					name: upgrade.name,
					description: upgrade.description,
					button: buttonText(upgrade, status),
					enabled: status === "ok",
					onPress: () => send("BuyUpgrade", upgrade.id),
				};
			})}
		/>
	);
}
