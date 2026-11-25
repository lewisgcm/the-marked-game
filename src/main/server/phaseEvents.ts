import { Players } from "@rbxts/services";
import { Clock, DayPhase } from "shared/run/phases";
import { MUM, SUNDOWN } from "shared/economy/walkie";
import { refillPile } from "./house/barricades";
import { addCoins } from "./economy/coins";
import { gameConfig } from "./core/config";
import { refillGardens, restockContainers } from "./items/containers";
import { returnAllTaken } from "./run/elimination";
import { send } from "./core/gameRemote";
import { healAll } from "./combat/health";
import { retreatAll, spawnDormant, startNight } from "./infected/director";
import { setPhaseLighting } from "./house/lighting";
import type { Street } from "./world/map";
import { beginNight, clearSummary, endNight } from "./run/nightReport";
import { getClock } from "./core/round";
import { setStreetLights } from "./house/streetlights";
import { isPlaying, livingKids } from "./core/teams";
import { itemsOnOrder, refreshTrading, startTradingDay } from "./economy/trading";
import { refreshWalkie, say, sayMorningReport } from "./economy/walkie";

/** What happens as each phase of the day/night clock begins. */

/** Does something `seconds` into a phase, unless it (or the run) is over by then. */
function later(clock: Clock, seconds: number, act: () => void) {
	task.delay(math.max(0, seconds), () => {
		const now = getClock();
		if (isPlaying() && now.night === clock.night && now.phase === clock.phase) {
			act();
		}
	});
}

/** Late in the day: a warning to head home, and the street lamps come on. */
function onSundown() {
	setStreetLights(true);
	say(MUM, SUNDOWN);
}

function onDay(clock: Clock, street: Street) {
	clearSummary();
	spawnDormant(street.dormantSpots, clock.night, clock.night === 1 ? street.dadSpot : undefined);
	startTradingDay();
	restockContainers(itemsOnOrder());
	later(clock, gameConfig.morningReportDelay.Value, () => sayMorningReport(clock.night));
	later(clock, gameConfig.daySeconds.Value - gameConfig.sundownSeconds.Value, onSundown);
}

function onNight(clock: Clock) {
	beginNight();
	startNight(clock.night, gameConfig.nightSeconds.Value, livingKids().size());
}

function onDawn(clock: Clock) {
	retreatAll();
	refillPile();
	healAll(livingKids());
	refillGardens();
	// Before the taken come back: only kids still in are paid.
	livingKids().forEach((kid) => addCoins(kid, gameConfig.coinsPerDawn.Value));
	setStreetLights(false);
	returnAllTaken();
	const summary = endNight(clock.night);
	Players.GetPlayers().forEach((p) => send(p, "NightSummary", summary));
}

const ON_PHASE: Record<DayPhase, (clock: Clock, street: Street) => void> = {
	Day: onDay,
	Dusk: () => {},
	Night: onNight,
	Dawn: onDawn,
};

export function onPhase(clock: Clock, street: Street) {
	print(`[Main] ${clock.phase} ${clock.night}`);
	setPhaseLighting(clock.phase);
	ON_PHASE[clock.phase](clock, street);
	// Bases open, close and restock.
	refreshTrading();
	refreshWalkie();
}
