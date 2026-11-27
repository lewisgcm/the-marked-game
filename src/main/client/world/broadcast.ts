import { Players, Workspace } from "@rbxts/services";
import { BROADCAST_ATTRIBUTE } from "shared/run/broadcast";
import { PING, playLocalSound } from "../core/sound";

/**
 * The dusk broadcast, on this client (the server bumps BROADCAST_ATTRIBUTE: main/server/economy/signal.ts):
 * every screen on the map flares and garbles for a few seconds, a low tone plays, and static washes
 * over the view.
 */

const SECONDS = 3;
const FLARE = [new Color3(1, 1, 1), new Color3(1, 0.3, 0.25), new Color3(0.7, 0.85, 1)];

function screens(): BasePart[] {
	const map = Workspace.FindFirstChild("Map");
	return (map?.GetDescendants() ?? []).filter((p): p is BasePart => p.IsA("BasePart") && p.Name === "TV");
}

function staticOverlay(): [ScreenGui, Frame] {
	const gui = new Instance("ScreenGui");
	gui.Name = "Broadcast";
	gui.IgnoreGuiInset = true;
	gui.DisplayOrder = 50;
	const frame = new Instance("Frame");
	frame.Size = new UDim2(1, 0, 1, 0);
	frame.BorderSizePixel = 0;
	frame.BackgroundColor3 = new Color3(1, 1, 1);
	frame.BackgroundTransparency = 1;
	frame.Parent = gui;
	gui.Parent = Players.LocalPlayer.WaitForChild("PlayerGui");
	return [gui, frame];
}

function play() {
	const parts = screens();
	const was = parts.map((p) => {
		const light = p.FindFirstChildOfClass("PointLight");
		return { part: p, color: p.Color, light, brightness: light?.Brightness ?? 0 };
	});
	const [gui, frame] = staticOverlay();
	playLocalSound(PING, 0.6, 0.25);
	const ends = os.clock() + SECONDS;
	while (os.clock() < ends) {
		for (const screen of was) {
			screen.part.Color = FLARE[math.random(1, FLARE.size()) - 1];
			if (screen.light) {
				screen.light.Brightness = screen.brightness * (2 + math.random() * 4);
			}
		}
		frame.BackgroundColor3 = math.random() < 0.5 ? new Color3(1, 1, 1) : new Color3(0.9, 0.2, 0.2);
		frame.BackgroundTransparency = 0.8 + math.random() * 0.18;
		task.wait(0.05 + math.random() * 0.08);
	}
	for (const screen of was) {
		screen.part.Color = screen.color;
		if (screen.light) {
			screen.light.Brightness = screen.brightness;
		}
	}
	gui.Destroy();
}

export function startBroadcast() {
	Workspace.GetAttributeChangedSignal(BROADCAST_ATTRIBUTE).Connect(() => task.spawn(play));
}
