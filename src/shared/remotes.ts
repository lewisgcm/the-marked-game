import { AttackWindowState } from "shared/combat";
import { ScoreCard } from "shared/scoreboard";
import { Inventory } from "shared/objectives";
import { Role } from "shared/roles";
import { SpookKind, SpookState } from "shared/spooks";

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
	/** Your role for this round. */
	Role: Role;
	/** Ghost only: whether hunters can currently see you. */
	GhostRevealed: boolean;
	/** What you're carrying. */
	Inventory: Inventory;
	/** A short message to show, e.g. "You need a key". */
	Notice: string;
	/** Ghost only: spook charges and recharge timer. */
	Spooks: SpookState;
	/** Ghost only: time left to use the knife after a scream. */
	AttackWindow: AttackWindowState;
	/** Dead hunters only: user IDs of the hunters still alive, to spectate. */
	Spectate: number[];
	/** Your swing connected ("Kill" if it took the target out). */
	HitResult: "Hit" | "Kill";
	/** You were struck (knife or poker). */
	Hurt: undefined;
	/** Everyone, at the end of the round: one card per player, ghost first. */
	Scoreboard: ScoreCard[];
}

export interface GameClientMessages {
	/** Ghost asks to use a spook. Validated server-side (role, phase, charges, cooldown). */
	Spook: SpookKind;
	/** The client has loaded and is listening: please re-send my current state. */
	Ready: undefined;
	/** "Back to lobby" on the end screen. Only honoured once the round is over. */
	LeaveRound: undefined;
	/**
	 * A melee swing with the equipped knife/poker: user IDs the client saw in reach, nearest
	 * first. The server re-checks each (role, range + tolerance, arc + tolerance, walls) and
	 * hits the first valid one.
	 */
	Swing: number[];
}
