import React from "@rbxts/react";
import { AttackWindowState } from "shared/combat";
import { onServerMessage, serverSender } from "shared/net";
import { Inventory } from "shared/objectives";
import { GameClientMessages, GameServerMessages } from "shared/remotes";
import { Role } from "shared/roles";
import { ScoreCard } from "shared/scoreboard";
import { SpookState } from "shared/spooks";
import { setGhost, setRevealed } from "./ghostSelf";

/**
 * The local player's game state, as told by the server, kept in small stores.
 *
 * Why: server messages are one-off events. Roblox holds them until a listener connects, but
 * only hands them to the *first* listener — so UI that subscribed later (once React mounted)
 * missed anything sent before it, e.g. "you're the ghost" on a slow tablet, and the ghost's
 * spook panel never appeared. Now one listener connects as early as possible and stores the
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

/** A timed value from the server, with when it arrived (to count timers down locally). */
export interface Timed<T> {
	state: T;
	receivedAt: number;
}

export const roleStore = new Store<Role | undefined>(undefined);
export const spookStore = new Store<Timed<SpookState> | undefined>(undefined);
export const attackWindowStore = new Store<Timed<AttackWindowState> | undefined>(undefined);
export const inventoryStore = new Store<Inventory>({ keys: 0, items: [] });
export const spectateStore = new Store<number[]>([]);
/** The latest notice; `at` changes even when the same text repeats. */
export const noticeStore = new Store<{ text: string; at: number } | undefined>(undefined);
/** Your latest swing that connected (for the hit marker). */
export const hitStore = new Store<{ kind: "Hit" | "Kill"; at: number } | undefined>(undefined);
/** The end-of-round cards (undefined until the round is over). */
export const scoreboardStore = new Store<ScoreCard[] | undefined>(undefined);
/** When you were last struck (for the red flash), as os.clock(). */
export const hurtStore = new Store<number | undefined>(undefined);

/** Connects the one listener, then tells the server this client is ready for a re-sync. */
export function startGameState(remote: RemoteEvent) {
	onServerMessage<GameServerMessages>(remote, {
		Role: (role) => {
			setGhost(role === "Ghost");
			roleStore.set(role);
		},
		GhostRevealed: (revealed) => setRevealed(revealed),
		Spooks: (state) => spookStore.set({ state, receivedAt: os.clock() }),
		AttackWindow: (state) => attackWindowStore.set({ state, receivedAt: os.clock() }),
		Inventory: (inventory) => inventoryStore.set(inventory),
		Spectate: (userIds) => spectateStore.set(userIds),
		Notice: (text) => noticeStore.set({ text, at: os.clock() }),
		HitResult: (kind) => hitStore.set({ kind, at: os.clock() }),
		Hurt: () => hurtStore.set(os.clock()),
		Scoreboard: (cards) => scoreboardStore.set(cards),
	});
	serverSender<GameClientMessages>(remote)("Ready", undefined);
}
