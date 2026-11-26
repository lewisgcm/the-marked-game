import { CollectionService, Players, Workspace } from "@rbxts/services";
import { Board, LeaderboardEntry, loadRunStats, loadTop } from "shared/lobby/stats";

/**
 * The lobby's leaderboards (GAMEPLAY.md §1), saved by the main game at the end of each run
 * (shared/lobby/stats.ts):
 *
 * - **Noticeboards:** a sheet pinned to each of the hall's two (`Noticeboard` parts, `Board` BestRun or
 *   TotalNights, in tools/tiles/lobby/Hall.ts): the top 10 of all time across every server, refreshed every
 *   REFRESH_SECONDS.
 * - **Player list:** every player's `leaderstats` "Best Run", which Roblox shows in the top-right list.
 *
 * If the DataStore can't be reached (e.g. Studio without API access), the sheets say so.
 */

const TOP_COUNT = 10;
const REFRESH_SECONDS = 60;

const INK = new Color3(0.12, 0.1, 0.09);
const RED_PEN = new Color3(0.7, 0.1, 0.1);

/** What each board's sheet is headed. */
const HEADINGS: Record<Board, string> = {
	BestRun: "Most nights in one run",
	TotalNights: "Most nights, all time",
};

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

/** The hall's noticeboard for `board`, if the hall has it. */
function noticeboard(board: Board): BasePart | undefined {
	const hall = Workspace.WaitForChild("Hall");
	return CollectionService.GetTagged("Noticeboard").find(
		(p): p is BasePart => p.IsA("BasePart") && p.IsDescendantOf(hall) && p.GetAttribute("Board") === board,
	);
}

/** Pins a sheet to `board`'s noticeboard and returns a function that rewrites its rows. */
function buildSheet(board: Board): (entries: LeaderboardEntry[] | undefined) => void {
	const part = noticeboard(board);
	if (!part) {
		warn(`[Lobby] The hall has no ${board} noticeboard: those scores have nowhere to go.`);
		return () => {};
	}
	const gui = new Instance("SurfaceGui");
	gui.Name = "Scores";
	gui.Face = Enum.NormalId.Front;
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud;
	gui.PixelsPerStud = 40;
	gui.Parent = part;
	// A sheet of paper pinned to the cork, a little crooked.
	const sheet = new Instance("Frame");
	sheet.Size = new UDim2(1, -60, 1, -30);
	sheet.Position = new UDim2(0, 30, 0, 15);
	sheet.BackgroundColor3 = new Color3(0.96, 0.95, 0.9);
	sheet.BorderSizePixel = 0;
	sheet.Rotation = board === "BestRun" ? -1 : 1.2;
	sheet.Parent = gui;

	label(sheet, HEADINGS[board], 34, new UDim2(0, 20, 0, 6), 40, RED_PEN);
	const rows: TextLabel[] = [];
	for (let i = 0; i < TOP_COUNT; i++) {
		rows.push(label(sheet, "", 25, new UDim2(0, 20, 0, 50 + i * 24), 24));
	}

	return (entries) => {
		if (entries === undefined) {
			rows.forEach((row, i) => (row.Text = i === 0 ? "The scores can't be reached right now (try later)." : ""));
			return;
		}
		if (entries.size() === 0) {
			rows.forEach((row, i) => (row.Text = i === 0 ? "No one's made it through a night yet." : ""));
			return;
		}
		rows.forEach((row, i) => {
			const entry = entries[i];
			row.Text = entry
				? `${i + 1}.  ${nameOf(entry.userId)}  —  ${entry.nights} night${entry.nights === 1 ? "" : "s"}`
				: "";
		});
	};
}

/** Adds the "Best Run" value Roblox shows in the player list. */
function addLeaderstats(player: Player) {
	const folder = new Instance("Folder");
	folder.Name = "leaderstats";
	const best = new Instance("IntValue");
	best.Name = "Best Run";
	best.Parent = folder;
	folder.Parent = player;
	task.spawn(() => {
		best.Value = loadRunStats(player.UserId)?.best ?? 0;
	});
}

export function startLeaderboard() {
	Players.GetPlayers().forEach(addLeaderstats);
	Players.PlayerAdded.Connect(addLeaderstats);

	const sheets = (["BestRun", "TotalNights"] as const).map((board) => [board, buildSheet(board)] as const);
	task.spawn(() => {
		for (;;) {
			for (const [board, draw] of sheets) {
				draw(loadTop(board, TOP_COUNT));
			}
			task.wait(REFRESH_SECONDS);
		}
	});
}
