import React from "@rbxts/react";
import { ReplicatedStorage, RunService, TweenService, Workspace } from "@rbxts/services";
import { announcementFor } from "shared/run/announce";
import { serverSender } from "shared/core/net";
import { Clock, DayPhase, phaseTitle } from "shared/run/phases";
import { GameClientMessages } from "shared/core/remotes";
import {
	DAY_PHASE_ATTRIBUTE,
	EndReason,
	NIGHT_ATTRIBUTE,
	NIGHTS_SURVIVED_ATTRIBUTE,
	PHASE_ENDS_AT_ATTRIBUTE,
	RUN_PHASE_ATTRIBUTE,
	RUN_REASON_ATTRIBUTE,
	RunPhase,
} from "shared/run/round";
import { EndScreen } from "../run/endScreen";
import { PING, playLocalSound } from "../core/sound";
import { PALE, PANEL, PINK } from "../core/theme";

/**
 * The "DAY 1" title card, the day/night clock, how phase changes are announced
 * (shared/run/announce.ts), and the end screen. Purely a display of the run state the server publishes on ReplicatedStorage
 * (shared/run/round.ts); it computes the remaining time from server time, so it needs no
 * per-second messages.
 */

/** Seconds a phase-change banner stays up. */
const BANNER_SECONDS = 2;
/** How much the clock swells at dusk, and seconds each way. */
const PULSE_SCALE = 1.25;
const PULSE_SECONDS = 0.35;

const PHASE_COLOR: Record<DayPhase, Color3> = {
	Day: new Color3(1, 0.97, 0.88),
	Dusk: new Color3(1, 0.62, 0.35),
	Night: new Color3(0.95, 0.35, 0.35),
	Dawn: PINK,
};

/** The advice under a banner. */
const PHASE_ADVICE: Partial<Record<DayPhase, string>> = {
	Day: "Scavenge. Be home before dark.",
	Night: "Hold the house.",
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

/**
 * Top of the screen: "NIGHT 2 · 1:12". Turns red in the last 10 seconds of the day or dusk, and
 * swells once whenever `pulse` changes.
 */
function ClockPill({ clock, seconds, pulse }: { clock: Clock; seconds: number; pulse: number }) {
	const urgent = seconds <= 10 && (clock.phase === "Day" || clock.phase === "Dusk");
	const scale = React.useRef<UIScale>();

	React.useEffect(() => {
		if (pulse > 0 && scale.current) {
			const info = new TweenInfo(PULSE_SECONDS, Enum.EasingStyle.Sine, Enum.EasingDirection.Out, 0, true);
			TweenService.Create(scale.current, info, { Scale: PULSE_SCALE }).Play();
		}
	}, [pulse]);

	return (
		<textlabel
			Size={new UDim2(0, 200, 0, 40)}
			Position={new UDim2(0.5, 0, 0, 8)}
			AnchorPoint={new Vector2(0.5, 0)}
			BackgroundColor3={PANEL}
			BackgroundTransparency={0.3}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBlack}
			TextSize={24}
			TextColor3={urgent ? new Color3(1, 0.35, 0.3) : PHASE_COLOR[clock.phase]}
			Text={`${phaseTitle(clock)} · ${formatClock(seconds)}`}
		>
			<uiscale ref={scale} />
			<uicorner CornerRadius={new UDim(0, 8)} />
		</textlabel>
	);
}

/** A title in the middle of the screen as a day or night begins ("NIGHT 2"). */
function PhaseBanner({ clock }: { clock: Clock }) {
	const advice = announcementFor(clock).advice ? PHASE_ADVICE[clock.phase] : undefined;
	return (
		<frame
			Size={new UDim2(1, 0, 0, 80)}
			Position={new UDim2(0.5, 0, 0.4, 0)}
			AnchorPoint={new Vector2(0.5, 0.5)}
			BackgroundTransparency={1}
		>
			<textlabel
				Size={new UDim2(1, 0, 0, 50)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBlack}
				TextSize={48}
				TextColor3={PHASE_COLOR[clock.phase]}
				TextStrokeTransparency={0.4}
				Text={phaseTitle(clock)}
			/>
			{advice !== undefined ? (
				<textlabel
					Size={new UDim2(1, 0, 0, 26)}
					Position={new UDim2(0, 0, 0, 52)}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBold}
					TextSize={18}
					TextColor3={PALE}
					TextStrokeTransparency={0.5}
					Text={advice}
				/>
			) : undefined}
		</frame>
	);
}

export function RoundHud({ remote }: { remote: RemoteEvent }) {
	const send = React.useMemo(() => serverSender<GameClientMessages>(remote), [remote]);
	const { runPhase, clock, secondsLeft, nightsSurvived, reason } = useRunState();
	const [banner, setBanner] = React.useState<Clock>();
	const [pulse, setPulse] = React.useState(0);
	const showCard = runPhase === "Waiting" || runPhase === "Starting";

	// Announce every phase change.
	const phaseKey = `${clock.night}:${clock.phase}`;
	React.useEffect(() => {
		setBanner(undefined);
		if (runPhase !== "Playing") {
			return;
		}
		const announcement = announcementFor(clock);
		if (announcement.chime) {
			playLocalSound(PING, 0.6);
		}
		if (announcement.pulse) {
			setPulse((count) => count + 1);
		}
		if (!announcement.banner) {
			return;
		}
		setBanner(clock);
		const thread = task.delay(BANNER_SECONDS, () => setBanner(undefined));
		return () => task.cancel(thread);
	}, [runPhase, phaseKey]);

	return (
		<screengui ResetOnSpawn={false} IgnoreGuiInset={showCard} DisplayOrder={5}>
			{showCard ? <TitleCard /> : undefined}
			{runPhase === "Playing" ? <ClockPill clock={clock} seconds={secondsLeft} pulse={pulse} /> : undefined}
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
