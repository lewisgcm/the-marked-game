import { Players, StarterPlayer } from "@rbxts/services";
import { rootOf } from "shared/characters";
import { TAKEN_ATTRIBUTE } from "shared/combat";
import { gameConfig } from "./config";
import { recordTaken } from "./roundStats";

/**
 * Spawning and death. The server spawns characters itself (CharacterAutoLoads off), so it can
 * decide who comes back:
 *
 * - A kid who is **taken** spectates until they're brought back (`returnKid`: at dawn, or sooner
 *   on Night 1 — elimination.ts decides).
 * - Dying any other way (resetting, falling) counts as taken at night; by day it respawns after
 *   RespawnDelay, as normal.
 */

export interface LifeHooks {
	/** A kid was taken, at `position`. Runs before their character is removed. */
	onTaken: (player: Player, position: Vector3 | undefined) => void;
	/** Whether dying right now counts as being taken (so resetting at night is no escape). */
	deathIsTaken: (player: Player) => boolean;
}

const dead = new Set<Player>();
let hooks: LifeHooks | undefined;

export function isAlive(player: Player): boolean {
	return !dead.has(player);
}

function spawnCharacter(player: Player) {
	task.spawn(() => {
		if (player.Parent && !dead.has(player)) {
			player.LoadCharacter();
		}
	});
}

function watch(player: Player) {
	player.CharacterAdded.Connect((character) => {
		const humanoid = character.WaitForChild("Humanoid", 5) as Humanoid | undefined;
		humanoid?.Died.Connect(() => {
			if (!dead.has(player) && hooks?.deathIsTaken(player)) {
				takeKid(player);
			} else if (!dead.has(player)) {
				task.delay(gameConfig.respawnDelay.Value, () => spawnCharacter(player));
			}
		});
	});
	if (!player.Character) {
		spawnCharacter(player);
	}
}

/** Takes `player` out of the run: they spectate instead of respawning. */
export function takeKid(player: Player) {
	if (dead.has(player)) {
		return;
	}
	dead.add(player);
	recordTaken(player);
	player.SetAttribute(TAKEN_ATTRIBUTE, true);

	const character = player.Character;
	hooks?.onTaken(player, rootOf(character)?.Position);

	const humanoid = character?.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		humanoid.Health = 0;
	}
	// Clear the body away after a moment; they won't be respawned.
	task.delay(3, () => {
		if (player.Character === character) {
			character?.Destroy();
		}
	});
}

/** Brings a taken kid back: they respawn (in the basement, see loadout.ts). */
export function returnKid(player: Player) {
	if (!dead.delete(player)) {
		return;
	}
	player.SetAttribute(TAKEN_ATTRIBUTE, false);
	spawnCharacter(player);
}

/** Kids currently taken. */
export function takenKids(): Player[] {
	return [...dead];
}

/**
 * Replaces Roblox's default health regeneration (a script named "Health" that every character
 * gets) with an empty one: kids only heal at dawn.
 */
function disableRegeneration() {
	const scripts = StarterPlayer.FindFirstChildOfClass("StarterCharacterScripts");
	if (scripts && !scripts.FindFirstChild("Health")) {
		const empty = new Instance("Script");
		empty.Name = "Health";
		empty.Parent = scripts;
	}
}

/** Takes over spawning. Call once, before players join if possible. */
export function startLife(lifeHooks: LifeHooks) {
	hooks = lifeHooks;
	disableRegeneration();
	Players.CharacterAutoLoads = false;
	Players.GetPlayers().forEach(watch);
	Players.PlayerAdded.Connect(watch);
	Players.PlayerRemoving.Connect((player) => dead.delete(player));
}
