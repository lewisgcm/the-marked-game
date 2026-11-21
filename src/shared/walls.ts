/**
 * Cutting a straight wall into pieces around its doors and windows. Pure (plain numbers, no
 * Roblox services) so it's unit-tested; main/server/world.ts turns the pieces into parts.
 *
 * Positions run along the wall (`start` to `finish`); heights are from the wall's base.
 */

export interface Opening {
	/** Centre of the opening along the wall. */
	center: number;
	width: number;
	/** Bottom of the opening (0 for a door, the sill height for a window). */
	bottom: number;
	/** Top of the opening (the lintel). */
	top: number;
}

/** One solid rectangle of wall. */
export interface WallPiece {
	from: number;
	to: number;
	bottom: number;
	top: number;
}

/** Pieces narrower than this are dropped (an opening flush with the wall's end). */
const MIN_PIECE = 0.01;

/**
 * The solid pieces of a wall from `start` to `finish`, `height` tall, with `openings` cut out:
 * full-height pieces between openings, plus a sill below and a lintel above each opening where
 * there's wall left. Openings may be given in any order; they shouldn't overlap.
 */
export function wallPieces(start: number, finish: number, height: number, openings: Opening[]): WallPiece[] {
	const sorted = [...openings];
	sorted.sort((a, b) => a.center < b.center);
	const pieces: WallPiece[] = [];
	const add = (from: number, to: number, bottom: number, top: number) => {
		if (to - from > MIN_PIECE && top - bottom > MIN_PIECE) {
			pieces.push({ from, to, bottom, top });
		}
	};
	let cursor = start;
	for (const opening of sorted) {
		const left = math.max(start, opening.center - opening.width / 2);
		const right = math.min(finish, opening.center + opening.width / 2);
		add(cursor, left, 0, height);
		add(left, right, 0, opening.bottom); // sill
		add(left, right, opening.top, height); // lintel
		cursor = right;
	}
	add(cursor, finish, 0, height);
	return pieces;
}
