import { DamageResult } from "shared/barricade";
import { StunState } from "shared/stun";
import { Entry } from "../world";

/** The infected's shared types. */

export interface InfectedHooks {
	/** Kids who can be chased and hit (still in, with a character). */
	getKids: () => Player[];
	/** Whether an opening has any plank up. */
	isEntryBlocked: (entry: Entry) => boolean;
	/** Wears down an opening's planks. */
	damageEntry: (entry: Entry, amount: number) => DamageResult;
	damageKid: (player: Player, amount: number) => void;
	/** A message for every kid, e.g. "The front door is broken!". */
	/** Danger, for everyone. */
	alertAll: (text: string) => void;
	/** Whether this is Night 1 (the infected hit softer). */
	isFirstNight: () => boolean;
	/** Whether any kid's flashlight beam is on `model` right now. */
	isLit: (model: Model) => boolean;
	/** Whether the night is on (woken infected never give up then). */
	isNight: () => boolean;
	/** Whether the generator counts for a wave (if not, more infected come). */
	isPowered: () => boolean;
	/** A plank was broken off an opening. */
	onPlankBroken: () => void;
	/** An infected was brought down. */
	onDowned: () => void;
}

/** What an infected is doing (one behaviour each, behaviours.ts). */
export type Mode = "dormant" | "approach" | "enter" | "chase" | "return" | "retreat";

export interface Infected {
	model: Model;
	humanoid: Humanoid;
	root: BasePart;
	isDad: boolean;
	mode: Mode;
	/** Where a dormant one stands (and goes back to); undefined for the night's waves. */
	spot?: CFrame;
	entry?: Entry;
	waypoints: PathWaypoint[];
	waypointIndex: number;
	lastPathAt: number;
	pathGoal?: Vector3;
	lastHitAt: number;
	modeSince: number;
	lastPosition: Vector3;
	stuckSince: number;
	stun: StunState;
	eyes: BasePart[];
}
