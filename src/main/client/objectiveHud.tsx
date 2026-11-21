import React from "@rbxts/react";
import { ReplicatedStorage } from "@rbxts/services";
import { RITUAL_PLACED_ATTRIBUTE } from "shared/objectives";
import { RITUAL_ITEMS } from "shared/ritualItems";
import { ROUND_PHASE_ATTRIBUTE } from "shared/round";
import { inventoryStore, noticeStore, useStore } from "./gameState";

/**
 * Objective HUD: what this hunter carries (bottom-left), ritual progress for everyone
 * (top-right) and short notices (bottom-centre). Display only — the server owns all of it.
 */

const NOTICE_SECONDS = 3;

function useAttribute<T>(name: string, fallback: T): T {
	const [value, setValue] = React.useState<T>((ReplicatedStorage.GetAttribute(name) as T | undefined) ?? fallback);
	React.useEffect(() => {
		const connection = ReplicatedStorage.GetAttributeChangedSignal(name).Connect(() =>
			setValue((ReplicatedStorage.GetAttribute(name) as T | undefined) ?? fallback),
		);
		return () => connection.Disconnect();
	}, [name]);
	return value;
}

function Panel(props: React.PropsWithChildren<{ position: UDim2; anchor: Vector2; size: UDim2 }>) {
	return (
		<frame
			Size={props.size}
			Position={props.position}
			AnchorPoint={props.anchor}
			BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
			BackgroundTransparency={0.3}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<uipadding PaddingLeft={new UDim(0, 12)} PaddingRight={new UDim(0, 12)} />
			{props.children}
		</frame>
	);
}

function Label({ text, color }: { text: string; color?: Color3 }) {
	return (
		<textlabel
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundTransparency={1}
			Font={Enum.Font.GothamBold}
			TextSize={18}
			TextXAlignment={Enum.TextXAlignment.Left}
			TextColor3={color ?? new Color3(0.95, 0.95, 0.97)}
			Text={text}
		/>
	);
}

export function ObjectiveHud({ isHunter }: { isHunter: boolean }) {
	const inventory = useStore(inventoryStore);
	const latestNotice = useStore(noticeStore);
	const [notice, setNotice] = React.useState<string>();
	const placed = useAttribute<number>(RITUAL_PLACED_ATTRIBUTE, 0);
	const phase = useAttribute<string>(ROUND_PHASE_ATTRIBUTE, "Waiting");

	// Show each new notice for NOTICE_SECONDS.
	React.useEffect(() => {
		if (!latestNotice) {
			return;
		}
		setNotice(latestNotice.text);
		const thread = task.delay(NOTICE_SECONDS, () => setNotice(undefined));
		return () => task.cancel(thread);
	}, [latestNotice]);

	if (phase !== "Hunt") {
		return undefined;
	}

	const total = RITUAL_ITEMS.size();
	const carrying = inventory.items.size() > 0 ? inventory.items.join(", ") : "nothing";

	return (
		<screengui ResetOnSpawn={false} DisplayOrder={4}>
			<Panel position={new UDim2(1, -12, 0, 8)} anchor={new Vector2(1, 0)} size={new UDim2(0, 200, 0, 40)}>
				<Label
					text={placed === total ? "Ritual ready — banish it!" : `Ritual: ${placed}/${total} items`}
					color={placed === total ? new Color3(1, 0.6, 0.5) : undefined}
				/>
			</Panel>

			{isHunter ? (
				<Panel position={new UDim2(0, 12, 1, -12)} anchor={new Vector2(0, 1)} size={new UDim2(0, 280, 0, 64)}>
					<uilistlayout
						FillDirection={Enum.FillDirection.Vertical}
						VerticalAlignment={Enum.VerticalAlignment.Center}
					/>
					<frame Size={new UDim2(1, 0, 0, 24)} BackgroundTransparency={1}>
						<Label text={`Keys: ${inventory.keys}`} color={new Color3(0.95, 0.78, 0.3)} />
					</frame>
					<frame Size={new UDim2(1, 0, 0, 24)} BackgroundTransparency={1}>
						<Label text={`Carrying: ${carrying}`} />
					</frame>
				</Panel>
			) : undefined}

			{notice !== undefined ? (
				<textlabel
					Size={new UDim2(0, 420, 0, 40)}
					Position={new UDim2(0.5, 0, 1, -110)}
					AnchorPoint={new Vector2(0.5, 1)}
					BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
					BackgroundTransparency={0.25}
					BorderSizePixel={0}
					Font={Enum.Font.GothamBold}
					TextSize={18}
					TextColor3={new Color3(1, 0.85, 0.6)}
					Text={notice}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
				</textlabel>
			) : undefined}
		</screengui>
	);
}
