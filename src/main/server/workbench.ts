import { CollectionService, Players } from "@rbxts/services";
import { WORKBENCH_TAG } from "shared/tags";
import { findUpgrade, parseUpgrade, UpgradeId, upgradeStatus } from "shared/upgrades";
import { coinsOf, spendCoins } from "./coins";
import { gameConfig } from "./config";
import { setSlots } from "./inventory";
import { inReach, makePrompt, promptAnchor } from "./prompts";

/**
 * The workbench in the garage: spends coins on upgrades (list and rules in shared/upgrades.ts).
 * Most are the whole party's, whoever paid; rucksacks are the buyer's own. The prompt opens the
 * list on the kid's screen; the purchase itself is checked here.
 */

export interface WorkbenchHooks {
	/** Whether `player` may use prompts right now. */
	canAct: (player: Player) => boolean;
	notify: (player: Player, text: string) => void;
	notifyAll: (text: string) => void;
	/** Opens the list on `player`'s screen. */
	open: (player: Player) => void;
	/** Tells a kid which upgrades they have (the party's and their own). */
	sendUpgrades: (player: Player, owned: UpgradeId[]) => void;
	/** The party got an upgrade. */
	onPartyUpgrade: (id: UpgradeId) => void;
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

function ownedBy(player: Player): UpgradeId[] {
	return [...party, ...(personal.get(player) ?? new Set<UpgradeId>())];
}

/** Re-sends `player` their upgrades (for resync). */
export function resendUpgrades(player: Player) {
	hooks?.sendUpgrades(player, ownedBy(player));
}

function grantPersonal(player: Player, id: UpgradeId) {
	const own = personal.get(player) ?? new Set<UpgradeId>();
	own.add(id);
	personal.set(player, own);
	setSlots(player, id === "HikingRucksack" ? gameConfig.hikingSlots.Value : gameConfig.schoolSlots.Value);
	resendUpgrades(player);
}

/** "Buy" in the list: `payload` should be an upgrade's ID (unknown — validated). */
export function onBuyRequest(player: Player, payload: unknown) {
	const id = parseUpgrade(payload);
	if (!hooks || !prompt || id === undefined || !hooks.canAct(player) || !inReach(player, prompt)) {
		return;
	}
	const upgrade = findUpgrade(id);
	if (upgradeStatus(id, coinsOf(player), ownedBy(player)) !== "ok" || !spendCoins(player, upgrade.cost)) {
		return;
	}
	if (upgrade.personal) {
		grantPersonal(player, id);
		hooks.notify(player, `You got the ${upgrade.name.lower()}.`);
		return;
	}
	party.add(id);
	Players.GetPlayers().forEach(resendUpgrades);
	hooks.notifyAll(`${player.DisplayName} bought ${upgrade.name.lower()}.`);
	hooks.onPartyUpgrade(id);
}

/** Sets up the prompt. Call once, after the world is built. */
export function startWorkbench(workbenchHooks: WorkbenchHooks) {
	hooks = workbenchHooks;
	const bench = CollectionService.GetTagged(WORKBENCH_TAG)[0];
	if (!bench || !bench.IsA("BasePart")) {
		warn("[Workbench] No workbench in the world.");
		return;
	}
	const use = makePrompt(promptAnchor(bench, new Vector3(0, 2, 0)), "Upgrade", Enum.KeyCode.E, 0.2);
	use.ObjectText = "Workbench";
	use.Triggered.Connect((player) => {
		if (workbenchHooks.canAct(player) && inReach(player, use)) {
			workbenchHooks.open(player);
		}
	});
	prompt = use;
}
