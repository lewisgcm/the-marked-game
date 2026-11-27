import { CollectionService } from "@rbxts/services";
import { WALL_MAP_TAG } from "shared/core/tags";
import { gameConfig } from "../core/config";
import { makePrompt, promptAnchor } from "../core/prompts";

/**
 * The neighbourhood map on the hall's cork board (a workbench upgrade). Each client draws it
 * (client/hud/wallMap.tsx) and opens it full screen from this prompt; the server only puts the prompt
 * there and turns it on once it's bought. It shows nothing the client can't already see.
 */

let prompt: ProximityPrompt | undefined;

/** Turns the map's prompt on: someone's bought it. */
export function unlockWallMap() {
	if (prompt) {
		prompt.Enabled = true;
	}
}

/** Puts the (hidden) prompt on the board. Call once, after the house is built. */
export function startWallMap() {
	const board = CollectionService.GetTagged(WALL_MAP_TAG).find((b): b is BasePart => b.IsA("BasePart"));
	if (!board) {
		warn("[WallMap] The house has no map board.");
		return;
	}
	prompt = makePrompt(
		promptAnchor(board, new Vector3(-0.5, 0, 0)),
		"Look at the map",
		Enum.KeyCode.E,
		gameConfig.holdQuick.Value,
	);
	prompt.Name = "WallMapPrompt";
	prompt.ObjectText = "Neighbourhood map";
	prompt.Enabled = false;
}
