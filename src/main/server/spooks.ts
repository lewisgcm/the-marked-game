import { RunService } from "@rbxts/services";
import { advanceCharges, SpookKind, SpookState } from "shared/spooks";
import { gameConfig } from "./config";
import { forceReveal } from "./ghostVisibility";
import { recordStat } from "./roundStats";
import { Lamp } from "./world";

/**
 * The ghost's spooks: a few charges that recharge over time, spent on
 *
 * - **Scream** — hunters near the ghost lose a chunk of sanity, and the ghost shows itself for
 *   a few seconds: its window to use the knife, and the hunters' chance to strike back.
 * - **Lights out** — the nearest working lamp stutters and dies for a while, taking its
 *   sanity comfort with it.
 *
 * **Fear feeds the ghost:** scaring hunters (a scream that lands, a hunter panicking, a knife
 * hit) pulls its next charge closer — `rewardScare` — so an active ghost spooks more often than
 * one that waits. The bonus seconds are in config (ScareReward*).
 *
 * Server-authoritative: the client only asks ("Spook", kind). The server checks it's the
 * ghost, during the hunt, with a charge and off cooldown, and does everything itself. Numbers
 * are in main/server/config.ts.
 */

export interface SpookHooks {
	getGhost: () => Player | undefined;
	getHunters: () => Player[];
	/** Whether spooks can be used and recharge (the hunt is running). */
	isActive: () => boolean;
	addSanity: (player: Player, amount: number) => void;
	notify: (player: Player, text: string) => void;
	/** The ghost screamed: it's visible for `seconds` and may use its knife meanwhile. */
	onScream: (ghost: Player, seconds: number) => void;
	/** Sends the ghost its charge state for the HUD. */
	sendState: (ghost: Player, state: SpookState) => void;
}

// Placeholder sounds (built-in Studio content), pitched for effect. Swap for real assets later.
const SCREAM_SOUND = "rbxasset://sounds/uuhhh.mp3";
const POP_SOUND = "rbxasset://sounds/electronicpingshort.wav";
const DEAD_BULB = new Color3(0.12, 0.1, 0.09);

let hooks: SpookHooks | undefined;
let lamps: Lamp[] = [];
let charges = 0;
let initialised = false;
let nextChargeAt = 0;
let lastSpookAt = -math.huge;

function rootOf(player: Player | undefined): BasePart | undefined {
	const hrp = player?.Character?.FindFirstChild("HumanoidRootPart");
	return hrp && hrp.IsA("BasePart") ? hrp : undefined;
}

function playSound(parent: Instance, id: string, speed: number, volume: number, range: number) {
	const sound = new Instance("Sound");
	sound.SoundId = id;
	sound.PlaybackSpeed = speed;
	sound.Volume = volume;
	sound.RollOffMode = Enum.RollOffMode.InverseTapered;
	sound.RollOffMaxDistance = range;
	sound.Parent = parent;
	sound.Play();
	task.delay(4, () => sound.Destroy());
}

function publish() {
	const ghost = hooks?.getGhost();
	if (!hooks || !ghost) {
		return;
	}
	const max = gameConfig.spookMaxCharges.Value;
	hooks.sendState(ghost, {
		charges,
		maxCharges: max,
		nextChargeIn: charges < max ? math.max(0, nextChargeAt - os.clock()) : undefined,
	});
}

function scream(ghost: Player, root: BasePart): boolean {
	const radius = gameConfig.screamRadius.Value;
	const damage = gameConfig.screamSanityDamage.Value;
	let scared = 0;
	for (const hunter of hooks!.getHunters()) {
		const at = rootOf(hunter);
		if (at && at.Position.sub(root.Position).Magnitude <= radius) {
			hooks!.addSanity(hunter, -damage);
			hooks!.notify(hunter, "Something screamed right next to you!");
			scared += 1;
		}
	}
	recordStat(ghost, "screamHits", scared);
	if (scared > 0) {
		// After the charge is spent (below), so the reward lands on the new wait.
		task.defer(() => rewardScare(scared * gameConfig.scareRewardScream.Value));
	}
	// The scream shows the ghost — its chance to attack, and the hunters' to fight back.
	const seconds = gameConfig.screamRevealSeconds.Value;
	forceReveal(ghost, seconds);
	hooks!.onScream(ghost, seconds);
	playSound(root, SCREAM_SOUND, 0.45, 3, 90);
	return true;
}

