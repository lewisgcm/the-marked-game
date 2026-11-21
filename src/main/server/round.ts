import { Players, ReplicatedStorage, Workspace } from "@rbxts/services";
import { EndReason, RUN_ENDS_AT_ATTRIBUTE, RUN_PHASE_ATTRIBUTE, RUN_REASON_ATTRIBUTE, RunPhase } from "shared/round";

/**
 * The run: countdown -> playing -> end screen -> back to the lobby.
 *
 * M0 placeholder: "Playing" is one timed phase. M1 replaces it with the day/night clock.
 *
 * Server-authoritative: the server owns the phase and the clock, and publishes them as
 * attributes (shared/round.ts) for clients to display. During the countdown every character's
 * root part is anchored by the server, so no one can move early.
 */

export interface RunSettings {
	countdownSeconds: number;
	runSeconds: number;
	endScreenSeconds: number;
}

export interface RunHooks {
	/** Called as the run ends, before the end screen shows. */
	onEnd: (reason: EndReason) => void;
	/** Called after the end screen, with everyone still in the server. */
	returnToLobby: (players: Player[]) => void;
}

let phase: RunPhase = "Waiting";

function setPhase(newPhase: RunPhase, duration?: number) {
	phase = newPhase;
	ReplicatedStorage.SetAttribute(RUN_PHASE_ATTRIBUTE, newPhase);
	ReplicatedStorage.SetAttribute(
		RUN_ENDS_AT_ATTRIBUTE,
		duration !== undefined ? Workspace.GetServerTimeNow() + duration : undefined,
	);
}

setPhase("Waiting");

export function getPhase(): RunPhase {
	return phase;
}

/** Characters are frozen while the countdown runs. */
export function isFrozen(): boolean {
	return phase === "Countdown";
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

/** Ends the run early, e.g. "AllTaken". */
export function endRun(reason: EndReason) {
	if (phase === "Playing" && pendingReason === undefined) {
		pendingReason = reason;
	}
}

/** Runs the whole run. Yields until it's over; call it from task.spawn. */
export function runRun(settings: RunSettings, hooks: RunHooks) {
	setPhase("Countdown", settings.countdownSeconds);
	freezeAll(true);
	task.wait(settings.countdownSeconds);

	setPhase("Playing", settings.runSeconds);
	startedAt = os.clock();
	freezeAll(false);
	const deadline = os.clock() + settings.runSeconds;
	while (pendingReason === undefined && os.clock() < deadline) {
		task.wait(0.25);
	}

	endedAt = os.clock();
	const reason = pendingReason ?? "Time";
	ReplicatedStorage.SetAttribute(RUN_REASON_ATTRIBUTE, reason);
	setPhase("Ended", settings.endScreenSeconds);
	hooks.onEnd(reason);

	task.wait(settings.endScreenSeconds);
	hooks.returnToLobby(Players.GetPlayers());
}
