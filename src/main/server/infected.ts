import { CollectionService, PathfindingService, Players, ServerStorage, Workspace } from "@rbxts/services";
import { INFECTED_TAG } from "shared/combat";
import { isStunned, newStun, StunState, stepStun } from "shared/stun";
import { infectedHealth, planNight, Wave } from "shared/waves";
import { damageEntry, isEntryBlocked } from "./barricades";
import { gameConfig } from "./config";
import { Entry, isInsideHouse, MainWorld } from "./world";

/**
 * The infected (shamblers for now), server-controlled. Waves come at night (shared/waves.ts),
 * from the spawn markers on all four sides, and retreat at dawn.
 *
 * Each one runs a small loop a few times a second:
 *  - **approach** the nearest door or window from outside (or a kid it can see),
 *  - **bash** it while it's boarded (barricades.ts wears the planks down),
 *  - **enter** once it's open (climbing in through windows),
 *  - **chase** the nearest kid with pathfinding, hitting them when in reach. If there's no way
 *    in to a kid (everything boarded), it goes back to bashing the nearest opening.
 *
 * A flashlight held on one for a moment **stuns** it for a couple of seconds (shared/stun.ts):
 * it stops dead, its eyes dim, then it shrugs off beams for a while.
 *
 * Bodies: an R15 rig made from a plain HumanoidDescription, greyed out, with glowing red eyes.
 * Brought to 0 health (the bat; combat.ts), it dissolves into static. Dad is one of them: he
 * can be knocked down, never killed — he's back the next night.
 */

export interface InfectedHooks {
	/** Kids who can be chased and hit (still in, with a character). */
	getKids: () => Player[];
	damageKid: (player: Player, amount: number) => void;
	/** A message for every kid, e.g. "The front door is broken!". */
	notifyAll: (text: string) => void;
	/** Whether this is Night 1 (the infected hit softer). */
	isFirstNight: () => boolean;
	/** Whether any kid's flashlight beam is on `model` right now. */
	isLit: (model: Model) => boolean;
}

type Mode = "approach" | "enter" | "chase" | "retreat";

interface Infected {
	model: Model;
	humanoid: Humanoid;
	root: BasePart;
	isDad: boolean;
	mode: Mode;
	entry?: Entry;
	waypoints: PathWaypoint[];
	waypointIndex: number;
	lastPathAt: number;
	pathGoal?: Vector3;
	lastHitAt: number;
	modeSince: number;
	lastPosition: Vector3;
	stuckSince: number;
	stun: StunState;
	eyes: BasePart[];
}

const THINK_SECONDS = 0.2;
const PATH_REFRESH_SECONDS = 1;
const RETREAT_SECONDS = 15;
const SKIN = new Color3(0.52, 0.55, 0.5);
const DAD_SHIRT = new Color3(0.25, 0.32, 0.45);
const EYE_COLOR = new Color3(1, 0.08, 0.05);
const STUNNED_EYE_COLOR = new Color3(0.3, 0.05, 0.05);
/** The default R15 walk animation. */
const WALK_ANIMATION = "rbxassetid://507777826";
const HIT_SOUND = "rbxasset://sounds/swordlunge.wav";

let hooks: InfectedHooks | undefined;
let world: MainWorld | undefined;
let template: Model | undefined;
const alive = new Map<Model, Infected>();
const holder = new Instance("Folder");
holder.Name = "Infected";
holder.Parent = Workspace;
/** Bumped every night and at dawn, so waves scheduled for an old night don't spawn. */
let generation = 0;
let dadAround = false;

/** Builds the body every infected is cloned from. Yields (the rig is made by Roblox). */
function buildTemplate(): Model | undefined {
	const description = new Instance("HumanoidDescription");
	description.HeadColor = SKIN;
	description.TorsoColor = SKIN;
	description.LeftArmColor = SKIN;
	description.RightArmColor = SKIN;
	description.LeftLegColor = SKIN.Lerp(new Color3(0, 0, 0), 0.3);
	description.RightLegColor = SKIN.Lerp(new Color3(0, 0, 0), 0.3);
	const [ok, result] = pcall(() => Players.CreateHumanoidModelFromDescription(description, Enum.HumanoidRigType.R15));
	if (!ok || !typeIs(result, "Instance") || !result.IsA("Model")) {
		warn(`[Infected] Couldn't build the infected body: ${result}`);
		return undefined;
	}
	const model = result;
	model.Name = "Infected";
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
		humanoid.BreakJointsOnDeath = false;
	}
	const head = model.FindFirstChild("Head");
	if (head && head.IsA("BasePart")) {
		head.FindFirstChild("face")?.Destroy(); // no friendly face
		for (const x of [-0.2, 0.2]) {
			const eye = new Instance("Part");
			eye.Name = "Eye";
			eye.Size = new Vector3(0.22, 0.12, 0.05);
			eye.Material = Enum.Material.Neon;
			eye.Color = EYE_COLOR;
			eye.CanCollide = false;
			eye.CanQuery = false;
			eye.Massless = true;
			// The head faces -Z (its LookVector).
			eye.CFrame = head.CFrame.mul(new CFrame(x, 0.12, -head.Size.Z / 2 - 0.01));
			const weld = new Instance("WeldConstraint");
			weld.Part0 = head;
			weld.Part1 = eye;
			weld.Parent = eye;
			eye.Parent = model;
		}
		// A faint red glow, so they read in the dark.
		const glow = new Instance("PointLight");
		glow.Color = EYE_COLOR;
		glow.Range = 6;
		glow.Brightness = 1.5;
		glow.Parent = head;
	}
	model.Parent = ServerStorage;
	return model;
}

