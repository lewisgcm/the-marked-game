import React from "@rbxts/react";
import { UserInputService } from "@rbxts/services";
import { BaseStatus, unreadCount, WalkieMessage } from "shared/walkie";
import { useStore, walkieOpenStore, walkieStore } from "./gameState";
import { useViewport } from "./useViewport";

/**
 * The walkie-talkie: a button on the left (or T) opens the bases and the message log. New messages
 * pop up in the message bar (messageQueue.ts). Display only.
 */

const OPEN_KEY = Enum.KeyCode.T;
const PANEL = new Color3(0.05, 0.05, 0.07);
const ROW = new Color3(0.1, 0.1, 0.13);
const PALE = new Color3(0.9, 0.9, 0.92);
const GREY = new Color3(0.65, 0.65, 0.7);
const GREEN = new Color3(0.55, 0.85, 0.55);
const GOLD = new Color3(1, 0.85, 0.4);

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

function Panel(props: { bases: BaseStatus[]; messages: WalkieMessage[]; onClose: () => void }) {
	const viewport = useViewport();
	const { bases, messages } = props;
	const entries: React.Element[] = [<Heading key="bases" order={0} text="BASES" />];
	for (const base of bases) {
		entries.push(
			<Entry
				key={`base${base.name}`}
				order={entries.size()}
				heading={base.name}
				aside={base.status}
				text={base.detail}
				color={base.open ? GREEN : GREY}
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
		<frame
			Size={new UDim2(0, math.min(320, viewport.X * 0.6), 0, math.min(400, viewport.Y * 0.75))}
			Position={new UDim2(0, 10, 0.5, 0)}
			AnchorPoint={new Vector2(0, 0.5)}
			BackgroundColor3={PANEL}
			BackgroundTransparency={0.1}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={new UDim(0, 12)} />
			<textlabel
				Size={new UDim2(1, -70, 0, 48)}
				Position={new UDim2(0, 14, 0, 0)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBlack}
				TextSize={20}
				TextColor3={GREEN}
				TextXAlignment={Enum.TextXAlignment.Left}
				Text="Walkie-talkie"
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
				Event={{ Activated: props.onClose }}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
			</textbutton>
			<scrollingframe
				Size={new UDim2(1, -20, 1, -60)}
				Position={new UDim2(0, 12, 0, 52)}
				BackgroundTransparency={1}
				BorderSizePixel={0}
				ScrollBarThickness={4}
				ScrollingDirection={Enum.ScrollingDirection.Y}
				CanvasSize={new UDim2(0, 0, 0, 0)}
				AutomaticCanvasSize={Enum.AutomaticSize.Y}
			>
				<uilistlayout Padding={new UDim(0, 6)} SortOrder={Enum.SortOrder.LayoutOrder} />
				{entries}
			</scrollingframe>
		</frame>
	);
}

function OpenButton({ unread, onPress }: { unread: number; onPress: () => void }) {
	return (
		<textbutton
			Size={new UDim2(0, 84, 0, 40)}
			Position={new UDim2(0, 10, 0.5, 0)}
			AnchorPoint={new Vector2(0, 0.5)}
			BackgroundColor3={PANEL}
			BackgroundTransparency={0.3}
			BorderSizePixel={0}
			Font={Enum.Font.GothamBold}
			TextSize={14}
			TextColor3={unread > 0 ? GREEN : GREY}
			Text={unread > 0 ? `Walkie (${unread})` : "Walkie"}
			Event={{ Activated: onPress }}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
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
				<Panel bases={bases} messages={messages} onClose={() => walkieOpenStore.set(false)} />
			) : (
				<OpenButton unread={unreadCount(messages, lastRead)} onPress={() => walkieOpenStore.set(true)} />
			)}
		</screengui>
	);
}
