import React from "@rbxts/react";
import { UserInputService } from "@rbxts/services";
import { BaseStatus, unreadCount, WalkieMessage } from "shared/economy/walkie";
import { isTouch } from "../core/device";
import { useStore, walkieOpenStore, walkieStore } from "../core/gameState";
import { Panel } from "../core/panel";
import { useViewport } from "../core/useViewport";
import { GOLD, GREEN, GREY, PALE, PANEL, RED, ROW } from "../core/theme";
import { markMeter } from "shared/economy/baseMarks";

/**
 * The walkie-talkie: a button on the left (or T) opens the bases and the message log. New messages
 * pop up in the message bar (messageQueue.ts). Display only.
 */

const OPEN_KEY = Enum.KeyCode.T;

/** One entry in the list: a heading, what's beside it, and a wrapped line below. */
function Entry(props: { order: number; heading: string; aside: string; text: string; color: Color3 }) {
	return (
		<frame
			LayoutOrder={props.order}
			Size={new UDim2(1, -6, 0, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundColor3={ROW}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<uipadding
				PaddingLeft={new UDim(0, 10)}
				PaddingRight={new UDim(0, 10)}
				PaddingTop={new UDim(0, 6)}
				PaddingBottom={new UDim(0, 8)}
			/>
			<textlabel
				Size={new UDim2(0.5, 0, 0, 20)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				TextSize={15}
				TextColor3={PALE}
				TextXAlignment={Enum.TextXAlignment.Left}
				Text={props.heading}
			/>
			<textlabel
				Size={new UDim2(0.5, 0, 0, 20)}
				Position={new UDim2(0.5, 0, 0, 0)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				TextSize={12}
				TextColor3={props.color}
				TextXAlignment={Enum.TextXAlignment.Right}
				Text={props.aside}
			/>
			<textlabel
				Size={new UDim2(1, 0, 0, 0)}
				Position={new UDim2(0, 0, 0, 22)}
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
				Font={Enum.Font.Gotham}
				TextSize={14}
				TextColor3={GREY}
				TextXAlignment={Enum.TextXAlignment.Left}
				TextWrapped={true}
				Text={props.text}
			/>
		</frame>
	);
}

function Heading({ order, text }: { order: number; text: string }) {
	return (
		<textlabel
			LayoutOrder={order}
			Size={new UDim2(1, 0, 0, 22)}
			BackgroundTransparency={1}
			Font={Enum.Font.GothamBlack}
			TextSize={14}
			TextColor3={GOLD}
			TextXAlignment={Enum.TextXAlignment.Left}
			Text={text}
		/>
	);
}

function Log(props: { bases: BaseStatus[]; messages: WalkieMessage[]; onClose: () => void }) {
	const viewport = useViewport();
	const { bases, messages } = props;
	const entries: React.Element[] = [<Heading key="bases" order={0} text="BASES" />];
	for (const base of bases) {
		entries.push(
			<Entry
				key={`base${base.name}`}
				order={entries.size()}
				heading={base.marks !== undefined ? `${base.name}  ${markMeter(base.marks)}` : base.name}
				aside={base.status}
				text={base.detail}
				color={base.alarm ? RED : base.open ? GREEN : GREY}
			/>,
		);
	}
	entries.push(<Heading key="messages" order={entries.size()} text="MESSAGES" />);
	// Newest first.
	for (let i = messages.size() - 1; i >= 0; i--) {
		const message = messages[i];
		entries.push(
			<Entry
				key={`message${message.id}`}
				order={entries.size()}
				heading={message.from}
				aside={`Day ${message.day}`}
				text={message.text}
				color={GREY}
			/>,
		);
	}
	return (
		<Panel
			title="Walkie-talkie"
			titleColor={GREEN}
			size={new Vector2(math.min(320, viewport.X * 0.6), math.min(400, viewport.Y * 0.75))}
			position={new UDim2(0, 10, 0.5, 0)}
			anchor={new Vector2(0, 0.5)}
			gap={6}
			onClose={props.onClose}
		>
			{entries}
		</Panel>
	);
}

/** A little walkie-talkie, drawn from frames (fonts don't have one). */
function WalkieIcon({ color }: { color: Color3 }) {
	const box = (key: string, x: number, y: number, width: number, height: number, fill: Color3) => (
		<frame
			key={key}
			Size={new UDim2(0, width, 0, height)}
			Position={new UDim2(0, x, 0, y)}
			BackgroundColor3={fill}
			BorderSizePixel={0}
		/>
	);
	return (
		<frame Size={new UDim2(0, 16, 0, 30)} Position={new UDim2(0, 12, 0, 5)} BackgroundTransparency={1}>
			{box("antenna", 1, 0, 3, 10, color)}
			{box("body", 0, 9, 16, 21, color)}
			{box("screen", 3, 12, 10, 5, PANEL)}
			{box("speaker1", 3, 20, 10, 2, PANEL)}
			{box("speaker2", 3, 24, 10, 2, PANEL)}
		</frame>
	);
}

/** Top left on touch, clear of the joystick; halfway down otherwise, clear of the chat. */
function OpenButton({ unread, onPress }: { unread: boolean; onPress: () => void }) {
	const touch = isTouch();
	return (
		<textbutton
			Size={new UDim2(0, 40, 0, 40)}
			Position={touch ? new UDim2(0, 10, 0, 4) : new UDim2(0, 10, 0.5, 0)}
			AnchorPoint={new Vector2(0, touch ? 0 : 0.5)}
			BackgroundColor3={PANEL}
			BackgroundTransparency={0.4}
			BorderSizePixel={0}
			Text=""
			Event={{ Activated: onPress }}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<WalkieIcon color={unread ? PALE : GREY} />
			{unread ? (
				<frame
					Size={new UDim2(0, 11, 0, 11)}
					Position={new UDim2(1, -2, 0, 2)}
					AnchorPoint={new Vector2(0.5, 0.5)}
					BackgroundColor3={GREEN}
					BorderSizePixel={0}
				>
					<uicorner CornerRadius={new UDim(1, 0)} />
				</frame>
			) : undefined}
		</textbutton>
	);
}

export function WalkieUi() {
	const { messages, bases } = useStore(walkieStore);
	const open = useStore(walkieOpenStore);
	const [lastRead, setLastRead] = React.useState(0);

	React.useEffect(() => {
		const connection = UserInputService.InputBegan.Connect((input, handled) => {
			if (!handled && input.KeyCode === OPEN_KEY) {
				walkieOpenStore.set(!walkieOpenStore.get());
			}
		});
		return () => connection.Disconnect();
	}, []);

	// Anything that arrives while it's open counts as read.
	React.useEffect(() => {
		if (open && messages.size() > 0) {
			setLastRead(messages[messages.size() - 1].id);
		}
	}, [open, messages]);

	if (bases.size() === 0) {
		return undefined; // nothing from the server yet
	}
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={4}>
			{open ? (
				<Log bases={bases} messages={messages} onClose={() => walkieOpenStore.set(false)} />
			) : (
				<OpenButton unread={unreadCount(messages, lastRead) > 0} onPress={() => walkieOpenStore.set(true)} />
			)}
		</screengui>
	);
}
