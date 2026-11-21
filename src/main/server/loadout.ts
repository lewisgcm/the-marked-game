import { Players } from "@rbxts/services";
import { giveBat } from "./combat";
import { giveFlashlight } from "./flashlight";
import { setUpHealth } from "./health";
import { isMember } from "./party";
import { isFrozen, setFrozen } from "./round";
import { MainWorld } from "./world";

/**
 * Sets each kid's character up on every spawn: a flashlight and a baseball bat, moved to the
 * kids' start (and frozen if the countdown is running).
 */

let world: MainWorld | undefined;

export function setUpCharacter(player: Player, character: Model) {
	if (!isMember(player) || !world) {
		return; // the run hasn't started yet; this runs again once it has
	}
	task.spawn(() => giveFlashlight(player, character));
	giveBat(player);
	setUpHealth(character);
	const spawnAt = world.kidSpawn;
	// Wait a frame so the character is fully parented before moving it.
	task.defer(() => {
		character.PivotTo(spawnAt);
		setFrozen(character, isFrozen()); // spawning mid-countdown still has to wait
	});
}

/** Sets up the current character of each of `players`. */
export function setUpAll(players: Player[]) {
	for (const player of players) {
		if (player.Character) {
			setUpCharacter(player, player.Character);
		}
	}
}

/** Sets up every future spawn. Call once. */
export function startLoadouts(mainWorld: MainWorld) {
	world = mainWorld;
	const watch = (player: Player) =>
		player.CharacterAdded.Connect((character) => {
			// Everyone waits frozen behind the title card until the run starts, party or not yet.
			if (isFrozen()) {
				task.defer(() => setFrozen(character, isFrozen()));
			}
			setUpCharacter(player, character);
		});
	Players.GetPlayers().forEach(watch);
	Players.PlayerAdded.Connect(watch);
}
