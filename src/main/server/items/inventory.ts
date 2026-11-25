import { Players, Workspace } from "@rbxts/services";
import {
	addItem,
	countOf,
	emptyInventory,
	Inventory,
	isUsable,
	ItemId,
	parseSlot,
	removeItem,
	roomFor,
	Stack,
	takeStack,
	UsableItem,
} from "shared/items/inventory";
import { rootOf } from "shared/core/characters";
import { gameConfig } from "../core/config";
import { inReach, makePrompt, promptAnchor } from "../core/prompts";

/**
 * Every kid's slot inventory (rules in shared/items/inventory.ts), and items lying in the world.
 * Clients only ask to use or drop a slot; everything is checked here.
 */

export interface InventoryHooks {
	/** Whether `player` may use and pick up things right now. */
	canAct: (player: Player) => boolean;
	notify: (player: Player, text: string) => void;
	sendInventory: (player: Player, inventory: Inventory) => void;
	/** Uses an item (itemUses.ts): undefined if it worked, or why it didn't. */
	use: (player: Player, item: UsableItem) => string | undefined;
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
		addItem(inv, "Fuel", gameConfig.fuelCansStart.Value);
		addItem(inv, "Scrap", gameConfig.scrapStart.Value);
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
	const prompt = makePrompt(
		promptAnchor(box, new Vector3(0, 0.6, 0)),
		"Pick up",
		Enum.KeyCode.E,
		gameConfig.holdQuick.Value,
	);
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

/** Gives `player` what fits and leaves the rest at `position`; returns how many were left there. */
export function giveOrDrop(player: Player, item: ItemId, count: number, position: Vector3): number {
	const left = count - giveItem(player, item, count);
	if (left > 0) {
		dropStack({ item, count: left }, position);
	}
	return left;
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

/** "Use" on a slot: `payload` should be its index (unknown — validated). */
export function onUseRequest(player: Player, payload: unknown) {
	if (!hooks || !hooks.canAct(player)) {
		return;
	}
	const inv = inventoryOf(player);
	const slot = parseSlot(payload, inv);
	const item = slot !== undefined ? inv.stacks[slot].item : undefined;
	if (item === undefined || !isUsable(item)) {
		return;
	}
	const refusal = hooks.use(player, item);
	if (refusal !== undefined) {
		hooks.notify(player, refusal);
		return;
	}
	takeItem(player, item, 1);
}

export function startInventory(inventoryHooks: InventoryHooks) {
	hooks = inventoryHooks;
}
