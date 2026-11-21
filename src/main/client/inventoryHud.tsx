import React from "@rbxts/react";
import { planksStore, useStore } from "./gameState";
import { useTaken } from "./spectate";

/** Bottom-left: what you're carrying. Just planks for now; the full inventory comes in M2. */

/** Matches PlankCarryMax in the server config (display only; the server enforces it). */
const PLANK_CARRY_MAX = 5;

export function InventoryHud() {
	const planks = useStore(planksStore);
	const taken = useTaken();
	if (taken) {
		return undefined;
	}
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={3}>
			<textlabel
				Size={new UDim2(0, 150, 0, 36)}
				Position={new UDim2(0, 12, 1, -12)}
				AnchorPoint={new Vector2(0, 1)}
				BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
				BackgroundTransparency={0.3}
				BorderSizePixel={0}
				Font={Enum.Font.GothamBold}
				TextSize={18}
				TextColor3={planks > 0 ? new Color3(0.95, 0.8, 0.55) : new Color3(0.6, 0.6, 0.64)}
				Text={`Planks ${planks}/${PLANK_CARRY_MAX}`}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
			</textlabel>
		</screengui>
	);
}
