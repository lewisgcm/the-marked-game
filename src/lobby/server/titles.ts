import { Players } from "@rbxts/services";
import { LastTitle, loadLastTitleAsync } from "shared/lastTitle";

/**
 * Shows each player's title from their last run (e.g. "Slugger") floating above their
 * head in the lobby, until they play again. The main game saves it (shared/lastTitle.ts) at the
 * end of each run; it expires after an hour.
 */

const SURVIVED_COLOR = new Color3(1, 0.8, 0.45);
const TAKEN_COLOR = new Color3(1, 0.4, 0.4);

function attach(character: Model, entry: LastTitle) {
	const head = character.WaitForChild("Head", 10);
	if (!head || !head.IsA("BasePart")) {
		return;
	}
	const board = new Instance("BillboardGui");
	board.Name = "LastRoundTitle";
	board.Size = new UDim2(0, 220, 0, 30);
	board.StudsOffset = new Vector3(0, 2.6, 0); // just above the name tag
	board.MaxDistance = 70;
	board.LightInfluence = 0; // readable in the dark graveyard
	board.Adornee = head;

	const label = new Instance("TextLabel");
	label.Size = new UDim2(1, 0, 1, 0);
	label.BackgroundTransparency = 1;
	label.Font = Enum.Font.Fondamento;
	label.TextScaled = true;
	label.TextColor3 = entry.taken ? TAKEN_COLOR : SURVIVED_COLOR;
	label.TextStrokeTransparency = 0.4;
	label.Text = entry.title;
	label.Parent = board;
	board.Parent = head;
}

function watch(player: Player) {
	task.spawn(() => {
		const entry = loadLastTitleAsync(player.UserId);
		if (!entry || player.Parent !== Players) {
			return;
		}
		if (player.Character) {
			task.spawn(attach, player.Character, entry);
		}
		player.CharacterAdded.Connect((character) => attach(character, entry));
	});
}

export function startTitles() {
	Players.GetPlayers().forEach(watch);
	Players.PlayerAdded.Connect(watch);
}
