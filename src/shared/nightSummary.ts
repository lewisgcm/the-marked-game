/**
 * The dawn summary card: what last night cost. Pure so it's unit-tested; main/server/nightReport.ts
 * counts and sends it.
 */

export interface NightTally {
	planksLost: number;
	infectedDowned: number;
	/** Names of kids taken during the night. */
	taken: string[];
}

export interface NightSummary {
	title: string;
	lines: string[];
}

export function emptyTally(): NightTally {
	return { planksLost: 0, infectedDowned: 0, taken: [] };
}

/** Notes that `name` was taken; a kid taken twice in a night is listed once. */
export function addTaken(tally: NightTally, name: string) {
	if (!tally.taken.includes(name)) {
		tally.taken.push(name);
	}
}

export function summarise(night: number, tally: NightTally): NightSummary {
	return {
		title: `NIGHT ${night} SURVIVED`,
		lines: [
			`Infected downed: ${tally.infectedDowned}`,
			`Planks lost: ${tally.planksLost}`,
			tally.taken.size() > 0 ? `Taken: ${tally.taken.join(", ")}` : "Nobody was taken",
		],
	};
}
