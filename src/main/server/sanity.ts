import { Players, RunService } from "@rbxts/services";
import { nextPanicState, PANIC_ATTRIBUTE, SANITY_ATTRIBUTE, SANITY_MAX, sanityRate, stepSanity } from "shared/sanity";
import { gameConfig } from "./config";
import { Lamp } from "./world";

/**
 * Hunters' sanity, simulated on the server a few times a second.
 *
 * The server measures each hunter's situation (near a working lamp? another hunter nearby?
 * the ghost close?) from its own copy of the world, applies the rules in shared/sanity.ts,
 * and publishes the value as a Player attribute for the HUD. Clients can't change it.
 */

export interface SanityHooks {
	/** Hunters whose sanity is being tracked. */
	getHunters: () => Player[];
	getGhost: () => Player | undefined;
	/** Only drains/recovers while this is true (the hunt is running). */
	isActive: () => boolean;
	/** A hunter started (true) or stopped (false) panicking. */
	onPanic: (player: Player, panicking: boolean) => void;
}

const TICK = 0.25;
const sanity = new Map<Player, number>();
const panicking = new Set<Player>();
let onPanic: SanityHooks["onPanic"] | undefined;

function rootPosition(player: Player): Vector3 | undefined {
	const hrp = player.Character?.FindFirstChild("HumanoidRootPart");
	return hrp && hrp.IsA("BasePart") ? hrp.Position : undefined;
}

/** Horizontal distance: lamps hang from the ceiling, but what matters is standing under one. */
function flatDistance(a: Vector3, b: Vector3) {
	return new Vector2(a.X - b.X, a.Z - b.Z).Magnitude;
}

export function isPanicking(player: Player): boolean {
	return panicking.has(player);
}

export function getSanity(player: Player): number {
	return sanity.get(player) ?? SANITY_MAX;
}

/** Changes a hunter's sanity directly (e.g. a spook). Clamped to 0..100. */
export function addSanity(player: Player, amount: number) {
	setSanity(player, getSanity(player) + amount);
}

function setSanity(player: Player, value: number) {
	const clamped = math.clamp(value, 0, SANITY_MAX);
	sanity.set(player, clamped);
	// Whole numbers only, so the attribute (which replicates) doesn't change every tick.
	const shown = math.floor(clamped + 0.5);
	if (player.GetAttribute(SANITY_ATTRIBUTE) !== shown) {
		player.SetAttribute(SANITY_ATTRIBUTE, shown);
	}

	const was = panicking.has(player);
	const now = nextPanicState(was, clamped, gameConfig.panicStartAt.Value, gameConfig.panicRecoverAt.Value);
	if (now !== was) {
		if (now) {
			panicking.add(player);
		} else {
			panicking.delete(player);
		}
		player.SetAttribute(PANIC_ATTRIBUTE, now);
		onPanic?.(player, now);
	}
}

export function startSanity(lamps: Lamp[], hooks: SanityHooks) {
	onPanic = hooks.onPanic;
	Players.PlayerRemoving.Connect((player) => {
		sanity.delete(player);
		panicking.delete(player);
	});

	let elapsed = 0;
	RunService.Heartbeat.Connect((dt) => {
		elapsed += dt;
		if (elapsed < TICK) {
			return;
		}
		const step = elapsed;
		elapsed = 0;

		const hunters = hooks.getHunters();
		const ghost = hooks.getGhost();
		const ghostAt = ghost && rootPosition(ghost);
		const positions = new Map<Player, Vector3>();
		for (const hunter of hunters) {
			const at = rootPosition(hunter);
			if (at) {
				positions.set(hunter, at);
			}
			if (!sanity.has(hunter)) {
				setSanity(hunter, SANITY_MAX);
			}
		}
		if (!hooks.isActive()) {
			return;
		}

		const lampRadius = gameConfig.lampComfortRadius.Value;
		const companyRadius = gameConfig.companyRadius.Value;
		const chillRadius = gameConfig.ghostChillRadius.Value;
		const rates = {
			drainAlone: gameConfig.sanityDrainAlone.Value,
			recoverOne: gameConfig.sanityRecoverOne.Value,
			recoverBoth: gameConfig.sanityRecoverBoth.Value,
			ghostChill: gameConfig.sanityGhostChill.Value,
		};
		for (const [hunter, at] of positions) {
			const lit = lamps.some((lamp) => lamp.light.Enabled && flatDistance(lamp.floor, at) <= lampRadius);
			let company = false;
			for (const [other, otherAt] of positions) {
				if (other !== hunter && otherAt.sub(at).Magnitude <= companyRadius) {
					company = true;
					break;
				}
			}
			const ghostNear = ghostAt !== undefined && ghostAt.sub(at).Magnitude <= chillRadius;
			setSanity(hunter, stepSanity(getSanity(hunter), sanityRate({ lit, company, ghostNear }, rates), step));
		}
	});
}
