import { Players, Workspace } from "@rbxts/services";
import {
	addItem,
	countOf,
	emptyInventory,
	Inventory,
	ItemId,
	parseSlot,
	removeItem,
	roomFor,
	Stack,
	takeStack,
} from "shared/inventory";
import { rootOf } from "shared/characters";
import { gameConfig } from "./config";
import { inReach, makePrompt, promptAnchor } from "./prompts";

/**
 * Every kid's slot inventory (rules in shared/inventory.ts), and items lying in the world.
 * Clients only ask to use or drop a slot; everything is checked here.
 */

export interface InventoryHooks {
	/** Whether `player` may use and pick up things right now. */
	canAct: (player: Player) => boolean;
	notify: (player: Player, text: string) => void;
	sendInventory: (player: Player, inventory: Inventory) => void;
	/** Heals a kid; false if they didn't need it. */
	heal: (player: Player, amount: number) => boolean;
}

let hooks: InventoryHooks | undefined;
const inventories = new Map<Player, Inventory>();
Players.PlayerRemoving.Connect((player) => inventories.delete(player));

const pickups = new Instance("Folder");
pickups.Name = "Pickups";
pickups.Parent = Workspace;

/** A kid's inventory; the first time, with the starting kit. */
function inventoryOf(player: Player): Inventory {
	let inv = inventories.get(player);
	if (!inv) {
		inv = emptyInventory(gameConfig.inventorySlots.Value);
		addItem(inv, "Stones", gameConfig.stonesStart.Value);
		addItem(inv, "Nails", gameConfig.nailsStart.Value);
		inventories.set(player, inv);
	}
	return inv;
}

/** Sends `player` their inventory (after a change, and for resync). */
export function resendInventory(player: Player) {
	hooks?.sendInventory(player, inventoryOf(player));
}

/** Gives `player` a bigger bag (never a smaller one). */
export function setSlots(player: Player, slots: number) {
	const inv = inventoryOf(player);
	inv.slots = math.max(inv.slots, slots);
	resendInventory(player);
}

export function itemCount(player: Player, item: ItemId): number {
	return countOf(inventoryOf(player), item);
}

export function itemRoom(player: Player, item: ItemId): number {
	return roomFor(inventoryOf(player), item);
}

/** Gives `player` up to `count`; returns how many fitted. */
export function giveItem(player: Player, item: ItemId, count: number): number {
	const added = addItem(inventoryOf(player), item, count);
	if (added > 0) {
		resendInventory(player);
	}
	return added;
}

/** Takes exactly `count` from `player`, or nothing. */
export function takeItem(player: Player, item: ItemId, count: number): boolean {
	const taken = removeItem(inventoryOf(player), item, count);
	if (taken) {
		resendInventory(player);
	}
	return taken;
}

/** The floor below `position`. */
function floorBelow(position: Vector3): Vector3 {
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	const ignore: Instance[] = [pickups];
	for (const player of Players.GetPlayers()) {
		if (player.Character) {
			ignore.push(player.Character);
		}
	}
	params.FilterDescendantsInstances = ignore;
	return Workspace.Raycast(position, new Vector3(0, -30, 0), params)?.Position ?? position;
}

/** Leaves a stack lying at `position`, for anyone to pick up. */
export function dropStack(stack: Stack, position: Vector3) {
	const box = new Instance("Part");
	box.Name = "Pickup";
	box.Size = new Vector3(1.4, 0.8, 1.4);
	box.Material = Enum.Material.Cardboard;
	box.Color = new Color3(0.62, 0.48, 0.32);
	box.Anchored = true;
	box.CanCollide = false;
	box.CanQuery = false;
	box.Position = floorBelow(position).add(new Vector3(0, 0.4, 0));
	box.Parent = pickups;
	const prompt = makePrompt(promptAnchor(box, new Vector3(0, 0.6, 0)), "Pick up", Enum.KeyCode.E, 0.2);
	const label = () => (prompt.ObjectText = `${stack.item} x${stack.count}`);
	label();
	prompt.Triggered.Connect((player) => {
		if (!hooks || !hooks.canAct(player) || !inReach(player, prompt) || stack.count <= 0) {
			return;
		}
		const added = giveItem(player, stack.item, stack.count);
		if (added === 0) {
			hooks.notify(player, "Your pockets are full.");
			return;
		}
		stack.count -= added;
		label();
		if (stack.count <= 0) {
			box.Destroy();
		}
	});
}

/** Gives `player` what fits and leaves the rest at `position`. */
export function giveOrDrop(player: Player, item: ItemId, count: number, position: Vector3) {
	const left = count - giveItem(player, item, count);
	if (left > 0) {
		dropStack({ item, count: left }, position);
	}
}

/** A taken kid leaves everything they carried where they were. */
export function dropAll(player: Player, position: Vector3 | undefined) {
	const inv = inventoryOf(player);
	if (position) {
		inv.stacks.forEach((stack, i) =>
			dropStack(stack, position.add(new Vector3((i % 3) * 2 - 2, 0, math.floor(i / 3) * 2))),
		);
	}
	inv.stacks.clear();
	resendInventory(player);
}

/** "Drop" on a slot: `payload` should be its index (unknown — validated). */
export function onDropRequest(player: Player, payload: unknown) {
	const root = rootOf(player.Character);
	if (!hooks || !hooks.canAct(player) || !root) {
		return;
	}
	const inv = inventoryOf(player);
	const slot = parseSlot(payload, inv);
	const stack = slot !== undefined ? takeStack(inv, slot) : undefined;
	if (stack) {
		dropStack(stack, root.Position);
		resendInventory(player);
	}
}

/** "Use" on a slot. Only medkits do anything yet; food and the rest are for trading (M3). */
export function onUseRequest(player: Player, payload: unknown) {
	if (!hooks || !hooks.canAct(player)) {
		return;
	}
	const inv = inventoryOf(player);
	const slot = parseSlot(payload, inv);
	if (slot === undefined || inv.stacks[slot].item !== "Medkit") {
		return;
	}
	if (!hooks.heal(player, gameConfig.medkitHeal.Value)) {
		hooks.notify(player, "You're not hurt.");
		return;
	}
	takeItem(player, "Medkit", 1);
}

export function startInventory(inventoryHooks: InventoryHooks) {
	hooks = inventoryHooks;
}
