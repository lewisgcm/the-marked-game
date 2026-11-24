import React from "@rbxts/react";
import { CollectionService, Players, RunService } from "@rbxts/services";
import { rootOf } from "shared/characters";
import { serverSender } from "shared/net";
import { GameClientMessages } from "shared/remotes";
import { WORKBENCH_TAG } from "shared/tags";
import { findUpgrade, Upgrade, UPGRADES, UpgradeStatus, upgradeStatus } from "shared/upgrades";
import { coinsStore, upgradesStore, useStore, workbenchOpenStore } from "./gameState";
import { useTaken } from "./spectate";
import { useViewport } from "./useViewport";

/** The workbench's list. Opened by its prompt; closes with the X, or when you walk away. */

const WIDTH = 380;
const ROW = 62;
/** Closes past this distance from the bench, in studs (the server checks reach on every purchase). */
const CLOSE_DISTANCE = 14;

function buttonText(upgrade: Upgrade, status: UpgradeStatus): string {
	if (status === "owned") {
		return "Owned";
	}
	if (status === "needsOther" && upgrade.needs) {
		return `Needs ${findUpgrade(upgrade.needs).name.lower()}`;
	}
	return `${upgrade.cost} coins`;
}

function Row({ upgrade, status, onBuy }: { upgrade: Upgrade; status: UpgradeStatus; onBuy: () => void }) {
	const canBuy = status === "ok";
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
	return (
		<frame Size={new UDim2(1, 0, 0, ROW)} BackgroundColor3={new Color3(0.1, 0.1, 0.13)} BorderSizePixel={0}>
			<uicorner CornerRadius={new UDim(0, 8)} />
			{label(8, upgrade.name, 16, new Color3(0.95, 0.93, 0.88), true)}
			{label(32, upgrade.description, 12, new Color3(0.65, 0.65, 0.7), false)}
			<textbutton
				Size={new UDim2(0, 122, 0, 40)}
				Position={new UDim2(1, -10, 0.5, 0)}
				AnchorPoint={new Vector2(1, 0.5)}
				BackgroundColor3={canBuy ? new Color3(0.3, 0.5, 0.35) : new Color3(0.2, 0.2, 0.24)}
				BorderSizePixel={0}
				AutoButtonColor={canBuy}
				Font={Enum.Font.GothamBold}
				TextSize={14}
				TextWrapped={true}
				TextColor3={canBuy ? new Color3(1, 1, 1) : new Color3(0.6, 0.6, 0.64)}
				Text={buttonText(upgrade, status)}
				Event={{
					Activated: () => {
						if (canBuy) {
							onBuy();
						}
					},
				}}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
			</textbutton>
		</frame>
	);
}

function nearBench(): boolean {
	const bench = CollectionService.GetTagged(WORKBENCH_TAG)[0];
	const root = rootOf(Players.LocalPlayer.Character);
	return (
		root !== undefined &&
		bench !== undefined &&
		bench.IsA("BasePart") &&
		bench.Position.sub(root.Position).Magnitude <= CLOSE_DISTANCE
	);
}

export function WorkbenchUi({ remote }: { remote: RemoteEvent }) {
	const send = React.useMemo(() => serverSender<GameClientMessages>(remote), [remote]);
	const open = useStore(workbenchOpenStore);
	const coins = useStore(coinsStore);
	const owned = useStore(upgradesStore);
	const taken = useTaken();
	const viewport = useViewport();

	React.useEffect(() => {
		if (!open) {
			return;
		}
		const connection = RunService.Heartbeat.Connect(() => {
			if (!nearBench()) {
				workbenchOpenStore.set(false);
			}
		});
		return () => connection.Disconnect();
	}, [open]);

	if (!open || taken) {
		return undefined;
	}
	const height = 56 + UPGRADES.size() * (ROW + 8) + 8;
	const scale = math.min(1, (viewport.X * 0.94) / WIDTH, (viewport.Y * 0.8) / height);
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
					Text={`Workbench  -  ${coins} coins`}
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
					Event={{ Activated: () => workbenchOpenStore.set(false) }}
				>
					<uicorner CornerRadius={new UDim(0, 8)} />
				</textbutton>
				<frame Size={new UDim2(1, -24, 1, -60)} Position={new UDim2(0, 12, 0, 54)} BackgroundTransparency={1}>
					<uilistlayout Padding={new UDim(0, 8)} />
					{UPGRADES.map((upgrade) => (
						<Row
							key={upgrade.id}
							upgrade={upgrade}
							status={upgradeStatus(upgrade.id, coins, owned)}
							onBuy={() => send("BuyUpgrade", upgrade.id)}
						/>
					))}
				</frame>
			</frame>
		</screengui>
	);
}
