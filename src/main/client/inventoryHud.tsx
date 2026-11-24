import React from "@rbxts/react";
import { STACK_SIZE } from "shared/inventory";
import { serverSender } from "shared/net";
import { GameClientMessages } from "shared/remotes";
import { gainStore } from "./gainFeed";
import { coinsStore, inventoryStore, useStore } from "./gameState";
import { useTaken } from "./spectate";

/**
 * Your slots and coins, down the right edge (clear of the touch joystick and jump button). Tap a
 * slot for Use (medkits) and Drop. The server checks both. What you gain shows beside them for a
 * moment ("+3 Nails").
 */

const CELL = 48;
const GAP = 5;
const ROWS = 6;

const PANEL = new Color3(0.05, 0.05, 0.07);
const GOLD = new Color3(1, 0.85, 0.4);

function SmallButton({ text, x, onClick }: { text: string; x: number; onClick: () => void }) {
	return (
		<textbutton
			Size={new UDim2(0, 62, 0, 36)}
			Position={new UDim2(0, x, 0.5, 0)}
			AnchorPoint={new Vector2(1, 0.5)}
			BackgroundColor3={new Color3(0.2, 0.2, 0.25)}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBold}
			TextSize={15}
			TextColor3={new Color3(1, 1, 1)}
			Text={text}
			Event={{ Activated: onClick }}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
		</textbutton>
	);
}

/** "+3 Nails" lines, left of the coins. */
function Gains() {
	const lines = useStore(gainStore);
	return (
		<frame
			Size={new UDim2(0, 130, 0, 0)}
			Position={new UDim2(1, -GAP - 90 - 8, 0, 4)}
			AnchorPoint={new Vector2(1, 0)}
			BackgroundTransparency={1}
		>
			<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} />
			{lines.map((line, i) => (
				<textlabel
					key={line.item}
					LayoutOrder={i}
					Size={new UDim2(1, 0, 0, 22)}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBold}
					TextSize={16}
					TextColor3={line.item === "Coins" ? GOLD : new Color3(0.95, 0.9, 0.8)}
					TextStrokeTransparency={0.5}
					TextXAlignment={Enum.TextXAlignment.Right}
					Text={`+${line.count} ${line.item}`}
				/>
			))}
		</frame>
	);
}

export function InventoryHud({ remote }: { remote: RemoteEvent }) {
	const send = React.useMemo(() => serverSender<GameClientMessages>(remote), [remote]);
	const inventory = useStore(inventoryStore);
	const coins = useStore(coinsStore);
	const taken = useTaken();
	const [selected, setSelected] = React.useState<number>();

	// What's in the slots changed, so the selection may no longer mean the same thing.
	React.useEffect(() => setSelected(undefined), [inventory]);

	if (taken) {
		return undefined;
	}
	const columns = math.ceil(inventory.slots / ROWS);
	const rows = math.min(inventory.slots, ROWS);
	const cells: React.Element[] = [];
	for (let i = 0; i < inventory.slots; i++) {
		const stack = inventory.stacks[i];
		const isSelected = selected === i && stack !== undefined;
		cells.push(
			<textbutton
				key={`slot${i}`}
				LayoutOrder={i}
				BackgroundColor3={isSelected ? new Color3(0.25, 0.22, 0.14) : PANEL}
				BackgroundTransparency={0.3}
				BorderSizePixel={0}
				AutoButtonColor={stack !== undefined}
				Font={Enum.Font.GothamBold}
				TextSize={12}
				TextColor3={new Color3(0.95, 0.9, 0.8)}
				Text={stack ? `${stack.item}\n${stack.count}/${STACK_SIZE[stack.item]}` : ""}
				Event={{ Activated: () => setSelected(stack && !isSelected ? i : undefined) }}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				{isSelected ? <SmallButton text="Drop" x={-8} onClick={() => send("DropItem", i)} /> : undefined}
				{isSelected && stack.item === "Medkit" ? (
					<SmallButton text="Use" x={-76} onClick={() => send("UseItem", i)} />
				) : undefined}
			</textbutton>,
		);
	}
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={3}>
			<frame
				Size={new UDim2(0, columns * (CELL + GAP), 0, rows * (CELL + GAP) + 34)}
				Position={new UDim2(1, -10, 0.42, 0)}
				AnchorPoint={new Vector2(1, 0.5)}
				BackgroundTransparency={1}
			>
				<Gains />
				<textlabel
					Size={new UDim2(0, 90, 0, 28)}
					Position={new UDim2(1, -GAP, 0, 0)}
					AnchorPoint={new Vector2(1, 0)}
					BackgroundColor3={PANEL}
					BackgroundTransparency={0.3}
					BorderSizePixel={0}
					Font={Enum.Font.GothamBold}
					TextSize={15}
					TextColor3={GOLD}
					Text={`Coins ${coins}`}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
				</textlabel>
				<frame Size={new UDim2(1, 0, 1, -34)} Position={new UDim2(0, 0, 0, 34)} BackgroundTransparency={1}>
					<uigridlayout
						CellSize={new UDim2(0, CELL, 0, CELL)}
						CellPadding={new UDim2(0, GAP, 0, GAP)}
						FillDirection={Enum.FillDirection.Vertical}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					{cells}
				</frame>
			</frame>
		</screengui>
	);
}
