/**
 * Barricade rules for one door or window. Pure (no Roblox services) so it's unit-tested;
 * main/server/house/barricades.ts owns the real state and the parts.
 *
 * - **Windows** start glazed. The glass goes at the first hit; behind it, a stack of planks, each with its
 *   own health. Planks go on in order (index 0 first); the infected wear down the outermost (last) plank,
 *   and a plank at 0 health falls off. A window can also have a metal shutter behind its planks: only some
 *   infected (Dad) can break it; the rest get no further, and go and find another way in.
 * - **Doors** are real doors that kids open and close. The planks are boards nailed onto the door itself, so
 *   it still opens. A closed door's boards take the hits first, then the door; at 0 it's broken (an open gap,
 *   its boards gone) until a kid fixes it. An open door lets anyone straight in.
 */

/** The tool that puts planks and shutters up. */
export const HAMMER_TOOL_NAME = "Hammer";

export interface Plank {
	health: number;
	/** What it had when it went up (a repair brings it back to this). */
	max: number;
	/** Nailed with the reinforced planks upgrade (it's drawn with metal strips). */
	reinforced: boolean;
}

/** A real door in the opening. */
export interface Door {
	health: number;
	/** What it has whole (a repair or a fix brings it back to this). */
	max: number;
	open: boolean;
	broken: boolean;
	/** How many times it's been fixed (it's drawn patched up). */
	fixes: number;
}

export interface Barricade {
	/** Innermost first. On a door, the boards nailed to it. */
	planks: Plank[];
	/** Health of its shutter, if it has one. */
	shutter?: number;
	/** A door's door; undefined for a window. */
	door?: Door;
	/** A window's glass, until it's smashed. */
	glass?: boolean;
}

export function emptyBarricade(): Barricade {
	return { planks: [] };
}

/** A glazed window. */
export function newWindow(): Barricade {
	return { planks: [], glass: true };
}

/** A whole, closed door with `health`. */
export function newDoor(health: number): Barricade {
	return { planks: [], door: { health, max: health, open: false, broken: false, fixes: 0 } };
}

/** Opens or closes a door. Returns false (and changes nothing) for a window or a broken door. */
export function toggleDoor(barricade: Barricade): boolean {
	const door = barricade.door;
	if (!door || door.broken) {
		return false;
	}
	door.open = !door.open;
	return true;
}

/** Puts a broken door back up, closed, with `health`. Returns false if it wasn't broken. */
export function fixDoor(barricade: Barricade, health: number): boolean {
	const door = barricade.door;
	if (!door || !door.broken || health <= 0) {
		return false;
	}
	door.broken = false;
	door.open = false;
	door.health = health;
	door.max = health;
	door.fixes += 1;
	return true;
}

/** What decides what a new plank is like. */
export interface PlankConditions {
	base: number;
	/** 1 normally; more on Night 1. */
	firstNight: number;
	/** Whether the party has reinforced planks... */
	reinforced: boolean;
	/** ...and how much sturdier they are. */
	reinforcedBy: number;
	/** Which plank of its opening it is (0-based). */
	index: number;
	/** Slots every opening has; anything past them is a door bar's. */
	normalSlots: number;
	/** How much sturdier a plank in a door bar's slot is. */
	doorBar: number;
}

export function newPlank(c: PlankConditions): Plank {
	const strength = (c.reinforced ? c.reinforcedBy : 1) * (c.index >= c.normalSlots ? c.doorBar : 1);
	const health = c.base * c.firstNight * strength;
	return { health, max: health, reinforced: c.reinforced };
}

/** Whether there's room for another plank (never on a broken door: fix it first). */
export function canAddPlank(barricade: Barricade, slots: number): boolean {
	return barricade.planks.size() < slots && !barricade.door?.broken;
}

/** Nails `plank` up. Returns false (and changes nothing) if the slots are full. */
export function addPlank(barricade: Barricade, slots: number, plank: Plank): boolean {
	if (!canAddPlank(barricade, slots) || plank.health <= 0) {
		return false;
	}
	barricade.planks.push(plank);
	return true;
}

/**
 * How worn the opening is, for a repair: the outermost damaged plank's health as a fraction of its max
 * (0..1), or a whole door's once its boards are all sound. Undefined if there's nothing to repair (a broken
 * door is fixed, not repaired).
 */
