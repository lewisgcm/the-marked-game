import React from "@rbxts/react";
import { Players, RunService } from "@rbxts/services";
import { rootOf } from "shared/characters";
import { useViewport } from "./useViewport";

/**
 * A list of things to buy or sell (the workbench, the traders). Closes with the X, or when you
 * walk away. Scrolls when it's taller than the screen.
 */

const WIDTH = 380;
const ROW = 62;
const GAP = 8;
const TITLE = 54;
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

export function ShopRow({ order, name, description, button, enabled, highlight, onPress }: ShopRowProps) {
	const label = (y: number, text: string, size: number, color: Color3, bold: boolean) => (
		<textlabel
			Size={new UDim2(1, -150, 0, 22)}
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
	const detail = highlight === true ? new Color3(1, 0.85, 0.4) : new Color3(0.65, 0.65, 0.7);
	return (
		<frame
			LayoutOrder={order}
			Size={new UDim2(1, 0, 0, ROW)}
			BackgroundColor3={new Color3(0.1, 0.1, 0.13)}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
			{label(8, name, 16, new Color3(0.95, 0.93, 0.88), true)}
			{label(32, description, 12, detail, false)}
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
				TextColor3={enabled ? new Color3(1, 1, 1) : new Color3(0.6, 0.6, 0.64)}
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
	const height = math.min(TITLE + rows.size() * (ROW + GAP) + GAP, (viewport.Y * 0.8) / scale);
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={6}>
			<frame
				Size={new UDim2(0, WIDTH, 0, height)}
				Position={new UDim2(0.5, 0, 0.5, 0)}
				AnchorPoint={new Vector2(0.5, 0.5)}
				BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
				BackgroundTransparency={0.1}
				BorderSizePixel={0}
			>
				<uiscale Scale={scale} />
				<uicorner CornerRadius={new UDim(0, 12)} />
				<textlabel
					Size={new UDim2(1, -70, 0, 48)}
					Position={new UDim2(0, 16, 0, 0)}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBlack}
					TextSize={20}
					TextColor3={new Color3(1, 0.85, 0.4)}
					TextXAlignment={Enum.TextXAlignment.Left}
					Text={title}
				/>
				<textbutton
					Size={new UDim2(0, 40, 0, 40)}
					Position={new UDim2(1, -6, 0, 6)}
					AnchorPoint={new Vector2(1, 0)}
					BackgroundColor3={new Color3(0.2, 0.2, 0.25)}
					BorderSizePixel={0}
					Font={Enum.Font.GothamBold}
					TextSize={18}
					TextColor3={new Color3(1, 1, 1)}
					Text="X"
					Event={{ Activated: onClose }}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
				</textbutton>
				<scrollingframe
					Size={new UDim2(1, -24, 1, -TITLE - GAP)}
					Position={new UDim2(0, 12, 0, TITLE)}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					ScrollBarThickness={4}
					ScrollingDirection={Enum.ScrollingDirection.Y}
					CanvasSize={new UDim2(0, 0, 0, rows.size() * (ROW + GAP) - GAP)}
				>
					<uilistlayout Padding={new UDim(0, GAP)} SortOrder={Enum.SortOrder.LayoutOrder} />
					{rows.map((row) => (
						<ShopRow key={`row${row.order}`} {...row} />
					))}
				</scrollingframe>
			</frame>
		</screengui>
	);
}
