import { CollectionService } from "@rbxts/services";

/** Strip lights in the hall that are on their way out (tagged in tools/tiles/lobby/Hall.ts). */
const FAULTY_TAG = "FaultyLight";

/** Turns a strip light (its tube and its light) on or off. */
function setLit(tube: BasePart, lit: boolean) {
	tube.Material = lit ? Enum.Material.Neon : Enum.Material.SmoothPlastic;
	tube.Transparency = lit ? 0 : 0.2;
	const light = tube.FindFirstChildOfClass("PointLight");
	if (light) {
		light.Enabled = lit;
	}
}

/**
 * Every few seconds each faulty strip light stutters: a few quick drop-outs, then back on. Local to each
 * client, so it costs no network traffic.
 */
export function startFaultyLights() {
	const flicker = (tube: Instance) => {
		if (!tube.IsA("BasePart")) {
			return;
		}
		task.spawn(() => {
			while (tube.Parent) {
				task.wait(math.random(20, 80) / 10);
				for (let i = 0; i < math.random(2, 5); i++) {
					setLit(tube, false);
					task.wait(math.random(3, 12) / 100);
					setLit(tube, true);
					task.wait(math.random(3, 20) / 100);
				}
			}
		});
	};
	CollectionService.GetTagged(FAULTY_TAG).forEach(flicker);
	CollectionService.GetInstanceAddedSignal(FAULTY_TAG).Connect(flicker);
}
