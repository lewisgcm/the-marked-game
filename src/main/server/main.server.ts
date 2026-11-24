import { Players } from "@rbxts/services";
import { onClientMessage } from "shared/net";
import { GameClientMessages } from "shared/remotes";
import { anyBoarded, refillPile, startBarricades } from "./barricades";
import { addCoins, startCoins } from "./coins";
import { onSwingRequest, startCombat } from "./combat";
import { gameConfig } from "./config";
import { refillGardens, startContainers } from "./containers";
import { returnAllTaken, startElimination } from "./elimination";
import { isRoundServer, startGatekeeper } from "./gatekeeper";
import { notify, remote, send } from "./gameRemote";
import { isPowered, startGenerator } from "./generator";
import { startHints } from "./hints";
import { litBy } from "./flashlight";
import { damageKid, healAll, healKid, startHealth } from "./health";
import { attackedEntry, hearNoise, retreatAll, spawnDormant, startInfected, startNight } from "./infected";
import { itemCount, onDropRequest, onUseRequest, startInventory } from "./inventory";
import { setPhaseLighting, setupLighting } from "./lighting";
import { setUpAll, setUpCharacter, startLoadouts } from "./loadout";
import { buildNeighbourhood } from "./neighbourhood";
import { beginNight, clearSummary, endNight, noteInfectedDowned, notePlankLost } from "./nightReport";
import { addLateJoiners, setMembers, waitForParty } from "./party";
import { resync } from "./resync";
import { getClock, runRun } from "./round";
import { onShootRequest, startSlingshot } from "./slingshot";
import { setStreetLights } from "./streetlights";
import { onLeaveRequest, onRunEnd, returnToLobby } from "./roundEnd";
import { canKidAct, isPlaying, livingKids } from "./teams";
import { buildMainWorld } from "./world";

/**
 * Main game entry point. The order matters:
 *  1. turn away anyone not in this run, build the house, take over spawning,
 *  2. wait for the party, start the run,
 *  3. run the day/night clock until every kid is taken, then send everyone back to the lobby.
 */

const isFirstNight = () => getClock().night === 1;
const notifyAll = (text: string) => Players.GetPlayers().forEach((p) => notify(p, text));

startGatekeeper();
setupLighting();
const world = buildMainWorld();
const street = buildNeighbourhood();
startElimination();
startLoadouts(world);
startInventory({
	canAct: canKidAct,
	notify,
	sendInventory: (player, inventory) => send(player, "Inventory", inventory),
	heal: healKid,
});
startCoins((player, coins) => send(player, "Coins", coins));
startContainers({
	canAct: canKidAct,
	notify,
	getNight: () => getClock().night,
	makeNoise: hearNoise,
});
startCombat({
	canAttack: canKidAct,
	makeNoise: hearNoise,
	sendHitResult: (attacker, kind) => send(attacker, "HitResult", kind),
});
startBarricades(world, {
	canAct: canKidAct,
	notify,
	isFirstNight,
});
startSlingshot({
	canAttack: canKidAct,
	sendHitResult: (attacker, kind) => send(attacker, "HitResult", kind),
});
startHealth({ sendHurt: (player) => send(player, "Hurt", undefined) });
startInfected(world, {
	getKids: () => livingKids().filter((p) => p.Character !== undefined),
	damageKid,
	notifyAll,
	isFirstNight,
	isLit: (model) => litBy(model).size() > 0,
	isNight: () => getClock().phase === "Night",
	isPowered,
	onPlankBroken: notePlankLost,
	onDowned: noteInfectedDowned,
});
startGenerator(world, {
	canAct: canKidAct,
	onChanged: (powered) => notifyAll(powered ? "The power's on." : "The power's off."),
});
startHints({
	getKids: () => (isPlaying() ? livingKids() : []),
	situation: (player) => ({
		firstNight: isFirstNight(),
		phase: getClock().phase,
		planks: itemCount(player, "Planks"),
		anyBoarded: anyBoarded(),
		powered: isPowered(),
		attacked: attackedEntry()?.name,
	}),
	sendHint: (player, text) => send(player, "Hint", text),
});

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

// Client -> server. Payloads are `unknown` here; each handler validates its own.
onClientMessage<GameClientMessages>(remote, {
	Ready: (player) => resync(player),
	Swing: onSwingRequest,
	Shoot: onShootRequest,
	UseItem: onUseRequest,
	DropItem: onDropRequest,
	LeaveRound: onLeaveRequest,
});

// A public server (someone joined the main place directly) never runs: the gatekeeper sends
// everyone to the lobby.
const party = isRoundServer() ? waitForParty(gameConfig.arrivalTimeout.Value) : [];
setMembers(party);
party.forEach(resync); // clients that said "Ready" before the party was known got nothing then
addLateJoiners((player) => {
	resync(player);
	if (player.Character) {
		setUpCharacter(player, player.Character);
	}
});

if (party.size() > 0) {
	print(`[Main] ${party.size()} kid(s) arrived; starting the run.`);
	setUpAll(party);
	runRun(
		{
			startSeconds: gameConfig.startSeconds.Value,
			endScreenSeconds: gameConfig.endScreenSeconds.Value,
			phaseLengths: () => ({
				Day: gameConfig.daySeconds.Value,
				Dusk: gameConfig.duskSeconds.Value,
				Night: gameConfig.nightSeconds.Value,
				Dawn: gameConfig.dawnSeconds.Value,
			}),
		},
		{
			onPhase: (clock) => {
				print(`[Main] ${clock.phase} ${clock.night}`);
				setPhaseLighting(clock.phase);
				if (clock.phase === "Night") {
					beginNight();
					startNight(clock.night, gameConfig.nightSeconds.Value, livingKids().size());
				} else if (clock.phase === "Dawn") {
					retreatAll();
					refillPile();
					healAll(livingKids());
					refillGardens();
					livingKids().forEach((kid) => addCoins(kid, gameConfig.coinsPerDawn.Value));
					setStreetLights(false);
					returnAllTaken();
					const summary = endNight(clock.night);
					Players.GetPlayers().forEach((p) => send(p, "NightSummary", summary));
				} else if (clock.phase === "Day") {
					clearSummary();
					spawnDormant(street.dormantSpots, clock.night, clock.night === 1 ? street.dadSpot : undefined);
					scheduleSundown(clock.night);
				}
			},
			onEnd: onRunEnd,
			returnToLobby,
		},
	);
} else {
	warn("[Main] No players arrived; nothing to start.");
}
