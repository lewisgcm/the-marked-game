import { Players } from "@rbxts/services";

/** Each kid's coins. Server-owned; they don't use inventory slots and survive being taken. */

let send: ((player: Player, coins: number) => void) | undefined;
const purse = new Map<Player, number>();
Players.PlayerRemoving.Connect((player) => purse.delete(player));

export function coinsOf(player: Player): number {
	return purse.get(player) ?? 0;
}

export function addCoins(player: Player, amount: number) {
	purse.set(player, coinsOf(player) + amount);
	send?.(player, coinsOf(player));
}

/** Re-sends `player` their coins (for resync). */
export function resendCoins(player: Player) {
	send?.(player, coinsOf(player));
}

export function startCoins(sendCoins: (player: Player, coins: number) => void) {
	send = sendCoins;
}
