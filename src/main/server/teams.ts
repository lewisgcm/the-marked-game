import { Players } from "@rbxts/services";
import { isAlive } from "./life";
import { getRole } from "./roles";
import { getPhase } from "./round";

/** Who's who, combining roles (roles.ts), life (life.ts) and the round phase (round.ts). */

/** Every hunter in the server, alive or dead. */
export function allHunters(): Player[] {
	return Players.GetPlayers().filter((p) => getRole(p) === "Hunter");
}

/** Hunters still in the round (not killed by the ghost). */
export function livingHunters(): Player[] {
	return allHunters().filter((p) => isAlive(p));
}

/** Whether the hunt is running (after the countdown, before the end screen). */
export function isHunting(): boolean {
	return getPhase() === "Hunt";
}

/** A living hunter during the hunt: may use prompts, traps, weapons. */
export function canHunterAct(player: Player): boolean {
	return getRole(player) === "Hunter" && isAlive(player) && isHunting();
}
