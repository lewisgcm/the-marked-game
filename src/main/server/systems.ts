import { setBanishSite } from "./banishing";
import { openAttackWindow, startCombat } from "./combat";
import { startRevealLoop } from "./flashlight";
import { notify, notifyAllBut, send } from "./gameRemote";
import { killHunter } from "./life";
import { setupObjectives } from "./objectives";
import { setPanicEffects } from "./panic";
import { getGhost } from "./roles";
import { endRound } from "./round";
import { addSanity, getSanity, startSanity } from "./sanity";
import { recordStat } from "./roundStats";
import { rewardScare, startSpooks } from "./spooks";
import { gameConfig } from "./config";
import { canHunterAct, isHunting, livingHunters } from "./teams";
import { startTraps } from "./traps";
import { MainWorld } from "./world";

/**
 * Starts the gameplay systems and connects each to the rest of the game. The systems
 * themselves don't import each other; the callbacks wired here are the only links.
 */

function onPanic(player: Player, panicking: boolean) {
	setPanicEffects(player, panicking);
	if (!panicking) {
		notify(player, "You've calmed down.");
		return;
	}
	notify(player, "You're panicking! Find light or a teammate!");
	recordStat(player, "panics");
	rewardScare(gameConfig.scareRewardPanic.Value);
	notifyAllBut(livingHunters(), player, `${player.DisplayName} is panicking!`);
}

/** Systems that run from server start (they idle until the hunt). Returns the reveal loop's stop. */
export function startAmbientSystems(world: MainWorld): () => void {
	const stopReveals = startRevealLoop(getGhost, (ghost, revealed) => send(ghost, "GhostRevealed", revealed));

	startTraps({ canPlace: canHunterAct, getGhost, notify, getHunters: livingHunters });

	startSanity(world.lamps, { getHunters: livingHunters, getGhost, isActive: isHunting, onPanic });

	startSpooks(world.lamps, {
		getGhost,
		getHunters: livingHunters,
		isActive: isHunting,
		addSanity,
		notify,
		onScream: (_, seconds) => openAttackWindow(seconds),
		sendState: (ghost, state) => send(ghost, "Spooks", state),
	});

	return stopReveals;
}

/** Systems that need roles picked first: combat (ghost health) and the objective's props. */
export function startRoundSystems(world: MainWorld) {
	startCombat({
		getGhost,
		getLivingHunters: livingHunters,
		isActive: isHunting,
		getSanity,
		addSanity,
		killHunter,
		notify,
		sendAttackWindow: (player, state) => send(player, "AttackWindow", state),
		sendHitResult: (attacker, kind) => send(attacker, "HitResult", kind),
		sendHurt: (victim) => send(victim, "Hurt", undefined),
		onGhostDestroyed: () => endRound("Hunters", "Destroyed"),
		onKnifeHit: (kind) =>
			rewardScare(kind === "Kill" ? gameConfig.scareRewardKill.Value : gameConfig.scareRewardKnifeHit.Value),
	});

	setupObjectives(world, {
		canInteract: canHunterAct,
		send,
		onBanished: (site) => {
			setBanishSite(site);
			endRound("Hunters", "Banished");
		},
	});
}
