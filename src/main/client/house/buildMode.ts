import { CollectionService, Players } from "@rbxts/services";
import { HAMMER_TOOL_NAME } from "shared/house/barricade";
import { BUILD_PROMPT_TAG } from "shared/core/tags";

/**
 * Build mode: the door and window prompts only show while you hold the hammer, so they're out of the
 * way in a fight. Hidden by setting their distance to 0 on this client only: the server never changes
 * a prompt's distance after making it (it does change Enabled). It checks for the hammer itself.
 */

const player = Players.LocalPlayer;
/** Each build prompt's real distance. */
const distances = new Map<ProximityPrompt, number>();
let building = false;

function setBuilding(on: boolean) {
	building = on;
	for (const [prompt, distance] of distances) {
		prompt.MaxActivationDistance = building ? distance : 0;
	}
}

function addPrompt(prompt: Instance) {
	if (prompt.IsA("ProximityPrompt") && !distances.has(prompt)) {
		distances.set(prompt, prompt.MaxActivationDistance);
		prompt.MaxActivationDistance = building ? prompt.MaxActivationDistance : 0;
	}
}

function watch(character: Model) {
	setBuilding(character.FindFirstChild(HAMMER_TOOL_NAME) !== undefined);
	character.ChildAdded.Connect((child) => {
		if (child.Name === HAMMER_TOOL_NAME) {
			setBuilding(true);
		}
	});
	character.ChildRemoved.Connect((child) => {
		if (child.Name === HAMMER_TOOL_NAME) {
			setBuilding(false);
		}
	});
}

export function startBuildMode() {
	CollectionService.GetInstanceAddedSignal(BUILD_PROMPT_TAG).Connect(addPrompt);
	CollectionService.GetTagged(BUILD_PROMPT_TAG).forEach(addPrompt);
	if (player.Character) {
		watch(player.Character);
	}
	player.CharacterAdded.Connect(watch);
}
