import { ItemId } from "shared/items/inventory";

/**
 * The bases kids trade with (GAMEPLAY.md §7), and what each sells and buys. Adding an item to a
 * base is an entry here; a new base also needs its place in the world (main/server/world/bases.ts).
 *
 * Bases never buy what a base sells (no buying from one to sell to another), nor planks and stones,
 * which are free at home every dawn. The spec checks this.
 */

export type BaseId = "Treehouse" | "FireStation";

/** Something a base sells. */
export interface Offer {
	item: ItemId;
	/** How many you get. */
	count: number;
	/** Coins for the lot, on Day 1. */
	price: number;
	/** How many lots it has each day, for the whole party. */
	stock: number;
	/** The price rises every day. */
	scarce?: boolean;
}

/** Something a base buys. */
export interface Want {
	item: ItemId;
	/** Coins for one, when it isn't on order. */
	price: number;
}

export interface Base {
	id: BaseId;
	name: string;
	/** Kids' bases never turn; adult ones do (M4). */
	kind: "Kids" | "Adults";
	trader: string;
	/** Where it is, for notices. */
	where: string;
	/** What it says over the walkie the morning it opens. */
	hello: string;
	/** The first day it trades. */
	opens: number;
	sells: Offer[];
	buys: Want[];
}

export const BASES: Base[] = [
	{
		id: "Treehouse",
		name: "Treehouse",
		kind: "Kids",
		trader: "Treehouse Gang",
		where: "the left end of Maple Street",
		hello: "Anyone there? We're in the treehouse, left end of Maple Street. Come and trade!",
		opens: 2,
		sells: [
			{ item: "Stones", count: 20, price: 4, stock: 3 },
			{ item: "Nails", count: 10, price: 6, stock: 3, scarce: true },
			{ item: "Planks", count: 5, price: 5, stock: 3 },
		],
		buys: [
			{ item: "Food", price: 2 },
			{ item: "Batteries", price: 2 },
			{ item: "Scrap", price: 1 },
		],
	},
	{
		id: "FireStation",
		name: "Fire Station",
		kind: "Adults",
		trader: "Fire Chief",
		where: "the right end of Maple Street",
		hello: "Fire Station here, right end of Maple Street. We've got fuel and medkits.",
		opens: 3,
		sells: [
			{ item: "Fuel", count: 1, price: 15, stock: 2 },
			{ item: "Medkit", count: 1, price: 10, stock: 3 },
		],
		buys: [
			{ item: "Batteries", price: 3 },
			{ item: "Food", price: 1 },
			{ item: "Scrap", price: 2 },
		],
	},
];

export function findBase(id: BaseId): Base {
	return BASES.find((b) => b.id === id)!;
}
