import React from "@rbxts/react";
import { ReplicatedStorage, RunService, SoundService, Workspace } from "@rbxts/services";
import { serverSender } from "shared/net";
import { Clock, DayPhase, phaseTitle } from "shared/phases";
import { GameClientMessages } from "shared/remotes";
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
import { EndScreen } from "./endScreen";

/**
 * The "DAY 1" title card, the day/night clock, a banner on every phase change, and the end
 * screen. Purely a display of the run state the server publishes on ReplicatedStorage
 * (shared/round.ts); it computes the remaining time from server time, so it needs no
 * per-second messages.
 */

// Built-in Studio sounds, so no uploaded audio is needed. Swap for real assets later.
const PHASE_SOUND = "rbxasset://sounds/electronicpingshort.wav";

/** Seconds a phase-change banner stays up. */
const BANNER_SECONDS = 3;

const PHASE_COLOR: Record<DayPhase, Color3> = {
	Day: new Color3(1, 0.97, 0.88),
	Dusk: new Color3(1, 0.62, 0.35),
	Night: new Color3(0.95, 0.35, 0.35),
	Dawn: new Color3(1, 0.82, 0.8),
};

/** What the banner says under each phase's title. */
const PHASE_HINT: Record<DayPhase, string> = {
	Day: "Scavenge. Be home before dark.",
	Dusk: "Get home. Board up. Night is coming.",
	Night: "Hold the house.",
	Dawn: "You made it through the night.",
};

interface RunState {
	runPhase: RunPhase;
	clock: Clock;
	secondsLeft: number;
	nightsSurvived: number;
	reason?: EndReason;
}

function readState(): RunState {
	const runPhase = (ReplicatedStorage.GetAttribute(RUN_PHASE_ATTRIBUTE) as RunPhase | undefined) ?? "Waiting";
	const phase = (ReplicatedStorage.GetAttribute(DAY_PHASE_ATTRIBUTE) as DayPhase | undefined) ?? "Day";
	const night = (ReplicatedStorage.GetAttribute(NIGHT_ATTRIBUTE) as number | undefined) ?? 1;
	const endsAt = ReplicatedStorage.GetAttribute(PHASE_ENDS_AT_ATTRIBUTE);
	const secondsLeft = typeIs(endsAt, "number") ? math.max(0, math.ceil(endsAt - Workspace.GetServerTimeNow())) : 0;
	const nightsSurvived = (ReplicatedStorage.GetAttribute(NIGHTS_SURVIVED_ATTRIBUTE) as number | undefined) ?? 0;
	const reason = ReplicatedStorage.GetAttribute(RUN_REASON_ATTRIBUTE) as EndReason | undefined;
	return { runPhase, clock: { night, phase }, secondsLeft, nightsSurvived, reason };
}

function sameState(a: RunState, b: RunState): boolean {
	return (
		a.runPhase === b.runPhase &&
		a.clock.phase === b.clock.phase &&
		a.clock.night === b.clock.night &&
		a.secondsLeft === b.secondsLeft &&
		a.nightsSurvived === b.nightsSurvived &&
		a.reason === b.reason
	);
}

function playSound(id: string) {
	const sound = new Instance("Sound");
	sound.SoundId = id;
	sound.Volume = 0.6;
	SoundService.PlayLocalSound(sound);
	task.delay(2, () => sound.Destroy());
}

function useRunState(): RunState {
	const [state, setState] = React.useState(readState());
	React.useEffect(() => {
		// Re-read a few times a second; only re-render when something visible changed.
		let elapsed = 0;
		const connection = RunService.Heartbeat.Connect((dt) => {
			elapsed += dt;
			if (elapsed < 0.1) {
				return;
			}
			elapsed = 0;
			const latest = readState();
			setState((previous) => (sameState(previous, latest) ? previous : latest));
		});
		return () => connection.Disconnect();
	}, []);
	return state;
}

function formatClock(seconds: number) {
	const minutes = math.floor(seconds / 60);
	const rest = seconds % 60;
	return `${minutes}:${rest < 10 ? "0" : ""}${rest}`;
}

/**
 * The "DAY 1" card at the start of a run, over a dark screen, while everyone is frozen. Shown from
 * the moment the client loads (while the server waits for the party, too), so there's no gap.
 */
