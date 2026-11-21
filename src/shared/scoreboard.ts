/**
 * The end-of-round scoreboard: per-player stats from the round, turned into cards with a fun
 * title and a few stat lines. Pure (no Roblox services) so it's unit-tested; the server counts
 * the stats (main/server/roundStats.ts) and sends the cards to everyone.
 */

export type StatName =
	// Hunters
	| "keys"
	| "chests"
	| "items"
	| "lightSeconds"
	| "pokerHits"
	| "trapCatches"
	| "panics"
	| "banisher"
	| "killingBlow"
	// Ghost
	| "kills"
	| "screamHits"
	| "lampsOut"
	| "damageTaken";

export type Stats = Partial<Record<StatName, number>>;

export interface PlayerRound {
	userId: number;
	name: string;
	role: "Ghost" | "Hunter";
	stats: Stats;
	/** Seconds into the hunt when a hunter was killed; undefined if they survived. */
	diedAt?: number;
}

export interface ScoreCard {
	userId: number;
	name: string;
	role: "Ghost" | "Hunter";
	title: string;
	/** What the title means, e.g. "Held the final banish". */
	titleHint: string;
	lines: string[];
	dead: boolean;
}

export interface RoundSummary {
	/** Did the ghost win? */
	ghostWon: boolean;
	/** Seconds the hunt lasted. */
	huntSeconds: number;
}

const stat = (p: PlayerRound, name: StatName) => p.stats[name] ?? 0;

export function formatTime(seconds: number): string {
	const s = math.max(0, math.floor(seconds));
	const rest = s % 60;
	return `${math.floor(s / 60)}:${rest < 10 ? "0" : ""}${rest}`;
}

