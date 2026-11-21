import { ReplicatedStorage } from "@rbxts/services";
import { clientSender } from "shared/net";
import { GAME_REMOTE_NAME, GameServerMessages } from "shared/remotes";

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

/** Shows `player` a short notice. */
export function notify(player: Player, text: string) {
	send(player, "Notice", text);
}

/** Shows a notice to each of `players` except `except`. */
export function notifyAllBut(players: Player[], except: Player, text: string) {
	for (const player of players) {
		if (player !== except) {
			notify(player, text);
		}
	}
}
