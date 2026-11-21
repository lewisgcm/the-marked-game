import { RitualItemKind } from "shared/ritualItems";

/** Public objective state, published by the server as attributes on ReplicatedStorage. */

/** How many ritual items have been placed on the altar (0..3). */
export const RITUAL_PLACED_ATTRIBUTE = "RitualPlaced";

/** What a hunter is carrying, as sent to that hunter in an "Inventory" message. */
export interface Inventory {
	keys: number;
	items: RitualItemKind[];
}
