import { CollectionService, RunService } from "@rbxts/services";
import { FLICKER_LIGHT_TAG } from "shared/core/tags";

/**
 * Flickers every light tagged FLICKER_LIGHT_TAG, locally on this client. Running it on the
 * client keeps the effect smooth and costs no network traffic (a server-side flicker would
 * replicate every change). Call once from a place's client entry point.
 */
interface Flicker {
	base: number;
	seed: number;
}

export function startFlicker() {
	const lights = new Map<PointLight, Flicker>();

	const track = (instance: Instance) => {
		if (instance.IsA("PointLight") && !lights.has(instance)) {
			lights.set(instance, { base: instance.Brightness, seed: math.random() * 1000 });
		}
	};

	CollectionService.GetTagged(FLICKER_LIGHT_TAG).forEach(track);
	CollectionService.GetInstanceAddedSignal(FLICKER_LIGHT_TAG).Connect(track);
	CollectionService.GetInstanceRemovedSignal(FLICKER_LIGHT_TAG).Connect((instance) => {
		if (instance.IsA("PointLight")) {
			lights.delete(instance);
		}
	});

	RunService.RenderStepped.Connect(() => {
		const t = os.clock();
		for (const [light, flicker] of lights) {
			// Smooth noise plus a faster component reads as a flame rather than a strobe.
			const n = math.noise(t * 2.5, flicker.seed) + 0.4 * math.noise(t * 9, flicker.seed + 50);
			light.Brightness = flicker.base * (1 + n * 0.6);
		}
	});
}