function TitleCard() {
	return (
		<frame
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundColor3={new Color3(0, 0, 0)}
			BackgroundTransparency={0.15}
			BorderSizePixel={0}
		>
			<textlabel
				Size={new UDim2(1, 0, 0, 140)}
				Position={new UDim2(0.5, 0, 0.45, 0)}
				AnchorPoint={new Vector2(0.5, 0.5)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBlack}
				TextSize={110}
				TextColor3={PHASE_COLOR.Day}
				Text="DAY 1"
			/>
			<textlabel
				Size={new UDim2(1, 0, 0, 40)}
				Position={new UDim2(0.5, 0, 0.45, 80)}
				AnchorPoint={new Vector2(0.5, 0)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				TextSize={24}
				TextColor3={new Color3(0.8, 0.8, 0.85)}
				Text="Board up the house before dark."
			/>
		</frame>
	);
}

/** Top of the screen: "NIGHT 2 · 1:12". Turns red in the last 10 seconds of the day or dusk. */
function ClockPill({ clock, seconds }: { clock: Clock; seconds: number }) {
	const urgent = seconds <= 10 && (clock.phase === "Day" || clock.phase === "Dusk");
	return (
		<textlabel
			Size={new UDim2(0, 200, 0, 40)}
			Position={new UDim2(0.5, 0, 0, 8)}
			AnchorPoint={new Vector2(0.5, 0)}
			BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
			BackgroundTransparency={0.3}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBlack}
			TextSize={24}
			TextColor3={urgent ? new Color3(1, 0.35, 0.3) : PHASE_COLOR[clock.phase]}
			Text={`${phaseTitle(clock)} · ${formatClock(seconds)}`}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
		</textlabel>
	);
}

/** A big title in the middle of the screen when the phase changes ("NIGHT 2", "DAWN"...). */
function PhaseBanner({ clock }: { clock: Clock }) {
	return (
		<frame
			Size={new UDim2(1, 0, 0, 130)}
			Position={new UDim2(0.5, 0, 0.3, 0)}
			AnchorPoint={new Vector2(0.5, 0.5)}
			BackgroundTransparency={1}
		>
			<textlabel
				Size={new UDim2(1, 0, 0, 90)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBlack}
				TextSize={80}
				TextColor3={PHASE_COLOR[clock.phase]}
				TextStrokeTransparency={0.4}
				Text={phaseTitle(clock)}
			/>
			<textlabel
				Size={new UDim2(1, 0, 0, 30)}
				Position={new UDim2(0, 0, 0, 92)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				TextSize={22}
				TextColor3={new Color3(0.9, 0.9, 0.92)}
				TextStrokeTransparency={0.5}
				Text={PHASE_HINT[clock.phase]}
			/>
		</frame>
	);
}

export function RoundHud({ remote }: { remote: RemoteEvent }) {
	const send = React.useMemo(() => serverSender<GameClientMessages>(remote), [remote]);
	const { runPhase, clock, secondsLeft, nightsSurvived, reason } = useRunState();
	const [banner, setBanner] = React.useState<Clock>();
	const showCard = runPhase === "Waiting" || runPhase === "Starting";

	// A banner and a sound on every phase change after the title card (Day 1 has the card).
	const phaseKey = `${clock.night}:${clock.phase}`;
	React.useEffect(() => {
		if (runPhase !== "Playing" || (clock.night === 1 && clock.phase === "Day")) {
			return;
		}
		setBanner(clock);
		playSound(PHASE_SOUND);
		const thread = task.delay(BANNER_SECONDS, () => setBanner(undefined));
		return () => task.cancel(thread);
	}, [runPhase, phaseKey]);

	return (
		<screengui ResetOnSpawn={false} IgnoreGuiInset={showCard} DisplayOrder={5}>
			{showCard ? <TitleCard /> : undefined}
			{runPhase === "Playing" ? <ClockPill clock={clock} seconds={secondsLeft} /> : undefined}
			{runPhase === "Playing" && banner ? <PhaseBanner clock={banner} /> : undefined}
			{runPhase === "Ended" ? (
				<EndScreen
					reason={reason}
					nightsSurvived={nightsSurvived}
					secondsLeft={secondsLeft}
					onLeave={() => send("LeaveRound", undefined)}
				/>
			) : undefined}
		</screengui>
	);
}
