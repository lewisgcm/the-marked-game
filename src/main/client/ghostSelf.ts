import { Players, ProximityPromptService } from "@rbxts/services";
import { GHOST_REVEALED_TRANSPARENCY, GHOST_SELF_TRANSPARENCY } from "shared/ghost";

/**
 * The ghost's view of its own character.
 *
 * The server makes the ghost fully transparent for everyone (see main/server/ghostVisibility).
 * On the ghost's own client we override that locally to a faint figure, so the player can see
 * where they are. Local property changes don't replicate, so hunters are unaffected.
 */
let isGhost = false;
let revealed = false;
let connections: RBXScriptConnection[] = [];
/** Set by the banishing cutscene: stop overriding, so the ghost sees itself dissolve too. */
let released = false;

function desiredTransparency() {
	return revealed ? GHOST_REVEALED_TRANSPARENCY : GHOST_SELF_TRANSPARENCY;
}

function watch(target: BasePart | Decal) {
	const apply = () => {
		if (isGhost && target.Transparency !== desiredTransparency()) {
			target.Transparency = desiredTransparency();
		}
	};
	apply();
	// Replication from the server would overwrite our local value; put it back each time.
	const signal = target.IsA("BasePart")
		? target.GetPropertyChangedSignal("Transparency")
		: target.GetPropertyChangedSignal("Transparency");
	connections.push(signal.Connect(apply));
}

function track(instance: Instance) {
	if (instance.IsA("BasePart") && instance.Name !== "HumanoidRootPart") {
		watch(instance);
	} else if (instance.IsA("Decal")) {
		watch(instance);
	}
}

function attach(character: Model) {
	connections.forEach((c) => c.Disconnect());
	connections = [];
	if (!isGhost || released) {
		return;
	}
	character.GetDescendants().forEach(track);
	connections.push(character.DescendantAdded.Connect(track));
}

const player = Players.LocalPlayer;
player.CharacterAdded.Connect(attach);

export function setGhost(ghost: boolean) {
	isGhost = ghost;
	// The ghost can't use keys, chests or the altar; hide their prompts. (The server rejects
	// a ghost's triggers anyway — this is just so the ghost isn't shown them.)
	ProximityPromptService.Enabled = !ghost;
	if (player.Character) {
		attach(player.Character);
	}
}

export function setRevealed(value: boolean) {
	revealed = value;
	if (isGhost && player.Character) {
		attach(player.Character);
	}
}

/** Hands the ghost's look back to the server (for the banishing cutscene). */
export function releaseSelfView() {
	released = true;
	connections.forEach((c) => c.Disconnect());
	connections = [];
}
