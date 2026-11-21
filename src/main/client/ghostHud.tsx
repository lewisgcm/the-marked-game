import React from "@rbxts/react";
import { ContextActionService, ReplicatedStorage, RunService } from "@rbxts/services";
import { serverSender } from "shared/net";
import { GameClientMessages } from "shared/remotes";
import { ROUND_PHASE_ATTRIBUTE } from "shared/round";
import { AttackWindowState } from "shared/combat";
import { SpookKind, SpookState } from "shared/spooks";

/**
 * The ghost's spook controls: charge pips, a recharge timer, a button per spook (also bound
 * to Q / F), and a line showing the knife window a scream opens. Only *asks* the server to
 * spook — the server decides whether it happens.
 */

const SPOOKS: Array<{ kind: SpookKind; key: Enum.KeyCode; label: string; hint: string }> = [
	{ kind: "Scream", key: Enum.KeyCode.Q, label: "Scream", hint: "Q" },
	{ kind: "LightsOut", key: Enum.KeyCode.F, label: "Lights out", hint: "F" },
];

function usePhase(): string {
	const read = () => (ReplicatedStorage.GetAttribute(ROUND_PHASE_ATTRIBUTE) as string | undefined) ?? "Waiting";
	const [phase, setPhase] = React.useState(read());
	React.useEffect(() => {
		const connection = ReplicatedStorage.GetAttributeChangedSignal(ROUND_PHASE_ATTRIBUTE).Connect(() =>
			setPhase(read()),
		);
		return () => connection.Disconnect();
	}, []);
	return phase;
}

/** A clock that ticks a few times a second, for counting timers down between server updates. */
function useNow(): number {
	const [now, setNow] = React.useState(os.clock());
	React.useEffect(() => {
		const connection = RunService.Heartbeat.Connect(() => setNow(math.floor(os.clock() * 4) / 4));
		return () => connection.Disconnect();
	}, []);
	return now;
}

/** Seconds left on a timer the server sent `secondsAtSend` seconds' worth of at `receivedAt`. */
function remaining(secondsAtSend: number | undefined, receivedAt: number, now: number): number | undefined {
	if (secondsAtSend === undefined) {
		return undefined;
	}
	const left = math.ceil(secondsAtSend - (now - receivedAt));
	return left > 0 ? left : undefined;
}

