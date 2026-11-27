import { CollectionService } from "@rbxts/services";
import { BARRICADE_SLOT_TAG } from "shared/core/tags";

/**
 * The house's doorways and windows each have an invisible slot part that stops anyone walking through while
 * it's blocked (main/server/house/barricades.ts). Roblox raycasts always hit a part that can collide, whatever
 * its CanQuery says, so every shot, swing, beam and line of sight leaves these out, and what's drawn in the
 * opening decides instead: glass, a shutter or a shut door stops it; planks don't (there are gaps).
 */
export function openingSlots(): Instance[] {
	return CollectionService.GetTagged(BARRICADE_SLOT_TAG);
}
