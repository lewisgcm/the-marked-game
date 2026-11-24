import { Players, UserInputService, Workspace } from "@rbxts/services";
import { SLINGSHOT_TOOL_NAME } from "shared/combat";
import { serverSender } from "shared/net";
import { GameClientMessages } from "shared/remotes";
import { isTouch } from "./device";
import { startFacing, stopFacing } from "./faceCamera";

/**
 * The slingshot on the kid's client: while it's held the character faces the camera, and a
 * click sends "Shoot" with the aim direction. The server decides what (if anything) it hits.
 *
 * Aim: the mouse on PC; the middle of the screen on touch, where there's no pointer.
 */

/** How far to look for what's under the crosshair, in studs. */
const AIM_REACH = 300;
/** Don't send faster than this locally (the server enforces the real cooldown). */
const LOCAL_SHOT_GAP = 0.3;

const player = Players.LocalPlayer;

/** Where the player is aiming, in the world. */
function aimPoint(character: Model): Vector3 | undefined {
	const camera = Workspace.CurrentCamera;
	if (!camera) {
		return undefined;
	}
	const screen = isTouch() ? camera.ViewportSize.div(2) : UserInputService.GetMouseLocation();
	const ray = camera.ViewportPointToRay(screen.X, screen.Y);
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	params.FilterDescendantsInstances = [character];
	const hit = Workspace.Raycast(ray.Origin, ray.Direction.mul(AIM_REACH), params);
	return hit ? hit.Position : ray.Origin.add(ray.Direction.mul(AIM_REACH));
}

export function startSlingshot(remote: RemoteEvent) {
	const send = serverSender<GameClientMessages>(remote);
	let lastShot = -math.huge;
	let activated: RBXScriptConnection | undefined;
	let equipped: Tool | undefined;

	const shoot = (character: Model) => {
		const now = os.clock();
		const head = character.FindFirstChild("Head");
		if (!head || !head.IsA("BasePart") || now - lastShot < LOCAL_SHOT_GAP) {
			return;
		}
		const target = aimPoint(character);
		if (!target) {
			return;
		}
		const direction = target.sub(head.Position);
		if (direction.Magnitude < 1e-3) {
			return;
		}
		lastShot = now;
		send("Shoot", direction.Unit);
	};

	const watch = (character: Model) => {
		character.ChildAdded.Connect((child) => {
			if (child.IsA("Tool") && child.Name === SLINGSHOT_TOOL_NAME) {
				equipped = child;
				activated?.Disconnect();
				activated = child.Activated.Connect(() => shoot(character));
				startFacing(character);
			}
		});
		character.ChildRemoved.Connect((child) => {
			if (child === equipped) {
				equipped = undefined;
				activated?.Disconnect();
				activated = undefined;
				stopFacing();
			}
		});
	};
	if (player.Character) {
		watch(player.Character);
	}
	player.CharacterAdded.Connect((character) => {
		equipped = undefined;
		activated?.Disconnect();
		watch(character);
	});
}
