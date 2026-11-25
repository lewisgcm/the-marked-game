import { CollectionService } from "@rbxts/services";
import { STREET_LIGHT_TAG } from "shared/core/tags";

/** Switches every street lamp on or off. */
export function setStreetLights(on: boolean) {
	for (const light of CollectionService.GetTagged(STREET_LIGHT_TAG)) {
		if (light.IsA("SpotLight")) {
			light.Enabled = on;
		}
	}
}
