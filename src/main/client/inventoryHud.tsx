import React from "@rbxts/react";
import { planksStore, stonesStore, useStore } from "./gameState";
import { useTaken } from "./spectate";

/** Bottom-left: what you're carrying (planks and stones). The slot inventory replaces it in M2. */

/** Matches PlankCarryMax in the server config (display only; the server enforces it). */
const PLANK_CARRY_MAX = 5;

function Line({ text, active, order }: { text: string; active: boolean; order: number }) {
	return (
		<textlabel
			LayoutOrder={order}
			Size={new UDim2(0, 150, 0, 32)}
			BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
			BackgroundTransparency={0.3}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBold}
			TextSize={18}
			TextColor3={active ? new Color3(0.95, 0.8, 0.55) : new Color3(0.6, 0.6, 0.64)}
			Text={text}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
		</textlabel>
	);
}

export function InventoryHud() {
	const planks = useStore(planksStore);
	const stones = useStore(stonesStore);
	const taken = useTaken();
	if (taken) {
		return undefined;
	}
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={3}>
			<frame
				Size={new UDim2(0, 150, 0, 70)}
				Position={new UDim2(0, 12, 1, -12)}
				AnchorPoint={new Vector2(0, 1)}
				BackgroundTransparency={1}
			>
				<uilistlayout
					Padding={new UDim(0, 6)}
					SortOrder={Enum.SortOrder.LayoutOrder}
					VerticalAlignment={Enum.VerticalAlignment.Bottom}
				/>
				<Line order={1} text={`Stones ${stones}`} active={stones > 0} />
				<Line order={2} text={`Planks ${planks}/${PLANK_CARRY_MAX}`} active={planks > 0} />
			</frame>
		</screengui>
	);
}
