import { CollectionService } from "@rbxts/services";
import { BaseId, findBase } from "shared/economy/bases";
import { TRADER_TAG } from "shared/core/tags";
import { loadModel, standMesh } from "./models";
import { buildNpc, NpcLook } from "./npc";

/**
 * The bases' people and props. Their buildings are map tiles (MAP.md): each has a counter tagged
 * Trader (trading.ts) with a "Base" attribute; this stands that base's trader behind it.
 */

/** The Fire Station's engine (tools/blender/assets/fire_engine.py), owned by the game's owner. */
const ENGINE_MODEL = 93513592432736;

/** Who trades at each base. */
const TRADERS: Record<BaseId, NpcLook> = {
	Treehouse: {
		name: findBase("Treehouse").trader,
		skin: new Color3(0.8, 0.62, 0.5),
		top: new Color3(0.3, 0.5, 0.35),
		legs: new Color3(0.25, 0.3, 0.45),
		scale: 0.75,
	},
	FireStation: {
		name: findBase("FireStation").trader,
		skin: new Color3(0.6, 0.45, 0.36),
		top: new Color3(0.2, 0.2, 0.24),
		legs: new Color3(0.75, 0.6, 0.2),
		scale: 1,
	},
};

/**
 * Stands each base's trader behind its counter in `map`, and swaps each Fire Station's red block
 * (a part named Engine) for the engine's model. Models load in the background.
 */
export function staffBases(map: Instance) {
	for (const counter of CollectionService.GetTagged(TRADER_TAG)) {
		const base = counter.GetAttribute("Base") as BaseId | undefined;
		const look = base !== undefined ? TRADERS[base] : undefined; // undefined for a misspelt Base
		if (counter.IsA("BasePart") && counter.IsDescendantOf(map) && look) {
			// The counter's middle is 1.5 above the floor; the trader stands 3 behind it, facing out.
			task.spawn(() => buildNpc(counter.Parent!, look, counter.CFrame.mul(new CFrame(0, -1.5, 3))));
		}
	}
	for (const block of map.GetDescendants()) {
		if (block.IsA("BasePart") && block.Name === "Engine") {
			task.spawn(() => {
				const model = loadModel(ENGINE_MODEL, "the fire engine, so it's a plain block");
				// The block's middle is 4.2 above the floor.
				if (standMesh(model, "FireEngine", block.Parent!, block.CFrame.mul(new CFrame(0, -4.2, 0)))) {
					block.Destroy();
				}
				model?.Destroy();
			});
		}
	}
}
