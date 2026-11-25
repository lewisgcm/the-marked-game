import { Players } from "@rbxts/services";
import { PlayerRun, ScoreCard, StatName, Stats, buildScoreboard } from "shared/run/scoreboard";
import { isMember } from "./party";
import { getPhase, runElapsed } from "./round";

/**
 * Counts each kid's run stats for the end-of-run scoreboard. Systems call `recordStat` where
 * things happen (a hit, a kill...). It's a leaf module, so any system can use it without wiring.
 * Only counts while the run is being played.
 */

const stats = new Map<Player, Stats>();
const takenAt = new Map<Player, number>();

export function recordStat(player: Player | undefined, name: StatName, amount = 1) {
	if (!player || getPhase() !== "Playing") {
		return;
	}
	let entry = stats.get(player);
	if (!entry) {
		entry = {};
		stats.set(player, entry);
	}
	entry[name] = (entry[name] ?? 0) + amount;
}

/** A kid was taken: remember when, for "Taken at m:ss" and First Taken. */
export function recordTaken(player: Player) {
	if (getPhase() === "Playing" && !takenAt.has(player)) {
		takenAt.set(player, runElapsed());
	}
}

/** Builds every kid's scoreboard card. */
export function scoreboardCards(): ScoreCard[] {
	const players: PlayerRun[] = [];
	for (const player of Players.GetPlayers()) {
		if (isMember(player)) {
			players.push({
				userId: player.UserId,
				name: player.DisplayName,
				stats: stats.get(player) ?? {},
				takenAt: takenAt.get(player),
			});
		}
	}
	return buildScoreboard(players);
}
