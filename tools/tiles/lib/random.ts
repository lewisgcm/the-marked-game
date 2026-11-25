/** Seeded random numbers (mulberry32), so a tile comes out the same every build. */
export class Random {
	private state: number;

	constructor(seed: number) {
		this.state = seed >>> 0;
	}

	/** 0 up to 1. */
	next(): number {
		this.state = (this.state + 0x6d2b79f5) >>> 0;
		let t = this.state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	between(low: number, high: number): number {
		return low + (high - low) * this.next();
	}
}
