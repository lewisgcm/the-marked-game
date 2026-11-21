import { Players, RunService, Workspace } from "@rbxts/services";
import { KNIFE_TOOL_NAME, WEAPON_TOOL_NAME } from "shared/combat";
import { checkMeleeReach, MAX_SWING_CANDIDATES } from "shared/melee";
import { serverSender } from "shared/net";
import { GameClientMessages } from "shared/remotes";

/**
 * Melee on the attacker's client (knife for the ghost, fire poker for hunters):
 *
 * - **Face the camera** while a weapon is held: the character turns smoothly to where the
 *   camera looks (like shift-lock), so you swing at what you're looking at — on PC and touch.
 * - **Swing:** plays the built-in slash animation (a "toolanim" value the default Animate script
 *   watches for), then sends "Swing" with the players in reach, nearest first. The server
 *   re-checks every one with its own positions; this side only makes it feel instant.
 */

const MELEE_TOOLS = [KNIFE_TOOL_NAME, WEAPON_TOOL_NAME];
/**
 * Client-side reach used to pick candidates. Deliberately generous (the server applies the real
 * reach per weapon, plus lag tolerance), so a hit that looked right is never dropped here.
 */
const CANDIDATE_REACH = 10;
const CANDIDATE_HALF_ARC = 75;
/** Don't spam swings faster than this locally (the server enforces the real cooldowns). */
const LOCAL_SWING_GAP = 0.35;
/** How quickly the character turns to face the camera (0..1 per frame). */
const TURN_SPEED = 0.35;
const FACE_BINDING = "MeleeFaceCamera";

const player = Players.LocalPlayer;

function rootOf(model: Model | undefined): BasePart | undefined {
	const hrp = model?.FindFirstChild("HumanoidRootPart");
	return hrp && hrp.IsA("BasePart") ? hrp : undefined;
}

/** Players in reach and in front of us, nearest first. */
function candidatesInReach(root: BasePart): number[] {
	const found: Array<{ userId: number; distance: number }> = [];
	for (const other of Players.GetPlayers()) {
		const theirs = rootOf(other.Character);
		if (other === player || !theirs) {
			continue;
		}
		if (
			checkMeleeReach(
				root.Position,
				root.CFrame.LookVector,
				theirs.Position,
				CANDIDATE_REACH,
				CANDIDATE_HALF_ARC,
			) === "ok"
		) {
			found.push({ userId: other.UserId, distance: theirs.Position.sub(root.Position).Magnitude });
		}
	}
	found.sort((a, b) => a.distance < b.distance);
	const ids: number[] = [];
	for (const entry of found) {
		if (ids.size() >= MAX_SWING_CANDIDATES) {
			break;
		}
		ids.push(entry.userId);
	}
	return ids;
}

export function startMelee(remote: RemoteEvent) {
	const send = serverSender<GameClientMessages>(remote);
	let lastSwing = -math.huge;
	let equipped: Tool | undefined;
	let activated: RBXScriptConnection | undefined;

	const stopFacing = () => {
		RunService.UnbindFromRenderStep(FACE_BINDING);
		const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.AutoRotate = true;
		}
	};

	const startFacing = (character: Model) => {
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (humanoid) {
			humanoid.AutoRotate = false; // we turn the character ourselves
		}
		RunService.BindToRenderStep(FACE_BINDING, Enum.RenderPriority.Character.Value, () => {
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
	};

	const swing = (tool: Tool) => {
		const now = os.clock();
		const root = rootOf(player.Character);
		if (!root || now - lastSwing < LOCAL_SWING_GAP) {
			return;
		}
		lastSwing = now;
		// The default Animate script plays its slash animation when this appears in the tool.
		const anim = new Instance("StringValue");
		anim.Name = "toolanim";
		anim.Value = "Slash";
		anim.Parent = tool;
		send("Swing", candidatesInReach(root));
	};

	const onEquipped = (character: Model, tool: Tool) => {
		equipped = tool;
		activated?.Disconnect();
		activated = tool.Activated.Connect(() => swing(tool));
		startFacing(character);
	};

	const onUnequipped = (tool: Tool) => {
		if (equipped !== tool) {
			return;
		}
		equipped = undefined;
		activated?.Disconnect();
		activated = undefined;
		stopFacing();
	};

	const watch = (character: Model) => {
		// An equipped Tool is parented to the character; unequipping moves it back out.
		character.ChildAdded.Connect((child) => {
			if (child.IsA("Tool") && MELEE_TOOLS.includes(child.Name)) {
				onEquipped(character, child);
			}
		});
		character.ChildRemoved.Connect((child) => {
			if (child.IsA("Tool")) {
				onUnequipped(child);
			}
		});
	};
	if (player.Character) {
		watch(player.Character);
	}
	player.CharacterAdded.Connect((character) => {
		equipped = undefined;
		activated?.Disconnect();
		stopFacing();
		watch(character);
	});
}