export function wear(barricade: Barricade): number | undefined {
	for (let i = barricade.planks.size() - 1; i >= 0; i--) {
		const plank = barricade.planks[i];
		if (plank.health < plank.max) {
			return plank.health / plank.max;
		}
	}
	const door = barricade.door;
	if (door && !door.broken && door.health < door.max) {
		return door.health / door.max;
	}
	return undefined;
}

/** Brings the outermost damaged plank (or, with none, a whole door) back to full. Returns false if nothing needed it. */
export function repair(barricade: Barricade): boolean {
	for (let i = barricade.planks.size() - 1; i >= 0; i--) {
		const plank = barricade.planks[i];
		if (plank.health < plank.max) {
			plank.health = plank.max;
			return true;
		}
	}
	const door = barricade.door;
	if (door && !door.broken && door.health < door.max) {
		door.health = door.max;
		return true;
	}
	return false;
}

/** Takes the outermost plank off. Returns false if there were none. */
export function removePlank(barricade: Barricade): boolean {
	return barricade.planks.pop() !== undefined;
}

/** Fits a shutter with `health`. Returns false (and changes nothing) if there already is one. */
export function addShutter(barricade: Barricade, health: number): boolean {
	if (barricade.shutter !== undefined || health <= 0) {
		return false;
	}
	barricade.shutter = health;
	return true;
}

/** What one hit did. */
export interface DamageResult {
	/** How many planks broke. */
	broken: number;
	/** Whether the opening is open now. */
	breached: boolean;
	/** Whether this hit is what opened it. */
	opened: boolean;
}

/**
 * Deals `amount` damage. A window's glass goes first, at one hit. Then the outermost plank: one that drops
 * to 0 falls off; any damage left over is lost (one hit breaks at most one plank), so a big hit can't clear a
 * whole stack. With no planks left, the hit lands on a door (at 0 it's broken, and open), or on a window's
 * shutter, which only `breaksShutters` can hurt. An open or broken door takes no damage: they just walk in.
 */
export function damageBarricade(barricade: Barricade, amount: number, breaksShutters: boolean): DamageResult {
	const wasBlocked = isBlocked(barricade);
	const last = barricade.planks.size() - 1;
	const door = barricade.door;
	let broken = 0;
	if (amount <= 0 || (door && (door.open || door.broken))) {
		// Nothing to break.
	} else if (barricade.glass) {
		barricade.glass = false;
	} else if (last >= 0) {
		barricade.planks[last].health -= amount;
		if (barricade.planks[last].health <= 0) {
			barricade.planks.pop();
			broken = 1;
		}
	} else if (door) {
		door.health -= amount;
		if (door.health <= 0) {
			door.health = 0;
			door.broken = true;
		}
	} else if (barricade.shutter !== undefined && breaksShutters) {
		const left = barricade.shutter - amount;
		barricade.shutter = left > 0 ? left : undefined;
	}
	const breached = !isBlocked(barricade);
	return { broken, breached, opened: wasBlocked && breached };
}

/** A door is blocked while it's shut and whole; a window while its glass, any plank, or a shutter is there. */
export function isBlocked(barricade: Barricade): boolean {
	const door = barricade.door;
	if (door) {
		return !door.open && !door.broken;
	}
	return barricade.glass === true || barricade.planks.size() > 0 || barricade.shutter !== undefined;
}

/** Whether anything's been put up on it: a plank or a shutter (not just a door, or glass). */
export function isBoarded(barricade: Barricade): boolean {
	return barricade.planks.size() > 0 || barricade.shutter !== undefined;
}

/** Whether an infected gets anywhere by attacking: something to break, and no shutter it can't. */
export function isWorthAttacking(barricade: Barricade, breaksShutters: boolean): boolean {
	if (barricade.door || barricade.glass || barricade.planks.size() > 0) {
		return true;
	}
	return barricade.shutter === undefined || breaksShutters;
}

/** How many planks a kid can pick up: limited by room in their arms and what's left in the pile. */
export function planksToTake(carrying: number, carryMax: number, inPile: number): number {
	return math.max(0, math.min(carryMax - carrying, inPile));
}
