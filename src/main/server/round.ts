import { Players, ReplicatedStorage, Workspace } from "@rbxts/services";
import { Clock, firstClock, nextClock, nightsSurvived, PhaseLengths, phaseLength } from "shared/phases";
import {
	DAY_PHASE_ATTRIBUTE,
	EndReason,
	NIGHT_ATTRIBUTE,
	NIGHTS_SURVIVED_ATTRIBUTE,
	PHASE_ENDS_AT_ATTRIBUTE,
	RUN_PHASE_ATTRIBUTE,
	RUN_REASON_ATTRIBUTE,
	RunPhase,
} from "shared/round";

/**
 * The run: "DAY 1" title card -> the day/night clock, round and round -> end screen -> back to
 * the lobby. The run only ends when every kid is taken (endRun); there's no last night.
 *
 * Server-authoritative: the server owns the run phase, the clock and the night count, and
 * publishes them as attributes (shared/round.ts) for clients to display. During the title card
 * every character's root part is anchored by the server, so no one can move early.
 */

export interface RunSettings {
	/** Seconds the "DAY 1" title card shows, with everyone frozen. */
	startSeconds: number;
	/** Seconds the end screen shows. */
	endScreenSeconds: number;
	/** Read at the start of every phase, so Studio edits to the lengths apply from the next one. */
	phaseLengths: () => PhaseLengths;
}

export interface RunHooks {
	/** Called at the start of every day/night phase (including Day 1). */
	onPhase: (clock: Clock) => void;
	/** Called as the run ends, before the end screen shows. */
	onEnd: (reason: EndReason) => void;
	/** Called after the end screen, with everyone still in the server. */
	returnToLobby: (players: Player[]) => void;
}

let runPhase: RunPhase = "Waiting";
let clock: Clock = firstClock();

function setRunPhase(phase: RunPhase, duration?: number) {
	runPhase = phase;
	ReplicatedStorage.SetAttribute(RUN_PHASE_ATTRIBUTE, phase);
	setEndsAt(duration);
}

function setEndsAt(duration: number | undefined) {
	ReplicatedStorage.SetAttribute(
		PHASE_ENDS_AT_ATTRIBUTE,
		duration !== undefined ? Workspace.GetServerTimeNow() + duration : undefined,
	);
}

function publishClock() {
	ReplicatedStorage.SetAttribute(DAY_PHASE_ATTRIBUTE, clock.phase);
	ReplicatedStorage.SetAttribute(NIGHT_ATTRIBUTE, clock.night);
	ReplicatedStorage.SetAttribute(NIGHTS_SURVIVED_ATTRIBUTE, nightsSurvived(clock));
}

setRunPhase("Waiting");

export function getPhase(): RunPhase {
	return runPhase;
}

/** The day/night clock (Day 1 until the run starts). */
export function getClock(): Clock {
	return clock;
}

/** Characters are frozen while the title card shows (and while waiting for the party). */
export function isFrozen(): boolean {
	return runPhase === "Waiting" || runPhase === "Starting";
}

export function setFrozen(character: Model, frozen: boolean) {
	const root = character.FindFirstChild("HumanoidRootPart");
	if (root && root.IsA("BasePart")) {
		root.Anchored = frozen;
	}
}

function freezeAll(frozen: boolean) {
	for (const player of Players.GetPlayers()) {
		if (player.Character) {
			setFrozen(player.Character, frozen);
		}
	}
}

let startedAt: number | undefined;
let endedAt: number | undefined;

/** Seconds since play started (frozen once it ends); 0 before it starts. */
export function runElapsed(): number {
	if (startedAt === undefined) {
		return 0;
	}
	return (endedAt ?? os.clock()) - startedAt;
}

let pendingReason: EndReason | undefined;

/** Ends the run, e.g. "AllTaken". */
export function endRun(reason: EndReason) {
	if (runPhase === "Playing" && pendingReason === undefined) {
		pendingReason = reason;
	}
}

/** Waits up to `seconds`, returning early if the run was ended. */
function waitOrEnd(seconds: number) {
	const deadline = os.clock() + seconds;
	while (pendingReason === undefined && os.clock() < deadline) {
		task.wait(0.25);
	}
}

/** Runs the whole run. Yields until it's over. */
export function runRun(settings: RunSettings, hooks: RunHooks) {
	clock = firstClock();
	publishClock();
	setRunPhase("Starting", settings.startSeconds);
	freezeAll(true);
	task.wait(settings.startSeconds);

	runPhase = "Playing";
	ReplicatedStorage.SetAttribute(RUN_PHASE_ATTRIBUTE, "Playing");
	startedAt = os.clock();
	freezeAll(false);
	while (pendingReason === undefined) {
		const seconds = phaseLength(clock, settings.phaseLengths());
		publishClock();
		setEndsAt(seconds);
		hooks.onPhase(clock);
		waitOrEnd(seconds);
		if (pendingReason === undefined) {
			clock = nextClock(clock);
		}
	}

	endedAt = os.clock();
	const reason = pendingReason;
	ReplicatedStorage.SetAttribute(RUN_REASON_ATTRIBUTE, reason);
	setRunPhase("Ended", settings.endScreenSeconds);
	hooks.onEnd(reason);

	task.wait(settings.endScreenSeconds);
	hooks.returnToLobby(Players.GetPlayers());
}
