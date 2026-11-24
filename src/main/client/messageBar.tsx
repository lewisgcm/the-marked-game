import React from "@rbxts/react";
import { UserInputService } from "@rbxts/services";
import { BarKind } from "shared/messages";
import { useStore } from "./gameState";
import { BarView, barStore, feedbackStore } from "./messageQueue";
import { PING, playLocalSound } from "./sound";
import { useViewport } from "./useViewport";
import { GREEN, GREY, PALE, PANEL } from "./theme";

/**
 * The only two places text pops up: one message at a time under the clock (danger, the walkie,
 * news, Night 1 tips), and a short line near the bottom replying to what you just did.
 */

/** Seconds a reply shows for. */
const FEEDBACK_SECONDS = 2;

const TIP = new Color3(1, 0.92, 0.7);
const REPLY = new Color3(1, 0.85, 0.6);
const TEXT: Record<BarKind, Color3> = {
	Danger: new Color3(1, 0.45, 0.4),
	Walkie: PALE,
	Info: PALE,
};

interface LineProps {
	order: number;
	text: string;
	size: number;
	color: Color3;
}

/** One wrapped, centred line of a message. */
function Line({ order, text, size, color }: LineProps) {
	return (
		<textlabel
			LayoutOrder={order}
			Size={new UDim2(1, 0, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundTransparency={1}
			Font={Enum.Font.GothamBold}
			TextSize={size}
			TextColor3={color}
			TextWrapped={true}
			Text={text}
		/>
	);
}

function moreText(more: number): string {
	return `+${more} more on the walkie${UserInputService.KeyboardEnabled ? " (T)" : ""}`;
}

function linesFor({ message, tip }: BarView): LineProps[] {
	if (!message) {
		return tip !== undefined ? [{ order: 1, text: tip, size: 17, color: TIP }] : [];
	}
	const lines: LineProps[] = [];
	if (message.from !== undefined) {
		lines.push({ order: 0, text: message.from, size: 13, color: GREEN });
	}
	lines.push({ order: 1, text: message.text, size: 17, color: TEXT[message.kind] });
	if (message.more !== undefined && message.more > 0) {
		lines.push({ order: 2, text: moreText(message.more), size: 12, color: GREY });
	}
	return lines;
}

function TopBar() {
	const view = useStore(barStore);
	const viewport = useViewport();
	const message = view.message;

	React.useEffect(() => {
		if (message?.kind === "Walkie") {
			playLocalSound(PING, 0.4, 0.6); // a crackle, for now
		}
	}, [message]);

	const lines = linesFor(view);
	if (lines.size() === 0) {
		return undefined;
	}
	return (
		<frame
			Size={new UDim2(0, math.min(440, viewport.X * 0.46), 0, 0)}
			Position={new UDim2(0.5, 0, 0, 54)}
			AnchorPoint={new Vector2(0.5, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundColor3={PANEL}
			BackgroundTransparency={0.3}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<uipadding
				PaddingLeft={new UDim(0, 12)}
				PaddingRight={new UDim(0, 12)}
				PaddingTop={new UDim(0, 7)}
				PaddingBottom={new UDim(0, 8)}
			/>
			<uilistlayout Padding={new UDim(0, 2)} SortOrder={Enum.SortOrder.LayoutOrder} />
			{lines.map((line) => (
				<Line key={`line${line.order}`} {...line} />
			))}
		</frame>
	);
}

function Feedback() {
	const latest = useStore(feedbackStore);
	const viewport = useViewport();
	const [text, setText] = React.useState<string>();

	React.useEffect(() => {
		if (!latest) {
			return;
		}
		setText(latest.text);
		const thread = task.delay(FEEDBACK_SECONDS, () => setText(undefined));
		return () => task.cancel(thread);
	}, [latest]);

	if (text === undefined) {
		return undefined;
	}
	return (
		<textlabel
			Size={new UDim2(0, math.min(420, viewport.X * 0.46), 0, 34)}
			Position={new UDim2(0.5, 0, 1, -110)}
			AnchorPoint={new Vector2(0.5, 1)}
			BackgroundTransparency={1}
			Font={Enum.Font.GothamBold}
			TextSize={17}
			TextColor3={REPLY}
			TextStrokeTransparency={0.4}
			TextWrapped={true}
			Text={text}
		/>
	);
}

export function MessageBar() {
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={7}>
			<TopBar />
			<Feedback />
		</screengui>
	);
}
