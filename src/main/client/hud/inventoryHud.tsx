import React from "@rbxts/react";
import { GuiService } from "@rbxts/services";
import { isUsable, itemName, STACK_SIZE } from "shared/items/inventory";
import { serverSender } from "shared/core/net";
import { GameClientMessages } from "shared/core/remotes";
import { inventorySpace, slotGrid } from "shared/items/slotLayout";
import { isTouch } from "../core/device";
import { gainStore } from "./gainFeed";
import { coinsStore, inventoryStore, useStore } from "../core/gameState";
import { useTaken } from "../run/spectate";
import { useViewport } from "../core/useViewport";
import { BUTTON, CREAM, GOLD, PANEL, WHITE } from "../core/theme";

/**
 * Your slots and coins, down the right edge, in as many columns as it takes to stay clear of the
 * jump button (shared/items/slotLayout.ts). Tap a
 * slot for Use (medkits, shutters) and Drop. The server checks both. What you gain shows beside them for a
 * moment ("+3 Nails").
 */

const CELL = 48;
const GAP = 5;
/** Most rows before another column. */
const ROWS = 6;
const COINS_WIDTH = 90;
/** Height of the coins, above the slots. */
const HEADER = 34;

function SmallButton({ text, x, onClick }: { text: string; x: number; onClick: () => void }) {
	return (
		<textbutton
			Size={new UDim2(0, 62, 0, 36)}
			Position={new UDim2(0, x, 0.5, 0)}
			AnchorPoint={new Vector2(1, 0.5)}
			BackgroundColor3={BUTTON}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBold}
			TextSize={15}
			TextColor3={WHITE}
			ZIndex={5} // over the next column
			Text={text}
			Event={{ Activated: onClick }}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
		</textbutton>
	);
}

/** "+3 Nails" lines, left of the coins and slots. */
function Gains({ panelWidth }: { panelWidth: number }) {
	const lines = useStore(gainStore);
	return (
		<frame
			Size={new UDim2(0, 130, 0, 0)}
			Position={new UDim2(1, -math.max(panelWidth, COINS_WIDTH + GAP) - 8, 0, 4)}
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
					TextColor3={line.item === "Coins" ? GOLD : CREAM}
					TextStrokeTransparency={0.5}
					TextXAlignment={Enum.TextXAlignment.Right}
					Text={`+${line.count} ${itemName(line.item)}`}
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
	const viewport = useViewport();
	const [selected, setSelected] = React.useState<number>();

	// What's in the slots changed, so the selection may no longer mean the same thing.
	React.useEffect(() => setSelected(undefined), [inventory]);

	if (taken) {
		return undefined;
	}
	const touch = isTouch();
	const space = inventorySpace(viewport.X, viewport.Y, GuiService.GetGuiInset()[0].Y, touch);
	const { rows, columns } = slotGrid(inventory.slots, space - HEADER, CELL + GAP, ROWS);
	const panelWidth = columns * (CELL + GAP);
	const cells: React.Element[] = [];
	for (let i = 0; i < inventory.slots; i++) {
		const stack = inventory.stacks[i];
		const isSelected = selected === i && stack !== undefined;
		cells.push(
			<textbutton
				key={`slot${i}`}
				LayoutOrder={i}
				BackgroundColor3={isSelected ? new Color3(0.25, 0.22, 0.14) : PANEL}
				BackgroundTransparency={stack ? 0.3 : 0.85}
				BorderSizePixel={0}
				AutoButtonColor={stack !== undefined}
				Font={Enum.Font.GothamBold}
				TextSize={12}
				TextColor3={CREAM}
				Text={stack ? `${itemName(stack.item)}\n${stack.count}/${STACK_SIZE[stack.item]}` : ""}
				Event={{ Activated: () => setSelected(stack && !isSelected ? i : undefined) }}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
				{isSelected ? <SmallButton text="Drop" x={-8} onClick={() => send("DropItem", i)} /> : undefined}
				{isSelected && isUsable(stack.item) ? (
					<SmallButton text="Use" x={-76} onClick={() => send("UseItem", i)} />
				) : undefined}
			</textbutton>,
		);
	}
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={3}>
			<frame
				Size={new UDim2(0, panelWidth, 0, rows * (CELL + GAP) + HEADER)}
				Position={touch ? new UDim2(1, -10, 0, 0) : new UDim2(1, -10, 0.42, 0)}
				AnchorPoint={new Vector2(1, touch ? 0 : 0.5)}
				BackgroundTransparency={1}
			>
				<Gains panelWidth={panelWidth} />
				<textlabel
					Size={new UDim2(0, COINS_WIDTH, 0, 28)}
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
				<frame
					Size={new UDim2(1, 0, 1, -HEADER)}
					Position={new UDim2(0, 0, 0, HEADER)}
					BackgroundTransparency={1}
				>
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
