import { part, PartOptions } from "shared/parts";
import { Opening, wallPieces } from "shared/walls";

/** Walls and floors out of parts, for the family house (world.ts) and the street (neighbourhood.ts). */

/** Thickness of walls and slabs, in studs. */
export const THICK = 1;

/** Which way a wall runs. */
export type Axis = "X" | "Z";

/**
 * A wall along `axis` (X: runs along X at z = `at`; Z: runs along Z at x = `at`), from `from` to
 * `to`, standing on `baseY`, with `openings` cut out (positions along the wall). `frame` places
 * the whole thing (a neighbour's house is built around its own origin).
 */
export function wall(
	parent: Instance,
	axis: Axis,
	at: number,
	from: number,
	to: number,
	baseY: number,
	height: number,
	openings: Opening[],
	style: PartOptions,
	frame = new CFrame(),
) {
	for (const piece of wallPieces(from, to, height, openings)) {
		const length = piece.to - piece.from;
		const mid = (piece.from + piece.to) / 2;
		const tall = piece.top - piece.bottom;
		const y = baseY + piece.bottom + tall / 2;
		const size = axis === "X" ? new Vector3(length, tall, THICK) : new Vector3(THICK, tall, length);
		const position = axis === "X" ? new Vector3(mid, y, at) : new Vector3(at, y, mid);
		part(parent, "Wall", size, frame.mul(new CFrame(position)), style);
	}
}

/** A horizontal slab from (x0, z0) to (x1, z1), top surface at `topY`. */
export function slab(
	parent: Instance,
	name: string,
	x0: number,
	x1: number,
	z0: number,
	z1: number,
	topY: number,
	style: PartOptions,
	frame = new CFrame(),
) {
	if (x1 - x0 <= 0 || z1 - z0 <= 0) {
		return;
	}
	part(
		parent,
		name,
		new Vector3(x1 - x0, THICK, z1 - z0),
		frame.mul(new CFrame((x0 + x1) / 2, topY - THICK / 2, (z0 + z1) / 2)),
		style,
	);
}
