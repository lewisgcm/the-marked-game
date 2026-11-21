import { ScoreCard } from "shared/scoreboard";

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
	/** How many planks you're carrying. */
	Planks: number;
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
}
