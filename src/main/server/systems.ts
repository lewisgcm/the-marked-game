import { Players } from "@rbxts/services";
import { onClientMessage } from "shared/net";
import { GameClientMessages } from "shared/remotes";
import { anyBoarded, damageEntry, isEntryBlocked, startBarricades } from "./barricades";
import { startCoins } from "./coins";
import { onSwingRequest, startCombat } from "./combat";
import { startContainers } from "./containers";
import { litBy } from "./flashlight";
import { notify, notifyAll, remote, send } from "./gameRemote";
import { isPowered, startGenerator } from "./generator";
import { damageKid, healKid, startHealth } from "./health";
import { startHints } from "./hints";
import { attackedEntry } from "./infected/behaviours";
import { hearNoise, startInfected } from "./infected/director";
import { itemCount, onDropRequest, onUseRequest, startInventory } from "./inventory";
import { noteInfectedDowned, notePlankLost } from "./nightReport";
import { resync } from "./resync";
import { getClock } from "./round";
import { onLeaveRequest } from "./roundEnd";
import { onShootRequest, startSlingshot } from "./slingshot";
import { canKidAct, isPlaying, livingKids } from "./teams";
import { baseReports, onTradeBuyRequest, onTradeSellRequest, startTrading } from "./trading";
import { UPGRADE_EFFECTS } from "./upgradeEffects";
import { startWalkie } from "./walkie";
import { hasUpgrade, onBuyRequest, startWorkbench } from "./workbench";
import { MainWorld } from "./world";

/**
 * Starts the gameplay systems and connects each to the rest of the game: the hooks given here are
 * how they reach each other (see AGENTS.md → Code structure).
 */

const isFirstNight = () => getClock().night === 1;

export function startSystems(world: MainWorld) {
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
		hasUpgrade,
	});
	startWorkbench({
		canAct: canKidAct,
		notify,
		notifyAll,
		open: (player) => send(player, "OpenWorkbench", undefined),
		sendUpgrades: (player, owned) => send(player, "Upgrades", owned),
		onBought: (id, buyer) => UPGRADE_EFFECTS[id](buyer),
	});
	startTrading({
		canAct: canKidAct,
		notify,
		open: (player, view) => send(player, "OpenTrade", view),
		update: (view) => Players.GetPlayers().forEach((p) => send(p, "UpdateTrade", view)),
	});
	startWalkie({
		getReports: baseReports,
		send: (player, state) => send(player, "Walkie", state),
		sendAll: (state) => Players.GetPlayers().forEach((p) => send(p, "Walkie", state)),
	});
	startSlingshot({
		canAttack: canKidAct,
		sendHitResult: (attacker, kind) => send(attacker, "HitResult", kind),
	});
	startHealth({ sendHurt: (player) => send(player, "Hurt", undefined) });
	startInfected(world, {
		isEntryBlocked,
		damageEntry,
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
		notify,
		notifyAll,
		burnsFuel: () => isPlaying() && getClock().phase === "Night",
		hasUpgrade,
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
}

/** Client -> server. Payloads are `unknown` here; each handler validates its own. */
export function listenToClients() {
	onClientMessage<GameClientMessages>(remote, {
		Ready: (player) => resync(player),
		Swing: onSwingRequest,
		Shoot: onShootRequest,
		UseItem: onUseRequest,
		DropItem: onDropRequest,
		BuyUpgrade: onBuyRequest,
		TradeBuy: onTradeBuyRequest,
		TradeSell: onTradeSellRequest,
		LeaveRound: onLeaveRequest,
	});
}
