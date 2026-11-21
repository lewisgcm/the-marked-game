import { Players } from "@rbxts/services";
import { DEAD_ATTRIBUTE } from "shared/combat";
import { gameConfig } from "./config";
import { recordDeath } from "./roundStats";

/**
 * Spawning and death. The server spawns characters itself (CharacterAutoLoads off), so it can
 * decide who comes back:
 *
 * - A hunter **killed by the ghost** is out for the round: no respawn, they spectate.
 * - Any other death (e.g. resetting) respawns after RespawnDelay, as normal.
 */

export interface LifeHooks {
	/** A hunter was killed by the ghost, at `position`. Runs before their character dies. */
	onKilled: (player: Player, position: Vector3 | undefined) => void;
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
			if (!dead.has(player)) {
				task.delay(gameConfig.respawnDelay.Value, () => spawnCharacter(player));
			}
		});
	});
	if (!player.Character) {
		spawnCharacter(player);
	}
}

/** Kills `player` for the rest of the round (the ghost's knife). */
export function killHunter(player: Player) {
	if (dead.has(player)) {
		return;
	}
	dead.add(player);
	recordDeath(player);
	player.SetAttribute(DEAD_ATTRIBUTE, true);

	const character = player.Character;
	const hrp = character?.FindFirstChild("HumanoidRootPart");
	hooks?.onKilled(player, hrp && hrp.IsA("BasePart") ? hrp.Position : undefined);

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

/** Takes over spawning. Call once, before players join if possible. */
export function startLife(lifeHooks: LifeHooks) {
	hooks = lifeHooks;
	Players.CharacterAutoLoads = false;
	Players.GetPlayers().forEach(watch);
	Players.PlayerAdded.Connect(watch);
	Players.PlayerRemoving.Connect((player) => dead.delete(player));
}
