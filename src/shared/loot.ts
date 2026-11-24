import { ItemId } from "shared/inventory";

/**
 * What's in the cupboards (GAMEPLAY.md §5, "How ammo gets harder to find"). Pure, with the random
 * numbers passed in, so it's unit-tested; main/server/containers.ts rolls it when a kid searches.
 */

export type ContainerKind = "Kitchen" | "Drawers" | "Garage" | "Car";
export type LootId = ItemId | "Coins";

export interface Loot {
	item: LootId;
	count: number;
}

interface LootEntry {
	item: LootId;
	weight: number;
	min: number;
	max: number;
}

export const LOOT_TABLES: Record<ContainerKind, LootEntry[]> = {
	Kitchen: [
		{ item: "Food", weight: 5, min: 1, max: 2 },
		{ item: "Batteries", weight: 2, min: 1, max: 2 },
		{ item: "Coins", weight: 3, min: 1, max: 4 },
		{ item: "Medkit", weight: 1, min: 1, max: 1 },
	],
	Drawers: [
		{ item: "Coins", weight: 5, min: 2, max: 5 },
		{ item: "Batteries", weight: 3, min: 1, max: 2 },
		{ item: "Nails", weight: 1, min: 2, max: 4 },
	],
	Garage: [
		{ item: "Nails", weight: 5, min: 4, max: 10 },
		{ item: "Planks", weight: 4, min: 2, max: 4 },
		{ item: "Scrap", weight: 3, min: 1, max: 4 },
	],
	Car: [
		{ item: "Coins", weight: 4, min: 1, max: 4 },
		{ item: "Scrap", weight: 3, min: 1, max: 3 },
		{ item: "Medkit", weight: 1, min: 1, max: 1 },
		{ item: "Nails", weight: 2, min: 3, max: 6 },
	],
};

/** Items that get scarcer every night. (Stones never run out; bullets join in M5.) */
const AMMO: LootId[] = ["Nails"];

/** How much of the usual ammo turns up: 100% on Night 1, 40% by Night 10, 25% from Night 20. */
export function ammoScale(night: number): number {
	if (night <= 10) {
		return 1 - 0.6 * (math.clamp(night - 1, 0, 9) / 9);
	}
	return 0.4 - 0.15 * (math.clamp(night - 10, 0, 10) / 10);
}

/** Picks an entry by weight; `roll` is 0..1. */
function pick(entries: LootEntry[], roll: number): LootEntry {
	let total = 0;
	for (const entry of entries) {
		total += entry.weight;
	}
	let at = roll * total;
	for (const entry of entries) {
		at -= entry.weight;
		if (at < 0) {
			return entry;
		}
	}
	return entries[entries.size() - 1];
}

/**
 * Searches one container: one find, or two about half the time. `random` gives 0..1. Ammo that
 * loses its scarcity roll is just not there.
 */
export function rollLoot(kind: ContainerKind, night: number, random: () => number): Loot[] {
	const finds: Loot[] = [];
	const rolls = random() < 0.5 ? 2 : 1;
	for (let i = 0; i < rolls; i++) {
		const entry = pick(LOOT_TABLES[kind], random());
		const count = math.min(entry.max, entry.min + math.floor(random() * (entry.max - entry.min + 1)));
		if (AMMO.includes(entry.item) && random() >= ammoScale(night)) {
			continue;
		}
		const same = finds.find((f) => f.item === entry.item);
		if (same) {
			same.count += count;
		} else {
			finds.push({ item: entry.item, count });
		}
	}
	return finds;
}

/** "Found 3 nails and 2 coins.", or that there was nothing. */
export function describeLoot(finds: Loot[]): string {
	if (finds.size() === 0) {
		return "Nothing useful.";
	}
	return `Found ${finds.map((f) => `${f.count} ${f.item.lower()}`).join(" and ")}.`;
}
