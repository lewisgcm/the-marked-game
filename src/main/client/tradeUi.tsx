import React from "@rbxts/react";
import { CollectionService } from "@rbxts/services";
import { findBase } from "shared/bases";
import { countOf, Inventory, roomFor } from "shared/inventory";
import { serverSender } from "shared/net";
import { SaleRow, TradeView } from "shared/pricing";
import { GameClientMessages } from "shared/remotes";
import { TRADER_TAG } from "shared/tags";
import { saleStatus } from "shared/trade";
import { coinsStore, inventoryStore, tradeStore, useStore } from "./gameState";
import { ShopPanel, ShopRowProps } from "./shopPanel";
import { useTaken } from "./spectate";

/** A trader's list: what they sell, then what they buy. Prices and stock come from the server. */

type Send = ReturnType<typeof serverSender<GameClientMessages>>;

function saleButton(row: SaleRow, coins: number, room: number): string {
	const status = saleStatus(row, coins, room);
	if (status === "soldOut") {
		return "Sold out";
	}
	return status === "noRoom" ? "No room" : `${row.price} coins`;
}

function tradeRows(view: TradeView, coins: number, inventory: Inventory, send: Send): ShopRowProps[] {
	const rows: ShopRowProps[] = [];
	for (const sale of view.sells) {
		const room = roomFor(inventory, sale.item);
		rows.push({
			order: rows.size(),
			name: sale.count > 1 ? `${sale.item} x${sale.count}` : sale.item,
			description: `${sale.stock} left today`,
			button: saleButton(sale, coins, room),
			enabled: saleStatus(sale, coins, room) === "ok",
			onPress: () => send("TradeBuy", { base: view.base, item: sale.item }),
		});
	}
	for (const want of view.buys) {
		const have = countOf(inventory, want.item);
		rows.push({
			order: rows.size(),
			name: `Sell ${want.item.lower()}`,
			description: want.wanted ? `Wanted today!  You have ${have}` : `You have ${have}`,
			button: `Get ${want.price} ${want.price === 1 ? "coin" : "coins"}`,
			enabled: have > 0,
			highlight: want.wanted,
			onPress: () => send("TradeSell", { base: view.base, item: want.item }),
		});
	}
	return rows;
}

export function TradeUi({ remote }: { remote: RemoteEvent }) {
	const send = React.useMemo(() => serverSender<GameClientMessages>(remote), [remote]);
	const view = useStore(tradeStore);
	const coins = useStore(coinsStore);
	const inventory = useStore(inventoryStore);
	const taken = useTaken();

	if (!view || taken) {
		return undefined;
	}
	return (
		<ShopPanel
			title={`${findBase(view.base).name}  -  ${coins} coins`}
			target={CollectionService.GetTagged(TRADER_TAG).find((c) => c.GetAttribute("Base") === view.base)}
			onClose={() => tradeStore.set(undefined)}
			rows={tradeRows(view, coins, inventory, send)}
		/>
	);
}
