import { Workspace } from "@rbxts/services";
import { rootOf } from "shared/characters";
import { Entry } from "../world";
import { flatDistance } from "./movement";
import { getHooks, getWorld, holder } from "./state";
import { Infected } from "./types";

/** What an infected knows: the nearest opening, the nearest kid, and whether it can see them. */

/** Just outside an opening, at ground level. */
export function outsidePoint(entry: Entry): Vector3 {
	const p = entry.cframe.Position.add(entry.cframe.LookVector.mul(3));
	return new Vector3(p.X, 3, p.Z);
}

/** Just inside an opening. */
export function insidePoint(entry: Entry): Vector3 {
	const p = entry.cframe.Position.sub(entry.cframe.LookVector.mul(4));
	return new Vector3(p.X, 3, p.Z);
}

export function nearestEntry(from: Vector3): Entry | undefined {
	let best: Entry | undefined;
	let bestDistance = math.huge;
	for (const entry of getWorld().entries) {
		const d = flatDistance(from, outsidePoint(entry));
		if (d < bestDistance) {
			best = entry;
			bestDistance = d;
		}
	}
	return best;
}

export function nearestKid(from: Vector3): { player: Player; root: BasePart; distance: number } | undefined {
	let best: { player: Player; root: BasePart; distance: number } | undefined;
	for (const player of getHooks().getKids()) {
		const root = rootOf(player.Character);
		if (!root) {
			continue;
		}
		const distance = root.Position.sub(from).Magnitude;
		if (!best || distance < best.distance) {
			best = { player, root, distance };
		}
	}
	return best;
}

/** Nothing solid between the infected's head and the kid. */
export function canSee(inf: Infected, kid: Player): boolean {
	const target = rootOf(kid.Character);
	if (!target) {
		return false;
	}
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	const ignore: Instance[] = [holder];
	if (kid.Character) {
		ignore.push(kid.Character);
	}
	params.FilterDescendantsInstances = ignore;
	const from = inf.root.Position.add(new Vector3(0, 1.5, 0));
	return Workspace.Raycast(from, target.Position.sub(from), params) === undefined;
}
