import React from "@rbxts/react";
import { createPortal, createRoot } from "@rbxts/react-roblox";
import { Players, ReplicatedStorage } from "@rbxts/services";
import { startFlicker } from "shared/world/flicker";
import { GAME_REMOTE_NAME } from "shared/core/remotes";
import { CombatFeedback } from "./combat/combatFeedback";
import { DawnCard } from "./hud/dawnCard";
import { startFlashlight } from "./combat/flashlight";
import { startBuildMode } from "./house/buildMode";
import { startBroadcast } from "./world/broadcast";
import { startGainFeed } from "./hud/gainFeed";
import { startGameState } from "./core/gameState";
import { InventoryHud } from "./hud/inventoryHud";
import { startMelee } from "./combat/melee";
import { MessageBar } from "./hud/messageBar";
import { startMessageQueue } from "./hud/messageQueue";
import { RoundHud } from "./hud/roundHud";
import { startSlingshot } from "./combat/slingshot";
import { Spectate } from "./run/spectate";
import { TradeUi } from "./shops/tradeUi";
import { WalkieUi } from "./hud/walkieUi";
import { WallMapUi } from "./hud/wallMap";
import { WorkbenchUi } from "./shops/workbenchUi";

startFlicker();

const remote = ReplicatedStorage.WaitForChild("Remotes").WaitForChild(GAME_REMOTE_NAME) as RemoteEvent;
startFlashlight();

// One early listener stores everything the server says (see gameState.ts), then asks the
// server to re-send our state, so UI that mounts later never misses a message.
startMessageQueue();
startGainFeed();
startGameState(remote);
startMelee(remote);
startSlingshot(remote);
startBuildMode();
startBroadcast();

function App() {
	return (
		<>
			<RoundHud remote={remote} />
			<MessageBar />
			<DawnCard />
			<InventoryHud remote={remote} />
			<WorkbenchUi remote={remote} />
			<TradeUi remote={remote} />
			<WalkieUi />
			<WallMapUi />
			<Spectate />
			<CombatFeedback />
		</>
	);
}

const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
// Render into an empty folder and portal into PlayerGui. Never createRoot(PlayerGui): a React root
// takes over its container and clears children it didn't create — including Roblox's TouchGui,
// which deleted the mobile joystick and jump button (tablet players couldn't move).
createRoot(new Instance("Folder")).render(createPortal(<App />, playerGui));
