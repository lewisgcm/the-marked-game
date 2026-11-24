import { Players, RunService, Workspace } from "@rbxts/services";
import { rootOf } from "shared/characters";

/**
 * Turns the local character to face where the camera looks (like shift-lock), while a weapon is
 * held, so you hit or shoot what you're looking at — on PC and touch. Used by melee.ts and
 * slingshot.ts.
 */

/** How quickly the character turns to face the camera (0..1 per frame). */
const TURN_SPEED = 0.35;
const BINDING = "FaceCamera";

const player = Players.LocalPlayer;

export function stopFacing() {
	RunService.UnbindFromRenderStep(BINDING);
	const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		humanoid.AutoRotate = true;
	}
}

export function startFacing(character: Model) {
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		humanoid.AutoRotate = false; // we turn the character ourselves
	}
	RunService.UnbindFromRenderStep(BINDING);
	RunService.BindToRenderStep(BINDING, Enum.RenderPriority.Character.Value, () => {
		const root = rootOf(character);
		const camera = Workspace.CurrentCamera;
		if (!root || !camera) {
			return;
		}
		const look = camera.CFrame.LookVector;
		const flat = new Vector3(look.X, 0, look.Z);
		if (flat.Magnitude < 1e-3) {
			return;
		}
		const target = CFrame.lookAt(root.Position, root.Position.add(flat.Unit));
		root.CFrame = root.CFrame.Lerp(target, TURN_SPEED);
	});
}
