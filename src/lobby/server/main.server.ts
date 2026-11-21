import { ReplicatedStorage } from "@rbxts/services";
import { QUEUE_REMOTE_NAME } from "shared/remotes";
import { startLeaderboard } from "./leaderboard";
import { QueueManager } from "./queue";
import { startTitles } from "./titles";
import { buildLobbyWorld } from "./world";

/** Finds or creates the QueueRemote RemoteEvent under ReplicatedStorage.Remotes. */
function ensureQueueRemote(): RemoteEvent {
	const remotes = ReplicatedStorage.FindFirstChild("Remotes");
	if (remotes) {
		const existing = remotes.FindFirstChild(QUEUE_REMOTE_NAME);
		if (existing && existing.IsA("RemoteEvent")) {
			return existing;
		}
	}

	const folder = remotes ?? new Instance("Folder");
	folder.Name = "Remotes";
	folder.Parent = ReplicatedStorage;

	const remote = new Instance("RemoteEvent");
	remote.Name = QUEUE_REMOTE_NAME;
	remote.Parent = folder;
	return remote;
}

const world = buildLobbyWorld();
const remote = ensureQueueRemote();
const queue = new QueueManager(world, remote);
queue.start();
startLeaderboard();
startTitles();