function flat(v: Vector3): Vector3 {
	return new Vector3(v.X, 0, v.Z);
}

function flatDistance(a: Vector3, b: Vector3): number {
	return flat(a).sub(flat(b)).Magnitude;
}

/** Just outside an opening, at ground level. */
function outsidePoint(entry: Entry): Vector3 {
	const p = entry.cframe.Position.add(entry.cframe.LookVector.mul(3));
	return new Vector3(p.X, 3, p.Z);
}

/** Just inside an opening. */
function insidePoint(entry: Entry): Vector3 {
	const p = entry.cframe.Position.sub(entry.cframe.LookVector.mul(4));
	return new Vector3(p.X, 3, p.Z);
}

function nearestEntry(from: Vector3): Entry | undefined {
	let best: Entry | undefined;
	let bestDistance = math.huge;
	for (const entry of world?.entries ?? []) {
		const d = flatDistance(from, outsidePoint(entry));
		if (d < bestDistance) {
			best = entry;
			bestDistance = d;
		}
	}
	return best;
}

function rootOf(player: Player): BasePart | undefined {
	const hrp = player.Character?.FindFirstChild("HumanoidRootPart");
	return hrp && hrp.IsA("BasePart") ? hrp : undefined;
}

function nearestKid(from: Vector3): { player: Player; root: BasePart; distance: number } | undefined {
	let best: { player: Player; root: BasePart; distance: number } | undefined;
	for (const player of hooks?.getKids() ?? []) {
		const root = rootOf(player);
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
function canSee(inf: Infected, kid: Player): boolean {
	const target = rootOf(kid);
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

function setMode(inf: Infected, mode: Mode) {
	inf.mode = mode;
	inf.modeSince = os.clock();
	inf.waypoints = [];
	inf.pathGoal = undefined;
}

function face(inf: Infected, point: Vector3) {
	const look = flat(point.sub(inf.root.Position));
	if (look.Magnitude > 0.1) {
		inf.root.CFrame = CFrame.lookAt(inf.root.Position, inf.root.Position.add(look));
	}
}

function stop(inf: Infected) {
	inf.humanoid.MoveTo(inf.root.Position);
}

/** Walks straight at `point`, jumping if it's been stuck for a moment (sills, furniture). */
function walkTo(inf: Infected, point: Vector3) {
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

function playHit(inf: Infected) {
	const sound = new Instance("Sound");
	sound.SoundId = HIT_SOUND;
	sound.Volume = 0.8;
	sound.RollOffMaxDistance = 60;
	sound.Parent = inf.root;
	sound.Play();
	task.delay(2, () => sound.Destroy());
}

function tryHitKid(inf: Infected, kid: Player, kidRoot: BasePart): boolean {
	if (!hooks) {
		return false;
	}
	face(inf, kidRoot.Position);
	stop(inf);
	const now = os.clock();
	if (now - inf.lastHitAt < gameConfig.infectedKidHitSeconds.Value) {
		return true;
	}
	inf.lastHitAt = now;
	playHit(inf);
	const multiplier = hooks.isFirstNight() ? gameConfig.firstNightDamageMultiplier.Value : 1;
	hooks.damageKid(kid, gameConfig.infectedKidDamage.Value * multiplier);
	return true;
}

/** Follows a path to `goal`, recomputing it every second or so. False if there's no way there. */
function pathTo(inf: Infected, goal: Vector3): boolean {
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

function approach(inf: Infected) {
	const kid = nearestKid(inf.root.Position);
	if (kid && kid.distance <= gameConfig.infectedSightRange.Value && canSee(inf, kid.player)) {
		setMode(inf, "chase");
		return;
	}
	const entry = inf.entry ?? nearestEntry(inf.root.Position);
	if (!entry) {
		return;
	}
	inf.entry = entry;
	const outside = outsidePoint(entry);
	if (flatDistance(inf.root.Position, outside) > 4) {
		walkTo(inf, outside);
		return;
	}
	if (!isEntryBlocked(entry)) {
		setMode(inf, "enter");
		return;
	}
	// Bash the planks.
	face(inf, entry.cframe.Position);
	stop(inf);
	const now = os.clock();
	if (now - inf.lastHitAt >= gameConfig.infectedPlankHitSeconds.Value) {
		inf.lastHitAt = now;
		const result = damageEntry(entry, gameConfig.infectedPlankDamage.Value);
		if (result.breached && result.broken > 0) {
			hooks?.notifyAll(`The ${entry.name.lower()} is broken!`);
		}
	}
}

function enter(inf: Infected) {
	const entry = inf.entry;
	if (!entry) {
		setMode(inf, "chase");
		return;
	}
	if (isEntryBlocked(entry) && !isInsideHouse(inf.root.Position)) {
		setMode(inf, "approach"); // boarded up again before it got through
		return;
	}
	const inside = insidePoint(entry);
	walkTo(inf, inside);
	if (entry.kind === "Window" && flatDistance(inf.root.Position, entry.cframe.Position) < 3.5) {
		inf.humanoid.Jump = true; // climb the sill
	}
	if (flatDistance(inf.root.Position, inside) < 2.5 || os.clock() - inf.modeSince > 5) {
		setMode(inf, "chase");
	}
}

function chase(inf: Infected) {
	const kid = nearestKid(inf.root.Position);
	if (!kid) {
		stop(inf);
		return;
	}
	if (kid.distance <= gameConfig.infectedAttackRange.Value && canSee(inf, kid.player)) {
		tryHitKid(inf, kid.player, kid.root);
		return;
	}
	if (!pathTo(inf, kid.root.Position)) {
		if (!isInsideHouse(inf.root.Position)) {
			// No way in: go and break one.
			inf.entry = nearestEntry(inf.root.Position);
			setMode(inf, "approach");
		} else {
			walkTo(inf, kid.root.Position);
		}
	}
}

function retreat(inf: Infected) {
	const spawns = world?.infectedSpawns ?? [];
	let goal: Vector3 | undefined;
	for (const spawn of spawns) {
		if (!goal || flatDistance(inf.root.Position, spawn.Position) < flatDistance(inf.root.Position, goal)) {
			goal = spawn.Position;
		}
	}
	if (!goal || flatDistance(inf.root.Position, goal) < 6 || os.clock() - inf.modeSince > RETREAT_SECONDS) {
		dissolve(inf);
		return;
	}
	if (!pathTo(inf, goal)) {
		walkTo(inf, goal);
	}
}

/** Fades the body out in a flicker of static, then removes it. */
function dissolve(inf: Infected) {
	if (!alive.delete(inf.model)) {
		return;
	}
	if (inf.isDad) {
		dadAround = false;
	}
	CollectionService.RemoveTag(inf.model, INFECTED_TAG);
	inf.humanoid.WalkSpeed = 0;
	const parts = inf.model.GetDescendants().filter((d): d is BasePart => d.IsA("BasePart"));
	task.spawn(() => {
		for (let i = 0; i < 8; i++) {
			const t = i / 8;
			for (const p of parts) {
				p.Material = Enum.Material.Neon;
				p.Color = i % 2 === 0 ? new Color3(0.9, 0.9, 0.95) : new Color3(0.2, 0.2, 0.25);
				p.Transparency = math.max(p.Transparency, t);
			}
			task.wait(0.08);
		}
		inf.model.Destroy();
	});
}

/** Steps the flashlight stun; a stunned infected stands still instead of thinking. */
function thinkOrStun(inf: Infected) {
	const now = os.clock();
	const lit = inf.mode !== "retreat" && hooks !== undefined && hooks.isLit(inf.model);
	const settings = {
		litSeconds: gameConfig.stunLitSeconds.Value,
		stunSeconds: gameConfig.stunSeconds.Value,
		immuneSeconds: gameConfig.stunImmuneSeconds.Value,
	};
	if (stepStun(inf.stun, lit, THINK_SECONDS, now, settings)) {
		inf.eyes.forEach((eye) => (eye.Color = STUNNED_EYE_COLOR));
		task.delay(settings.stunSeconds, () => inf.eyes.forEach((eye) => (eye.Color = EYE_COLOR)));
	}
	if (isStunned(inf.stun, now)) {
		stop(inf);
		return;
	}
	think(inf);
}

function think(inf: Infected) {
	if (inf.mode === "approach") {
		approach(inf);
	} else if (inf.mode === "enter") {
		enter(inf);
	} else if (inf.mode === "chase") {
		chase(inf);
	} else {
		retreat(inf);
	}
}

function startWalkAnimation(humanoid: Humanoid) {
	const animator = humanoid.FindFirstChildOfClass("Animator") ?? new Instance("Animator", humanoid);
	const animation = new Instance("Animation");
	animation.AnimationId = WALK_ANIMATION;
	const [ok, track] = pcall(() => animator.LoadAnimation(animation));
	if (!ok || !typeIs(track, "Instance")) {
		return;
	}
	track.Looped = true;
	humanoid.Running.Connect((speed) => {
		if (speed > 0.5 && !track.IsPlaying) {
			track.Play();
		} else if (speed <= 0.5 && track.IsPlaying) {
			track.Stop();
		}
	});
}

function spawnOne(at: CFrame, night: number, isDad: boolean) {
	if (!template || alive.size() >= gameConfig.maxInfected.Value) {
		return;
	}
	const model = template.Clone();
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	const root = model.FindFirstChild("HumanoidRootPart");
	if (!humanoid || !root || !root.IsA("BasePart")) {
		model.Destroy();
		return;
	}
	model.Name = isDad ? "Dad" : "Infected";
	if (isDad) {
		for (const name of ["UpperTorso", "LowerTorso", "LeftUpperArm", "RightUpperArm"]) {
			const p = model.FindFirstChild(name);
			if (p && p.IsA("BasePart")) {
				p.Color = DAD_SHIRT;
			}
		}
	}
	const health = infectedHealth(night, gameConfig.infectedBaseHealth.Value, gameConfig.infectedHealthPerNight.Value);
	humanoid.MaxHealth = health;
	humanoid.Health = health;
	humanoid.WalkSpeed = gameConfig.infectedWalkSpeed.Value;
	model.PivotTo(at);
	model.Parent = holder;
	root.SetNetworkOwner(undefined); // the server moves them
	CollectionService.AddTag(model, INFECTED_TAG);
	startWalkAnimation(humanoid);

	const inf: Infected = {
		model,
		humanoid,
		root,
		isDad,
		mode: "approach",
		waypoints: [],
		waypointIndex: 0,
		lastPathAt: 0,
		lastHitAt: 0,
		modeSince: os.clock(),
		lastPosition: root.Position,
		stuckSince: os.clock(),
		stun: newStun(),
		eyes: model.GetChildren().filter((c): c is BasePart => c.IsA("BasePart") && c.Name === "Eye"),
	};
	alive.set(model, inf);
	if (isDad) {
		dadAround = true;
	}
	humanoid.Died.Connect(() => dissolve(inf));
	task.spawn(() => {
		while (alive.has(model)) {
			const [ok, err] = pcall(() => thinkOrStun(inf));
			if (!ok) {
				warn(`[Infected] ${err}`);
			}
			task.wait(THINK_SECONDS);
		}
	});
}

function spawnWave(wave: Wave, night: number) {
	const spawns = world?.infectedSpawns ?? [];
	if (spawns.size() === 0) {
		return;
	}
	const rng = new Random();
	if (wave.dad && !dadAround) {
		spawnOne(spawns[0], night, true); // Dad comes from the street
	}
	for (let i = 0; i < wave.shamblers; i++) {
		const spawn = spawns[rng.NextInteger(0, spawns.size() - 1)];
		const offset = new CFrame(rng.NextNumber(-8, 8), 0, rng.NextNumber(-4, 4));
		spawnOne(spawn.mul(offset), night, false);
	}
}

/** Nightfall: schedules tonight's waves over the `nightSeconds` the night lasts. */
export function startNight(night: number, nightSeconds: number, kids: number) {
	generation += 1;
	const mine = generation;
	for (const wave of planNight(night, kids)) {
		task.delay(wave.at * nightSeconds, () => {
			if (generation === mine) {
				spawnWave(wave, night);
			}
		});
	}
}

/** Dawn: no more waves tonight, and everyone still around heads off. */
export function retreatAll() {
	generation += 1;
	for (const [, inf] of alive) {
		inf.entry = undefined;
		setMode(inf, "retreat");
	}
}

export function startInfected(mainWorld: MainWorld, infectedHooks: InfectedHooks) {
	world = mainWorld;
	hooks = infectedHooks;
	task.spawn(() => {
		template = buildTemplate();
	});
}
