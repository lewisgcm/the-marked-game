/**
 * The end-of-run scoreboard: per-kid stats from the run, turned into cards with a fun title and a
 * few stat lines. Pure (no Roblox services) so it's unit-tested; the server counts the stats
 * (main/server/core/roundStats.ts) and sends the cards to everyone.
 *
 * More titles arrive with the systems that earn them (Carpenter with barricades, etc.; see
 * GAMEPLAY.md "Ending a run").
 */

export type StatName = "kills" | "hits" | "planksNailed";

export type Stats = Partial<Record<StatName, number>>;

export interface PlayerRun {
	userId: number;
	name: string;
	stats: Stats;
	/** Seconds into the run when this kid was taken; undefined if they made it. */
	takenAt?: number;
}

export interface ScoreCard {
	userId: number;
	name: string;
	title: string;
	/** What the title means, e.g. "Downed the most infected". */
	titleHint: string;
	lines: string[];
	taken: boolean;
}

const stat = (p: PlayerRun, name: StatName) => p.stats[name] ?? 0;

export function formatTime(seconds: number): string {
	const s = math.max(0, math.floor(seconds));
	const rest = s % 60;
	return `${math.floor(s / 60)}:${rest < 10 ? "0" : ""}${rest}`;
}

function plural(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

/** Titles in priority order. A kid gets the first one they win; each is given once. */
interface TitleRule {
	title: string;
	hint: string;
	/** Higher is better; undefined means this kid doesn't qualify. */
	score: (p: PlayerRun) => number | undefined;
}

const TITLES: TitleRule[] = [
	{
		title: "Slugger",
		hint: "Downed the most infected",
		score: (p) => (stat(p, "kills") > 0 ? stat(p, "kills") : undefined),
	},
	{
		title: "Carpenter",
		hint: "Nailed up the most planks",
		score: (p) => (stat(p, "planksNailed") > 0 ? stat(p, "planksNailed") : undefined),
	},
	{
		title: "First Taken",
		hint: "The infected got them first",
		// Earliest wins, so negate the time.
		score: (p) => (p.takenAt !== undefined ? -p.takenAt : undefined),
	},
];

/** How much a kid did, for ordering the cards (best first). */
function kidScore(p: PlayerRun): number {
	return stat(p, "kills") * 3 + stat(p, "hits") + math.max(0, stat(p, "planksNailed"));
}

function kidLines(p: PlayerRun): string[] {
	const lines: string[] = [];
	if (stat(p, "kills") > 0) {
		lines.push(plural(stat(p, "kills"), "infected downed", "infected downed"));
	}
	if (stat(p, "hits") > 0) {
		lines.push(plural(stat(p, "hits"), "hit", "hits"));
	}
	if (stat(p, "planksNailed") > 0) {
		lines.push(plural(stat(p, "planksNailed"), "plank nailed", "planks nailed"));
	}
	lines.push(p.takenAt !== undefined ? `First taken at ${formatTime(p.takenAt)}` : "Made it");
	return lines;
}

/** Builds the cards, best first, each kid with one title. */
export function buildScoreboard(players: PlayerRun[]): ScoreCard[] {
	const titles = new Map<number, { title: string; hint: string }>();
	for (const rule of TITLES) {
		let best: PlayerRun | undefined;
		let bestScore = -math.huge;
		for (const p of players) {
			if (titles.has(p.userId)) {
				continue;
			}
			const score = rule.score(p);
			if (score !== undefined && score > bestScore) {
				best = p;
				bestScore = score;
			}
		}
		if (best) {
			titles.set(best.userId, { title: rule.title, hint: rule.hint });
		}
	}

	const sorted = [...players];
	sorted.sort((a, b) => kidScore(a) > kidScore(b));
	return sorted.map((p) => {
		const given = titles.get(p.userId) ?? { title: "Survivor", hint: "Held on to the end" };
		return {
			userId: p.userId,
			name: p.name,
			title: given.title,
			titleHint: given.hint,
			lines: kidLines(p),
			taken: p.takenAt !== undefined,
		};
	});
}
