import { Base, BaseId } from "shared/bases";
import { ItemId } from "shared/inventory";
import { SaleRow } from "shared/pricing";

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
