import { configInt, configNumber, getServerConfig } from "shared/core/serverConfig";

/**
 * Every main-game tuning number, in one place.
 *
 * Written into `ServerStorage.GameConfig` at server start (Int/NumberValues). Code is the
 * source of truth: values saved in the place file are overwritten (see shared/serverConfig).
 * During a Studio play session you can edit them live in ServerStorage.GameConfig to try
 * things out — systems read them as they go — but the change doesn't stick; copy a good value
 * back here. Server-only: clients can't see or change them.
 *
 * Not here: the flashlight's range and cone angle (src/shared/combat/flashlight.ts), because every
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
		daySeconds: int("DaySeconds", 180, 90),
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

		/** The "sun's going down" warning and street lamps come this long before dusk. */
		sundownSeconds: num("SundownSeconds", 60, 25),

		// --- Inventory, loot and coins -------------------------------------------------------------
		/** Inventory slots (rucksacks add more, M3). */
		inventorySlots: int("InventorySlots", 5),
		/** Nails each kid starts with (one per plank nailed up). */
		nailsStart: int("NailsStart", 10),
		/** Scrap each kid starts with (Studio: enough to try the workbench's recipes). */
		scrapStart: int("ScrapStart", 0, 10),
		/** Seconds to hold to search a container. */
		searchSeconds: num("SearchSeconds", 1.2),
		/** How far the noise of searching carries to dormant infected, in studs. */
		searchNoise: num("SearchNoise", 14),
		/** Health a medkit gives back. */
		medkitHeal: num("MedkitHeal", 50),
		/** Coins each kid starts with (Studio: enough to try the workbench). */
		coinsStart: int("CoinsStart", 0, 150),
		/** Coins for each kid still in at dawn. */
		coinsPerDawn: int("CoinsPerDawn", 5),

		// --- Prompts: seconds to hold (read at the start of a run) ------------------------------------
		/** Things that happen at once: picking up, trading, the workbench. */
		holdQuick: num("HoldQuick", 0.2),
		/** Gathering stones from a garden patch. */
		holdStones: num("HoldStones", 0.6),
		/** Taking planks from the pile. */
		holdTakePlanks: num("HoldTakePlanks", 0.4),
		/** Taking a plank down. */
		holdTakeDown: num("HoldTakeDown", 0.5),
		/** Switching the generator on or off. */
		holdGenerator: num("HoldGenerator", 0.8),

		// --- Workbench upgrades (costs: shared/economy/upgrades.ts) --------------------------------------------
		/** Reinforced planks: planks nailed afterwards have this many times the health. */
		reinforcedPlankMultiplier: num("ReinforcedPlankMultiplier", 1.5),
		/** Door bar: extra plank slots on the front and back doors. */
		doorBarSlots: int("DoorBarSlots", 1),
		/** Door bar: a plank in an extra slot has this many times the health. */
		doorBarMultiplier: num("DoorBarMultiplier", 2),
		/** Inventory slots with a school rucksack. */
		schoolSlots: int("SchoolSlots", 8),
		/** Inventory slots with a hiking rucksack. */
		hikingSlots: int("HikingSlots", 12),

		// --- Trading (who sells what, and prices: shared/economy/bases.ts) --------------------------------------
		/** Scarce goods go up by this fraction of their Day 1 price every day. */
		scarcePriceRise: num("ScarcePriceRise", 0.15),
		/** A base pays this many times its usual price for what it has on order. */
		wantMultiplier: num("WantMultiplier", 2),
		/** Each base's daily order is for this many... */
		orderFewest: int("OrderFewest", 2),
		/** ...to this many. */
		orderMost: int("OrderMost", 3),
		/** Searched containers that get something a base has on order, every morning. */
		restockContainers: int("RestockContainers", 3),
		/** The most one of them gets (at least 1). */
		restockMost: int("RestockMost", 2),
		/** 1: every base trades from Day 1 (Studio, to try them without waiting). */
		openAllBases: int("OpenAllBases", 0, 1),

		// --- Walkie-talkie (what's said: shared/economy/walkie.ts) ----------------------------------------------
		/** Seconds into the day the morning report comes (after the day's title). */
		morningReportDelay: num("MorningReportDelay", 4),
		/** Most messages kept in the log. */
		walkieLog: int("WalkieLog", 30),

		// --- Generator fuel, in nights of running (shared/house/fuel.ts) ------------------------------------
		/** Fuel in the generator at the start of a run. */
		fuelStart: num("FuelStart", 1),
		/** The most the tank holds. */
		fuelTank: num("FuelTank", 3),
		/** What one can adds. */
		fuelPerCan: num("FuelPerCan", 1),
		/** Cans each kid starts with (Studio: one, to try refuelling). */
		fuelCansStart: int("FuelCansStart", 0, 1),
		/** Everyone's warned when it drops to this many nights. */
		fuelLow: num("FuelLow", 0.25),
		/** Generator tune-up: how fast fuel burns (1 = as normal). */
		tuneUpBurnRate: num("TuneUpBurnRate", 0.5),
		/** Seconds to hold to pour a can in. */
		pourSeconds: num("PourSeconds", 1.5),

		// --- Dormant infected (by day, in front of screens; shared/infected/wake.ts) ---------------------------
		/** How far one notices a kid in front of it, in studs. */
		wakeSightRange: num("WakeSightRange", 14),
		/** Half its field of view, in degrees. */
		wakeHalfAngle: num("WakeHalfAngle", 60),
		/** A kid this close wakes it, whichever way it faces, in studs. */
		wakeTouchRange: num("WakeTouchRange", 4),
		/** How far the noise of a bat swing carries, in studs. */
		batNoise: num("BatNoise", 18),
		/** By day, a woken one gives up on a kid this far away, in studs. */
		giveUpRange: num("GiveUpRange", 70),

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
		/** Most planks taken from the pile in one go. */
		planksPerGrab: int("PlanksPerGrab", 5),
		/** Planks in the garage pile at the start of a run. */
		plankPileStart: int("PlankPileStart", 30),
		/** Planks added to the pile at every dawn. */
		plankPileDawnRefill: int("PlankPileDawnRefill", 10),
		/** Health of a window shutter (only Dad can hurt it). */
		shutterHealth: num("ShutterHealth", 300),
		/** Seconds to hold the prompt to nail a plank up (taking one down is quicker). */
		boardHoldSeconds: num("BoardHoldSeconds", 1.2),

		// --- Kids -------------------------------------------------------------------------------
		/** A kid's health. It doesn't regenerate; everyone is healed to full at dawn. */
		kidMaxHealth: num("KidMaxHealth", 100),
		/** Night 1 is forgiving: a taken kid is back in the basement after this many seconds. */
		firstNightTakenSeconds: num("FirstNightTakenSeconds", 15),

		// --- The infected (shamblers for now; see shared/infected/waves.ts for wave sizes) ---------------
		/** Health on Night 1. */
		infectedBaseHealth: num("InfectedBaseHealth", 60),
		/** Extra health per night after the first, as a fraction (0.1 = +10% a night). */
		infectedHealthPerNight: num("InfectedHealthPerNight", 0.1),
		/** Walk speed (kids walk at 16). */
		infectedWalkSpeed: num("InfectedWalkSpeed", 9),
		/** Dad's size, against the model's 5.26 studs (adults tower over kids). Windows open 6 studs. */
		dadScale: num("DadScale", 1.2),
		/** The shamblers' size, against their model's 5.28 studs. */
		shamblerScale: num("ShamblerScale", 1.1),
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
		/** One outside that finds no way in to a kid goes for an opening for at least this long, in seconds. */
		infectedBlockedSeconds: num("InfectedBlockedSeconds", 6),
		/** The power only counts once it's been on for this long, in seconds (Studio nights are shorter). */
		powerSettleSeconds: num("PowerSettleSeconds", 20, 8),
		/** With the generator off, waves are this many times bigger (never on Night 1). */
		powerOffWaveMultiplier: num("PowerOffWaveMultiplier", 1.4),
		/** At dawn, one still walking off after this long dissolves where it is, in seconds. */
		infectedRetreatSeconds: num("InfectedRetreatSeconds", 15),
		/** Most infected alive at once (the rest of a wave waits). */
		maxInfected: int("MaxInfected", 20),

		// --- Slingshot -------------------------------------------------------------------------
		/** Damage per stone. */
		slingshotDamage: num("SlingshotDamage", 10),
		/** How far a stone flies, in studs. */
		slingshotRange: num("SlingshotRange", 80),
		/** How close a stone must pass to hit, in studs. */
		slingshotHitRadius: num("SlingshotHitRadius", 0.6),
		/** Seconds between shots. */
		slingshotCooldown: num("SlingshotCooldown", 0.6),
		/** Stones each kid starts with. */
		stonesStart: int("StonesStart", 20),
		/** Stones in a garden patch (back every dawn). */
		stonesPerPatch: int("StonesPerPatch", 10),

		// --- Flashlight stun (shared/infected/stun.ts) ------------------------------------------------------
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
