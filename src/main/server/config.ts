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
		// --- Round ----------------------------------------------------------------------------
		/** Seconds to wait for the whole party to arrive before starting without stragglers. */
		arrivalTimeout: int("ArrivalTimeout", 30),
		/** Seconds of "get ready" countdown before the hunt, with everyone frozen. */
		countdownSeconds: int("CountdownSeconds", 5),
		/** Length of the hunt; if the ghost survives it, the ghost wins. Studio: 3 minutes. */
		roundSeconds: int("RoundSeconds", 480, 180),
		/** Seconds the end screen (scoreboard) shows before everyone goes back to the lobby. */
		endScreenSeconds: int("EndScreenSeconds", 15),

		// --- Lighting -------------------------------------------------------------------------
		/**
		 * How bright the house is with no lamp or torch (Lighting.Ambient grey level, 0-1). Low
		 * enough to stay scary, high enough to make out walls and furniture in unlit rooms.
		 * Applies live when edited in Studio. (Was 0.16, 0.26, 0.34: playtesters wanted it lighter.)
		 */
		darkness: num("DarkRoomLight", 0.8),

		// --- Flashlight reveals -----------------------------------------------------------------
		/** The ghost stays visible this long after leaving every beam, so reveals don't strobe. */
		revealLinger: num("RevealLinger", 1.2),

		// --- Ghost traps ------------------------------------------------------------------------
		/** Traps each hunter gets per round. */
		trapsPerHunter: int("TrapsPerHunter", 2),
		/** How close the ghost must come to set a trap off, in studs. */
		trapTriggerRadius: num("TrapTriggerRadius", 6),
		/** How long a sprung trap reveals and slows the ghost, in seconds. */
		trapEffectSeconds: num("TrapEffectSeconds", 4),
		/** The ghost's speed multiplier while a trap's effect lasts. */
		trapSlowFactor: num("TrapSlowFactor", 0.5),

		// --- Sanity (per second; see shared/sanity.ts for how they combine) -----------------------
		/** Drain when alone in the dark. */
		sanityDrainAlone: num("SanityDrainAlone", 0.8),
		/** Recovery near a working lamp *or* another hunter. */
		sanityRecoverOne: num("SanityRecoverOne", 0.5),
		/** Recovery near a lamp *and* another hunter. */
		sanityRecoverBoth: num("SanityRecoverBoth", 1.5),
		/** Extra drain while the ghost is close, seen or not. */
		sanityGhostChill: num("SanityGhostChill", 1.2),
		/** Within this horizontal distance of a working lamp counts as "in the light", in studs. */
		lampComfortRadius: num("LampComfortRadius", 13),
		/** Another hunter within this distance counts as company, in studs. */
		companyRadius: num("CompanyRadius", 15),
		/** The ghost within this distance chills a hunter, in studs. */
		ghostChillRadius: num("GhostChillRadius", 14),

		// --- Panic -------------------------------------------------------------------------------
		/** Panic starts when sanity drops to this. */
		panicStartAt: num("PanicStartAt", 0),
		/** A panicking hunter calms down once sanity climbs back to this. */
		panicRecoverAt: num("PanicRecoverAt", 20),
		/** A panicking hunter's speed multiplier. */
		panicSpeedFactor: num("PanicSpeedFactor", 0.7),
		/** Seconds between a panicking hunter's screams. */
		panicScreamInterval: num("PanicScreamInterval", 10),

		// --- Spooks (the ghost's abilities) -------------------------------------------------------
		/** Most spook charges the ghost can hold. */
		spookMaxCharges: int("SpookMaxCharges", 3),
		/** Charges the ghost starts the hunt with. */
		spookStartCharges: int("SpookStartCharges", 2),
		/** Seconds to regain one charge. */
		spookRechargeSeconds: num("SpookRechargeSeconds", 40),
		/** Minimum seconds between any two spooks. */
		spookCooldown: num("SpookCooldown", 3),
		/** Fear feeds the ghost: seconds off its next charge per hunter a scream hits. */
		scareRewardScream: num("ScareRewardScream", 8),
		/** ...when a hunter starts panicking. */
		scareRewardPanic: num("ScareRewardPanic", 10),
		/** ...per knife hit that drains sanity. */
		scareRewardKnifeHit: num("ScareRewardKnifeHit", 10),
		/** ...per knife kill. */
		scareRewardKill: num("ScareRewardKill", 15),
		/** Scream: hunters within this distance of the ghost are hit, in studs. */
		screamRadius: num("ScreamRadius", 15),
		/** Scream: sanity each hunter in range loses. */
		screamSanityDamage: num("ScreamSanityDamage", 25),
		/** Scream: how long the ghost is visible afterwards — and can use its knife — in seconds. */
		screamRevealSeconds: num("ScreamRevealSeconds", 6),
		/** Lights out: the lamp must be within this horizontal distance of the ghost, in studs. */
		lightsOutRadius: num("LightsOutRadius", 20),
		/** Lights out: how long the lamp stays dark, in seconds. */
		lightsOutSeconds: num("LightsOutSeconds", 10),

		// --- Combat --------------------------------------------------------------------------------
		/** Knife reach, in studs (the target must also be in front of the ghost). */
		knifeRange: num("KnifeRange", 6),
		/** Seconds between knife swings. */
		knifeCooldown: num("KnifeCooldown", 1.5),
		/** A hunter below this sanity is vulnerable: the knife kills them. */
		vulnerableBelowSanity: num("VulnerableBelowSanity", 30),
		/** Sanity a knife hit takes from a hunter who isn't vulnerable. */
		knifeSanityDamage: num("KnifeSanityDamage", 20),
		/** The ghost's health. */
		ghostMaxHealth: num("GhostMaxHealth", 100),
		/** Damage per weapon hit on a visible ghost. */
		weaponDamage: num("WeaponDamage", 20),
		/** Weapon reach, in studs (the ghost must also be in front of the hunter). */
		weaponRange: num("WeaponRange", 7),
		/** Seconds between weapon swings. */
		weaponCooldown: num("WeaponCooldown", 1),
		/** Half the swing arc for both weapons, in degrees (60 = a 120-degree arc in front). */
		meleeHalfArc: num("MeleeHalfArc", 60),
		/** Extra reach the server allows for network lag when checking a client's hit, in studs. */
		meleeReachTolerance: num("MeleeReachTolerance", 3),
		/** Extra arc the server allows for network lag, in degrees. */
		meleeAngleTolerance: num("MeleeAngleTolerance", 30),
		/** A hit ghost's speed multiplier, briefly. */
		hitSlowFactor: num("HitSlowFactor", 0.6),
		/** Seconds before a hunter who reset (not killed) respawns. */
		respawnDelay: num("RespawnDelay", 3),

		// --- Objective ---------------------------------------------------------------------------
		/** Keys beyond one per chest, so a missed key isn't a dead end. */
		spareKeys: int("SpareKeys", 1),
		/** Seconds hunters must hold the altar prompt to banish the ghost. */
		banishHoldSeconds: num("BanishHoldSeconds", 10),
		/** Length of the banishing cutscene (ghost dragged to the altar and dissolved), in seconds. */
		banishCutsceneSeconds: num("BanishCutsceneSeconds", 6),
	};
}

/** The live config. Read `.Value` at the point of use, so Studio edits take effect. */
export const gameConfig = loadGameConfig();