function lightsOut(ghost: Player, root: BasePart): boolean {
	const radius = gameConfig.lightsOutRadius.Value;
	let nearest: Lamp | undefined;
	let nearestDistance = math.huge;
	for (const lamp of lamps) {
		const distance = new Vector2(lamp.floor.X - root.Position.X, lamp.floor.Z - root.Position.Z).Magnitude;
		if (lamp.light.Enabled && distance <= radius && distance < nearestDistance) {
			nearest = lamp;
			nearestDistance = distance;
		}
	}
	if (!nearest) {
		hooks!.notify(ghost, "No working lamp nearby.");
		return false;
	}

	const lamp = nearest;
	recordStat(ghost, "lampsOut");
	const litColor = lamp.bulb.Color;
	task.spawn(() => {
		// Stutter, pop, dark.
		for (const on of [false, true, false, true, false]) {
			lamp.light.Enabled = on;
			task.wait(0.1);
		}
		lamp.bulb.Color = DEAD_BULB;
		lamp.bulb.Material = Enum.Material.SmoothPlastic;
		playSound(lamp.bulb, POP_SOUND, 0.5, 1.5, 60);

		task.wait(gameConfig.lightsOutSeconds.Value);
		lamp.bulb.Color = litColor;
		lamp.bulb.Material = Enum.Material.Neon;
		lamp.light.Enabled = true;
	});
	return true;
}

/**
 * Pulls the ghost's next charge `seconds` closer (it scared someone) and tells it so. Does
 * nothing before the hunt or when the ghost is already at max charges.
 */
export function rewardScare(seconds: number) {
	const ghost = hooks?.getGhost();
	if (!hooks || !ghost || !initialised || !hooks.isActive() || seconds <= 0) {
		return;
	}
	const max = gameConfig.spookMaxCharges.Value;
	if (charges >= max) {
		return;
	}
	const before = charges;
	const updated = advanceCharges(
		{ charges, nextChargeAt },
		os.clock(),
		seconds,
		max,
		gameConfig.spookRechargeSeconds.Value,
	);
	charges = updated.charges;
	nextChargeAt = updated.nextChargeAt;
	hooks.notify(
		ghost,
		charges > before ? "Their fear feeds you: spook charged!" : `Their fear feeds you (-${math.floor(seconds)}s)`,
	);
	publish();
}

/** Re-sends the ghost its charge state (e.g. its client just loaded). */
export function resendSpooks() {
	if (initialised) {
		publish();
	}
}

/** Handles a client's "Spook" message. `kind` comes from the client, so it's validated. */
export function onSpookRequest(player: Player, kind: unknown) {
	if (!hooks || player !== hooks.getGhost() || !hooks.isActive()) {
		return;
	}
	if (kind !== "Scream" && kind !== "LightsOut") {
		return;
	}
	const now = os.clock();
	if (charges < 1 || now - lastSpookAt < gameConfig.spookCooldown.Value) {
		return;
	}
	const root = rootOf(player);
	if (!root) {
		return;
	}

	const used = (kind as SpookKind) === "Scream" ? scream(player, root) : lightsOut(player, root);
	if (!used) {
		return;
	}
	lastSpookAt = now;
	if (charges === gameConfig.spookMaxCharges.Value) {
		nextChargeAt = now + gameConfig.spookRechargeSeconds.Value; // recharge restarts from full
	}
	charges -= 1;
	publish();
}

/** Starts charge tracking. Call once. */
export function startSpooks(worldLamps: Lamp[], spookHooks: SpookHooks) {
	hooks = spookHooks;
	lamps = worldLamps;

	let elapsed = 0;
	RunService.Heartbeat.Connect((dt) => {
		elapsed += dt;
		if (elapsed < 0.25) {
			return;
		}
		elapsed = 0;
		if (!spookHooks.isActive()) {
			return;
		}
		const now = os.clock();
		if (!initialised) {
			// The hunt just started: hand out the starting charges.
			initialised = true;
			charges = gameConfig.spookStartCharges.Value;
			nextChargeAt = now + gameConfig.spookRechargeSeconds.Value;
			publish();
			return;
		}
		const max = gameConfig.spookMaxCharges.Value;
		const updated = advanceCharges({ charges, nextChargeAt }, now, 0, max, gameConfig.spookRechargeSeconds.Value);
		if (updated.charges !== charges) {
			charges = updated.charges;
			nextChargeAt = updated.nextChargeAt;
			publish();
		}
	});
}
