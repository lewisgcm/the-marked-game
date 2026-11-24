/**
 * The ghost prototype's ritual items, which still decorate the lobby pedestals (until M6).
 */

export type RitualItemKind = "Book" | "Candles" | "Skull";

/**
 * Mesh heights in studs (the low-poly lobby kit, tools/blender/assets/lobby_kit.py; see
 * src/shared/kitManifest.ts). A MeshPart's position is its centre, so placing one on a surface
 * means lifting it by half of this.
 */
export const RITUAL_ITEM_HEIGHT: Record<RitualItemKind, number> = {
	Book: 0.545,
	Candles: 1.27,
	Skull: 1.1,
};

/** Page colour for the plain-part fallback book (the low-poly mesh has its pages built in). */
export const PAGE_COLOR = new Color3(0.85, 0.8, 0.66);
