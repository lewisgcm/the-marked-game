import { Players } from "@rbxts/services";
import { onClientMessage } from "shared/core/net";
import { GameClientMessages } from "shared/core/remotes";
import { anyBoarded, damageEntry, isEntryBlocked, isEntryWorthAttacking, startBarricades } from "./house/barricades";
import { startCoins } from "./economy/coins";
import { onSwingRequest, startCombat } from "./combat/combat";
import { startContainers } from "./items/containers";
import { onCraftRequest, startCrafting } from "./economy/crafting";
import { litBy } from "./combat/flashlight";
import { alertAll, notify, notifyAll, remote, send } from "./core/gameRemote";
import { holdsHammer } from "./house/hammer";
import { isPowered, keepsThemWary, startGenerator } from "./house/generator";
import { damageKid, startHealth } from "./combat/health";
import { startHints } from "./run/hints";
import { attackedEntry } from "./infected/behaviours";
import { hearNoise, startInfected } from "./infected/director";
import { itemCount, onDropRequest, onUseRequest, startInventory } from "./items/inventory";
import { ITEM_USES } from "./items/itemUses";
import { noteInfectedDowned, notePlankLost } from "./run/nightReport";
import { resync } from "./run/resync";
import { getClock } from "./core/round";
import { onLeaveRequest } from "./run/roundEnd";
import { onShootRequest, startSlingshot } from "./combat/slingshot";
import { canKidAct, isPlaying, livingKids } from "./core/teams";
import { baseReports, onTradeBuyRequest, onTradeSellRequest, startTrading } from "./economy/trading";
import { UPGRADE_EFFECTS } from "./economy/upgradeEffects";
import { refreshWalkie, startWalkie } from "./economy/walkie";
import { canUseWorkbench, hasUpgrade, onBuyRequest, startWorkbench, upgradesOf } from "./economy/workbench";
import { MainWorld } from "./world/world";

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
		use: (player, item) => ITEM_USES[item](player),
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
	startCrafting({ canUseWorkbench, upgradesOf, notify });
	startTrading({
		canAct: canKidAct,
		notify,
		open: (player, view) => send(player, "OpenTrade", view),
		update: (view) => Players.GetPlayers().forEach((p) => send(p, "UpdateTrade", view)),
		onOrderChanged: refreshWalkie,
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
		isEntryWorthAttacking,
		damageEntry,
		getKids: () => livingKids().filter((p) => p.Character !== undefined),
		damageKid,
		alertAll,
		isFirstNight,
		isLit: (model) => litBy(model).size() > 0,
		isNight: () => getClock().phase === "Night",
		isPowered: keepsThemWary,
		onPlankBroken: notePlankLost,
		onDowned: noteInfectedDowned,
	});
	startGenerator(world, {
		canAct: canKidAct,
		notify,
		notifyAll,
		alertAll,
		burnsFuel: () => isPlaying() && getClock().phase === "Night",
		hasUpgrade,
	});
	startHints({
		getKids: () => (isPlaying() ? livingKids() : []),
		situation: (player) => ({
			firstNight: isFirstNight(),
			phase: getClock().phase,
			planks: itemCount(player, "Planks"),
			hammer: holdsHammer(player),
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
		Craft: onCraftRequest,
		TradeBuy: onTradeBuyRequest,
		TradeSell: onTradeSellRequest,
		LeaveRound: onLeaveRequest,
	});
}
