import { Base, BaseId } from "shared/bases";
import { ItemId } from "shared/inventory";

/**
 * What things cost at the bases (GAMEPLAY.md §7), and the list a kid is shown. Pure so it's
 * unit-tested; main/server/trading.ts works the list out and the client only draws it.
 */

/** A base's price on this day: scarce goods go up by `rise` of the Day 1 price every day. */
export function salePrice(price: number, day: number, scarce: boolean, rise: number): number {
	return scarce ? math.round(price * (1 + rise * math.max(0, day - 1))) : price;
}

/** What a base pays for one: more if it's today's want. */
export function buyPrice(price: number, wanted: boolean, multiplier: number): number {
	return wanted ? math.max(price, math.round(price * multiplier)) : price;
}

/** Today's want: any of `items` except yesterday's. `roll` is 0..1. */
export function pickWanted(items: ItemId[], yesterday: ItemId | undefined, roll: number): ItemId {
	const fresh = items.filter((item) => item !== yesterday);
	const choices = fresh.size() > 0 ? fresh : items;
	return choices[math.min(choices.size() - 1, math.floor(roll * choices.size()))];
}

/** One thing on sale, at today's price. */
export interface SaleRow {
	item: ItemId;
	count: number;
	price: number;
	stock: number;
}

/** One thing the base buys, at today's price for one. */
export interface BuyRow {
	item: ItemId;
	price: number;
	wanted: boolean;
}

export interface TradeView {
	base: BaseId;
	sells: SaleRow[];
	buys: BuyRow[];
}

/** A base's stall on a given day. `stockOf` is how many lots of an item are left. */
export function tradeView(
	base: Base,
	day: number,
	wanted: ItemId | undefined,
	stockOf: (item: ItemId) => number,
	rise: number,
	wantMultiplier: number,
): TradeView {
	return {
		base: base.id,
		sells: base.sells.map((offer) => ({
			item: offer.item,
			count: offer.count,
			price: salePrice(offer.price, day, offer.scarce === true, rise),
			stock: stockOf(offer.item),
		})),
		buys: base.buys.map((want) => ({
			item: want.item,
			price: buyPrice(want.price, want.item === wanted, wantMultiplier),
			wanted: want.item === wanted,
		})),
	};
}
