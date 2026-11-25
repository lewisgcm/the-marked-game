/** What parts are made of. One place, so every tile looks like part of the same world. */

export interface Style {
	material: string;
	color: [number, number, number];
	collide?: boolean;
	shadow?: boolean;
	transparency?: number;
}

const style = (material: string, color: [number, number, number], extra: Partial<Style> = {}): Style => ({
	material,
	color,
	...extra,
});

// Ground.
export const GRASS = style("Grass", [0.3, 0.42, 0.22]);
export const FOREST_FLOOR = style("LeafyGrass", [0.2, 0.3, 0.15]);
export const MUD = style("Mud", [0.24, 0.21, 0.15]);
export const DIRT = style("Ground", [0.36, 0.28, 0.2]);
export const WATER = style("Glass", [0.16, 0.24, 0.18], { transparency: 0.35, collide: false, shadow: false });

// Streets.
export const ROAD = style("Asphalt", [0.18, 0.18, 0.19]);
export const PAVING = style("Concrete", [0.6, 0.6, 0.58]);
export const ROAD_LINE = style("SmoothPlastic", [0.75, 0.72, 0.6], { shadow: false, collide: false });

// Buildings.
export const HOUSE_WALL = style("SmoothPlastic", [0.72, 0.74, 0.7]);
export const FLOORBOARDS = style("WoodPlanks", [0.46, 0.36, 0.27]);
export const ROOF = style("Slate", [0.3, 0.2, 0.18]);
export const WOOD = style("Wood", [0.45, 0.33, 0.22]);
export const BARN_WALL = style("WoodPlanks", [0.5, 0.2, 0.16]);
export const METAL = style("Metal", [0.5, 0.52, 0.56]);
export const SCREEN = style("Neon", [0.55, 0.75, 0.95], { shadow: false });
export const CANVAS = style("Fabric", [0.4, 0.42, 0.28]);
export const HAY = style("Fabric", [0.72, 0.6, 0.3]);
export const STONE = style("Slate", [0.5, 0.49, 0.47]);
export const BRICK = style("Brick", [0.6, 0.25, 0.2]);
export const CONCRETE = style("Concrete", [0.55, 0.55, 0.55]);
export const FIRE_RED = style("Metal", [0.75, 0.12, 0.1]);
export const LAMP = style("Neon", [1, 0.95, 0.85]);
export const HEDGE = style("Grass", [0.2, 0.34, 0.17]);

// Plants.
export const BARK = style("Wood", [0.33, 0.24, 0.17]);
export const DEAD_WOOD = style("Wood", [0.3, 0.28, 0.25]);
export const LEAVES = style("Grass", [0.24, 0.4, 0.2], { collide: false });
export const PINE_NEEDLES = style("LeafyGrass", [0.14, 0.26, 0.16], { collide: false });
export const REEDS = style("Grass", [0.4, 0.45, 0.22], { collide: false, shadow: false });

/** Markers: seen in Studio, hidden by the game. */
export const MARKER = style("Neon", [1, 0.2, 0.2], { transparency: 0.5, collide: false, shadow: false });
/** Where something built by the game's code goes (the family house). */
export const PLOT = style("ForceField", [0.3, 0.55, 1], { transparency: 0.6, collide: false, shadow: false });
