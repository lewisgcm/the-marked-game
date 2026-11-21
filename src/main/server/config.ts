import { configInt, configNumber, getServerConfig } from "shared/serverConfig";

/**
 * Every main-game tuning number, in one place.
 *
 * Written into `ServerStorage.GameConfig` at server start (Int/NumberValues). Code is the
 * source of truth: values saved in the place file are overwritten (see shared/serverConfig).
 * During a Studio play session you can edit them live in ServerStorage.GameConfig to try
 * things out — systems read them as they go — but the change doesn't stick; copy a good value
 * back here. Server-only: clients can't see or change them.
 *
 * Not here: the flashlight's range and cone angle (src/shared/flashlight.ts), because every
 * client also needs them to draw the beam, and clients can't read ServerStorage.
 */
export const GAME_CONFIG_NAME = "GameConfig";

function loadGameConfig() {
	const config = getServerConfig(GAME_CONFIG_NAME);
	const int = (name: string, value: number, studioValue?: number) => configInt(config, name, value, studioValue);
	const num = (name: string, value: number, studioValue?: number) => configNumber(config, name, value, studioValue);

	return {
		// --- Run ------------------------------------------------------------------------------
		/** Seconds to wait for the whole party to arrive before starting without stragglers. */
		arrivalTimeout: int("ArrivalTimeout", 30),
		/** Seconds of "get ready" countdown before play, with everyone frozen. */
		countdownSeconds: int("CountdownSeconds", 5),
		/**
		 * Length of the run. M0 placeholder until the day/night clock (M1) decides when a run
		 * ends. Studio: 3 minutes.
		 */
		runSeconds: int("RunSeconds", 480, 180),
		/** Seconds the end screen (scoreboard) shows before everyone goes back to the lobby. */
		endScreenSeconds: int("EndScreenSeconds", 15),
		/** Seconds before a kid who reset (not taken) respawns. */
		respawnDelay: num("RespawnDelay", 3),

		// --- Lighting -------------------------------------------------------------------------
		/**
		 * How bright the house is with no lamp or torch (Lighting.Ambient grey level, 0-1). Low
		 * enough to stay scary, high enough to make out walls and furniture in unlit rooms.
		 * Applies live when edited in Studio.
		 */
		darkness: num("DarkRoomLight", 0.8),

		// --- Melee ----------------------------------------------------------------------------
		/** Baseball bat damage per hit (infected health is their Humanoid's Health). */
		batDamage: num("BatDamage", 20),
		/** Baseball bat reach, in studs (the target must also be in front of the kid). */
		batRange: num("BatRange", 7),
		/** Seconds between bat swings. */
		batCooldown: num("BatCooldown", 0.8),
		/** Half the swing arc, in degrees (60 = a 120-degree arc in front). */
		meleeHalfArc: num("MeleeHalfArc", 60),
		/** Extra reach the server allows for network lag when checking a client's hit, in studs. */
		meleeReachTolerance: num("MeleeReachTolerance", 3),
		/** Extra arc the server allows for network lag, in degrees. */
		meleeAngleTolerance: num("MeleeAngleTolerance", 30),
	};
}

/** The live config. Read `.Value` at the point of use, so Studio edits take effect. */
export const gameConfig = loadGameConfig();
