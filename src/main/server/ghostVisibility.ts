import { GHOST_HIDDEN_TRANSPARENCY, GHOST_REVEALED_COLOR, GHOST_REVEALED_TRANSPARENCY } from "shared/ghost";

/**
 * Server-side invisibility for the ghost.
 *
 * The server sets the ghost's body transparent, and that replicates to every client, so
 * hunters see nothing without any cooperation from their own scripts. The ghost's client
 * overrides its *own* view locally (see main/client/ghostSelf.ts) so the player can see
 * themselves; local property changes never replicate, so that can't leak to anyone else.
 *
 * Limit: a character's position always replicates in Roblox, so an exploit client can still
 * locate the ghost (e.g. by forcing parts visible locally). Invisibility stops honest
 * players seeing it; it is not anti-ESP. Gameplay decisions (reveals, hits) stay server-side.
 */

interface GhostState {
	character: Model;
	revealed: boolean;
	connections: RBXScriptConnection[];
}

const ghosts = new Map<Player, GhostState>();

function styleInstance(instance: Instance, revealed: boolean) {
	if (instance.IsA("BasePart")) {
		if (instance.Name === "HumanoidRootPart") {
			return; // always invisible anyway; leave it be
		}
		instance.Transparency = revealed ? GHOST_REVEALED_TRANSPARENCY : GHOST_HIDDEN_TRANSPARENCY;
		instance.CastShadow = false; // a shadow would give a hidden ghost away
	} else if (instance.IsA("Decal")) {
		instance.Transparency = revealed ? GHOST_REVEALED_TRANSPARENCY : GHOST_HIDDEN_TRANSPARENCY;
	}
}

function applyStyle(state: GhostState) {
	for (const descendant of state.character.GetDescendants()) {
		styleInstance(descendant, state.revealed);
	}
	let highlight = state.character.FindFirstChild("RevealHighlight") as Highlight | undefined;
	if (state.revealed && !highlight) {
		highlight = new Instance("Highlight");
		highlight.Name = "RevealHighlight";
		highlight.FillColor = GHOST_REVEALED_COLOR;
		highlight.FillTransparency = 0.6;
		highlight.OutlineColor = GHOST_REVEALED_COLOR;
		highlight.DepthMode = Enum.HighlightDepthMode.Occluded; // no seeing it through walls
		highlight.Parent = state.character;
	} else if (!state.revealed && highlight) {
		highlight.Destroy();
	}
}

/** Makes `player`'s current character the (hidden) ghost. Call again after each respawn. */
export function makeGhost(player: Player, character: Model) {
	clearGhost(player);

	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None; // no name tag
		humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff;
	}

	const state: GhostState = { character, revealed: false, connections: [] };
	// Accessories and clothing stream in after the character spawns; style them as they land.
	state.connections.push(character.DescendantAdded.Connect((d) => styleInstance(d, state.revealed)));
	ghosts.set(player, state);
	applyStyle(state);
}

export function clearGhost(player: Player) {
	forcedUntil.delete(player);
	const state = ghosts.get(player);
	if (state) {
		state.connections.forEach((c) => c.Disconnect());
		ghosts.delete(player);
	}
}

/**
 * Forced reveals (e.g. a trap), on top of flashlight reveals: the reveal loop keeps the ghost
 * visible until this time (os.clock()).
 */
const forcedUntil = new Map<Player, number>();

/** Keeps `player` revealed for at least `seconds` from now. */
export function forceReveal(player: Player, seconds: number) {
	forcedUntil.set(player, math.max(forcedUntil.get(player) ?? 0, os.clock() + seconds));
}

export function isForceRevealed(player: Player): boolean {
	return os.clock() < (forcedUntil.get(player) ?? 0);
}

export function isRevealed(player: Player): boolean {
	return ghosts.get(player)?.revealed ?? false;
}

/** Shows or hides the ghost to everyone. Returns true if the state changed. */
export function setRevealed(player: Player, revealed: boolean): boolean {
	const state = ghosts.get(player);
	if (!state || state.revealed === revealed) {
		return false;
	}
	state.revealed = revealed;
	applyStyle(state);
	return true;
}
