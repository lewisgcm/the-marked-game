import { Inventory } from "shared/items/inventory";
import { Notice } from "shared/core/messages";
import { NightSummary } from "shared/run/nightSummary";
import { ScoreCard } from "shared/run/scoreboard";
import { TradeView } from "shared/economy/pricing";
import { RecipeId } from "shared/economy/recipes";
import { TradeRequest } from "shared/economy/trade";
import { WalkieState } from "shared/economy/walkie";
import { UpgradeId } from "shared/economy/upgrades";

/**
 * Message maps for each RemoteEvent: message name -> payload type. Send and receive through
 * shared/core/net.ts, so a misspelt name or wrong payload is a compile error rather than a
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
	/** You're no longer in a party (and if you were being led out, you're not now). */
	LeaveParty: undefined;
	/** The countdown's over: follow your parent out of `door` while the screen fades, over `seconds`. */
	LeadOut: { door: Vector3; seconds: number };
}

export interface LobbyClientMessages {
	/** Host asks to create the party with this maximum size. */
	RequestCreate: number;
}

// --- Main game --------------------------------------------------------------------------

/** RemoteEvent the main game uses to tell each player about their own state. */
export const GAME_REMOTE_NAME = "GameRemote";

export interface GameServerMessages {
	/** A short message to show (shared/core/messages.ts says where). */
	Notice: Notice;
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
	/** The walkie-talkie's log, and how each base is doing. */
	Walkie: WalkieState;
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
	/** Make this at the workbench. The server knows what it costs. */
	Craft: RecipeId;
	/** Buy one lot of an item from a trader. The server knows the price. */
	TradeBuy: TradeRequest;
	/** Sell a trader one of an item. */
	TradeSell: TradeRequest;
	/** Drop what's in this inventory slot (0-based). */
	DropItem: number;
}
