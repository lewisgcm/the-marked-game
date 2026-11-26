import { CollectionService, Players, RunService, Workspace } from "@rbxts/services";
import { Habit, HALL_GLITCH_SECONDS, PARENT_TAG } from "shared/lobby/hall";
import { onHallGlitch, onTvGlitch } from "./hallEvents";

/**
 * Moves the parents at the pick-up pads, on each client (GAMEPLAY.md §1: "just slightly off"). Each pose is
 * code turning their R15 joints, so it needs no uploaded animations:
 *
 * - **Keys** (Mum): breathes, jingles her keys now and then, and turns her head to follow the nearest kid,
 *   a little too smoothly and for a little too long.
 * - **Coat** (a dad): the coat over his arm, looking slowly round the hall; when the TV glitches, he twitches.
 * - **Phone**: phone up, head down to it, and nothing else. Ever. Not even breathing.
 *
 * When every screen in the hall glitches at once, all of them freeze where they are. When a party's countdown
 * ends, its parent turns and walks out of the door (LeavingAt, LeaveTo: lobby/server/parents.ts), and is back
 * at the pad when the server clears it.
 */

type Joint = Motor6D | AnimationConstraint;

interface Parent {
	model: Model;
	habit: Habit;
	joints: Map<string, Joint>;
	/** Where the head's turned to (yaw), smoothed. */
	look: number;
	/** When the last twitch started. */
	twitchAt: number;
	/** When the next jingle of the keys starts. */
	jingleAt: number;
	/** Where they stand at the pad. */
	home: CFrame;
	/** Whether they were walking out last frame. */
	away: boolean;
}

/** How fast a parent walks out, and how far past the door they go. */
const WALK_SPEED = 5;
const PAST_DOOR = 8;
const TURN_SECONDS = 0.6;

const parents = new Map<Model, Parent>();
let frozenUntil = 0;

/** The joint that moves `part` (by its R15 name): a Motor6D (a plain avatar) or an AnimationConstraint (ours). */
function findJoint(model: Model, part: string): Joint | undefined {
	for (const d of model.GetDescendants()) {
		if (d.IsA("Motor6D") && d.Part1?.Name === part) return d;
		if (d.IsA("AnimationConstraint") && d.Attachment1?.Parent?.Name === part) return d;
	}
	return undefined;
}

const MOVED = [
	"Head",
	"UpperTorso",
	"LeftUpperArm",
	"LeftLowerArm",
	"RightUpperArm",
	"RightLowerArm",
	"RightHand",
	"LeftUpperLeg",
	"LeftLowerLeg",
	"RightUpperLeg",
	"RightLowerLeg",
];

function track(instance: Instance) {
	if (!instance.IsA("Model") || parents.has(instance)) return;
	const habit = instance.GetAttribute("Habit") as Habit | undefined;
	if (habit === undefined) return;
	// Joints can arrive a moment after the model.
	task.delay(1, () => {
		const joints = new Map<string, Joint>();
		for (const part of MOVED) {
			const joint = findJoint(instance, part);
			if (joint) joints.set(part, joint);
		}
		parents.set(instance, {
			model: instance,
			habit,
			joints,
			look: 0,
			twitchAt: -math.huge,
			jingleAt: os.clock() + 3,
			home: instance.GetPivot(),
			away: false,
		});
	});
}

/** The nearest player's character root to `from`, within 45 studs. */
function nearestKid(from: Vector3): Vector3 | undefined {
	let best: Vector3 | undefined;
	let bestDistance = 45;
	for (const player of Players.GetPlayers()) {
		const root = player.Character?.FindFirstChild("HumanoidRootPart");
		if (root?.IsA("BasePart")) {
			const distance = root.Position.sub(from).Magnitude;
			if (distance < bestDistance) [best, bestDistance] = [root.Position, distance];
		}
	}
	return best;
}

const angles = (pitch: number, yaw = 0, roll = 0) => CFrame.Angles(pitch, yaw, roll);

