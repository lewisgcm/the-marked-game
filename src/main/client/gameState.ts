import React from "@rbxts/react";
import { onServerMessage, serverSender } from "shared/net";
import { GameClientMessages, GameServerMessages } from "shared/remotes";
import { emptyInventory, Inventory } from "shared/inventory";
import { NightSummary } from "shared/nightSummary";
import { ScoreCard } from "shared/scoreboard";

/**
 * The local player's game state, as told by the server, kept in small stores.
 *
 * Why: server messages are one-off events. Roblox holds them until a listener connects, but
 * only hands them to the *first* listener — so UI that subscribed later (once React mounted)
 * missed anything sent before it (in the ghost prototype, a slow tablet never learned its
 * role). Now one listener connects as early as possible and stores the
 * latest of everything; UI reads the stores whenever it mounts. On top of that the client
 * says "Ready" once loaded and the server re-sends its current state, so even a lost message
 * is recovered.
 */

class Store<T> {
	private listeners = new Set<() => void>();
	constructor(private value: T) {}

	get(): T {
		return this.value;
	}

	set(value: T) {
		this.value = value;
		this.listeners.forEach((listener) => listener());
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

/** Re-renders the component whenever `store` changes. */
export function useStore<T>(store: Store<T>): T {
	const [value, setValue] = React.useState(store.get());
	React.useEffect(() => {
		setValue(store.get()); // catch anything that changed before we subscribed
		return store.subscribe(() => setValue(store.get()));
	}, [store]);
	return value;
}

export const spectateStore = new Store<number[]>([]);
/** The latest notice; `at` changes even when the same text repeats. */
export const noticeStore = new Store<{ text: string; at: number } | undefined>(undefined);
/** Your latest swing that connected (for the hit marker). */
export const hitStore = new Store<{ kind: "Hit" | "Kill"; at: number } | undefined>(undefined);
/** What you're carrying. */
export const inventoryStore = new Store<Inventory>(emptyInventory(5));
/** Your coins. */
export const coinsStore = new Store<number>(0);
/** Your Night 1 tip ("" for none). */
export const hintStore = new Store<string>("");
/** Last night's summary, with when it arrived. */
export const nightSummaryStore = new Store<{ summary: NightSummary; at: number } | undefined>(undefined);
/** The end-of-run cards (undefined until the run is over). */
export const scoreboardStore = new Store<ScoreCard[] | undefined>(undefined);
/** When you were last struck (for the red flash), as os.clock(). */
export const hurtStore = new Store<number | undefined>(undefined);

/** Connects the one listener, then tells the server this client is ready for a re-sync. */
export function startGameState(remote: RemoteEvent) {
	onServerMessage<GameServerMessages>(remote, {
		Spectate: (userIds) => spectateStore.set(userIds),
		Notice: (text) => noticeStore.set({ text, at: os.clock() }),
		HitResult: (kind) => hitStore.set({ kind, at: os.clock() }),
		Hurt: () => hurtStore.set(os.clock()),
		Inventory: (inventory) => inventoryStore.set(inventory),
		Coins: (coins) => coinsStore.set(coins),
		Hint: (text) => hintStore.set(text),
		NightSummary: (summary) => nightSummaryStore.set({ summary, at: os.clock() }),
		Scoreboard: (cards) => scoreboardStore.set(cards),
	});
	serverSender<GameClientMessages>(remote)("Ready", undefined);
}
