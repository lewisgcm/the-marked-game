import { Players, TeleportService } from "@rbxts/services";

const ATTEMPT_LIMIT = 5;
const RETRY_DELAY = 1;
const FLOOD_DELAY = 15;

/**
 * Attempts a TeleportAsync, retrying on transient failures.
 * Mirrors the "SafeTeleport" module from the BloodyMary example.
 */
function teleportAsync(placeId: number, players: Player[], options?: TeleportOptions): boolean {
	let lastError: string | undefined;

	for (let attempt = 1; attempt <= ATTEMPT_LIMIT; attempt++) {
		const [success, err] = pcall(() => {
			TeleportService.TeleportAsync(placeId, players, options);
		});
		if (success) {
			return true;
		}
		lastError = tostring(err);
		task.wait(RETRY_DELAY);
	}

	warn(`[SafeTeleport] Teleport failed after ${ATTEMPT_LIMIT} attempts: ${lastError}`);
	return false;
}

/** Per-player retries after TeleportInitFailed, so a persistent failure can't loop forever. */
const INIT_RETRY_LIMIT = 3;
const initRetries = new Map<Player, number>();

Players.PlayerRemoving.Connect((player) => initRetries.delete(player));

/**
 * Handles teleports that never got off the ground (e.g. server flooded),
 * retrying after a delay where appropriate, up to INIT_RETRY_LIMIT times per player.
 */
TeleportService.TeleportInitFailed.Connect((player, teleportResult, errorMessage, targetPlaceId, teleportOptions) => {
	const retries = (initRetries.get(player) ?? 0) + 1;
	if (retries > INIT_RETRY_LIMIT) {
		warn(`[SafeTeleport] Giving up on ${player.Name} after ${INIT_RETRY_LIMIT} retries: ${errorMessage}`);
		initRetries.delete(player);
		return;
	}
	initRetries.set(player, retries);

	if (teleportResult === Enum.TeleportResult.Flooded) {
		task.wait(FLOOD_DELAY);
	} else if (teleportResult === Enum.TeleportResult.Failure) {
		task.wait(RETRY_DELAY);
	} else {
		warn(`[SafeTeleport] Invalid teleport [${teleportResult.Name}]: ${errorMessage}`);
		initRetries.delete(player);
		return;
	}

	teleportAsync(targetPlaceId, [player], teleportOptions);
});

/**
 * Safely teleports the given players to a place, retrying on failure.
 * Returns false if the teleport couldn't be started after every retry.
 *
 * To send a group to one reserved server, reserve it first and pass its
 * `ReservedServerAccessCode` — not `ShouldReserveServer`, which would make each retry
 * (including the per-player TeleportInitFailed retries) reserve a *different* server.
 */
export function safeTeleport(placeId: number, players: Player[], options?: TeleportOptions): boolean {
	return teleportAsync(placeId, players, options);
}
