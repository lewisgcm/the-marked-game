import { Players, TweenService } from "@rbxts/services";

/**
 * Being led out of the hall when your party's countdown ends: your controls stop, you walk after your parent
 * to the door, and the screen fades to black, then the teleport. If the party's disbanded instead (it
 * couldn't leave), `comeBack` undoes it all.
 */

interface Controls {
	Enable(): void;
	Disable(): void;
}

const player = Players.LocalPlayer;
let fade: Frame | undefined;

/** The player's movement controls (the PlayerModule's), if it's there. */
function controls(): Controls | undefined {
	const module = player.FindFirstChild("PlayerScripts")?.FindFirstChild("PlayerModule");
	if (!module?.IsA("ModuleScript")) return undefined;
	// Roblox's own PlayerModule (a ModuleScript in the player's scripts), not one of ours.
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const [ok, playerModule] = pcall(() => require(module) as { GetControls(): Controls });
	return ok ? playerModule.GetControls() : undefined;
}

/** A black screen over everything, faded in over `seconds`. */
function fadeOut(seconds: number) {
	const gui = new Instance("ScreenGui");
	gui.Name = "LeadOutFade";
	gui.IgnoreGuiInset = true;
	gui.DisplayOrder = 100;
	gui.ResetOnSpawn = false;
	const frame = new Instance("Frame");
	frame.Size = UDim2.fromScale(1, 1);
	frame.BackgroundColor3 = new Color3(0, 0, 0);
	frame.BackgroundTransparency = 1;
	frame.BorderSizePixel = 0;
	frame.Parent = gui;
	gui.Parent = player.WaitForChild("PlayerGui");
	// A beat to watch the parent turn, then the fade.
	TweenService.Create(
		frame,
		new TweenInfo(seconds * 0.7, Enum.EasingStyle.Sine, Enum.EasingDirection.In, 0, false, seconds * 0.3),
		{
			BackgroundTransparency: 0,
		},
	).Play();
	fade = frame;
}

export function leadOut(door: Vector3, seconds: number) {
	controls()?.Disable();
	player.Character?.FindFirstChildOfClass("Humanoid")?.MoveTo(door);
	fadeOut(seconds);
}

export function comeBack() {
	if (!fade) return;
	controls()?.Enable();
	const frame = fade;
	fade = undefined;
	const tween = TweenService.Create(frame, new TweenInfo(0.6), { BackgroundTransparency: 1 });
	tween.Completed.Connect(() => frame.Parent?.Destroy());
	tween.Play();
}
