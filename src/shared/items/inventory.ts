/**
 * The slot inventory (GAMEPLAY.md §5): a fixed number of slots, each holding a stack of one
 * item. Coins and the starter tools (flashlight, bat, slingshot, hammer) don't use slots. Pure so it's
 * unit-tested; main/server/items/inventory.ts owns the real ones.
 */

export type ItemId = "Planks" | "Nails" | "Stones" | "Food" | "Batteries" | "Scrap" | "Medkit" | "Fuel" | "Shutter";

/** How many of each item fit in one slot. */
export const STACK_SIZE: Record<ItemId, number> = {
	Planks: 5,
	Nails: 20,
	Stones: 20,
	Food: 3,
	Batteries: 4,
	Scrap: 10,
	Medkit: 1,
	Fuel: 1,
	Shutter: 1,
};

/** Items with a "Use" button (what each does: main/server/items/itemUses.ts). */
export type UsableItem = "Medkit" | "Shutter";

export function isUsable(item: ItemId): item is UsableItem {
	return item === "Medkit" || item === "Shutter";
}

export interface Stack {
	item: ItemId;
	count: number;
}

export interface Inventory {
	slots: number;
	/** The filled slots, in order; never more than `slots`. */
	stacks: Stack[];
}

export function emptyInventory(slots: number): Inventory {
	return { slots, stacks: [] };
}

export function countOf(inv: Inventory, item: ItemId): number {
	let total = 0;
	for (const stack of inv.stacks) {
		if (stack.item === item) {
			total += stack.count;
		}
	}
	return total;
}

/** How many more of `item` would fit: gaps in its stacks plus whole empty slots. */
export function roomFor(inv: Inventory, item: ItemId): number {
	let room = (inv.slots - inv.stacks.size()) * STACK_SIZE[item];
	for (const stack of inv.stacks) {
		if (stack.item === item) {
			room += STACK_SIZE[item] - stack.count;
		}
	}
	return math.max(0, room);
}

/** Adds up to `count` of `item`, topping up stacks first. Returns how many fitted. */
export function addItem(inv: Inventory, item: ItemId, count: number): number {
	const adding = math.min(math.max(0, count), roomFor(inv, item));
	let left = adding;
	for (const stack of inv.stacks) {
		if (stack.item === item) {
			const n = math.min(left, STACK_SIZE[item] - stack.count);
			stack.count += n;
			left -= n;
		}
	}
	while (left > 0) {
		const n = math.min(left, STACK_SIZE[item]);
		inv.stacks.push({ item, count: n });
		left -= n;
	}
	return adding;
}

/** Removes exactly `count` of `item` (from the last stacks first), or nothing if there aren't enough. */
export function removeItem(inv: Inventory, item: ItemId, count: number): boolean {
	if (count <= 0 || countOf(inv, item) < count) {
		return false;
	}
	let left = count;
	for (let i = inv.stacks.size() - 1; i >= 0; i--) {
		const stack = inv.stacks[i];
		if (left > 0 && stack.item === item) {
			const n = math.min(left, stack.count);
			stack.count -= n;
			left -= n;
			if (stack.count === 0) {
				inv.stacks.remove(i);
			}
		}
	}
	return true;
}

/** Empties slot `index` (0-based) and returns what was in it. */
export function takeStack(inv: Inventory, index: number): Stack | undefined {
	return inv.stacks.remove(index);
}

/** A client's slot choice: a whole number naming a filled slot, or undefined. */
export function parseSlot(payload: unknown, inv: Inventory): number | undefined {
	if (!typeIs(payload, "number") || payload !== math.floor(payload)) {
		return undefined;
	}
	return payload >= 0 && payload < inv.stacks.size() ? payload : undefined;
}
