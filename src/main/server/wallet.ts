import { Wallet } from "shared/trade";
import { addCoins, coinsOf, spendCoins } from "./coins";
import { giveItem, itemCount, itemRoom, takeItem } from "./inventory";

/** A kid's real coins and inventory, for exchanges (trading, crafting). */
export function walletOf(player: Player): Wallet {
	return {
		coins: () => coinsOf(player),
		spend: (amount) => spendCoins(player, amount),
		earn: (amount) => addCoins(player, amount),
		room: (item) => itemRoom(player, item),
		count: (item) => itemCount(player, item),
		give: (item, count) => giveItem(player, item, count),
		take: (item, count) => takeItem(player, item, count),
	};
}
