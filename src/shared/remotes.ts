import { Inventory } from "shared/inventory";
import { NightSummary } from "shared/nightSummary";
import { ScoreCard } from "shared/scoreboard";
import { TradeView } from "shared/pricing";
import { TradeRequest } from "shared/trade";
import { UpgradeId } from "shared/upgrades";

/**
 * Message maps for each RemoteEvent: message name -> payload type. Send and receive through
 * shared/net.ts, so a misspelt name or wrong payload is a compile error rather than a
 * silently ignored message.
 *
 * Server -> client payloads are trusted by the client. Client -> server payloads are typed
 * here for the sender only: the server receives them as `unknown` and must validate them.
 */

// --- Lobby ------------------------------------------------------------------------------

/** RemoteEvent for lobby party communication. */
export const QUEUE_REMOTE_NAME = "QueueRemote";

export interface LobbyServerMessages {
	/** You're the host: show the create-party form. */
	CreateParty: { lowest: number; highest: number; expireSeconds: number };
	/** You're in a party now. */
	JoinParty: undefined;
	/** You're no longer in a party. */
	LeaveParty: undefined;
}

export interface LobbyClientMessages {
	/** Host asks to create the party with this maximum size. */
	RequestCreate: number;
}

// --- Main game --------------------------------------------------------------------------

/** RemoteEvent the main game uses to tell each player about their own state. */
export const GAME_REMOTE_NAME = "GameRemote";

export interface GameServerMessages {
	/** A short message to show, e.g. "You were taken!". */
	Notice: string;
	/** Taken kids only: user IDs of the kids still in, to spectate. */
	Spectate: number[];
	/** Your swing connected ("Kill" if it took the target down). */
	HitResult: "Hit" | "Kill";
	/** You were struck. */
	Hurt: undefined;
	/** What you're carrying. */
	Inventory: Inventory;
	/** Your coins. */
	Coins: number;
	/** The upgrades you have: the party's and your own. */
	Upgrades: UpgradeId[];
	/** You used the workbench: show its list. */
	OpenWorkbench: undefined;
	/** You used a trader: show their list. */
	OpenTrade: TradeView;
	/** Everyone: a trader's list changed (shown only if you have it open). */
	UpdateTrade: TradeView;
	/** Your Night 1 tip; "" for none. */
	Hint: string;
	/** Everyone, at dawn: what the night cost. */
	NightSummary: NightSummary;
	/** Everyone, at the end of the run: one card per kid. */
	Scoreboard: ScoreCard[];
}

export interface GameClientMessages {
	/** The client has loaded and is listening: please re-send my current state. */
	Ready: undefined;
	/** "Back to lobby" on the end screen. Only honoured once the run is over. */
	LeaveRound: undefined;
	/**
	 * A melee swing with the equipped weapon: the infected models the client saw in reach,
	 * nearest first. The server re-checks each (tag, range + tolerance, arc + tolerance, walls)
	 * and hits the first valid one.
	 */
	Swing: Model[];
	/**
	 * A slingshot shot: the aim direction. The server checks it (a finite direction, slingshot
	 * held, stones, cooldown) and casts the shot itself from the kid's head.
	 */
	Shoot: Vector3;
	/** Use what's in this inventory slot (0-based). */
	UseItem: number;
	/** Buy this workbench upgrade. */
	BuyUpgrade: UpgradeId;
	/** Buy one lot of an item from a trader. The server knows the price. */
	TradeBuy: TradeRequest;
	/** Sell a trader one of an item. */
	TradeSell: TradeRequest;
	/** Drop what's in this inventory slot (0-based). */
	DropItem: number;
}
