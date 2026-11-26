/**
 * Place IDs from the Roblox Creator Dashboard (each place's own ID, not the experience ID). Both places must
 * be in the same experience: the lobby teleports parties to a reserved main-game server, and the party list
 * goes through MemoryStore, which is per experience.
 * Typed as `number` so the "not configured yet" checks (`=== 0`) still type-check.
 */
// Set 26 Nov 2026, when the game was first published (privately) for end-to-end testing.
export const LOBBY_PLACE_ID: number = 140014462358696;
export const MAIN_GAME_PLACE_ID: number = 106019255941993;
