import { onClientMessage } from "shared/net";
import { GameClientMessages } from "shared/remotes";
import { onSwingRequest } from "./combat";
import { gameConfig } from "./config";
import { isRoundServer, startGatekeeper } from "./gatekeeper";
import { startElimination } from "./elimination";
import { remote, send } from "./gameRemote";
import { announceRoles, startLoadouts } from "./loadout";
import { playBanishing } from "./banishing";
import { resync } from "./resync";
import { assignLateJoiners, assignRoles, waitForParty } from "./roles";
import { runRound } from "./round";
import { onLeaveRequest, onRoundEnd, returnToLobby } from "./roundEnd";
import { onSpookRequest } from "./spooks";
import { startAmbientSystems, startRoundSystems } from "./systems";
import { buildMainWorld } from "./world";

/**
 * Main game entry point. The order matters:
 *  1. turn away anyone not in this round, build the house, take over spawning,
 *  2. start the systems that idle until the hunt,
 *  3. wait for the party, pick roles, start combat and the objective,
 *  4. run the round, then send everyone back to the lobby.
 */

startGatekeeper();
const world = buildMainWorld();
startElimination();
startLoadouts(world);

// Client -> server. Payloads are `unknown` here; each handler validates its own.
onClientMessage<GameClientMessages>(remote, {
	Spook: onSpookRequest,
	Ready: (player) => resync(player),
	Swing: onSwingRequest,
	LeaveRound: onLeaveRequest,
});

const stopReveals = startAmbientSystems(world);

// A public server (someone joined the main place directly) never runs a round: the gatekeeper
// sends everyone to the lobby.
const party = isRoundServer() ? waitForParty(gameConfig.arrivalTimeout.Value) : [];
const ghost = assignRoles(party);
assignLateJoiners((player) => send(player, "Role", "Hunter"));

if (ghost) {
	print(`[Main] ${party.size()} player(s) arrived; ghost chosen.`);
	announceRoles(party);
	startRoundSystems(world);
	runRound(
		{
			countdownSeconds: gameConfig.countdownSeconds.Value,
			roundSeconds: gameConfig.roundSeconds.Value,
			endScreenSeconds: gameConfig.endScreenSeconds.Value,
		},
		{
			onEnd: (winner, reason) => onRoundEnd(winner, reason, stopReveals),
			playBanishing: () => {
				stopReveals(); // the cutscene shows the ghost; don't let the flashlight loop hide it
				playBanishing();
			},
			returnToLobby,
		},
	);
} else {
	warn("[Main] No players arrived; nothing to start.");
}