export function GhostHud({
	remote,
	state,
	receivedAt,
	attackWindow,
	attackWindowReceivedAt,
}: {
	remote: RemoteEvent;
	state?: SpookState;
	receivedAt: number;
	attackWindow?: AttackWindowState;
	attackWindowReceivedAt: number;
}) {
	const phase = usePhase();
	const now = useNow();
	const nextIn = remaining(state?.nextChargeIn, receivedAt, now);
	const attackLeft = remaining(attackWindow?.activeFor, attackWindowReceivedAt, now);
	const send = React.useMemo(() => serverSender<GameClientMessages>(remote), [remote]);
	const active = phase === "Hunt" && state !== undefined;

	React.useEffect(() => {
		if (!active) {
			return;
		}
		for (const spook of SPOOKS) {
			ContextActionService.BindAction(
				`Spook${spook.kind}`,
				(_, inputState) => {
					if (inputState === Enum.UserInputState.Begin) {
						send("Spook", spook.kind);
					}
					return Enum.ContextActionResult.Sink;
				},
				false,
				spook.key,
			);
		}
		return () => {
			SPOOKS.forEach((spook) => ContextActionService.UnbindAction(`Spook${spook.kind}`));
		};
	}, [active]);

	if (!active || !state) {
		return undefined;
	}

	const canSpook = state.charges > 0;
	const attacking = attackLeft !== undefined;

	// A slim column on the right edge, vertically centred a little high: clear of the centre
	// (where the action is), the top-right player list, and the touch jump button bottom-right.
	// On a tablet it sits under the right thumb.
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={4}>
			<frame
				Size={new UDim2(0, PANEL_WIDTH, 0, 0)}
				AutomaticSize={Enum.AutomaticSize.Y}
				Position={new UDim2(1, -10, 0.42, 0)}
				AnchorPoint={new Vector2(1, 0.5)}
				BackgroundColor3={new Color3(0.05, 0.05, 0.08)}
				BackgroundTransparency={0.35}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 10)} />
				<uipadding
					PaddingTop={new UDim(0, 8)}
					PaddingBottom={new UDim(0, 8)}
					PaddingLeft={new UDim(0, 8)}
					PaddingRight={new UDim(0, 8)}
				/>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					Padding={new UDim(0, 6)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				<ChargePips charges={state.charges} max={state.maxCharges} nextIn={nextIn} />
				{SPOOKS.map((spook, i) => (
					<textbutton
						key={spook.kind}
						LayoutOrder={i + 1}
						Size={new UDim2(1, 0, 0, 44)}
						BackgroundColor3={canSpook ? new Color3(0.25, 0.3, 0.45) : new Color3(0.15, 0.15, 0.18)}
						BorderSizePixel={0}
						AutoButtonColor={canSpook}
						Font={Enum.Font.GothamBold}
						TextSize={15}
						TextColor3={canSpook ? new Color3(1, 1, 1) : new Color3(0.5, 0.5, 0.55)}
						Text={`${spook.label} [${spook.hint}]`}
						Event={{ Activated: () => send("Spook", spook.kind) }}
					>
						<uicorner CornerRadius={new UDim(0, 8)} />
					</textbutton>
				))}
				<textlabel
					LayoutOrder={10}
					Size={new UDim2(1, 0, 0, attacking ? 40 : 34)}
					BackgroundColor3={attacking ? new Color3(0.55, 0.15, 0.15) : new Color3(0.12, 0.12, 0.15)}
					BackgroundTransparency={attacking ? 0 : 0.3}
					BorderSizePixel={0}
					Font={Enum.Font.GothamBold}
					TextSize={attacking ? 15 : 12}
					TextWrapped={true}
					TextColor3={attacking ? new Color3(1, 1, 1) : new Color3(0.65, 0.65, 0.72)}
					Text={attacking ? `VISIBLE ${attackLeft}s\nuse your knife!` : "Scream to show\nyourself and attack"}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
				</textlabel>
			</frame>
		</screengui>
	);
}

const PANEL_WIDTH = 150;
const PIP_SIZE = 14;

/** Charge pips drawn as circles (not "●" text, which some fonts lack), plus the recharge timer. */
function ChargePips({ charges, max, nextIn }: { charges: number; max: number; nextIn?: number }) {
	const pips: React.Element[] = [];
	for (let i = 0; i < max; i++) {
		const filled = i < charges;
		pips.push(
			<frame
				key={`pip${i}`}
				LayoutOrder={i}
				Size={new UDim2(0, PIP_SIZE, 0, PIP_SIZE)}
				BackgroundColor3={new Color3(0.7, 0.82, 1)}
				BackgroundTransparency={filled ? 0 : 1}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(1, 0)} />
				<uistroke Color={new Color3(0.7, 0.82, 1)} Thickness={2} />
			</frame>,
		);
	}
	return (
		<frame LayoutOrder={0} Size={new UDim2(1, 0, 0, 38)} BackgroundTransparency={1}>
			<textlabel
				Size={new UDim2(1, 0, 0, 16)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				TextSize={14}
				TextXAlignment={Enum.TextXAlignment.Left}
				TextColor3={new Color3(0.7, 0.82, 1)}
				Text={nextIn !== undefined ? `SPOOKS  +1 in ${nextIn}s` : "SPOOKS  full"}
			/>
			<frame Size={new UDim2(1, 0, 0, PIP_SIZE)} Position={new UDim2(0, 2, 0, 21)} BackgroundTransparency={1}>
				<uilistlayout
					FillDirection={Enum.FillDirection.Horizontal}
					Padding={new UDim(0, 8)}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
				{pips}
			</frame>
		</frame>
	);
}
