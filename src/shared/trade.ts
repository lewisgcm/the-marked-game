import { Base, BaseId } from "shared/bases";
import { ItemId } from "shared/inventory";
import { BuyRow, SaleRow, Stall } from "shared/pricing";

/**
 * The rules for trading at a base. Pure (only type imports), and used by both sides: the server
 * (main/server/trading.ts) decides; the client greys out what it can't do.
 */

/** Whether something on sale can be bought, or why not. `room` is how many more the kid can carry. */
export type SaleStatus = "ok" | "soldOut" | "tooExpensive" | "noRoom";

export function saleStatus(row: SaleRow, coins: number, room: number): SaleStatus {
	if (row.stock <= 0) {
		return "soldOut";
	}
	if (coins < row.price) {
		return "tooExpensive";
	}
	return room >= row.count ? "ok" : "noRoom";
}

/** A kid's side of a trade. The server's is their real coins and inventory. */
export interface Wallet {
	coins: () => number;
	/** Takes exactly this much, or nothing. */
	spend: (amount: number) => boolean;
	earn: (amount: number) => void;
	/** How many more of an item they can carry. */
	room: (item: ItemId) => number;
	count: (item: ItemId) => number;
	give: (item: ItemId, count: number) => void;
	/** Takes exactly this many, or nothing. */
	take: (item: ItemId, count: number) => boolean;
}

/** Buys one lot: the kid pays and gets it, and the stall has one fewer. Nothing happens unless "ok". */
export function buyLot(row: SaleRow, stall: Stall, wallet: Wallet): SaleStatus {
	const status = saleStatus(row, wallet.coins(), wallet.room(row.item));
	if (status !== "ok") {
		return status;
	}
	if (!wallet.spend(row.price)) {
		return "tooExpensive";
	}
	stall.stock.set(row.item, row.stock - 1);
	wallet.give(row.item, row.count);
	return "ok";
}

/** How many one press sells: all that's on order, otherwise one. `have` is how many the kid has. */
export function sellCount(row: BuyRow, have: number): number {
	return math.min(have, math.max(1, row.wanted));
}

/** What the base pays for each right now. */
export function unitPrice(row: BuyRow): number {
	return row.wanted > 0 ? row.orderPrice : row.price;
}

/** Sells what one press sells: the kid is paid, and it counts towards the order. Returns how many. */
export function sellItems(row: BuyRow, stall: Stall, wallet: Wallet): number {
	const count = sellCount(row, wallet.count(row.item));
	if (count <= 0 || !wallet.take(row.item, count)) {
		return 0;
	}
	wallet.earn(count * unitPrice(row));
	if (row.wanted > 0 && stall.order) {
		stall.order.left -= count;
	}
	return count;
}

/** Whether a base is trading: from its first day, and never at night. */
export function isTrading(base: Base, day: number, isNight: boolean, openAll: boolean): boolean {
	return !isNight && (openAll || day >= base.opens);
}

/** What a client asks to buy or sell. Never a price or an amount: the server knows those. */
export interface TradeRequest {
	base: BaseId;
	item: ItemId;
}

/** A client's request, if it names one of `bases` and something that base sells or buys. */
export function parseTradeRequest(payload: unknown, bases: Base[]): TradeRequest | undefined {
	if (!typeIs(payload, "table")) {
		return undefined;
	}
	const { base: id, item } = payload as { base?: unknown; item?: unknown };
	const base = bases.find((b) => b.id === id);
	const traded = base && (base.sells.find((o) => o.item === item) ?? base.buys.find((w) => w.item === item));
	return base && traded ? { base: base.id, item: traded.item } : undefined;
}
