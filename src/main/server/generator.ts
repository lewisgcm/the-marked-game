import { CollectionService } from "@rbxts/services";
import { burnFuel, canPour, fuelText, justRanLow, nightsLeft } from "shared/fuel";
import { GENERATOR_TAG } from "shared/tags";
import { UpgradeId } from "shared/upgrades";
import { powerCounts } from "shared/waves";
import { gameConfig } from "./config";
import { takeItem } from "./inventory";
import { inReach, makePrompt, promptAnchor } from "./prompts";
import { Lamp, MainWorld } from "./world";

/**
 * The generator in the garage: a switch for every light in the house. It starts off. With the
 * power off the infected are bolder and more come (infected/, shared/waves.ts). Running it at night
 * burns fuel (rules in shared/fuel.ts), found in cans and poured in here; by day it's free.
 */

export interface GeneratorHooks {
	/** Whether `player` may use prompts right now. */
	canAct: (player: Player) => boolean;
	notify: (player: Player, text: string) => void;
	notifyAll: (text: string) => void;
	/** Danger, for everyone. */
	alertAll: (text: string) => void;
	/** Whether running it costs fuel right now (at night, during play). */
	burnsFuel: () => boolean;
	hasUpgrade: (id: UpgradeId) => boolean;
}

const BULB_ON = new Color3(1, 0.85, 0.6);
const BULB_OFF = new Color3(0.3, 0.28, 0.25);
/** Seconds between fuel updates. */
const TICK = 0.5;

let hooks: GeneratorHooks | undefined;
let lamps: Lamp[] = [];
let switchPrompt: ProximityPrompt | undefined;
let pourPrompt: ProximityPrompt | undefined;
let powered = false;
/** When it was last switched on (os.clock). */
let poweredAt = 0;
let fuel = gameConfig.fuelStart.Value;

export function isPowered(): boolean {
	return powered;
}

/** Whether the infected are kept wary: on, and not only just. */
export function keepsThemWary(): boolean {
	return powerCounts(powered ? os.clock() - poweredAt : undefined, gameConfig.powerSettleSeconds.Value);
}

function burnRate(): number {
	return hooks?.hasUpgrade("TuneUp") ? gameConfig.tuneUpBurnRate.Value : 1;
}

function canFits(): boolean {
	return canPour(fuel, gameConfig.fuelPerCan.Value, gameConfig.fuelTank.Value);
}

/** Updates the prompts' text after anything changes (including buying the tune-up). */
export function refreshGenerator() {
	if (!switchPrompt || !pourPrompt) {
		return;
	}
	switchPrompt.ActionText = powered ? "Switch off" : "Start";
	switchPrompt.ObjectText = `Generator (${fuelText(nightsLeft(fuel, burnRate()))})`;
	pourPrompt.Enabled = canFits();
}

function setPowered(on: boolean) {
	if (on && !powered) {
		poweredAt = os.clock();
	}
	powered = on;
	for (const lamp of lamps) {
		lamp.light.Enabled = on;
		lamp.bulb.Material = on ? Enum.Material.Neon : Enum.Material.SmoothPlastic;
		lamp.bulb.Color = on ? BULB_ON : BULB_OFF;
	}
	refreshGenerator();
}

function onSwitch(player: Player) {
	if (!powered && fuel <= 0) {
		hooks?.notify(player, "It's out of fuel. Find a can and pour it in.");
		return;
	}
	setPowered(!powered);
}

function onPour(player: Player) {
	if (!canFits()) {
		return;
	}
	if (!takeItem(player, "Fuel", 1)) {
		hooks?.notify(player, "You need a fuel can. Try garages and cars.");
		return;
	}
	fuel += gameConfig.fuelPerCan.Value;
	refreshGenerator();
}

function burn(seconds: number) {
	if (!hooks || !powered || !hooks.burnsFuel()) {
		return;
	}
	const rate = burnRate();
	const before = fuel;
	fuel = burnFuel(fuel, seconds, gameConfig.nightSeconds.Value, rate);
	if (fuel <= 0) {
		setPowered(false);
		hooks.alertAll("The generator's out of fuel. The power's off.");
		return;
	}
	if (justRanLow(nightsLeft(before, rate), nightsLeft(fuel, rate), gameConfig.fuelLow.Value)) {
		hooks.notifyAll("The generator's running low on fuel.");
	}
	refreshGenerator();
}

/** Sets up the prompts and turns the house lights off. Call once, after the world is built. */
export function startGenerator(world: MainWorld, generatorHooks: GeneratorHooks) {
	hooks = generatorHooks;
	lamps = world.lamps;
	setPowered(false);
	const machine = CollectionService.GetTagged(GENERATOR_TAG)[0];
	if (!machine || !machine.IsA("BasePart")) {
		warn("[Generator] No generator in the world.");
		return;
	}
	const anchor = promptAnchor(machine, new Vector3(0, 2, 0));
	const connect = (prompt: ProximityPrompt, act: (player: Player) => void) =>
		prompt.Triggered.Connect((player) => {
			if (generatorHooks.canAct(player) && inReach(player, prompt)) {
				act(player);
			}
		});
	switchPrompt = makePrompt(anchor, "Start", Enum.KeyCode.E, gameConfig.holdGenerator.Value);
	connect(switchPrompt, onSwitch);
	pourPrompt = makePrompt(anchor, "Pour in fuel", Enum.KeyCode.F, gameConfig.pourSeconds.Value);
	pourPrompt.UIOffset = new Vector2(0, 70); // below the switch
	connect(pourPrompt, onPour);
	refreshGenerator();

	task.spawn(() => {
		while (true) {
			burn(task.wait(TICK));
		}
	});
}
