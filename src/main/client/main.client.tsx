import React from "@rbxts/react";
import { createPortal, createRoot } from "@rbxts/react-roblox";
import { Players, ReplicatedStorage } from "@rbxts/services";
import { startFlicker } from "shared/flicker";
import { GAME_REMOTE_NAME } from "shared/remotes";
import { CombatFeedback } from "./combatFeedback";
import { DawnCard } from "./dawnCard";
import { startFlashlight } from "./flashlight";
import { startGameState } from "./gameState";
import { HintHud } from "./hintHud";
import { InventoryHud } from "./inventoryHud";
import { startMelee } from "./melee";
import { NoticeHud } from "./noticeHud";
import { RoundHud } from "./roundHud";
import { startSlingshot } from "./slingshot";
import { Spectate } from "./spectate";

startFlicker();

const remote = ReplicatedStorage.WaitForChild("Remotes").WaitForChild(GAME_REMOTE_NAME) as RemoteEvent;
startFlashlight();

// One early listener stores everything the server says (see gameState.ts), then asks the
// server to re-send our state, so UI that mounts later never misses a message.
startGameState(remote);
startMelee(remote);
startSlingshot(remote);

function App() {
	return (
		<>
			<RoundHud remote={remote} />
			<NoticeHud />
			<HintHud />
			<DawnCard />
			<InventoryHud />
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
