import { Players, UserInputService, Workspace } from "@rbxts/services";
import { SLINGSHOT_TOOL_NAME } from "shared/combat/combat";
import { openingSlots } from "shared/combat/openings";
import { serverSender } from "shared/core/net";
import { GameClientMessages } from "shared/core/remotes";
import { isTouch } from "../core/device";
import { startFacing, stopFacing } from "./faceCamera";

/**
 * The slingshot on the kid's client: while it's held the character faces the camera, and a
 * click (or a tap) sends "Shoot" with the aim direction. The server decides what (if anything) it hits.
 *
 * Aim: the mouse on PC. On touch, a tap in the world shoots at what was tapped (TouchTapInWorld:
 * Tool.Activated alone missed taps on phones, and had no position, so it shot at the screen's middle).
 */

/** How far to look for what's under the crosshair, in studs. */
const AIM_REACH = 300;
/** Don't send faster than this locally (the server enforces the real cooldown). */
const LOCAL_SHOT_GAP = 0.3;

const player = Players.LocalPlayer;

/** Where the player is aiming, in the world: under the mouse, or under `tap` (a touch, in screen space). */
function aimPoint(character: Model, tap?: Vector2): Vector3 | undefined {
	const camera = Workspace.CurrentCamera;
	if (!camera) {
		return undefined;
	}
	let ray: Ray;
	if (tap) {
		ray = camera.ScreenPointToRay(tap.X, tap.Y); // touch positions leave out the top bar
	} else {
		const mouse = UserInputService.GetMouseLocation();
		ray = camera.ViewportPointToRay(mouse.X, mouse.Y);
	}
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	params.FilterDescendantsInstances = [character, ...openingSlots()];
	const hit = Workspace.Raycast(ray.Origin, ray.Direction.mul(AIM_REACH), params);
	return hit ? hit.Position : ray.Origin.add(ray.Direction.mul(AIM_REACH));
}

export function startSlingshot(remote: RemoteEvent) {
	const send = serverSender<GameClientMessages>(remote);
	let lastShot = -math.huge;
	let activated: RBXScriptConnection | undefined;
	let equipped: Tool | undefined;

	const shoot = (character: Model, tap?: Vector2) => {
		const now = os.clock();
		const head = character.FindFirstChild("Head");
		if (!head || !head.IsA("BasePart") || now - lastShot < LOCAL_SHOT_GAP) {
			return;
		}
		const target = aimPoint(character, tap);
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

	// Touch: a tap in the world (not on a button) while it's held.
	UserInputService.TouchTapInWorld.Connect((position, processedByUI) => {
		const character = player.Character;
		if (!processedByUI && equipped && character && equipped.Parent === character) {
			shoot(character, position);
		}
	});

	const watch = (character: Model) => {
		character.ChildAdded.Connect((child) => {
			if (child.IsA("Tool") && child.Name === SLINGSHOT_TOOL_NAME) {
				equipped = child;
				activated?.Disconnect();
				// On touch the tap itself shoots (above); Activated is the mouse click.
				activated = child.Activated.Connect(() => {
					if (!isTouch()) {
						shoot(character);
					}
				});
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
