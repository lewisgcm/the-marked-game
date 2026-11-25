import { buildBases } from "./world/bases";
import { gameConfig } from "./core/config";
import { startElimination } from "./run/elimination";
import { isRoundServer, startGatekeeper } from "./run/gatekeeper";
import { setupLighting } from "./house/lighting";
import { setUpAll, setUpCharacter, startLoadouts } from "./run/loadout";
import { buildNeighbourhood } from "./world/neighbourhood";
import { addLateJoiners, setMembers, waitForParty } from "./core/party";
import { onPhase } from "./phaseEvents";
import { resync } from "./run/resync";
import { runRun } from "./core/round";
import { onRunEnd, returnToLobby } from "./run/roundEnd";
import { listenToClients, startSystems } from "./systems";
import { buildMainWorld } from "./world/world";

/**
 * Main game entry point. The order matters:
 *  1. turn away anyone not in this run, build the house, take over spawning,
 *  2. wait for the party, start the run,
 *  3. run the day/night clock until every kid is taken, then send everyone back to the lobby.
 */

startGatekeeper();
setupLighting();
const world = buildMainWorld();
const street = buildNeighbourhood();
buildBases();
startElimination();
startLoadouts(world);
startSystems(world);
listenToClients();

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
			onPhase: (clock) => onPhase(clock, street),
			onEnd: onRunEnd,
			returnToLobby,
		},
	);
} else {
	warn("[Main] No players arrived; nothing to start.");
}
