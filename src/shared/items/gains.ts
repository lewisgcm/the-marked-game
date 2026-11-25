import { ItemId, Stack } from "shared/items/inventory";

/**
 * "+3 Nails": what a kid just gained, worked out from their inventory before and after. Pure (only
 * type imports); client/hud/gainFeed.ts keeps the lines and inventoryHud.tsx draws them.
 */

export interface Gain {
	item: ItemId | "Coins";
	count: number;
}

export interface GainLine extends Gain {
	/** When it goes. */
	endsAt: number;
}

function totals(stacks: Stack[]): Map<ItemId, number> {
	const counts = new Map<ItemId, number>();
	for (const stack of stacks) {
		counts.set(stack.item, (counts.get(stack.item) ?? 0) + stack.count);
	}
	return counts;
}

/** What there's more of in `after`, however it's split into stacks. */
export function gainedItems(before: Stack[], after: Stack[]): Gain[] {
	const had = totals(before);
	const has = totals(after);
	const gains: Gain[] = [];
	for (const stack of after) {
		const count = (has.get(stack.item) ?? 0) - (had.get(stack.item) ?? 0);
		if (count > 0 && !gains.some((g) => g.item === stack.item)) {
			gains.push({ item: stack.item, count });
		}
	}
	return gains;
}

/** The lines still to be seen at `now`. */
export function liveGains(lines: GainLine[], now: number): GainLine[] {
	return lines.filter((line) => now < line.endsAt);
}

/** Adds to the lines: more of something still showing adds to its line. */
export function addGains(lines: GainLine[], gains: Gain[], now: number, seconds: number): GainLine[] {
	const result = liveGains(lines, now).map((line) => ({ ...line }));
	for (const gain of gains) {
		const same = result.find((line) => line.item === gain.item);
		if (same) {
			same.count += gain.count;
			same.endsAt = now + seconds;
		} else {
			result.push({ item: gain.item, count: gain.count, endsAt: now + seconds });
		}
	}
	return result;
}
