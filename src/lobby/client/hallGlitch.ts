import { CollectionService, Workspace } from "@rbxts/services";
import { HALL_GLITCH_ATTRIBUTE, HALL_GLITCH_SECONDS, SCREEN_TAG } from "shared/lobby/hall";
import { hallGlitched, tvGlitched } from "./hallEvents";

/**
 * The hall's glitches, on each client. When the server counts up the Hall's Glitch attribute, every screen
 * garbles and every strip light stutters at once (and the parents freeze: parents.ts). In between, the news
 * trolley's screen glitches on its own now and then (and one parent twitches).
 */

const GLYPHS = ["▓", "▒", "░", "█", "#", "/", "\\", "_", "?", "%"];
const GLITCH_COLOURS = [new Color3(0.9, 0.2, 0.6), new Color3(0.2, 0.9, 0.85), new Color3(1, 1, 1)];

function garble(text: string): string {
	let out = "";
	for (let i = 0; i < text.size(); i++) {
		out += math.random() < 0.55 ? GLYPHS[math.random(0, GLYPHS.size() - 1)] : text.sub(i + 1, i + 1);
	}
	return out;
}

/** Garbles a screen (its colour and its words) for `seconds`, then puts it back. */
function glitchScreen(screen: BasePart, seconds: number) {
	const colour = screen.Color;
	const labels = screen.GetDescendants().filter((d): d is TextLabel => d.IsA("TextLabel"));
	const words = labels.map((label) => label.Text);
	const ends = os.clock() + seconds;
	while (os.clock() < ends) {
		screen.Color = GLITCH_COLOURS[math.random(0, GLITCH_COLOURS.size() - 1)];
		labels.forEach((label, i) => (label.Text = garble(words[i])));
		task.wait(0.05);
	}
	screen.Color = colour;
	labels.forEach((label, i) => (label.Text = words[i]));
}

/** Every strip light in the hall stutters for `seconds`. */
function stutterLights(hall: Instance, seconds: number) {
	const tubes = hall.GetDescendants().filter((d): d is BasePart => d.IsA("BasePart") && d.Name === "StripLight");
	const ends = os.clock() + seconds;
	while (os.clock() < ends) {
		const lit = math.random() < 0.5;
		for (const tube of tubes) {
			tube.Material = lit ? Enum.Material.Neon : Enum.Material.SmoothPlastic;
			const light = tube.FindFirstChildOfClass("PointLight");
			if (light) light.Enabled = lit;
		}
		task.wait(math.random(3, 9) / 100);
	}
	for (const tube of tubes) {
		tube.Material = Enum.Material.Neon;
		const light = tube.FindFirstChildOfClass("PointLight");
		if (light) light.Enabled = true;
	}
}

const screens = () => CollectionService.GetTagged(SCREEN_TAG).filter((s): s is BasePart => s.IsA("BasePart"));

export function startHallGlitches() {
	const hall = Workspace.WaitForChild("Hall");
	hall.GetAttributeChangedSignal(HALL_GLITCH_ATTRIBUTE).Connect(() => {
		hallGlitched();
		for (const screen of screens()) task.spawn(glitchScreen, screen, HALL_GLITCH_SECONDS);
		task.spawn(stutterLights, hall, HALL_GLITCH_SECONDS);
	});
	// The trolley's screen, on its own, every 8 to 20 seconds.
	task.spawn(() => {
		for (;;) {
			task.wait(math.random(8, 20));
			tvGlitched();
			for (const screen of screens()) task.spawn(glitchScreen, screen, 0.3);
		}
	});
}
