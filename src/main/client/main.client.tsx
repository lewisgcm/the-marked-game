import React from "@rbxts/react";
import { createPortal, createRoot } from "@rbxts/react-roblox";
import { Players, ReplicatedStorage } from "@rbxts/services";
import { startFlicker } from "shared/flicker";
import { GAME_REMOTE_NAME } from "shared/remotes";
import { startBanishCamera } from "./banishCamera";
import { CombatFeedback } from "./combatFeedback";
import { startFlashlight } from "./flashlight";
import { attackWindowStore, roleStore, spookStore, startGameState, useStore } from "./gameState";
import { GhostHud } from "./ghostHud";
import { startMelee } from "./melee";
import { ObjectiveHud } from "./objectiveHud";
import { RoleBanner } from "./roleBanner";
import { RoundHud } from "./roundHud";
import { SanityHud } from "./sanityHud";
import { Spectate, useDead } from "./spectate";

startFlicker();

const remote = ReplicatedStorage.WaitForChild("Remotes").WaitForChild(GAME_REMOTE_NAME) as RemoteEvent;
startFlashlight();

// One early listener stores everything the server says (see gameState.ts), then asks the
// server to re-send our state, so UI that mounts later never misses a message.
startGameState(remote);
startMelee(remote);
startBanishCamera();

function App() {
	const role = useStore(roleStore);
	const spooks = useStore(spookStore);
	const attackWindow = useStore(attackWindowStore);
	const dead = useDead();
	const livingHunter = role === "Hunter" && !dead;

	return (
		<>
			<RoleBanner role={role} />
			<RoundHud remote={remote} />
			<ObjectiveHud isHunter={livingHunter} />
			<SanityHud isHunter={livingHunter} />
			<Spectate />
			<CombatFeedback />
			{role === "Ghost" ? (
				<GhostHud
					remote={remote}
					state={spooks?.state}
					receivedAt={spooks?.receivedAt ?? 0}
					attackWindow={attackWindow?.state}
					attackWindowReceivedAt={attackWindow?.receivedAt ?? 0}
				/>
			) : undefined}
		</>
	);
}

const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;
// Render into an empty folder and portal into PlayerGui. Never createRoot(PlayerGui): a React root
// takes over its container and clears children it didn't create — including Roblox's TouchGui,
// which deleted the mobile joystick and jump button (tablet players couldn't move).
createRoot(new Instance("Folder")).render(createPortal(<App />, playerGui));
