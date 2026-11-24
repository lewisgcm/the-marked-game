import { Players } from "@rbxts/services";
import { onClientMessage } from "shared/net";
import { GameClientMessages } from "shared/remotes";
import { refillPile, startBarricades } from "./barricades";
import { onSwingRequest, startCombat } from "./combat";
import { gameConfig } from "./config";
import { returnAllTaken, startElimination } from "./elimination";
import { isRoundServer, startGatekeeper } from "./gatekeeper";
import { notify, remote, send } from "./gameRemote";
import { litBy } from "./flashlight";
import { damageKid, healAll, startHealth } from "./health";
import { retreatAll, startInfected, startNight } from "./infected";
import { setPhaseLighting, setupLighting } from "./lighting";
import { setUpAll, setUpCharacter, startLoadouts } from "./loadout";
import { addLateJoiners, setMembers, waitForParty } from "./party";
import { resync } from "./resync";
import { getClock, runRun } from "./round";
import { onShootRequest, refillStones, startSlingshot } from "./slingshot";
import { onLeaveRequest, onRunEnd, returnToLobby } from "./roundEnd";
import { canKidAct, livingKids } from "./teams";
import { buildMainWorld } from "./world";

/**
 * Main game entry point. The order matters:
 *  1. turn away anyone not in this run, build the house, take over spawning,
 *  2. wait for the party, start the run,
 *  3. run the day/night clock until every kid is taken, then send everyone back to the lobby.
 */

const isFirstNight = () => getClock().night === 1;

startGatekeeper();
setupLighting();
const world = buildMainWorld();
startElimination();
startLoadouts(world);
startCombat({
	canAttack: canKidAct,
	sendHitResult: (attacker, kind) => send(attacker, "HitResult", kind),
	onInfectedDowned: () => {},
});
startBarricades(world, {
	canAct: canKidAct,
	notify,
	sendPlanks: (player, count) => send(player, "Planks", count),
	isFirstNight,
});
startSlingshot({
	canAttack: canKidAct,
	sendHitResult: (attacker, kind) => send(attacker, "HitResult", kind),
	sendStones: (player, count) => send(player, "Stones", count),
});
startHealth({ sendHurt: (player) => send(player, "Hurt", undefined) });
startInfected(world, {
	getKids: () => livingKids().filter((p) => p.Character !== undefined),
	damageKid,
	notifyAll: (text) => Players.GetPlayers().forEach((p) => notify(p, text)),
	isFirstNight,
	isLit: (model) => litBy(model).size() > 0,
});

// Client -> server. Payloads are `unknown` here; each handler validates its own.
onClientMessage<GameClientMessages>(remote, {
	Ready: (player) => resync(player),
	Swing: onSwingRequest,
	Shoot: onShootRequest,
	LeaveRound: onLeaveRequest,
});

// A public server (someone joined the main place directly) never runs: the gatekeeper sends
// everyone to the lobby.
const party = isRoundServer() ? waitForParty(gameConfig.arrivalTimeout.Value) : [];
setMembers(party);
addLateJoiners((player) => {
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
					startNight(clock.night, gameConfig.nightSeconds.Value, livingKids().size());
				} else if (clock.phase === "Dawn") {
					retreatAll();
					refillPile();
					healAll(livingKids());
					refillStones(livingKids());
					returnAllTaken();
				}
			},
			onEnd: onRunEnd,
			returnToLobby,
		},
	);
} else {
	warn("[Main] No players arrived; nothing to start.");
}
