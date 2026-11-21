import { Players } from "@rbxts/services";
import { giveKnife, giveWeapon } from "./combat";
import { giveFlashlight, removeFlashlight } from "./flashlight";
import { send } from "./gameRemote";
import { clearGhost, makeGhost } from "./ghostVisibility";
import { getRole } from "./roles";
import { isFrozen, setFrozen } from "./round";
import { giveTrapTool, removeTrapTool } from "./traps";
import { MainWorld } from "./world";

/**
 * Sets each character up for its role, on every spawn: the ghost becomes invisible with a
 * knife; hunters get a flashlight, traps and a fire poker. Then the character is moved to its
 * role's start room (and frozen if the countdown is running).
 */

let world: MainWorld | undefined;

export function setUpCharacter(player: Player, character: Model) {
	const role = getRole(player);
	if (role === undefined || !world) {
		return; // roles not picked yet; this runs again once they are
	}
	if (role === "Ghost") {
		removeFlashlight(player);
		removeTrapTool(player);
		makeGhost(player, character);
		giveKnife(player);
		send(player, "GhostRevealed", false);
	} else {
		clearGhost(player);
		task.spawn(() => giveFlashlight(player, character));
		giveTrapTool(player);
		giveWeapon(player);
	}
	const spawnAt = role === "Ghost" ? world.ghostSpawn : world.hunterSpawn;
	// Wait a frame so the character is fully parented before moving it.
	task.defer(() => {
		character.PivotTo(spawnAt);
		setFrozen(character, isFrozen()); // spawning mid-countdown still has to wait
	});
}

/** Tells each of `players` their role and sets up their current character. */
export function announceRoles(players: Player[]) {
	for (const player of players) {
		const role = getRole(player);
		if (role) {
			send(player, "Role", role);
		}
		if (player.Character) {
			setUpCharacter(player, player.Character);
		}
	}
}

/** Sets up every future spawn. Call once. */
export function startLoadouts(mainWorld: MainWorld) {
	world = mainWorld;
	const watch = (player: Player) => player.CharacterAdded.Connect((character) => setUpCharacter(player, character));
	Players.GetPlayers().forEach(watch);
	Players.PlayerAdded.Connect(watch);
	Players.PlayerRemoving.Connect(clearGhost);
}
