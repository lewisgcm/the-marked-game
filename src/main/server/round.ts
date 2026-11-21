import { Players, ReplicatedStorage, Workspace } from "@rbxts/services";
import {
	EndReason,
	ROUND_ENDS_AT_ATTRIBUTE,
	ROUND_PHASE_ATTRIBUTE,
	ROUND_REASON_ATTRIBUTE,
	ROUND_WINNER_ATTRIBUTE,
	RoundPhase,
	Winner,
} from "shared/round";

/**
 * The round: countdown -> hunt -> end screen -> back to the lobby.
 *
 * Server-authoritative: the server owns the phase, the clock and the winner, and publishes
 * them as attributes (shared/round.ts) for clients to display. During the countdown every
 * character's root part is anchored by the server, so no one can move early.
 */

export interface RoundSettings {
	countdownSeconds: number;
	roundSeconds: number;
	endScreenSeconds: number;
}

export interface RoundHooks {
	/** Called as the round ends, e.g. to show the ghost to everyone. */
	onEnd: (winner: Winner, reason: EndReason) => void;
	/** Plays the banishing cutscene (yields until it's done). Everyone is frozen meanwhile. */
	playBanishing: () => void;
	/** Called after the end screen, with everyone still in the server. */
	returnToLobby: (players: Player[]) => void;
}

let phase: RoundPhase = "Waiting";

function setPhase(newPhase: RoundPhase, duration?: number) {
	phase = newPhase;
	ReplicatedStorage.SetAttribute(ROUND_PHASE_ATTRIBUTE, newPhase);
	ReplicatedStorage.SetAttribute(
		ROUND_ENDS_AT_ATTRIBUTE,
		duration !== undefined ? Workspace.GetServerTimeNow() + duration : undefined,
	);
}

setPhase("Waiting");

export function getPhase(): RoundPhase {
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

let huntStartedAt: number | undefined;
let huntEndedAt: number | undefined;

/** Seconds since the hunt started (frozen once it ends); 0 before it starts. */
export function huntElapsed(): number {
	if (huntStartedAt === undefined) {
		return 0;
	}
	return (huntEndedAt ?? os.clock()) - huntStartedAt;
}

let pendingWinner: Winner | undefined;
let pendingReason: EndReason | undefined;

/** Ends the hunt early: e.g. ("Hunters", "Banished") or ("Ghost", "AllDead"). */
export function endRound(winner: Winner, reason: EndReason) {
	if (phase === "Hunt" && pendingWinner === undefined) {
		pendingWinner = winner;
		pendingReason = reason;
	}
}

/** Runs one full round. Yields until the round is over; call it from task.spawn. */
export function runRound(settings: RoundSettings, hooks: RoundHooks) {
	setPhase("Countdown", settings.countdownSeconds);
	freezeAll(true);
	task.wait(settings.countdownSeconds);

	setPhase("Hunt", settings.roundSeconds);
	huntStartedAt = os.clock();
	freezeAll(false);
	const deadline = os.clock() + settings.roundSeconds;
	while (pendingWinner === undefined && os.clock() < deadline) {
		task.wait(0.25);
	}

	huntEndedAt = os.clock();
	// Time running out means the ghost survived.
	const winner = pendingWinner ?? "Ghost";
	const reason = pendingReason ?? "Time";
	if (reason === "Banished") {
		setPhase("Banishing");
		freezeAll(true);
		hooks.playBanishing();
	}
	ReplicatedStorage.SetAttribute(ROUND_WINNER_ATTRIBUTE, winner);
	ReplicatedStorage.SetAttribute(ROUND_REASON_ATTRIBUTE, reason);
	setPhase("Ended", settings.endScreenSeconds);
	hooks.onEnd(winner, reason);

	task.wait(settings.endScreenSeconds);
	hooks.returnToLobby(Players.GetPlayers());
}
