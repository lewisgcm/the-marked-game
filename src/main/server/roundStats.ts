import { Players } from "@rbxts/services";
import { PlayerRound, ScoreCard, StatName, Stats, buildScoreboard } from "shared/scoreboard";
import { getPhase, huntElapsed } from "./round";

/**
 * Counts each player's round stats for the end-of-round scoreboard. The systems call
 * `recordStat` where things happen (a key picked up, a poker hit, a lamp put out...). It's a leaf
 * module — it imports nothing but the round clock — so any system can use it without wiring.
 * Only counts during the hunt.
 */

const stats = new Map<Player, Stats>();
const deaths = new Map<Player, number>();

export function recordStat(player: Player | undefined, name: StatName, amount = 1) {
	if (!player || getPhase() !== "Hunt") {
		return;
	}
	let entry = stats.get(player);
	if (!entry) {
		entry = {};
		stats.set(player, entry);
	}
	entry[name] = (entry[name] ?? 0) + amount;
}

/** A hunter was killed: remember when, for "Died at m:ss" and First to Fall. */
export function recordDeath(player: Player) {
	if (getPhase() === "Hunt" && !deaths.has(player)) {
		deaths.set(player, huntElapsed());
	}
}

/** Builds everyone's scoreboard card. `roleOf` says who played what (undefined = not in the round). */
export function scoreboardCards(
	roleOf: (player: Player) => "Ghost" | "Hunter" | undefined,
	ghostWon: boolean,
): ScoreCard[] {
	const players: PlayerRound[] = [];
	for (const player of Players.GetPlayers()) {
		const role = roleOf(player);
		if (role) {
			players.push({
				userId: player.UserId,
				name: player.DisplayName,
				role,
				stats: stats.get(player) ?? {},
				diedAt: deaths.get(player),
			});
		}
	}
	return buildScoreboard(players, { ghostWon, huntSeconds: huntElapsed() });
}
