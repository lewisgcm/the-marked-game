import { aliveHumanoidOf } from "shared/core/characters";
import { hitFlash } from "../core/effects";
import { recordStat } from "../core/roundStats";

/**
 * What every weapon does once it has decided it hit an infected: takes the health off (their
 * Humanoid's, which only the server changes), flashes it, and counts the hit. Returns what
 * happened, for the hit marker; undefined if it was already down.
 */
export function damageInfected(attacker: Player, target: Model, amount: number): "Hit" | "Kill" | undefined {
	const humanoid = aliveHumanoidOf(target);
	if (!humanoid) {
		return undefined;
	}
	humanoid.Health = math.max(0, humanoid.Health - amount);
	hitFlash(target);
	recordStat(attacker, "hits");
	if (humanoid.Health > 0) {
		return "Hit";
	}
	recordStat(attacker, "kills");
	return "Kill";
}
