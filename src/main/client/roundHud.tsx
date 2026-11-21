import React from "@rbxts/react";
import { ReplicatedStorage, RunService, SoundService, Workspace } from "@rbxts/services";
import { serverSender } from "shared/net";
import { GameClientMessages } from "shared/remotes";
import { EndScreen } from "./endScreen";
import { EndReason, RUN_ENDS_AT_ATTRIBUTE, RUN_PHASE_ATTRIBUTE, RUN_REASON_ATTRIBUTE, RunPhase } from "shared/round";

/**
 * Countdown, run clock and end screen. Purely a display of the run state the server publishes
 * on ReplicatedStorage (shared/round.ts); it computes the remaining time from server time, so
 * it needs no per-second messages.
 */

// Built-in Studio sounds, so no uploaded audio is needed. Swap for spookier assets later.
const TICK_SOUND = "rbxasset://sounds/clickfast.wav";
const GO_SOUND = "rbxasset://sounds/electronicpingshort.wav";

interface RunState {
	phase: RunPhase;
	secondsLeft: number;
	reason?: EndReason;
}

function readState(): RunState {
	const phase = (ReplicatedStorage.GetAttribute(RUN_PHASE_ATTRIBUTE) as RunPhase | undefined) ?? "Waiting";
	const endsAt = ReplicatedStorage.GetAttribute(RUN_ENDS_AT_ATTRIBUTE);
	const secondsLeft = typeIs(endsAt, "number") ? math.max(0, math.ceil(endsAt - Workspace.GetServerTimeNow())) : 0;
	const reason = ReplicatedStorage.GetAttribute(RUN_REASON_ATTRIBUTE) as EndReason | undefined;
	return { phase, secondsLeft, reason };
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
			setState((previous) =>
				previous.phase === latest.phase &&
				previous.secondsLeft === latest.secondsLeft &&
				previous.reason === latest.reason
					? previous
					: latest,
			);
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

function Countdown({ seconds }: { seconds: number }) {
	return (
		<frame Size={new UDim2(1, 0, 1, 0)} BackgroundTransparency={1}>
			<textlabel
				Size={new UDim2(0, 300, 0, 160)}
				Position={new UDim2(0.5, 0, 0.45, 0)}
				AnchorPoint={new Vector2(0.5, 0.5)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBlack}
				TextSize={140}
				TextColor3={new Color3(1, 1, 1)}
				TextStrokeTransparency={0.4}
				Text={tostring(math.max(seconds, 1))}
			/>
			<textlabel
				Size={new UDim2(0, 400, 0, 40)}
				Position={new UDim2(0.5, 0, 0.45, 95)}
				AnchorPoint={new Vector2(0.5, 0)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				TextSize={24}
				TextColor3={new Color3(0.85, 0.85, 0.9)}
				TextStrokeTransparency={0.5}
				Text="Get ready..."
			/>
		</frame>
	);
}

function Clock({ seconds }: { seconds: number }) {
	const urgent = seconds <= 60;
	return (
		<textlabel
			Size={new UDim2(0, 130, 0, 40)}
			Position={new UDim2(0.5, 0, 0, 8)}
			AnchorPoint={new Vector2(0.5, 0)}
			BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
			BackgroundTransparency={0.3}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBlack}
			TextSize={26}
			TextColor3={urgent ? new Color3(1, 0.35, 0.3) : new Color3(1, 1, 1)}
			Text={formatClock(seconds)}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
		</textlabel>
	);
}

export function RoundHud({ remote }: { remote: RemoteEvent }) {
	const send = React.useMemo(() => serverSender<GameClientMessages>(remote), [remote]);
	const { phase, secondsLeft, reason } = useRunState();

	// A tick on every countdown second, and a different sound when play starts.
	React.useEffect(() => {
		if (phase === "Countdown" && secondsLeft > 0) {
			playSound(TICK_SOUND);
		} else if (phase === "Playing") {
			playSound(GO_SOUND);
		}
	}, [phase, phase === "Countdown" ? secondsLeft : 0]);

	return (
		<screengui ResetOnSpawn={false} IgnoreGuiInset={false} DisplayOrder={5}>
			{phase === "Countdown" ? <Countdown seconds={secondsLeft} /> : undefined}
			{phase === "Playing" ? <Clock seconds={secondsLeft} /> : undefined}
			{phase === "Ended" ? (
				<EndScreen reason={reason} secondsLeft={secondsLeft} onLeave={() => send("LeaveRound", undefined)} />
			) : undefined}
		</screengui>
	);
}
