/**
 * Barricade rules for one door or window: a stack of planks, each with its own health. Pure
 * (no Roblox services) so it's unit-tested; main/server/barricades.ts owns the real state and
 * the parts.
 *
 * Planks go on in order (index 0 first); the infected wear down the outermost (last) plank, and
 * a plank at 0 health falls off. The opening is blocked while at least one plank is up.
 */

export interface Barricade {
	/** Health of each plank, innermost first. */
	planks: number[];
}

export function emptyBarricade(): Barricade {
	return { planks: [] };
}

/** What decides a new plank's health. */
export interface PlankConditions {
	base: number;
	/** 1 normally; more on Night 1. */
	firstNight: number;
	/** 1 without reinforced planks. */
	reinforced: number;
	/** Which plank of its opening it is (0-based). */
	index: number;
	/** Slots every opening has; anything past them is a door bar's. */
	normalSlots: number;
	/** How much sturdier a plank in a door bar's slot is. */
	doorBar: number;
}

export function newPlankHealth(c: PlankConditions): number {
	return c.base * c.firstNight * c.reinforced * (c.index >= c.normalSlots ? c.doorBar : 1);
}

/** Whether there's room for another plank. */
export function canAddPlank(barricade: Barricade, slots: number): boolean {
	return barricade.planks.size() < slots;
}

/** Nails a new plank with `health`. Returns false (and changes nothing) if the slots are full. */
export function addPlank(barricade: Barricade, slots: number, health: number): boolean {
	if (!canAddPlank(barricade, slots) || health <= 0) {
		return false;
	}
	barricade.planks.push(health);
	return true;
}

/** Takes the outermost plank off. Returns false if there were none. */
export function removePlank(barricade: Barricade): boolean {
	return barricade.planks.pop() !== undefined;
}

/** What one hit did: how many planks broke, and whether the opening is now open. */
export interface DamageResult {
	broken: number;
	breached: boolean;
}

/**
 * Deals `amount` damage to the outermost plank. A plank that drops to 0 falls off; any damage
 * left over is lost (one hit breaks at most one plank), so a big hit can't clear a whole stack.
 */
export function damageBarricade(barricade: Barricade, amount: number): DamageResult {
	const last = barricade.planks.size() - 1;
	if (last < 0 || amount <= 0) {
		return { broken: 0, breached: last < 0 };
	}
	barricade.planks[last] -= amount;
	if (barricade.planks[last] > 0) {
		return { broken: 0, breached: false };
	}
	barricade.planks.pop();
	return { broken: 1, breached: barricade.planks.size() === 0 };
}

/** The opening is blocked while any plank is up. */
export function isBlocked(barricade: Barricade): boolean {
	return barricade.planks.size() > 0;
}

/** How many planks a kid can pick up: limited by room in their arms and what's left in the pile. */
export function planksToTake(carrying: number, carryMax: number, inPile: number): number {
	return math.max(0, math.min(carryMax - carrying, inPile));
}
