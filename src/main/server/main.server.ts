import { RunService } from "@rbxts/services";
import { onClientMessage } from "shared/net";
import { GameClientMessages } from "shared/remotes";
import { onSwingRequest, startCombat } from "./combat";
import { gameConfig } from "./config";
import { startElimination } from "./elimination";
import { isRoundServer, startGatekeeper } from "./gatekeeper";
import { remote, send } from "./gameRemote";
import { setUpAll, setUpCharacter, startLoadouts } from "./loadout";
import { addLateJoiners, setMembers, waitForParty } from "./party";
import { spawnPracticeDummy } from "./practiceDummy";
import { resync } from "./resync";
import { runRun } from "./round";
import { onLeaveRequest, onRunEnd, returnToLobby } from "./roundEnd";
import { canKidAct } from "./teams";
import { buildMainWorld } from "./world";

/**
 * Main game entry point. The order matters:
 *  1. turn away anyone not in this run, build the house, take over spawning,
 *  2. wait for the party, start the run,
 *  3. run it, then send everyone back to the lobby.
 */

startGatekeeper();
const world = buildMainWorld();
startElimination();
startLoadouts(world);
startCombat({
	canAttack: canKidAct,
	sendHitResult: (attacker, kind) => send(attacker, "HitResult", kind),
	onInfectedDowned: () => {},
});
if (RunService.IsStudio()) {
	// Ten studs into the room from the kids' start, facing them (models face -Z).
	spawnPracticeDummy(world.house, world.kidSpawn.mul(new CFrame(0, -3, 10)));
}

// Client -> server. Payloads are `unknown` here; each handler validates its own.
onClientMessage<GameClientMessages>(remote, {
	Ready: (player) => resync(player),
	Swing: onSwingRequest,
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
			countdownSeconds: gameConfig.countdownSeconds.Value,
			runSeconds: gameConfig.runSeconds.Value,
			endScreenSeconds: gameConfig.endScreenSeconds.Value,
		},
		{ onEnd: onRunEnd, returnToLobby },
	);
} else {
	warn("[Main] No players arrived; nothing to start.");
}
