import React from "@rbxts/react";
import { createPortal, createRoot } from "@rbxts/react-roblox";
import { Players, ReplicatedStorage } from "@rbxts/services";
import { onServerMessage, serverSender } from "shared/net";
import { LobbyClientMessages, LobbyServerMessages, QUEUE_REMOTE_NAME } from "shared/remotes";
import { PartyUi, PartyUiMode } from "./partyUi";

const player = Players.LocalPlayer;
const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;
const remote = ReplicatedStorage.WaitForChild("Remotes").WaitForChild(QUEUE_REMOTE_NAME) as RemoteEvent;
const send = serverSender<LobbyClientMessages>(remote);

function App() {
	const [mode, setMode] = React.useState<PartyUiMode>({ kind: "hidden" });

	React.useEffect(() => {
		const connection = onServerMessage<LobbyServerMessages>(remote, {
			CreateParty: ({ lowest, highest, expireSeconds }) =>
				setMode({ kind: "create", lowest, highest, expireSeconds }),
			JoinParty: () => setMode({ kind: "party" }),
			LeaveParty: () => setMode({ kind: "hidden" }),
		});
		return () => connection.Disconnect();
	}, []);

	return <PartyUi mode={mode} onCreate={(size) => send("RequestCreate", size)} />;
}

// Render into an empty folder and portal into PlayerGui. Never createRoot(PlayerGui): a React root
// takes over its container and clears children it didn't create — including Roblox's TouchGui,
// which deleted the mobile joystick and jump button (tablet players couldn't move).
createRoot(new Instance("Folder")).render(createPortal(<App />, playerGui));
