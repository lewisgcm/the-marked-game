import { Players } from "@rbxts/services";
import { Clock, DayPhase } from "shared/phases";
import { refillPile } from "./barricades";
import { addCoins } from "./coins";
import { gameConfig } from "./config";
import { refillGardens } from "./containers";
import { returnAllTaken } from "./elimination";
import { notifyAll, send } from "./gameRemote";
import { healAll } from "./health";
import { retreatAll, spawnDormant, startNight } from "./infected/director";
import { setPhaseLighting } from "./lighting";
import { Neighbourhood } from "./neighbourhood";
import { beginNight, clearSummary, endNight } from "./nightReport";
import { getClock } from "./round";
import { setStreetLights } from "./streetlights";
import { isPlaying, livingKids } from "./teams";

/** What happens as each phase of the day/night clock begins. */

/** Late in the day: a warning to head home, and the street lamps come on. */
function scheduleSundown(night: number) {
	task.delay(math.max(0, gameConfig.daySeconds.Value - gameConfig.sundownSeconds.Value), () => {
		const clock = getClock();
		if (isPlaying() && clock.night === night && clock.phase === "Day") {
			setStreetLights(true);
			notifyAll("The sun's going down. Get home.");
		}
	});
}

function onDay(clock: Clock, street: Neighbourhood) {
	clearSummary();
	spawnDormant(street.dormantSpots, clock.night, clock.night === 1 ? street.dadSpot : undefined);
	scheduleSundown(clock.night);
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
}
