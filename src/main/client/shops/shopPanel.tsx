import React from "@rbxts/react";
import { Players, RunService } from "@rbxts/services";
import { rootOf } from "shared/core/characters";
import { Panel, PANEL_FOOT, PANEL_TITLE } from "../core/panel";
import { useViewport } from "../core/useViewport";
import { GOLD, GREY, ROW, WHITE } from "../core/theme";

/**
 * A list of things to buy or sell (the workbench, the traders). Closes with the X, or when you
 * walk away. Scrolls when it's taller than the screen.
 */

const WIDTH = 380;
const ROW_HEIGHT = 62;
const GAP = 8;
/** Closes past this distance, in studs (the server checks reach on every purchase). */
const CLOSE_DISTANCE = 14;

function isNear(target: Instance | undefined): boolean {
	const root = rootOf(Players.LocalPlayer.Character);
	return (
		root !== undefined &&
		target !== undefined &&
		target.IsA("BasePart") &&
		target.Position.sub(root.Position).Magnitude <= CLOSE_DISTANCE
	);
}

export interface ShopRowProps {
	order: number;
	name: string;
	description: string;
	button: string;
	enabled: boolean;
	highlight?: boolean;
	onPress: () => void;
}

function ShopRow({ order, name, description, button, enabled, highlight, onPress }: ShopRowProps) {
	const label = (y: number, text: string, size: number, height: number, color: Color3, bold: boolean) => (
		<textlabel
			Size={new UDim2(1, -150, 0, height)}
			Position={new UDim2(0, 12, 0, y)}
			BackgroundTransparency={1}
			Font={bold ? Enum.Font.GothamBold : Enum.Font.Gotham}
			TextSize={size}
			TextColor3={color}
			TextXAlignment={Enum.TextXAlignment.Left}
			TextWrapped={true}
			Text={text}
		/>
	);
	const detail = highlight === true ? GOLD : GREY;
	return (
		<frame LayoutOrder={order} Size={new UDim2(1, 0, 0, ROW_HEIGHT)} BackgroundColor3={ROW} BorderSizePixel={0}>
			<uicorner CornerRadius={new UDim(0, 8)} />
			{label(8, name, 16, 22, new Color3(0.95, 0.93, 0.88), true)}
			{label(30, description, 12, 28, detail, false)}
			<textbutton
				Size={new UDim2(0, 122, 0, 40)}
				Position={new UDim2(1, -10, 0.5, 0)}
				AnchorPoint={new Vector2(1, 0.5)}
				BackgroundColor3={enabled ? new Color3(0.3, 0.5, 0.35) : new Color3(0.2, 0.2, 0.24)}
				BorderSizePixel={0}
				AutoButtonColor={enabled}
				Font={Enum.Font.GothamBold}
				TextSize={14}
				TextWrapped={true}
				TextColor3={enabled ? WHITE : new Color3(0.6, 0.6, 0.64)}
				Text={button}
				Event={{
					Activated: () => {
						if (enabled) {
							onPress();
						}
					},
				}}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
			</textbutton>
		</frame>
	);
}

interface ShopPanelProps {
	title: string;
	/** The part it's bought from: walking away from it closes the list. */
	target: Instance | undefined;
	rows: ShopRowProps[];
	onClose: () => void;
}

export function ShopPanel({ title, target, rows, onClose }: ShopPanelProps) {
	const viewport = useViewport();

	React.useEffect(() => {
		const connection = RunService.Heartbeat.Connect(() => {
			if (!isNear(target)) {
				onClose();
			}
		});
		return () => connection.Disconnect();
	}, [target]);

	const scale = math.min(1, (viewport.X * 0.94) / WIDTH);
	const height = math.min(PANEL_TITLE + rows.size() * (ROW_HEIGHT + GAP) + PANEL_FOOT, (viewport.Y * 0.8) / scale);
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={6}>
			<Panel
				title={title}
				titleColor={GOLD}
				size={new Vector2(WIDTH, height)}
				position={new UDim2(0.5, 0, 0.5, 0)}
				anchor={new Vector2(0.5, 0.5)}
				scale={scale}
				contentHeight={rows.size() * (ROW_HEIGHT + GAP) - GAP}
				gap={GAP}
				onClose={onClose}
			>
				{rows.map((row) => (
					<ShopRow key={`row${row.order}`} {...row} />
				))}
			</Panel>
		</screengui>
	);
}
