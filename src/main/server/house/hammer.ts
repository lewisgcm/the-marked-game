import { Players } from "@rbxts/services";
import { HAMMER_TOOL_NAME } from "shared/house/barricade";

/**
 * The hammer: holding it is "build mode". Only then do the doors and windows show their prompts
 * (client/house/buildMode.ts), and only then does the server accept them (barricades.ts).
 */

const tools = new Map<Player, Tool>();
Players.PlayerRemoving.Connect((player) => tools.delete(player));

function piece(name: string, size: Vector3, material: Enum.Material, color: Color3, parent: Instance): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Size = size;
	part.Material = material;
	part.Color = color;
	part.CanCollide = false;
	part.Massless = true;
	part.Parent = parent;
	return part;
}

/** A kid's hammer (a blockout until it gets a model). */
export function giveHammer(player: Player) {
	tools.get(player)?.Destroy();
	const backpack = player.FindFirstChildOfClass("Backpack");
	if (!backpack) {
		return;
	}
	const tool = new Instance("Tool");
	tool.Name = HAMMER_TOOL_NAME;
	tool.ToolTip = "Hold it to board up doors and windows";
	tool.CanBeDropped = false;
	tool.Grip = new CFrame(0, -0.4, 0);
	const handle = piece("Handle", new Vector3(0.25, 1.5, 0.25), Enum.Material.Wood, new Color3(0.5, 0.36, 0.22), tool);
	const head = piece("Head", new Vector3(0.4, 0.4, 1), Enum.Material.Metal, new Color3(0.35, 0.36, 0.38), tool);
	head.CFrame = handle.CFrame.mul(new CFrame(0, 0.75, 0));
	const weld = new Instance("WeldConstraint");
	weld.Part0 = handle;
	weld.Part1 = head;
	weld.Parent = head;
	tool.Parent = backpack;
	tools.set(player, tool);
}

export function removeHammer(player: Player) {
	tools.get(player)?.Destroy();
	tools.delete(player);
}

/** Whether `player` is holding their hammer. */
export function holdsHammer(player: Player): boolean {
	const tool = tools.get(player);
	return tool !== undefined && player.Character !== undefined && tool.Parent === player.Character;
}
