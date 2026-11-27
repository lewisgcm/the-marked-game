import { Players, RunService, Workspace } from "@rbxts/services";
import { rootOf } from "shared/core/characters";
import { MELEE_TOOL_NAMES, SLINGSHOT_TOOL_NAME } from "shared/combat/combat";
import { FLASHLIGHT_TOOL_NAME } from "shared/combat/flashlight";

/**
 * Turns the local character to face where the camera looks (like shift-lock), while a weapon is
 * held, so you hit, shoot or shine at what you're looking at — on PC and touch. Used by melee.ts,
 * slingshot.ts and flashlight.ts.
 */

/** Tools you face the camera with. Swapping one for another keeps facing on. */
const FACING_TOOLS = [...MELEE_TOOL_NAMES, SLINGSHOT_TOOL_NAME, FLASHLIGHT_TOOL_NAME];

/** How quickly the character turns to face the camera (0..1 per frame). */
const TURN_SPEED = 0.35;
const BINDING = "FaceCamera";

const player = Players.LocalPlayer;

/** Stops facing the camera, unless another facing tool is in hand by then (a swap: one goes, the next comes). */
export function stopFacing() {
	task.defer(() => {
		const character = player.Character;
		if (character && FACING_TOOLS.some((name) => character.FindFirstChild(name)?.IsA("Tool"))) {
			return;
		}
		RunService.UnbindFromRenderStep(BINDING);
		const humanoid = character?.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.AutoRotate = true;
		}
	});
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
