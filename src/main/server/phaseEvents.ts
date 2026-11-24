import { Players } from "@rbxts/services";
import { Clock, DayPhase } from "shared/phases";
import { MUM, SUNDOWN } from "shared/walkie";
import { refillPile } from "./barricades";
import { addCoins } from "./coins";
import { gameConfig } from "./config";
import { refillGardens, restockContainers } from "./containers";
import { returnAllTaken } from "./elimination";
import { send } from "./gameRemote";
import { healAll } from "./health";
import { retreatAll, spawnDormant, startNight } from "./infected/director";
import { setPhaseLighting } from "./lighting";
import { Neighbourhood } from "./neighbourhood";
import { beginNight, clearSummary, endNight } from "./nightReport";
import { getClock } from "./round";
import { setStreetLights } from "./streetlights";
import { isPlaying, livingKids } from "./teams";
import { itemsOnOrder, refreshTrading, startTradingDay } from "./trading";
import { refreshWalkie, say, sayMorningReport } from "./walkie";

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

function onDay(clock: Clock, street: Neighbourhood) {
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

const ON_PHASE: Record<DayPhase, (clock: Clock, street: Neighbourhood) => void> = {
	Day: onDay,
	Dusk: () => {},
	Night: onNight,
	Dawn: onDawn,
};

export function onPhase(clock: Clock, street: Neighbourhood) {
	print(`[Main] ${clock.phase} ${clock.night}`);
	setPhaseLighting(clock.phase);
	ON_PHASE[clock.phase](clock, street);
	// Bases open, close and restock.
	refreshTrading();
	refreshWalkie();
}
