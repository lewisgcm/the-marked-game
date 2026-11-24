import { PathfindingService } from "@rbxts/services";
import { Infected } from "./types";

/** Getting about: facing, walking straight, and following paths. */

const PATH_REFRESH_SECONDS = 1;

export function flat(v: Vector3): Vector3 {
	return new Vector3(v.X, 0, v.Z);
}

export function flatDistance(a: Vector3, b: Vector3): number {
	return flat(a).sub(flat(b)).Magnitude;
}

export function face(inf: Infected, point: Vector3) {
	const look = flat(point.sub(inf.root.Position));
	if (look.Magnitude > 0.1) {
		inf.root.CFrame = CFrame.lookAt(inf.root.Position, inf.root.Position.add(look));
	}
}

export function stop(inf: Infected) {
	inf.humanoid.MoveTo(inf.root.Position);
}

/** Walks straight at `point`, jumping if it's been stuck for a moment (sills, furniture). */
export function walkTo(inf: Infected, point: Vector3) {
	inf.humanoid.MoveTo(point);
	const now = os.clock();
	if (inf.root.Position.sub(inf.lastPosition).Magnitude > 0.5) {
		inf.lastPosition = inf.root.Position;
		inf.stuckSince = now;
	} else if (now - inf.stuckSince > 1) {
		inf.humanoid.Jump = true;
		inf.stuckSince = now;
	}
}

/** Follows a path to `goal`, recomputing it every second or so. False if there's no way there. */
export function pathTo(inf: Infected, goal: Vector3): boolean {
	const now = os.clock();
	const goalMoved = !inf.pathGoal || inf.pathGoal.sub(goal).Magnitude > 5;
	if (goalMoved || now - inf.lastPathAt > PATH_REFRESH_SECONDS) {
		inf.lastPathAt = now;
		inf.pathGoal = goal;
		const path = PathfindingService.CreatePath({ AgentRadius: 2, AgentHeight: 5, AgentCanJump: true });
		const [ok] = pcall(() => path.ComputeAsync(inf.root.Position, goal));
		if (!ok || path.Status !== Enum.PathStatus.Success) {
			inf.waypoints = [];
			return false;
		}
		inf.waypoints = path.GetWaypoints();
		inf.waypointIndex = 1; // [0] is where it's standing
	}
	const waypoint = inf.waypoints[inf.waypointIndex];
	if (!waypoint) {
		walkTo(inf, goal);
		return true;
	}
	if (flatDistance(inf.root.Position, waypoint.Position) < 3) {
		inf.waypointIndex += 1;
	}
	if (waypoint.Action === Enum.PathWaypointAction.Jump) {
		inf.humanoid.Jump = true;
	}
	walkTo(inf, waypoint.Position);
	return true;
}
