import React from "@rbxts/react";
import { BUTTON, PANEL, WHITE } from "./theme";

/** A window with a title, a close button and a scrolling list (the shops, the walkie). */

/** Height of the title bar. */
export const PANEL_TITLE = 54;
/** Space under the list. */
export const PANEL_FOOT = 8;

interface PanelProps {
	title: string;
	titleColor: Color3;
	size: Vector2;
	position: UDim2;
	anchor: Vector2;
	/** Shrinks the whole panel, for small screens. */
	scale?: number;
	/**
	 * Height of all the rows, if it's known. Needed with a scale: Roblox's automatic sizing isn't
	 * reliable inside one.
	 */
	contentHeight?: number;
	/** Space between rows. */
	gap: number;
	onClose: () => void;
	/** The rows. Each sets its LayoutOrder. */
	children?: React.ReactNode;
}

export function Panel(props: PanelProps) {
	return (
		<frame
			Size={new UDim2(0, props.size.X, 0, props.size.Y)}
			Position={props.position}
			AnchorPoint={props.anchor}
			BackgroundColor3={PANEL}
			BackgroundTransparency={0.1}
			BorderSizePixel={0}
		>
			<uiscale Scale={props.scale ?? 1} />
			<uicorner CornerRadius={new UDim(0, 12)} />
			<textlabel
				Size={new UDim2(1, -70, 0, 48)}
				Position={new UDim2(0, 16, 0, 0)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBlack}
				TextSize={20}
				TextColor3={props.titleColor}
				TextXAlignment={Enum.TextXAlignment.Left}
				Text={props.title}
			/>
			<textbutton
				Size={new UDim2(0, 40, 0, 40)}
				Position={new UDim2(1, -6, 0, 6)}
				AnchorPoint={new Vector2(1, 0)}
				BackgroundColor3={BUTTON}
				BorderSizePixel={0}
				Font={Enum.Font.GothamBold}
				TextSize={18}
				TextColor3={WHITE}
				Text="X"
				Event={{ Activated: props.onClose }}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
			</textbutton>
			<scrollingframe
				Size={new UDim2(1, -24, 1, -PANEL_TITLE - PANEL_FOOT)}
				Position={new UDim2(0, 12, 0, PANEL_TITLE)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ScrollBarThickness={4}
				ScrollingDirection={Enum.ScrollingDirection.Y}
				CanvasSize={new UDim2(0, 0, 0, props.contentHeight ?? 0)}
				AutomaticCanvasSize={props.contentHeight === undefined ? Enum.AutomaticSize.Y : Enum.AutomaticSize.None}
			>
				<uilistlayout Padding={new UDim(0, props.gap)} SortOrder={Enum.SortOrder.LayoutOrder} />
				{props.children}
			</scrollingframe>
		</frame>
	);
}
