import { CollectionService } from "@rbxts/services";
import { INFECTED_TAG } from "shared/combat/combat";
import { isStunned, stepStun } from "shared/infected/stun";
import { shouldWake } from "shared/infected/wake";
import { gameConfig } from "../core/config";
import { playSound } from "../core/effects";
import { Entry, isInsideHouse } from "../world/world";
import { dimEyes, fadeToStatic } from "./body";
import { face, flat, flatDistance, pathTo, stop, walkTo } from "./movement";
import {
	breaksShutters,
	canSee,
	insidePoint,
	isWorthAttacking,
	nearestKid,
	nearestTarget,
	outsidePoint,
} from "./senses";
import { alive, getHooks, getWorld, setMode } from "./state";
import { Infected, Mode } from "./types";

/** What an infected does in each mode (see director.ts for the overview). */

const HIT_SOUND = "rbxasset://sounds/swordlunge.wav";
/** An opening counts as under attack for this long after a hit, in seconds. */
const ATTACKED_SECONDS = 4;

/** The opening bashed most recently, and when (os.clock()). */
let lastBash: { entry: Entry; at: number } | undefined;

/** The opening under attack right now, if any. */
export function attackedEntry(): Entry | undefined {
	return lastBash && os.clock() - lastBash.at < ATTACKED_SECONDS ? lastBash.entry : undefined;
}

/** Turns to a kid in reach and hits them, as often as it can. */
function tryHitKid(inf: Infected, kid: Player, kidRoot: BasePart) {
	face(inf, kidRoot.Position);
	stop(inf);
	const now = os.clock();
	if (now - inf.lastHitAt < gameConfig.infectedKidHitSeconds.Value) {
		return;
	}
	inf.lastHitAt = now;
	playSound(inf.root, HIT_SOUND, { volume: 0.8, range: 60 });
	const multiplier = getHooks().isFirstNight() ? gameConfig.firstNightDamageMultiplier.Value : 1;
	getHooks().damageKid(kid, gameConfig.infectedKidDamage.Value * multiplier);
}

function approach(inf: Infected) {
	const kid = nearestKid(inf.root.Position);
	// One that's just found no way in to a kid it can see gets on with breaking in, unless they're in reach.
	const isBlocked = os.clock() < inf.blockedUntil;
	const range = isBlocked ? gameConfig.infectedAttackRange.Value : gameConfig.infectedSightRange.Value;
	if (kid && kid.distance <= range && canSee(inf, kid.player)) {
		setMode(inf, "chase");
		return;
	}
	if (!inf.entry || !isWorthAttacking(inf, inf.entry)) {
		inf.entry = nearestTarget(inf);
	}
	const entry = inf.entry;
	if (!entry) {
		return;
	}
	const outside = outsidePoint(entry);
	if (flatDistance(inf.root.Position, outside) > 4) {
		// It may be round the other side of the house.
		if (!pathTo(inf, outside)) {
			walkTo(inf, outside);
		}
		return;
	}
	if (!getHooks().isEntryBlocked(entry)) {
		setMode(inf, "enter");
		return;
	}
	// Bash the planks.
	face(inf, entry.cframe.Position);
	stop(inf);
	const now = os.clock();
	if (now - inf.lastHitAt >= gameConfig.infectedPlankHitSeconds.Value) {
		inf.lastHitAt = now;
		lastBash = { entry, at: now };
		const result = getHooks().damageEntry(entry, gameConfig.infectedPlankDamage.Value, breaksShutters(inf));
		if (result.broken > 0) {
			getHooks().onPlankBroken();
		}
		if (result.opened) {
			getHooks().alertAll(`The ${entry.name.lower()} is broken!`);
		}
	}
}

function enter(inf: Infected) {
	const entry = inf.entry;
	if (!entry) {
		setMode(inf, "chase");
		return;
	}
	if (getHooks().isEntryBlocked(entry) && !isInsideHouse(inf.root.Position)) {
		setMode(inf, "approach"); // boarded up again before it got through
		return;
	}
	const inside = insidePoint(entry);
	walkTo(inf, inside);
	if (entry.kind === "Window" && flatDistance(inf.root.Position, entry.cframe.Position) < 3.5) {
		inf.humanoid.Jump = true; // climb the sill
	}
	if (flatDistance(inf.root.Position, inside) < 2.5 || os.clock() - inf.modeSince > 5) {
		setMode(inf, "chase");
	}
}

/** Wakes a dormant one: it goes for the kids. */
export function wake(inf: Infected) {
	if (inf.mode === "dormant") {
		setMode(inf, "chase");
	}
}

