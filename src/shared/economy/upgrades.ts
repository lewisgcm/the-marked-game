/**
 * What the workbench sells (GAMEPLAY.md "Workbench upgrades"). Pure, and used by both sides: the
 * client to draw the list, the server (main/server/economy/workbench.ts) to decide. What each upgrade
 * does is a number in the server config.
 */

export type UpgradeId =
	"ReinforcedPlanks" | "DoorBar" | "SchoolRucksack" | "HikingRucksack" | "TuneUp" | "ScrapPress" | "WallMap";

export interface Upgrade {
	id: UpgradeId;
	name: string;
	description: string;
	cost: number;
	/** Personal upgrades are the buyer's own; the rest are for the whole party. */
	personal: boolean;
	/** Must be owned first. */
	needs?: UpgradeId;
}

export const UPGRADES: Upgrade[] = [
	{
		id: "ReinforcedPlanks",
		name: "Reinforced planks",
		description: "Planks you nail from now on get metal strips: 50% tougher",
		cost: 20,
		personal: false,
	},
	{
		id: "DoorBar",
		name: "Door bar",
		description: "Front and back doors take a fourth, sturdier board",
		cost: 30,
		personal: false,
	},
	{
		id: "SchoolRucksack",
		name: "School rucksack",
		description: "More slots, just for you",
		cost: 25,
		personal: true,
	},
	{
		id: "HikingRucksack",
		name: "Hiking rucksack",
		description: "Even more slots, just for you",
		cost: 60,
		personal: true,
		needs: "SchoolRucksack",
	},
	{
		id: "TuneUp",
		name: "Generator tune-up",
		description: "The generator uses half the fuel",
		cost: 35,
		personal: false,
	},
	{
		id: "ScrapPress",
		name: "Scrap press",
		description: "Make a few nails or stones from scrap",
		cost: 30,
		personal: false,
	},
	{
		id: "WallMap",
		name: "Neighbourhood map",
		description: "A map in the hall: the bases, how they're holding up, and where everyone is",
		cost: 25,
		personal: false,
	},
];

export function findUpgrade(id: UpgradeId): Upgrade {
	return UPGRADES.find((u) => u.id === id)!;
}

/** Whether an upgrade can be bought, or why not. */
export type UpgradeStatus = "ok" | "owned" | "needsOther" | "tooExpensive";

/** `owned` is everything the buyer has: the party's upgrades and their own. */
export function upgradeStatus(id: UpgradeId, coins: number, owned: UpgradeId[]): UpgradeStatus {
	const upgrade = findUpgrade(id);
	if (owned.includes(id)) {
		return "owned";
	}
	if (upgrade.needs !== undefined && !owned.includes(upgrade.needs)) {
		return "needsOther";
	}
	return coins >= upgrade.cost ? "ok" : "tooExpensive";
}

/** A client's choice: the ID of a real upgrade, or undefined. */
export function parseUpgrade(payload: unknown): UpgradeId | undefined {
	return UPGRADES.find((u) => u.id === payload)?.id;
}