/** Each joint's pose this frame, for `parent` at time `t`. (Pitch: + swings a limb forward, tips a head back.) */
function pose(parent: Parent, t: number, dt: number): Map<string, CFrame> {
	const poses = new Map<string, CFrame>();
	const breath = math.sin(t * 1.7) * 0.018;
	if (parent.habit === "Phone") {
		// Phone up, head down to it, and nothing else.
		poses.set("RightUpperArm", angles(0.45, 0, 0.12));
		poses.set("RightLowerArm", angles(1.55));
		poses.set("RightHand", angles(0.25));
		poses.set("Head", angles(-0.42));
		return poses;
	}
	poses.set("UpperTorso", angles(breath));
	if (parent.habit === "Keys") {
		// Follows the nearest kid with her head: smooth, slow to let go, and tipped a little too far.
		const root = parent.model.PrimaryPart;
		let target = 0;
		const kid = root ? nearestKid(root.Position) : undefined;
		if (root && kid) {
			const offset = root.CFrame.PointToObjectSpace(kid);
			target = math.clamp(math.atan2(-offset.X, -offset.Z), -1.1, 1.1);
		}
		parent.look += (target - parent.look) * math.min(1, dt * 1.6);
		poses.set("Head", angles(0.04, parent.look, parent.look * 0.25));
		// The keys: now and then a jingle.
		if (t > parent.jingleAt + 0.7) parent.jingleAt = t + math.random(40, 90) / 10;
		const jingle = t > parent.jingleAt ? math.sin(t * 34) * 0.1 : 0;
		poses.set("RightUpperArm", angles(0.18));
		poses.set("RightLowerArm", angles(0.55 + jingle));
		return poses;
	}
	// Coat: the coat arm across him, looking slowly round; a twitch when the TV glitches.
	poses.set("LeftUpperArm", angles(0.2, 0, -0.08));
	poses.set("LeftLowerArm", angles(1.2));
	const since = t - parent.twitchAt;
	const twitch = since < 0.6 ? math.exp(-since * 9) : 0;
	poses.set("Head", angles(-0.05 + twitch * 0.15, math.sin(t * 0.27) * 0.45 + twitch * 0.6, twitch * 0.35));
	return poses;
}

/**
 * Walking out, `elapsed` seconds after leaving: turning round on the spot, then walking to the door and on
 * past it. Moves the model (locally) and adds the legs' and arms' swing to `poses`.
 */
function walkOut(parent: Parent, elapsed: number, poses: Map<string, CFrame>) {
	const to = parent.model.GetAttribute("LeaveTo");
	if (!typeIs(to, "Vector3")) return;
	const home = parent.home;
	const door = new Vector3(to.X, home.Y, to.Z);
	const away = door.sub(home.Position).Unit;
	const finish = door.add(away.mul(PAST_DOOR));
	// Facing the door: the model's front (-Z) along `away`.
	const facing = CFrame.lookAt(home.Position, home.Position.add(away));
	if (elapsed < TURN_SECONDS) {
		const turned = home.Lerp(facing, elapsed / TURN_SECONDS);
		parent.model.PivotTo(turned);
		return;
	}
	const walked = math.min((elapsed - TURN_SECONDS) * WALK_SPEED, finish.sub(home.Position).Magnitude);
	parent.model.PivotTo(facing.add(away.mul(walked)));
	if (walked >= finish.sub(home.Position).Magnitude) return;
	const step = math.sin(elapsed * 7);
	poses.set("LeftUpperLeg", angles(step * 0.5));
	poses.set("RightUpperLeg", angles(-step * 0.5));
	poses.set("LeftLowerLeg", angles(-math.max(0, -step) * 0.6));
	poses.set("RightLowerLeg", angles(-math.max(0, step) * 0.6));
	// The free arm swings (the other's busy: keys, coat; the phone parent's arms stay as they are).
	if (parent.habit === "Keys") poses.set("LeftUpperArm", angles(-step * 0.35));
	if (parent.habit === "Coat") poses.set("RightUpperArm", angles(-step * 0.35));
}

export function startParents() {
	CollectionService.GetTagged(PARENT_TAG).forEach(track);
	CollectionService.GetInstanceAddedSignal(PARENT_TAG).Connect(track);
	CollectionService.GetInstanceRemovedSignal(PARENT_TAG).Connect((m) => parents.delete(m as Model));
	onHallGlitch(() => (frozenUntil = os.clock() + HALL_GLITCH_SECONDS));
	onTvGlitch(() => {
		for (const [, parent] of parents) if (parent.habit === "Coat") parent.twitchAt = os.clock();
	});
	RunService.RenderStepped.Connect((dt) => {
		const t = os.clock();
		const frozen = t < frozenUntil;
		for (const [, parent] of parents) {
			const leftAt = parent.model.GetAttribute("LeavingAt");
			const leaving = typeIs(leftAt, "number");
			if (parent.away && !leaving) parent.model.PivotTo(parent.home); // back at the pad
			parent.away = leaving;
			// Frozen: every joint stays where it was (unless they're on their way out).
			if (frozen && !leaving) continue;
			const poses = pose(parent, t, dt);
			if (leaving) walkOut(parent, Workspace.GetServerTimeNow() - leftAt, poses);
			// Every joint, so one that stops moving (a leg after walking) goes back to rest.
			for (const [part, joint] of parent.joints) joint.Transform = poses.get(part) ?? new CFrame();
		}
	});
}
