import { Players, Workspace } from "@rbxts/services";
import { part } from "shared/world/parts";
import { LeaderboardEntry, loadTopWins, loadWins } from "shared/lobby/stats";

/**
 * Lobby scoreboard:
 *
 * - **Player list:** every player gets a `leaderstats` "Wins" value (their lifetime wins), which
 *   Roblox shows in the top-right player list.
 * - **Top-10 board:** a wooden noticeboard beside the path, listing the most wins of all time
 *   across every server, refreshed every REFRESH_SECONDS.
 *
 * Wins are recorded by the main game at the end of each round (shared/lobby/stats.ts). If the
 * DataStore can't be reached (e.g. Studio without API access), the board says so.
 */

const TOP_COUNT = 10;
const REFRESH_SECONDS = 60;

/** Where the board stands: left of the path, a little ahead of the spawn, angled toward it. */
const BOARD_POSITION = new Vector3(-11, 0, -34);
const BOARD_FACES = new Vector3(0, 0, -44);

const WOOD = { material: Enum.Material.Wood, color: new Color3(0.22, 0.15, 0.1) };
const INK = new Color3(0.95, 0.88, 0.75);
const BLOOD = new Color3(0.85, 0.15, 0.15);

const nameCache = new Map<number, string>();
function nameOf(userId: number): string {
	const cached = nameCache.get(userId);
	if (cached !== undefined) {
		return cached;
	}
	// @rbxts types brand user IDs as a nominal `User`; it's the same number at runtime.
	const [ok, name] = pcall(() => Players.GetNameFromUserIdAsync(userId as unknown as User));
	const result = ok ? (name as string) : `Player ${userId}`;
	nameCache.set(userId, result);
	return result;
}

function label(parent: Instance, text: string, size: number, position: UDim2, height: number, color = INK): TextLabel {
	const l = new Instance("TextLabel");
	l.BackgroundTransparency = 1;
	l.Size = new UDim2(1, -40, 0, height);
	l.Position = position;
	l.Font = Enum.Font.Fondamento;
	l.TextSize = size;
	l.TextColor3 = color;
	l.TextXAlignment = Enum.TextXAlignment.Left;
	l.Text = text;
	l.Parent = parent;
	return l;
}

/** Builds the noticeboard and returns a function that redraws its rows. */
function buildBoard(): (entries: LeaderboardEntry[] | undefined) => void {
	const model = new Instance("Model");
	model.Name = "Leaderboard";
	model.Parent = Workspace;

	const facing = CFrame.lookAt(BOARD_POSITION, new Vector3(BOARD_FACES.X, 0, BOARD_FACES.Z));
	const board = part(model, "Board", new Vector3(10, 7.5, 0.4), facing.mul(new CFrame(0, 5.25, 0)), WOOD);
	part(model, "Roof", new Vector3(11, 0.4, 1.4), facing.mul(new CFrame(0, 9.2, 0.2)), WOOD);
	for (const x of [-4.6, 4.6]) {
		part(model, "Post", new Vector3(0.6, 9.4, 0.6), facing.mul(new CFrame(x, 4.7, 0.3)), WOOD);
	}

	const gui = new Instance("SurfaceGui");
	gui.Face = Enum.NormalId.Front;
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	gui.PixelsPerStud = 40;
	gui.LightInfluence = 0; // readable at night
	gui.Brightness = 1.2;
	gui.Parent = board;

	label(gui, "THE MOST WINS", 34, new UDim2(0, 20, 0, 10), 40, BLOOD);
	label(gui, "of all who dared enter the house", 16, new UDim2(0, 22, 0, 46), 20);

	const rows: TextLabel[] = [];
	for (let i = 0; i < TOP_COUNT; i++) {
		rows.push(label(gui, "", 19, new UDim2(0, 20, 0, 76 + i * 22), 22));
	}

	return (entries) => {
		if (entries === undefined) {
			rows.forEach((row, i) => (row.Text = i === 0 ? "The scores are lost in the fog… (try later)" : ""));
			return;
		}
		if (entries.size() === 0) {
			rows.forEach((row, i) => (row.Text = i === 0 ? "No one has won yet. Be the first." : ""));
			return;
		}
		rows.forEach((row, i) => {
			const entry = entries[i];
			row.Text = entry
				? `${i + 1}.  ${nameOf(entry.userId)}  —  ${entry.wins} win${entry.wins === 1 ? "" : "s"}`
				: "";
		});
	};
}

/** Adds the "Wins" value Roblox shows in the player list. */
function addLeaderstats(player: Player) {
	const folder = new Instance("Folder");
	folder.Name = "leaderstats";
	const wins = new Instance("IntValue");
	wins.Name = "Wins";
	wins.Parent = folder;
	folder.Parent = player;
	task.spawn(() => {
		wins.Value = loadWins(player.UserId) ?? 0;
	});
}

export function startLeaderboard() {
	Players.GetPlayers().forEach(addLeaderstats);
	Players.PlayerAdded.Connect(addLeaderstats);

	const draw = buildBoard();
	task.spawn(() => {
		for (;;) {
			draw(loadTopWins(TOP_COUNT));
			task.wait(REFRESH_SECONDS);
		}
	});
}
