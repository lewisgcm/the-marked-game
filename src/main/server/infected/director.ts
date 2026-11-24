import { CollectionService } from "@rbxts/services";
import { INFECTED_TAG } from "shared/combat";
import { newStun } from "shared/stun";
import { infectedHealth, planNight, Wave, waveSize } from "shared/waves";
import { gameConfig } from "../config";
import { MainWorld } from "../world";
import { dissolve, think, wake } from "./behaviours";
import { buildTemplate, dressAsDad, eyesOf, startWalkAnimation } from "./body";
import { activeCount, alive, getHooks, getWorld, holder, isDadAround, setMode, setUpState } from "./state";
import { Infected, InfectedHooks } from "./types";

/**
 * The infected (shamblers for now), server-controlled. Waves come at night (shared/waves.ts),
 * from the spawn markers on all four sides, and retreat at dawn.
 *
 * Each one runs a small loop a few times a second:
 *  - **approach** the nearest door or window from outside (or a kid it can see),
 *  - **bash** it while it's boarded (through hooks: barricades.ts wears the planks down),
 *  - **enter** once it's open (climbing in through windows),
 *  - **chase** the nearest kid with pathfinding, hitting them when in reach. If there's no way
 *    in to a kid (everything boarded), it goes back to bashing the nearest opening.
 *
 * By day, **dormant** ones stand in the neighbours' houses staring at a screen until something
 * wakes them (shared/wake.ts, noise, or being hit). A woken one chases; by day it gives up on kids
 * who get far away and goes back to its screen. Dad waits next door on Day 1, and Night 1's first
 * wave wakes him.
 *
 * A flashlight held on one for a moment **stuns** it for a couple of seconds (shared/stun.ts):
 * it stops dead, its eyes dim, then it shrugs off beams for a while.
 *
 * Split up: types.ts, state.ts (who's around), body.ts (looks), movement.ts, senses.ts, behaviours.ts
 * (one function per mode), and this file (spawning, and the calls the rest of the game makes).
 *
 * Bodies: an R15 rig made from a plain HumanoidDescription, greyed out, with glowing red eyes.
 * Brought to 0 health (the bat; combat.ts), it dissolves into static. Dad is one of them: he
 * can be knocked down, never killed — he's back the next night.
 */

const THINK_SECONDS = 0.2;

let template: Model | undefined;
let templateReady = false;
/** Bumped every night and at dawn, so waves scheduled for an old night don't spawn. */
let generation = 0;

/** Spawns one at `at`; `spot` makes it dormant there. */
function spawnOne(at: CFrame, night: number, isDad: boolean, spot?: CFrame) {
	if (!template || (!spot && activeCount() >= gameConfig.maxInfected.Value)) {
		return;
	}
	const model = template.Clone();
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	const root = model.FindFirstChild("HumanoidRootPart");
	if (!humanoid || !root || !root.IsA("BasePart")) {
		model.Destroy();
		return;
	}
	model.Name = isDad ? "Dad" : "Infected";
	if (isDad) {
		dressAsDad(model);
	}
	const health = infectedHealth(night, gameConfig.infectedBaseHealth.Value, gameConfig.infectedHealthPerNight.Value);
	humanoid.MaxHealth = health;
	humanoid.Health = health;
	humanoid.WalkSpeed = gameConfig.infectedWalkSpeed.Value;
	model.PivotTo(at);
	model.Parent = holder;
	root.SetNetworkOwner(undefined); // the server moves them
	CollectionService.AddTag(model, INFECTED_TAG);
	startWalkAnimation(humanoid);

	const inf: Infected = {
		model,
		humanoid,
		root,
		isDad,
		mode: spot ? "dormant" : "approach",
		spot,
		waypoints: [],
		waypointIndex: 0,
		lastPathAt: 0,
		lastHitAt: 0,
		modeSince: os.clock(),
		lastPosition: root.Position,
		stuckSince: os.clock(),
		stun: newStun(),
		eyes: eyesOf(model),
	};
	alive.set(model, inf);
	let lastHealth = health;
	humanoid.HealthChanged.Connect((now) => {
		if (now < lastHealth) {
			wake(inf); // hitting it wakes it
		}
		lastHealth = now;
	});
	humanoid.Died.Connect(() => {
		getHooks().onDowned();
		dissolve(inf);
	});
	task.spawn(() => {
		while (alive.has(model)) {
			const [ok, err] = pcall(() => think(inf, THINK_SECONDS));
			if (!ok) {
				warn(`[Infected] ${err}`);
			}
			task.wait(THINK_SECONDS);
		}
	});
}

function spawnWave(wave: Wave, night: number) {
	const spawns = getWorld().infectedSpawns;
	if (spawns.size() === 0) {
		return;
	}
	const rng = new Random();
	if (wave.dad) {
		if (!isDadAround()) {
			spawnOne(spawns[0], night, true); // Dad comes from the street
		}
		for (const [, inf] of alive) {
			if (inf.isDad && inf.mode === "dormant") {
				inf.spot = undefined; // from the garden next door, with the wave
				setMode(inf, "approach");
			}
		}
	}
	const powered = getHooks().isPowered();
	const count = waveSize(wave.shamblers, night, powered, gameConfig.powerOffWaveMultiplier.Value);
	for (let i = 0; i < count; i++) {
		const spawn = spawns[rng.NextInteger(0, spawns.size() - 1)];
		const offset = new CFrame(rng.NextNumber(-8, 8), 0, rng.NextNumber(-4, 4));
		spawnOne(spawn.mul(offset), night, false);
	}
}

/** Nightfall: schedules tonight's waves over the `nightSeconds` the night lasts. */
export function startNight(night: number, nightSeconds: number, kids: number) {
	generation += 1;
	const mine = generation;
	for (const wave of planNight(night, kids)) {
		task.delay(wave.at * nightSeconds, () => {
			if (generation === mine) {
				spawnWave(wave, night);
			}
		});
	}
}

/** Dawn: no more waves tonight, and everyone still around heads off. */
export function retreatAll() {
	generation += 1;
	for (const [, inf] of alive) {
		inf.entry = undefined;
		if (inf.mode !== "dormant") {
			inf.spot = undefined; // a woken one leaves too; its spot is filled again in the morning
			setMode(inf, "retreat");
		}
	}
}

/** Day: puts a dormant infected at every spot that hasn't got one. Dad waits at `dadSpot` on Day 1. */
export function spawnDormant(spots: CFrame[], night: number, dadSpot?: CFrame) {
	task.spawn(() => {
		while (!templateReady) {
			task.wait(0.5); // the body is still being made
		}
		for (const spot of spots) {
			let taken = false;
			for (const [, inf] of alive) {
				taken = taken || inf.spot === spot;
			}
			if (!taken) {
				spawnOne(spot, night, false, spot);
			}
		}
		if (dadSpot && !isDadAround()) {
			spawnOne(dadSpot, night, true, dadSpot);
		}
	});
}

/** A noise at `position`: wakes dormant infected within `radius` studs. */
export function hearNoise(position: Vector3, radius: number) {
	for (const [, inf] of alive) {
		if (inf.root.Position.sub(position).Magnitude <= radius) {
			wake(inf);
		}
	}
}

export function startInfected(mainWorld: MainWorld, infectedHooks: InfectedHooks) {
	setUpState(mainWorld, infectedHooks);
	task.spawn(() => {
		template = buildTemplate();
		templateReady = true;
	});
}
