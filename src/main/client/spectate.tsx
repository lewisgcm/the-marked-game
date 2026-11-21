import React from "@rbxts/react";
import { ContextActionService, Players, Workspace } from "@rbxts/services";
import { TAKEN_ATTRIBUTE } from "shared/combat";
import { spectateStore, useStore } from "./gameState";

/**
 * Spectating for kids who were taken. The server sends the user IDs of the kids still in; the
 * camera follows one, and the arrow keys or buttons switch between them.
 */

const player = Players.LocalPlayer;

export function useTaken(): boolean {
	const read = () => player.GetAttribute(TAKEN_ATTRIBUTE) === true;
	const [dead, setTaken] = React.useState(read());
	React.useEffect(() => {
		const connection = player.GetAttributeChangedSignal(TAKEN_ATTRIBUTE).Connect(() => setTaken(read()));
		return () => connection.Disconnect();
	}, []);
	return dead;
}

export function Spectate() {
	const dead = useTaken();
	const targets = useStore(spectateStore);
	const [index, setIndex] = React.useState(0);

	const cycle = (step: number) =>
		setIndex((i) => (targets.size() === 0 ? 0 : (i + step + targets.size()) % targets.size()));

	React.useEffect(() => {
		if (!dead) {
			return;
		}
		ContextActionService.BindAction(
			"SpectateCycle",
			(_, state, input) => {
				if (state === Enum.UserInputState.Begin) {
					cycle(input.KeyCode === Enum.KeyCode.Left ? -1 : 1);
				}
				return Enum.ContextActionResult.Sink;
			},
			false,
			Enum.KeyCode.Left,
			Enum.KeyCode.Right,
		);
		return () => ContextActionService.UnbindAction("SpectateCycle");
	}, [dead, targets]);

	const target = targets.size() > 0 ? Players.GetPlayerByUserId(targets[index % targets.size()]) : undefined;

	// Point the camera at the current target's humanoid.
	React.useEffect(() => {
		const humanoid = target?.Character?.FindFirstChildOfClass("Humanoid");
		const camera = Workspace.CurrentCamera;
		if (dead && humanoid && camera) {
			camera.CameraType = Enum.CameraType.Custom;
			camera.CameraSubject = humanoid;
		}
	}, [dead, target]);

	if (!dead) {
		return undefined;
	}

	const arrow = (text: string, step: number, x: number) => (
		<textbutton
			Size={new UDim2(0, 44, 0, 44)}
			Position={new UDim2(x, x === 0 ? 8 : -52, 0.5, 0)}
			AnchorPoint={new Vector2(0, 0.5)}
			BackgroundColor3={new Color3(0.2, 0.2, 0.25)}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBlack}
			TextSize={22}
			TextColor3={new Color3(1, 1, 1)}
			Text={text}
			Event={{ Activated: () => cycle(step) }}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
		</textbutton>
	);

	return (
		<screengui ResetOnSpawn={false} DisplayOrder={6}>
			<frame
				Size={new UDim2(0, 420, 0, 60)}
				Position={new UDim2(0.5, 0, 1, -24)}
				AnchorPoint={new Vector2(0.5, 1)}
				BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
				BackgroundTransparency={0.25}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 10)} />
				{arrow("<", -1, 0)}
				<textlabel
					Size={new UDim2(1, -120, 1, 0)}
					Position={new UDim2(0.5, 0, 0, 0)}
					AnchorPoint={new Vector2(0.5, 0)}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBold}
					TextSize={18}
					TextColor3={new Color3(0.95, 0.85, 0.85)}
					Text={target ? `You were taken — spectating ${target.DisplayName}` : "You were taken — no one left"}
				/>
				{arrow(">", 1, 1)}
			</frame>
		</screengui>
	);
}
