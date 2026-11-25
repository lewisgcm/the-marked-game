import { Workspace } from "@rbxts/services";
import { MainWorld } from "../world/world";
import { Infected, InfectedHooks, Mode } from "./types";

/** Who's around, and what the rest of the game told us at start. Used by the other infected modules. */

export const alive = new Map<Model, Infected>();
export const holder = new Instance("Folder");
holder.Name = "Infected";
holder.Parent = Workspace;

let hooks: InfectedHooks | undefined;
let world: MainWorld | undefined;

export function setUpState(mainWorld: MainWorld, infectedHooks: InfectedHooks) {
	world = mainWorld;
	hooks = infectedHooks;
}

export function getHooks(): InfectedHooks {
	assert(hooks, "the infected haven't been started");
	return hooks;
}

export function getWorld(): MainWorld {
	assert(world, "the infected haven't been started");
	return world;
}

/** Whether Dad is in the world, awake or dormant. */
export function isDadAround(): boolean {
	for (const [, inf] of alive) {
		if (inf.isDad) {
			return true;
		}
	}
	return false;
}

/** Infected on the move (dormant ones don't count towards MaxInfected). */
export function activeCount(): number {
	let count = 0;
	for (const [, inf] of alive) {
		if (inf.mode !== "dormant") {
			count += 1;
		}
	}
	return count;
}

export function setMode(inf: Infected, mode: Mode) {
	inf.mode = mode;
	inf.modeSince = os.clock();
	inf.waypoints = [];
	inf.pathGoal = undefined;
}
