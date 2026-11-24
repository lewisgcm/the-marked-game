/**
 * Fitting the inventory's slots on the screen. Pure so it's unit-tested; client/inventoryHud.tsx
 * draws it.
 */

/** Screens whose shorter side is at most this get Roblox's small jump button. */
const SMALL_SCREEN = 500;
/** How far Roblox's jump button reaches up from the bottom, plus a gap, in pixels. */
const JUMP_SMALL = 100;
const JUMP_LARGE = 220;
/** With a mouse there's no jump button; this much of the height is plenty. */
const MOUSE_SHARE = 0.8;

/** Height the inventory can take, in pixels: below the top bar, and above the jump button on touch. */
export function inventorySpace(width: number, height: number, topBar: number, touch: boolean): number {
	const usable = height - topBar;
	if (!touch) {
		return usable * MOUSE_SHARE;
	}
	return usable - (math.min(width, height) <= SMALL_SCREEN ? JUMP_SMALL : JUMP_LARGE);
}

export interface SlotGrid {
	rows: number;
	columns: number;
}

/** Slots in as few columns as fit in `space`, each slot `cell` tall, with at most `most` rows. */
export function slotGrid(slots: number, space: number, cell: number, most: number): SlotGrid {
	const fits = math.clamp(math.floor(space / cell), 1, most);
	const columns = math.max(1, math.ceil(slots / fits));
	return { rows: math.ceil(slots / columns), columns };
}
