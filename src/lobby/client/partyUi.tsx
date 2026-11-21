import React from "@rbxts/react";
import { TweenService } from "@rbxts/services";

export type PartyUiMode =
	{ kind: "hidden" } | { kind: "create"; lowest: number; highest: number; expireSeconds: number } | { kind: "party" };

export interface PartyUiProps {
	mode: PartyUiMode;
	onCreate: (size: number) => void;
}

export function PartyUi({ mode, onCreate }: PartyUiProps) {
	return (
		<screengui ResetOnSpawn={false} Enabled={mode.kind !== "hidden"}>
			{mode.kind === "create" ? (
				<CreateFrame
					lowest={mode.lowest}
					highest={mode.highest}
					expireSeconds={mode.expireSeconds}
					onCreate={onCreate}
				/>
			) : mode.kind === "party" ? (
				<InPartyBanner />
			) : undefined}
		</screengui>
	);
}

interface CreateFrameProps {
	lowest: number;
	highest: number;
	expireSeconds: number;
	onCreate: (size: number) => void;
}

function CreateFrame({ lowest, highest, expireSeconds, onCreate }: CreateFrameProps) {
	const [size, setSize] = React.useState(lowest);
	const fillRef = React.useRef<Frame>();

	React.useEffect(() => {
		const fill = fillRef.current;
		if (!fill) {
			return;
		}
		const tween = TweenService.Create(
			fill,
			new TweenInfo(expireSeconds, Enum.EasingStyle.Linear, Enum.EasingDirection.Out),
			{ Size: new UDim2(0, 0, 1, 0) },
		);
		tween.Play();
		return () => tween.Cancel();
	}, [expireSeconds]);

	return (
		<frame
			Size={new UDim2(0, 300, 0, 240)}
			Position={new UDim2(0.5, 0, 0.5, 0)}
			AnchorPoint={new Vector2(0.5, 0.5)}
			BackgroundColor3={new Color3(0.1, 0.1, 0.12)}
			BorderSizePixel={0}
		>
			<textlabel
				Size={new UDim2(1, 0, 0.25, 0)}
				BackgroundTransparency={1}
				TextColor3={new Color3(1, 1, 1)}
				Font={Enum.Font.GothamBold}
				TextScaled={true}
				Text="Create Party"
			/>
			<textbutton
				Size={new UDim2(0.22, 0, 0.3, 0)}
				Position={new UDim2(0.05, 0, 0.3, 0)}
				BackgroundColor3={new Color3(0.7, 0.2, 0.2)}
				BorderSizePixel={0}
				TextColor3={new Color3(1, 1, 1)}
				Font={Enum.Font.GothamBold}
				TextScaled={true}
				Text="-"
				Event={{
					Activated: () => setSize((s) => math.clamp(s - 1, lowest, highest)),
				}}
			/>
			<textlabel
				Size={new UDim2(0.46, 0, 0.3, 0)}
				Position={new UDim2(0.27, 0, 0.3, 0)}
				BackgroundColor3={new Color3(0.2, 0.2, 0.25)}
				BorderSizePixel={0}
				TextColor3={new Color3(1, 1, 1)}
				Font={Enum.Font.GothamBold}
				TextScaled={true}
				Text={tostring(size)}
			/>
			<textbutton
				Size={new UDim2(0.22, 0, 0.3, 0)}
				Position={new UDim2(0.73, 0, 0.3, 0)}
				BackgroundColor3={new Color3(0.2, 0.6, 0.3)}
				BorderSizePixel={0}
				TextColor3={new Color3(1, 1, 1)}
				Font={Enum.Font.GothamBold}
				TextScaled={true}
				Text="+"
				Event={{
					Activated: () => setSize((s) => math.clamp(s + 1, lowest, highest)),
				}}
			/>
			<textbutton
				Size={new UDim2(0.9, 0, 0.25, 0)}
				Position={new UDim2(0.05, 0, 0.66, 0)}
				BackgroundColor3={new Color3(0.15, 0.5, 0.85)}
				BorderSizePixel={0}
				TextColor3={new Color3(1, 1, 1)}
				Font={Enum.Font.GothamBold}
				TextScaled={true}
				Text="Create"
				Event={{
					Activated: () => onCreate(size),
				}}
			/>
			<frame
				Size={new UDim2(0.9, 0, 0.04, 0)}
				Position={new UDim2(0.05, 0, 0.94, 0)}
				BackgroundColor3={new Color3(0.3, 0.3, 0.3)}
				BorderSizePixel={0}
			>
				<frame
					ref={fillRef}
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={new Color3(0.85, 0.5, 0.2)}
					BorderSizePixel={0}
				/>
			</frame>
		</frame>
	);
}

/**
 * Small hint bar at the bottom of the screen while in a party. Kept out of the way so players
 * can watch others join the pad; leaving is done by walking off the pad.
 */
function InPartyBanner() {
	return (
		<textlabel
			Size={new UDim2(0, 340, 0, 36)}
			Position={new UDim2(0.5, 0, 1, -24)}
			AnchorPoint={new Vector2(0.5, 1)}
			BackgroundColor3={new Color3(0.1, 0.1, 0.12)}
			BackgroundTransparency={0.35}
			BorderSizePixel={0}
			TextColor3={new Color3(1, 1, 1)}
			Font={Enum.Font.GothamBold}
			TextSize={16}
			Text="In party — step off the pad to leave"
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
		</textlabel>
	);
}
