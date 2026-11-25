/**
 * Positions and rotations, written the way Rojo reads a CFrame: x, y, z, then the rotation by rows.
 * Only what tiles need: moving, turning about the vertical, and standing a cylinder on end.
 */

type Row = [number, number, number];
type Rotation = [Row, Row, Row];

export class CFrame {
	readonly position: Row;
	readonly rotation: Rotation;

	constructor(
		x = 0,
		y = 0,
		z = 0,
		rotation: Rotation = [
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 1],
		],
	) {
		this.position = [x, y, z];
		this.rotation = rotation;
	}

	/** A point in this frame's space, in world space. */
	point(x: number, y: number, z: number): Row {
		const [p, m] = [this.position, this.rotation];
		return [0, 1, 2].map((i) => p[i] + m[i][0] * x + m[i][1] * y + m[i][2] * z) as Row;
	}

	/** `other`, given in this frame's space. */
	mul(other: CFrame): CFrame {
		const m = this.rotation;
		const o = other.rotation;
		const rotation = [0, 1, 2].map((i) =>
			[0, 1, 2].map((j) => m[i][0] * o[0][j] + m[i][1] * o[1][j] + m[i][2] * o[2][j]),
		) as Rotation;
		return new CFrame(...this.point(...other.position), rotation);
	}

	/** This frame moved `x, y, z` along its own axes. */
	at(x: number, y: number, z: number): CFrame {
		return this.mul(new CFrame(x, y, z));
	}

	/** Rojo's 12 numbers. */
	toArray(): number[] {
		return [...this.position, ...this.rotation.flat()].map(round);
	}
}

/** Turned `degrees` about the vertical: 90 turns -Z (the front) to -X, -90 to +X. */
export function turn(degrees: number): CFrame {
	const a = (degrees * Math.PI) / 180;
	const [c, s] = [Math.cos(a), Math.sin(a)];
	return new CFrame(0, 0, 0, [
		[c, 0, s],
		[0, 1, 0],
		[-s, 0, c],
	]);
}

/** Roblox cylinders lie along X; this stands one on end. */
export const UPRIGHT = new CFrame(0, 0, 0, [
	[0, -1, 0],
	[1, 0, 0],
	[0, 0, 1],
]);

/** To 3 decimal places, and no "-0". */
export function round(value: number): number {
	return Math.round(value * 1000) / 1000 + 0;
}
