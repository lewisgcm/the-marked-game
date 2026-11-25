import { CollectionService, Players } from "@rbxts/services";
import { WORKBENCH_TAG } from "shared/core/tags";
import { findUpgrade, parseUpgrade, UpgradeId, upgradeStatus } from "shared/economy/upgrades";
import { coinsOf, spendCoins } from "./coins";
import { gameConfig } from "../core/config";
import { inReach, makePrompt, promptAnchor } from "../core/prompts";

/**
 * The workbench in the garage: spends coins on upgrades (list and rules in shared/economy/upgrades.ts).
 * Most are the whole party's, whoever paid; rucksacks are the buyer's own. The prompt opens the
 * list on the kid's screen; the purchase itself is checked here. The list also has things to make
 * from scrap (crafting.ts).
 */

export interface WorkbenchHooks {
	/** Whether `player` may use prompts right now. */
	canAct: (player: Player) => boolean;
	notify: (player: Player, text: string) => void;
	/** News for everyone but `except`. */
	notifyAll: (text: string, except: Player) => void;
	/** Opens the list on `player`'s screen. */
	open: (player: Player) => void;
	/** Tells a kid which upgrades they have (the party's and their own). */
	sendUpgrades: (player: Player, owned: UpgradeId[]) => void;
	/** An upgrade was bought: make it happen (upgradeEffects.ts). */
	onBought: (id: UpgradeId, buyer: Player) => void;
}

let hooks: WorkbenchHooks | undefined;
let prompt: ProximityPrompt | undefined;
const party = new Set<UpgradeId>();
const personal = new Map<Player, Set<UpgradeId>>();
Players.PlayerRemoving.Connect((player) => personal.delete(player));

/** Whether the party has an upgrade. */
export function hasUpgrade(id: UpgradeId): boolean {
	return party.has(id);
}

/** The upgrades a kid has: the party's and their own. */
export function upgradesOf(player: Player): UpgradeId[] {
	return [...party, ...(personal.get(player) ?? new Set<UpgradeId>())];
}

/** Re-sends `player` their upgrades (for resync). */
export function resendUpgrades(player: Player) {
	hooks?.sendUpgrades(player, upgradesOf(player));
}

function grantPersonal(player: Player, id: UpgradeId) {
	const own = personal.get(player) ?? new Set<UpgradeId>();
	own.add(id);
	personal.set(player, own);
	resendUpgrades(player);
}

/** Whether `player` is at the workbench and may use it. */
export function canUseWorkbench(player: Player): boolean {
	return hooks !== undefined && prompt !== undefined && hooks.canAct(player) && inReach(player, prompt);
}

/** "Buy" in the list: `payload` should be an upgrade's ID (unknown — validated). */
export function onBuyRequest(player: Player, payload: unknown) {
	const id = parseUpgrade(payload);
	if (!hooks || id === undefined || !canUseWorkbench(player)) {
		return;
	}
	const upgrade = findUpgrade(id);
	if (upgradeStatus(id, coinsOf(player), upgradesOf(player)) !== "ok" || !spendCoins(player, upgrade.cost)) {
		return;
	}
	if (upgrade.personal) {
		grantPersonal(player, id);
	} else {
		party.add(id);
		Players.GetPlayers().forEach(resendUpgrades);
		hooks.notifyAll(`${player.DisplayName} bought ${upgrade.name.lower()}.`, player);
	}
	hooks.notify(player, `You got the ${upgrade.name.lower()}.`);
	hooks.onBought(id, player);
}

/** Sets up the prompt. Call once, after the world is built. */
export function startWorkbench(workbenchHooks: WorkbenchHooks) {
	hooks = workbenchHooks;
	const bench = CollectionService.GetTagged(WORKBENCH_TAG)[0];
	if (!bench || !bench.IsA("BasePart")) {
		warn("[Workbench] No workbench in the world.");
		return;
	}
	const use = makePrompt(
		promptAnchor(bench, new Vector3(0, 2, 0)),
		"Upgrade",
		Enum.KeyCode.E,
		gameConfig.holdQuick.Value,
	);
	use.ObjectText = "Workbench";
	use.Triggered.Connect((player) => {
		if (canUseWorkbench(player)) {
			workbenchHooks.open(player);
		}
	});
	prompt = use;
}
