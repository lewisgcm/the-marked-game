import { CollectionService, Players } from "@rbxts/services";
import { rootOf } from "shared/core/characters";
import { INFECTED_TAG, MELEE_TOOL_NAMES } from "shared/combat/combat";
import { checkMeleeReach, MAX_SWING_CANDIDATES } from "shared/combat/melee";
import { serverSender } from "shared/core/net";
import { GameClientMessages } from "shared/core/remotes";
import { startFacing, stopFacing } from "./faceCamera";

/**
 * Melee on the attacker's client (the baseball bat, and later the other melee weapons):
 *
 * - **Face the camera** while a weapon is held: the character turns smoothly to where the
 *   camera looks (like shift-lock), so you swing at what you're looking at — on PC and touch.
 * - **Swing:** plays the built-in slash animation (a "toolanim" value the default Animate script
 *   watches for), then sends "Swing" with the infected in reach, nearest first. The server
 *   re-checks every one with its own positions; this side only makes it feel instant.
 */

/**
 * Client-side reach used to pick candidates. Deliberately generous (the server applies the real
 * reach per weapon, plus lag tolerance), so a hit that looked right is never dropped here.
 */
const CANDIDATE_REACH = 10;
const CANDIDATE_HALF_ARC = 75;
/** Don't spam swings faster than this locally (the server enforces the real cooldowns). */
const LOCAL_SWING_GAP = 0.35;

const player = Players.LocalPlayer;

/** Infected in reach and in front of us, nearest first. */
function candidatesInReach(root: BasePart): Model[] {
	const found: Array<{ model: Model; distance: number }> = [];
	for (const tagged of CollectionService.GetTagged(INFECTED_TAG)) {
		if (!tagged.IsA("Model")) {
			continue;
		}
		const theirs = rootOf(tagged);
		if (!theirs) {
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
			found.push({ model: tagged, distance: theirs.Position.sub(root.Position).Magnitude });
		}
	}
	found.sort((a, b) => a.distance < b.distance);
	const models: Model[] = [];
	for (const entry of found) {
		if (models.size() >= MAX_SWING_CANDIDATES) {
			break;
		}
		models.push(entry.model);
	}
	return models;
}

export function startMelee(remote: RemoteEvent) {
	const send = serverSender<GameClientMessages>(remote);
	let lastSwing = -math.huge;
	let equipped: Tool | undefined;
	let activated: RBXScriptConnection | undefined;

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
			if (child.IsA("Tool") && MELEE_TOOL_NAMES.includes(child.Name)) {
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
