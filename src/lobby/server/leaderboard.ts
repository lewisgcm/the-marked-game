import { CollectionService, Players, Workspace } from "@rbxts/services";
import { LeaderboardEntry, loadTopWins, loadWins } from "shared/lobby/stats";

/**
 * Lobby scoreboard:
 *
 * - **Player list:** every player gets a `leaderstats` "Wins" value (their lifetime wins), which
 *   Roblox shows in the top-right player list.
 * - **Top-10 board:** on the hall's BEST RUN noticeboard (a `Noticeboard` part, `Board` BestRun, in
 *   tools/tiles/lobby/Hall.ts), the most wins of all time across every server, refreshed every
 *   REFRESH_SECONDS. (Best run and total nights replace wins later in M6.)
 *
 * Wins are recorded by the main game at the end of each round (shared/lobby/stats.ts). If the
 * DataStore can't be reached (e.g. Studio without API access), the board says so.
 */

const TOP_COUNT = 10;
const REFRESH_SECONDS = 60;

const INK = new Color3(0.12, 0.1, 0.09);
const RED_PEN = new Color3(0.7, 0.1, 0.1);

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
	l.Font = Enum.Font.PatrickHand;
	l.TextSize = size;
	l.TextColor3 = color;
	l.TextXAlignment = Enum.TextXAlignment.Left;
	l.Text = text;
	l.Parent = parent;
	return l;
}

/** The hall's noticeboard for `board` (BestRun or TotalNights), if the hall has it. */
function noticeboard(board: string): BasePart | undefined {
	const hall = Workspace.WaitForChild("Hall");
	return CollectionService.GetTagged("Noticeboard").find(
		(p): p is BasePart => p.IsA("BasePart") && p.IsDescendantOf(hall) && p.GetAttribute("Board") === board,
	);
}

/** Pins a sheet to the BEST RUN noticeboard and returns a function that rewrites its rows. */
function buildBoard(): (entries: LeaderboardEntry[] | undefined) => void {
	const board = noticeboard("BestRun");
	if (!board) {
		warn("[Lobby] The hall has no BestRun noticeboard: the scores have nowhere to go.");
		return () => {};
	}
	const gui = new Instance("SurfaceGui");
	gui.Name = "Scores";
	gui.Face = Enum.NormalId.Front;
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	gui.PixelsPerStud = 40;
	gui.Parent = board;
	// A sheet of paper pinned to the cork.
	const sheet = new Instance("Frame");
	sheet.Size = new UDim2(1, -60, 1, -30);
	sheet.Position = new UDim2(0, 30, 0, 15);
	sheet.BackgroundColor3 = new Color3(0.96, 0.95, 0.9);
	sheet.BorderSizePixel = 0;
	sheet.Rotation = -1;
	sheet.Parent = gui;

	label(sheet, "Most wins", 36, new UDim2(0, 20, 0, 6), 40, RED_PEN);

	const rows: TextLabel[] = [];
	for (let i = 0; i < TOP_COUNT; i++) {
		rows.push(label(sheet, "", 22, new UDim2(0, 20, 0, 50 + i * 24), 24));
	}

	return (entries) => {
		if (entries === undefined) {
			rows.forEach((row, i) => (row.Text = i === 0 ? "The scores can't be reached right now (try later)." : ""));
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
