import { Players, ReplicatedStorage } from "@rbxts/services";
import { clientSender } from "shared/core/net";
import { GAME_REMOTE_NAME, GameServerMessages } from "shared/core/remotes";

/** The main game's RemoteEvent, and typed helpers for messaging players. */

function ensureRemote(name: string): RemoteEvent {
	let folder = ReplicatedStorage.FindFirstChild("Remotes");
	if (!folder) {
		folder = new Instance("Folder");
		folder.Name = "Remotes";
		folder.Parent = ReplicatedStorage;
	}
	const existing = folder.FindFirstChild(name);
	if (existing && existing.IsA("RemoteEvent")) {
		return existing;
	}
	const remote = new Instance("RemoteEvent");
	remote.Name = name;
	remote.Parent = folder;
	return remote;
}

export const remote = ensureRemote(GAME_REMOTE_NAME);

/** Sends one player a typed message about their own state. */
export const send = clientSender<GameServerMessages>(remote);

/** Tells `player` something about what they just did. */
export function notify(player: Player, text: string) {
	send(player, "Notice", { text, kind: "Feedback" });
}

/** News, for everyone (but `except`). */
export function notifyAll(text: string, except?: Player) {
	for (const player of Players.GetPlayers()) {
		if (player !== except) {
			send(player, "Notice", { text, kind: "Info" });
		}
	}
}

/** Danger: `player` should see this at once. */
export function alertPlayer(player: Player, text: string) {
	send(player, "Notice", { text, kind: "Danger" });
}

/** Danger, for everyone (but `except`). */
export function alertAll(text: string, except?: Player) {
	for (const player of Players.GetPlayers()) {
		if (player !== except) {
			alertPlayer(player, text);
		}
	}
}
