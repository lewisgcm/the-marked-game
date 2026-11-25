import { addGains, Gain, gainedItems, GainLine, liveGains } from "shared/items/gains";
import { Stack } from "shared/items/inventory";
import { coinsStore, inventoryStore, Store } from "../core/gameState";

/** Notices what you gain ("+3 Nails", rules in shared/items/gains.ts) whenever your inventory or coins change. */

/** Seconds a line shows for. */
const SHOW_SECONDS = 2.5;

export const gainStore = new Store<GainLine[]>([]);

// What you had last; undefined until the server first says, so your starting kit isn't a gain.
let stacks: Stack[] | undefined;
let coins: number | undefined;

function show(gains: Gain[]) {
	if (gains.size() > 0) {
		gainStore.set(addGains(gainStore.get(), gains, os.clock(), SHOW_SECONDS));
		task.delay(SHOW_SECONDS + 0.05, () => gainStore.set(liveGains(gainStore.get(), os.clock())));
	}
}

/** Call once, before the server's first messages can arrive. */
export function startGainFeed() {
	inventoryStore.subscribe(() => {
		const before = stacks;
		stacks = inventoryStore.get().stacks;
		if (before) {
			show(gainedItems(before, stacks));
		}
	});
	coinsStore.subscribe(() => {
		const before = coins;
		coins = coinsStore.get();
		if (before !== undefined && coins > before) {
			show([{ item: "Coins", count: coins - before }]);
		}
	});
}
