import { CollectionService } from "@rbxts/services";
import { GENERATOR_TAG } from "shared/tags";
import { inReach, makePrompt, promptAnchor } from "./prompts";
import { Lamp, MainWorld } from "./world";

/**
 * The generator in the garage: a switch for every light in the house. It starts off. With the
 * power off the infected are bolder and more come (infected.ts, shared/waves.ts). Fuel, the cost
 * of leaving it on, arrives with trading (M3).
 */

export interface GeneratorHooks {
	/** Whether `player` may use prompts right now. */
	canAct: (player: Player) => boolean;
	/** The power went on or off. */
	onChanged: (powered: boolean) => void;
}

const BULB_ON = new Color3(1, 0.85, 0.6);
const BULB_OFF = new Color3(0.3, 0.28, 0.25);

let powered = false;

export function isPowered(): boolean {
	return powered;
}

function showLamps(lamps: Lamp[]) {
	for (const lamp of lamps) {
		lamp.light.Enabled = powered;
		lamp.bulb.Material = powered ? Enum.Material.Neon : Enum.Material.SmoothPlastic;
		lamp.bulb.Color = powered ? BULB_ON : BULB_OFF;
	}
}

/** Sets up the switch and turns the house lights off. Call once, after the world is built. */
export function startGenerator(world: MainWorld, hooks: GeneratorHooks) {
	showLamps(world.lamps);
	const machine = CollectionService.GetTagged(GENERATOR_TAG)[0];
	if (!machine || !machine.IsA("BasePart")) {
		warn("[Generator] No generator in the world.");
		return;
	}
	const prompt = makePrompt(promptAnchor(machine, new Vector3(0, 2, 0)), "Start", Enum.KeyCode.E, 0.8);
	prompt.ObjectText = "Generator";
	prompt.Triggered.Connect((player) => {
		if (!hooks.canAct(player) || !inReach(player, prompt)) {
			return;
		}
		powered = !powered;
		prompt.ActionText = powered ? "Switch off" : "Start";
		showLamps(world.lamps);
		hooks.onChanged(powered);
	});
}
