import React from "@rbxts/react";
import { ReplicatedStorage, RunService, SoundService, Workspace } from "@rbxts/services";
import { serverSender } from "shared/net";
import { GameClientMessages } from "shared/remotes";
import { EndScreen } from "./endScreen";
import { GHOST_HEALTH_ATTRIBUTE, GHOST_MAX_HEALTH_ATTRIBUTE } from "shared/combat";
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
 * Countdown, round clock and end screen. Purely a display of the round state the server
 * publishes on ReplicatedStorage (shared/round.ts); it computes the remaining time from server
 * time, so it needs no per-second messages.
 */

// Built-in Studio sounds, so no uploaded audio is needed. Swap for spookier assets later.
const TICK_SOUND = "rbxasset://sounds/clickfast.wav";
const GO_SOUND = "rbxasset://sounds/electronicpingshort.wav";

interface RoundState {
	phase: RoundPhase;
	secondsLeft: number;
	winner?: Winner;
	reason?: EndReason;
	ghostHealth: number;
	ghostMaxHealth: number;
}

function readState(): RoundState {
	const phase = (ReplicatedStorage.GetAttribute(ROUND_PHASE_ATTRIBUTE) as RoundPhase | undefined) ?? "Waiting";
	const endsAt = ReplicatedStorage.GetAttribute(ROUND_ENDS_AT_ATTRIBUTE);
	const secondsLeft = typeIs(endsAt, "number") ? math.max(0, math.ceil(endsAt - Workspace.GetServerTimeNow())) : 0;
	const winner = ReplicatedStorage.GetAttribute(ROUND_WINNER_ATTRIBUTE) as Winner | undefined;
	const reason = ReplicatedStorage.GetAttribute(ROUND_REASON_ATTRIBUTE) as EndReason | undefined;
	const ghostHealth = (ReplicatedStorage.GetAttribute(GHOST_HEALTH_ATTRIBUTE) as number | undefined) ?? 0;
	const ghostMaxHealth = (ReplicatedStorage.GetAttribute(GHOST_MAX_HEALTH_ATTRIBUTE) as number | undefined) ?? 0;
	return { phase, secondsLeft, winner, reason, ghostHealth, ghostMaxHealth };
}

function playSound(id: string) {
	const sound = new Instance("Sound");
	sound.SoundId = id;
	sound.Volume = 0.6;
	SoundService.PlayLocalSound(sound);
	task.delay(2, () => sound.Destroy());
}

function useRoundState(): RoundState {
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
				previous.winner === latest.winner &&
				previous.reason === latest.reason &&
				previous.ghostHealth === latest.ghostHealth
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

/** The ghost's health, under the clock, once it has taken damage. */
function GhostHealthBar({ health, max }: { health: number; max: number }) {
	if (max <= 0 || health >= max) {
		return undefined;
	}
	return (
		<frame
			Size={new UDim2(0, 200, 0, 14)}
			Position={new UDim2(0.5, 0, 0, 54)}
			AnchorPoint={new Vector2(0.5, 0)}
			BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
			BackgroundTransparency={0.3}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={new UDim(0, 6)} />
			<frame
				Size={new UDim2(health / max, 0, 1, 0)}
				BackgroundColor3={new Color3(0.7, 0.82, 1)}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 6)} />
			</frame>
			<textlabel
				Size={new UDim2(1, 0, 1, 0)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				TextSize={11}
				TextColor3={new Color3(0.05, 0.05, 0.1)}
				Text="GHOST"
			/>
		</frame>
	);
}

/** Over the banishing cutscene (main/client/banishCamera.ts does the camera). */
function BanishingBanner() {
	return (
		<textlabel
			Size={new UDim2(1, 0, 0, 50)}
			Position={new UDim2(0.5, 0, 0.8, 0)}
			AnchorPoint={new Vector2(0.5, 0.5)}
			BackgroundTransparency={1}
			Font={Enum.Font.Fondamento}
			TextSize={38}
			TextColor3={new Color3(0.9, 0.95, 1)}
			TextStrokeTransparency={0.3}
			Text="The ritual is complete..."
		/>
	);
}

export function RoundHud({ remote }: { remote: RemoteEvent }) {
	const send = React.useMemo(() => serverSender<GameClientMessages>(remote), [remote]);
	const { phase, secondsLeft, winner, reason, ghostHealth, ghostMaxHealth } = useRoundState();

	// A tick on every countdown second, and a different sound when the hunt starts.
	React.useEffect(() => {
		if (phase === "Countdown" && secondsLeft > 0) {
			playSound(TICK_SOUND);
		} else if (phase === "Hunt") {
			playSound(GO_SOUND);
		}
	}, [phase, phase === "Countdown" ? secondsLeft : 0]);

	return (
		<screengui ResetOnSpawn={false} IgnoreGuiInset={false} DisplayOrder={5}>
			{phase === "Countdown" ? <Countdown seconds={secondsLeft} /> : undefined}
			{phase === "Hunt" ? <Clock seconds={secondsLeft} /> : undefined}
			{phase === "Hunt" ? <GhostHealthBar health={ghostHealth} max={ghostMaxHealth} /> : undefined}
			{phase === "Banishing" ? <BanishingBanner /> : undefined}
			{phase === "Ended" ? (
				<EndScreen
					winner={winner}
					reason={reason}
					secondsLeft={secondsLeft}
					onLeave={() => send("LeaveRound", undefined)}
				/>
			) : undefined}
		</screengui>
	);
}
