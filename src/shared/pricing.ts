import { Base, BaseId } from "shared/bases";
import { ItemId } from "shared/inventory";

/**
 * What things cost at the bases (GAMEPLAY.md §7), what each wants today, and the list a kid is
 * shown. Pure (only type imports); main/server/trading.ts works the list out and the client only
 * draws it.
 */

/** What a base wants today: it pays extra for this many, then its usual price. */
export interface Order {
	item: ItemId;
	/** How many more it wants; 0 once it's filled. */
	left: number;
}

/** A base's day so far. */
export interface Stall {
	order?: Order;
	/** Lots left of each thing it sells. */
	stock: Map<ItemId, number>;
}

/** "1 coin", "6 coins". */
export function coinsText(count: number): string {
	return count === 1 ? "1 coin" : `${count} coins`;
}

/** A base's price on this day: scarce goods go up by `rise` of the Day 1 price every day. */
export function salePrice(price: number, day: number, scarce: boolean, rise: number): number {
	return scarce ? math.round(price * (1 + rise * math.max(0, day - 1))) : price;
}

/** What a base pays for one that's on order. */
export function orderPrice(price: number, multiplier: number): number {
	return math.max(price, math.round(price * multiplier));
}

/**
 * What a base wants today: one of `items`, but not what another base already wants (`taken`), nor
 * the same as yesterday, as far as that's possible. `roll` is 0..1.
 */
export function pickWanted(items: ItemId[], yesterday: ItemId | undefined, taken: ItemId[], roll: number): ItemId {
	const free = items.filter((item) => !taken.includes(item));
	const pool = free.size() > 0 ? free : items;
	const fresh = pool.filter((item) => item !== yesterday);
	const choices = fresh.size() > 0 ? fresh : pool;
	return choices[math.min(choices.size() - 1, math.floor(roll * choices.size()))];
}

/** A whole number from `fewest` to `most`; `roll` is 0..1. */
export function rollCount(fewest: number, most: number, roll: number): number {
	return math.min(most, fewest + math.floor(roll * (most - fewest + 1)));
}

/** Morning: full stock and a new order. `random` gives 0..1. */
export function startStallDay(
	stall: Stall,
	base: Base,
	taken: ItemId[],
	fewest: number,
	most: number,
	random: () => number,
) {
	for (const offer of base.sells) {
		stall.stock.set(offer.item, offer.stock);
	}
	const items = base.buys.map((want) => want.item);
	stall.order = {
		item: pickWanted(items, stall.order?.item, taken, random()),
		left: rollCount(fewest, most, random()),
	};
}

/** One thing on sale, at today's price. */
export interface SaleRow {
	item: ItemId;
	count: number;
	price: number;
	stock: number;
}

/** One thing the base buys. */
export interface BuyRow {
	item: ItemId;
	/** The usual price for one. */
	price: number;
	/** How many it still has on order... */
	wanted: number;
	/** ...and what it pays for each of those. */
	orderPrice: number;
}

export interface TradeView {
	base: BaseId;
	/** Whether it's trading right now. */
	open: boolean;
	sells: SaleRow[];
	buys: BuyRow[];
}

/** A base's list on a given day. */
export function tradeView(
	base: Base,
	day: number,
	open: boolean,
	stall: Stall,
	rise: number,
	multiplier: number,
): TradeView {
	return {
		base: base.id,
		open,
		sells: base.sells.map((offer) => ({
			item: offer.item,
			count: offer.count,
			price: salePrice(offer.price, day, offer.scarce === true, rise),
			stock: stall.stock.get(offer.item) ?? 0,
		})),
		buys: base.buys.map((want) => ({
			item: want.item,
			price: want.price,
			wanted: stall.order !== undefined && stall.order.item === want.item ? stall.order.left : 0,
			orderPrice: orderPrice(want.price, multiplier),
		})),
	};
}
