import React from "@rbxts/react";
import { hintStore, useStore } from "./gameState";

/** Night 1 tips, under the clock. The server decides what they say (shared/hints.ts). */
export function HintHud() {
	const hint = useStore(hintStore);
	if (hint === "") {
		return undefined;
	}
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={3}>
			<textlabel
				AutomaticSize={Enum.AutomaticSize.X}
				Size={new UDim2(0, 0, 0, 34)}
				Position={new UDim2(0.5, 0, 0, 56)}
				AnchorPoint={new Vector2(0.5, 0)}
				BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
				BackgroundTransparency={0.35}
				BorderSizePixel={0}
				Font={Enum.Font.GothamBold}
				TextSize={18}
				TextColor3={new Color3(1, 0.92, 0.7)}
				Text={hint}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				<uipadding PaddingLeft={new UDim(0, 14)} PaddingRight={new UDim(0, 14)} />
			</textlabel>
		</screengui>
	);
}
