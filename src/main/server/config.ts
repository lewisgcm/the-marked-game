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
		/** Seconds the "DAY 1" title card shows at the start, with everyone frozen. */
		startSeconds: int("StartSeconds", 4),

		// --- Day/night clock (GAMEPLAY.md §4). Studio values are short, to see a cycle quickly. --
		/** Day: scavenge and trade. */
		daySeconds: int("DaySeconds", 180, 40),
		/** Dusk: get home, barricade, deal with screens; the broadcast hits partway through. */
		duskSeconds: int("DuskSeconds", 45, 20),
		/** Night: hold the house. */
		nightSeconds: int("NightSeconds", 150, 60),
		/** Dawn: recover and upgrade. */
		dawnSeconds: int("DawnSeconds", 45, 15),

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

		// --- Barricades -------------------------------------------------------------------------
		/** Planks each door or window holds. */
		plankSlots: int("PlankSlots", 3),
		/** Health of a plank. */
		plankHealth: num("PlankHealth", 100),
		/** Night 1 is forgiving: planks nailed on Day 1 or Night 1 get this much more health. */
		firstNightPlankMultiplier: num("FirstNightPlankMultiplier", 2),
		/** Planks a kid can carry. */
		plankCarryMax: int("PlankCarryMax", 5),
		/** Planks in the garage pile at the start of a run. */
		plankPileStart: int("PlankPileStart", 30),
		/** Planks added to the pile at every dawn. */
		plankPileDawnRefill: int("PlankPileDawnRefill", 10),
		/** Seconds to hold the prompt to nail a plank up (taking one down is quicker). */
		boardHoldSeconds: num("BoardHoldSeconds", 1.2),

		// --- Kids -------------------------------------------------------------------------------
		/** A kid's health. It doesn't regenerate; everyone is healed to full at dawn. */
		kidMaxHealth: num("KidMaxHealth", 100),
		/** Night 1 is forgiving: a taken kid is back in the basement after this many seconds. */
		firstNightTakenSeconds: num("FirstNightTakenSeconds", 15),

		// --- The infected (shamblers for now; see shared/waves.ts for wave sizes) ---------------
		/** Health on Night 1. */
		infectedBaseHealth: num("InfectedBaseHealth", 60),
		/** Extra health per night after the first, as a fraction (0.1 = +10% a night). */
		infectedHealthPerNight: num("InfectedHealthPerNight", 0.1),
		/** Walk speed (kids walk at 16). */
		infectedWalkSpeed: num("InfectedWalkSpeed", 9),
		/** Damage per hit on a kid. */
		infectedKidDamage: num("InfectedKidDamage", 15),
		/** Night 1 is forgiving: the infected's damage to kids is multiplied by this. */
		firstNightDamageMultiplier: num("FirstNightDamageMultiplier", 0.5),
		/** Seconds between an infected's hits on a kid. */
		infectedKidHitSeconds: num("InfectedKidHitSeconds", 1.2),
		/** Damage per hit on a plank. */
		infectedPlankDamage: num("InfectedPlankDamage", 15),
		/** Seconds between an infected's hits on a barricade. */
		infectedPlankHitSeconds: num("InfectedPlankHitSeconds", 1.5),
		/** How close an infected must be to hit a kid, in studs. */
		infectedAttackRange: num("InfectedAttackRange", 5),
		/** An infected outside goes for a kid it can see within this distance, in studs. */
		infectedSightRange: num("InfectedSightRange", 40),
		/** With the generator off, waves are this many times bigger (never on Night 1). */
		powerOffWaveMultiplier: num("PowerOffWaveMultiplier", 1.4),
		/** Most infected alive at once (the rest of a wave waits). */
		maxInfected: int("MaxInfected", 20),

		// --- Slingshot -------------------------------------------------------------------------
		/** Damage per stone. */
		slingshotDamage: num("SlingshotDamage", 10),
		/** How far a stone flies, in studs. */
		slingshotRange: num("SlingshotRange", 80),
		/** Seconds between shots. */
		slingshotCooldown: num("SlingshotCooldown", 0.6),
		/** Stones each kid starts with. */
		stonesStart: int("StonesStart", 20),
		/** Stones each kid gets back at dawn (up to StonesMax). */
		stonesDawnRefill: int("StonesDawnRefill", 10),
		/** Most stones a kid can carry. */
		stonesMax: int("StonesMax", 20),

		// --- Flashlight stun (shared/stun.ts) ------------------------------------------------------
		/** Seconds a beam must stay on an infected to stun it. */
		stunLitSeconds: num("StunLitSeconds", 0.6),
		/** How long the stun lasts. */
		stunSeconds: num("StunSeconds", 2),
		/** After a stun, beams don't work on that infected for this long. */
		stunImmuneSeconds: num("StunImmuneSeconds", 5),

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
