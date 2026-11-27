import { DamageResult } from "shared/house/barricade";
import { StunState } from "shared/infected/stun";
import { Entry } from "../world/world";

/** The infected's shared types. */

export interface InfectedHooks {
	/** Kids who can be chased and hit (still in, with a character). */
	getKids: () => Player[];
	/** Whether an opening has any plank, or a shutter, up. */
	isEntryBlocked: (entry: Entry) => boolean;
	/** Whether one gets anywhere by attacking an opening (not if it's down to a shutter it can't break). */
	isEntryWorthAttacking: (entry: Entry, breaksShutters: boolean) => boolean;
	/** Wears down an opening's planks, and its shutter if this one can break them. */
	damageEntry: (entry: Entry, amount: number, breaksShutters: boolean) => DamageResult;
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
	/** Where each fallen base's nest is: part of every wave sets off from there. */
	getNests: () => CFrame[];
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
	/** It goes at dawn even if it's dormant (a base's attackers). */
	leavesAtDawn: boolean;
	entry?: Entry;
	/** It found no way in to a kid: it goes for openings until then (os.clock()). */
	blockedUntil: number;
	waypoints: PathWaypoint[];
	waypointIndex: number;
	lastPathAt: number;
	pathGoal?: Vector3;
	lastHitAt: number;
	modeSince: number;
	lastPosition: Vector3;
	stuckSince: number;
	stun: StunState;
	/** Knocked back by a hit: it does nothing else until then (os.clock()). */
	staggeredUntil: number;
	eyes: BasePart[];
}
