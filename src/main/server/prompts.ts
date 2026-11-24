import { rootOf } from "shared/characters";

/** ProximityPrompt helpers for anything kids interact with. */

/** Extra reach allowed past a prompt's own distance when checking a trigger, in studs. */
const REACH_TOLERANCE = 4;

/** A prompt on a new attachment at `offset` (in `part`'s space). */
export function promptAnchor(part: BasePart, offset: Vector3): Attachment {
	const anchor = new Instance("Attachment");
	anchor.Name = "PromptAnchor";
	anchor.Position = offset;
	anchor.Parent = part;
	return anchor;
}

export function makePrompt(anchor: Attachment, action: string, key: Enum.KeyCode, hold: number): ProximityPrompt {
	const prompt = new Instance("ProximityPrompt");
	prompt.ActionText = action;
	prompt.KeyboardKeyCode = key;
	prompt.HoldDuration = hold;
	prompt.MaxActivationDistance = 8;
	prompt.RequiresLineOfSight = false; // slots, planks and props are often in the way
	prompt.Parent = anchor;
	return prompt;
}

/** Server-side check that `player` is close enough to have used `prompt`. */
export function inReach(player: Player, prompt: ProximityPrompt): boolean {
	const root = rootOf(player.Character);
	const anchor = prompt.Parent;
	if (!root || !anchor || !anchor.IsA("Attachment")) {
		return false;
	}
	return root.Position.sub(anchor.WorldPosition).Magnitude <= prompt.MaxActivationDistance + REACH_TOLERANCE;
}