function plural(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

/** Hunter titles in priority order. A hunter gets the first one they win; each is given once. */
interface TitleRule {
	title: string;
	hint: string;
	/** Higher is better; undefined means this hunter doesn't qualify. */
	score: (p: PlayerRound) => number | undefined;
}

const HUNTER_TITLES: TitleRule[] = [
	{ title: "The Banisher", hint: "Held the final banish", score: (p) => (stat(p, "banisher") > 0 ? 1 : undefined) },
	{
		title: "Ghostbuster",
		hint: "Landed the final blow",
		score: (p) => (stat(p, "killingBlow") > 0 ? 1 : undefined),
	},
	{
		title: "First to Fall",
		hint: "The ghost got them first",
		// Earliest death wins, so negate the time.
		score: (p) => (p.diedAt !== undefined ? -p.diedAt : undefined),
	},
	{
		title: "Spotlight",
		hint: "Kept the ghost in the light",
		score: (p) => (stat(p, "lightSeconds") >= 3 ? stat(p, "lightSeconds") : undefined),
	},
	{
		title: "Locksmith",
		hint: "Opened the most chests",
		score: (p) => (stat(p, "chests") > 0 ? stat(p, "chests") : undefined),
	},
	{
		title: "Trapper",
		hint: "Caught the ghost in a trap",
		score: (p) => (stat(p, "trapCatches") > 0 ? stat(p, "trapCatches") : undefined),
	},
	{
		title: "Scaredy Cat",
		hint: "Panicked the most",
		score: (p) => (stat(p, "panics") > 0 ? stat(p, "panics") : undefined),
	},
];

/** How much a hunter did, for ordering the cards (best first). */
function hunterScore(p: PlayerRound): number {
	return (
		stat(p, "banisher") * 10 +
		stat(p, "killingBlow") * 10 +
		stat(p, "items") * 3 +
		stat(p, "chests") * 2 +
		stat(p, "keys") +
		stat(p, "pokerHits") * 2 +
		stat(p, "trapCatches") * 3 +
		stat(p, "lightSeconds") / 5
	);
}

function hunterLines(p: PlayerRound): string[] {
	const lines: string[] = [];
	if (stat(p, "keys") > 0 || stat(p, "chests") > 0) {
		lines.push(`${plural(stat(p, "keys"), "key", "keys")}, ${plural(stat(p, "chests"), "chest", "chests")}`);
	}
	if (stat(p, "items") > 0) {
		lines.push(`${plural(stat(p, "items"), "item", "items")} on the altar`);
	}
	if (stat(p, "lightSeconds") >= 1) {
		lines.push(`Lit the ghost ${math.floor(stat(p, "lightSeconds"))}s`);
	}
	if (stat(p, "pokerHits") > 0) {
		lines.push(plural(stat(p, "pokerHits"), "poker hit", "poker hits"));
	}
	if (stat(p, "trapCatches") > 0) {
		lines.push(`Trapped it ${plural(stat(p, "trapCatches"), "time", "times")}`);
	}
	const kept = lines.filter((_, i) => i < 2);
	kept.push(p.diedAt !== undefined ? `Died at ${formatTime(p.diedAt)}` : "Survived");
	return kept;
}

function ghostCard(p: PlayerRound, hunters: PlayerRound[], summary: RoundSummary): ScoreCard {
	const kills = stat(p, "kills");
	let title = summary.ghostWon ? "Phantom" : "Lost Soul";
	let hint = summary.ghostWon ? "Haunted the house to the end" : "Sent back to the other side";
	if (hunters.size() > 0 && kills >= hunters.size()) {
		[title, hint] = ["The Reaper", "Took every hunter"];
	} else if (stat(p, "damageTaken") === 0 && summary.huntSeconds >= 60) {
		[title, hint] = ["Untouchable", "Never got hit"];
	} else if (stat(p, "screamHits") >= 3) {
		[title, hint] = ["Banshee", "Screamed in the most faces"];
	} else if (stat(p, "lampsOut") >= 3) {
		[title, hint] = ["Blackout", "Put out the lights"];
	}

	const lines = [
		plural(kills, "hunter killed", "hunters killed"),
		`${plural(stat(p, "screamHits"), "scream hit", "scream hits")}, ${plural(stat(p, "lampsOut"), "lamp", "lamps")} out`,
		stat(p, "damageTaken") > 0 ? `Took ${stat(p, "damageTaken")} damage` : "Never hit",
	];
	return { userId: p.userId, name: p.name, role: "Ghost", title, titleHint: hint, lines, dead: false };
}

/** Builds the cards: the ghost first, then hunters best first, each with one title. */
export function buildScoreboard(players: PlayerRound[], summary: RoundSummary): ScoreCard[] {
	const hunters = players.filter((p) => p.role === "Hunter");
	const titles = new Map<number, { title: string; hint: string }>();

	for (const rule of HUNTER_TITLES) {
		let best: PlayerRound | undefined;
		let bestScore = -math.huge;
		for (const hunter of hunters) {
			if (titles.has(hunter.userId)) {
				continue;
			}
			const score = rule.score(hunter);
			if (score !== undefined && score > bestScore) {
				best = hunter;
				bestScore = score;
			}
		}
		if (best) {
			titles.set(best.userId, { title: rule.title, hint: rule.hint });
		}
	}

	const cards: ScoreCard[] = [];
	for (const p of players) {
		if (p.role === "Ghost") {
			cards.push(ghostCard(p, hunters, summary));
		}
	}
	const sorted = [...hunters];
	sorted.sort((a, b) => hunterScore(a) > hunterScore(b));
	for (const p of sorted) {
		const given =
			titles.get(p.userId) ??
			(p.diedAt !== undefined
				? { title: "Haunted", hint: "Fell to the ghost" }
				: { title: "Survivor", hint: "Made it out alive" });
		cards.push({
			userId: p.userId,
			name: p.name,
			role: "Hunter",
			title: given.title,
			titleHint: given.hint,
			lines: hunterLines(p),
			dead: p.diedAt !== undefined,
		});
	}
	return cards;
}