function dormant(inf: Infected) {
	const kid = nearestKid(inf.root.Position);
	const lit = getHooks().isLit(inf.model);
	if (lit) {
		wake(inf);
		return;
	}
	if (!kid) {
		return;
	}
	const toKid = flat(kid.root.Position.sub(inf.root.Position));
	const facing = toKid.Magnitude > 0.1 ? toKid.Unit.Dot(flat(inf.root.CFrame.LookVector).Unit) : 1;
	const situation = { distance: kid.distance, facing, canSee: canSee(inf, kid.player), lit };
	const settings = {
		sightRange: gameConfig.wakeSightRange.Value,
		halfAngle: gameConfig.wakeHalfAngle.Value,
		touchRange: gameConfig.wakeTouchRange.Value,
	};
	if (shouldWake(situation, settings)) {
		wake(inf);
	}
}

/** Back to its screen; kids who come close on the way are fair game. */
function goBack(inf: Infected) {
	const spot = inf.spot;
	const kid = nearestKid(inf.root.Position);
	if (!spot || (kid && kid.distance < gameConfig.wakeSightRange.Value && canSee(inf, kid.player))) {
		setMode(inf, "chase");
		return;
	}
	if (flatDistance(inf.root.Position, spot.Position) < 3) {
		stop(inf);
		face(inf, spot.Position.add(spot.LookVector.mul(10)));
		setMode(inf, "dormant");
		return;
	}
	if (!pathTo(inf, spot.Position)) {
		walkTo(inf, spot.Position);
	}
}

function chase(inf: Infected) {
	const kid = nearestKid(inf.root.Position);
	const gaveUp = !kid || kid.distance > gameConfig.giveUpRange.Value;
	if (inf.spot && gaveUp && !getHooks().isNight()) {
		setMode(inf, "return");
		return;
	}
	if (!kid) {
		stop(inf);
		return;
	}
	if (kid.distance <= gameConfig.infectedAttackRange.Value && canSee(inf, kid.player)) {
		tryHitKid(inf, kid.player, kid.root);
		return;
	}
	if (!pathTo(inf, kid.root.Position)) {
		if (!isInsideHouse(inf.root.Position)) {
			// No way in: go and break one.
			inf.entry = nearestTarget(inf);
			inf.blockedUntil = os.clock() + gameConfig.infectedBlockedSeconds.Value;
			setMode(inf, "approach");
		} else {
			walkTo(inf, kid.root.Position);
		}
	}
}

function retreat(inf: Infected) {
	const spawns = getWorld().infectedSpawns;
	let goal: Vector3 | undefined;
	for (const spawn of spawns) {
		if (!goal || flatDistance(inf.root.Position, spawn.Position) < flatDistance(inf.root.Position, goal)) {
			goal = spawn.Position;
		}
	}
	if (
		!goal ||
		flatDistance(inf.root.Position, goal) < 6 ||
		os.clock() - inf.modeSince > gameConfig.infectedRetreatSeconds.Value
	) {
		dissolve(inf);
		return;
	}
	if (!pathTo(inf, goal)) {
		walkTo(inf, goal);
	}
}

/** Removes one from the world in a flicker of static. */
export function dissolve(inf: Infected) {
	if (!alive.delete(inf.model)) {
		return;
	}
	CollectionService.RemoveTag(inf.model, INFECTED_TAG);
	inf.humanoid.WalkSpeed = 0;
	fadeToStatic(inf.model);
}

const BEHAVIOURS: Record<Mode, (inf: Infected) => void> = {
	dormant,
	approach,
	enter,
	chase,
	return: goBack,
	retreat,
};

/**
 * One step, `dt` seconds after the last: the flashlight stun, then whatever its mode says. A stunned
 * infected stands still instead.
 */
export function think(inf: Infected, dt: number) {
	const now = os.clock();
	if (inf.mode === "dormant") {
		dormant(inf); // a beam wakes it rather than stunning it
		return;
	}
	const lit = inf.mode !== "retreat" && getHooks().isLit(inf.model);
	const settings = {
		litSeconds: gameConfig.stunLitSeconds.Value,
		stunSeconds: gameConfig.stunSeconds.Value,
		immuneSeconds: gameConfig.stunImmuneSeconds.Value,
	};
	if (stepStun(inf.stun, lit, dt, now, settings)) {
		dimEyes(inf, settings.stunSeconds);
	}
	if (isStunned(inf.stun, now)) {
		stop(inf);
		return;
	}
	BEHAVIOURS[inf.mode](inf);
}
