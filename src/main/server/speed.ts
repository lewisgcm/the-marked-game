import { Players, StarterPlayer } from "@rbxts/services";

/**
 * Walk-speed modifiers, combined per player (e.g. a trap's slow and panic multiply instead of
 * overwriting each other). Keyed by player, not character, so they survive a respawn —
 * resetting can't shake off a slow.
 */

const modifiers = new Map<Player, Map<string, number>>();

function apply(player: Player) {
	const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
	if (!humanoid) {
		return;
	}
	let factor = 1;
	modifiers.get(player)?.forEach((value) => (factor *= value));
	humanoid.WalkSpeed = StarterPlayer.CharacterWalkSpeed * factor;
}

/** Sets (or, with `factor` undefined, clears) the modifier named `key` for `player`. */
export function setSpeedModifier(player: Player, key: string, factor: number | undefined) {
	let forPlayer = modifiers.get(player);
	if (!forPlayer) {
		forPlayer = new Map();
		modifiers.set(player, forPlayer);
	}
	if (factor === undefined) {
		forPlayer.delete(key);
	} else {
		forPlayer.set(key, factor);
	}
	apply(player);
}

const watch = (player: Player) => player.CharacterAdded.Connect(() => task.defer(() => apply(player)));
Players.GetPlayers().forEach(watch);
Players.PlayerAdded.Connect(watch);
Players.PlayerRemoving.Connect((player) => modifiers.delete(player));
