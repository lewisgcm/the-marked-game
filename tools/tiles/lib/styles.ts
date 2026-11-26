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

// Patches on the ground (lib/build.ts → Ground): only 0.03 proud, so they needn't collide.
const FLAT = { collide: false, shadow: false };
export const GRASS_DARK = style("Grass", [0.25, 0.36, 0.19], FLAT);
export const GRASS_DRY = style("Grass", [0.43, 0.46, 0.27], FLAT);
export const DIRT_PATCH = style("Ground", [0.38, 0.31, 0.22], FLAT);
export const LEAF_LITTER = style("Ground", [0.31, 0.25, 0.17], FLAT);
export const MOSS = style("LeafyGrass", [0.17, 0.29, 0.13], FLAT);

// Streets.
export const ROAD = style("Asphalt", [0.18, 0.18, 0.19]);
export const PAVING = style("Pavement", [0.62, 0.62, 0.6]);
export const KERB = style("Concrete", [0.74, 0.74, 0.72]);
export const ROAD_LINE = style("SmoothPlastic", [0.75, 0.72, 0.6], { shadow: false, collide: false });
export const EDGE_LINE = style("SmoothPlastic", [0.86, 0.86, 0.83], { shadow: false, collide: false });
export const YELLOW_LINE = style("SmoothPlastic", [0.85, 0.7, 0.2], { shadow: false, collide: false });
export const DRAIN = style("Metal", [0.17, 0.17, 0.18], { shadow: false, collide: false });
export const VERGE = style("Ground", [0.37, 0.32, 0.24]);
export const BEACON = style("Neon", [1, 0.62, 0.12], { shadow: false });

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
export const BARRIER_RED = style("SmoothPlastic", [0.8, 0.12, 0.1]);
export const BARRIER_WHITE = style("SmoothPlastic", [0.95, 0.95, 0.95]);
export const HEDGE = style("Grass", [0.2, 0.34, 0.17]);

// Plants.
export const BARK = style("Wood", [0.33, 0.24, 0.17]);
export const DEAD_WOOD = style("Wood", [0.3, 0.28, 0.25]);
export const LEAVES = style("Grass", [0.24, 0.4, 0.2], { collide: false });
export const PINE_NEEDLES = style("LeafyGrass", [0.14, 0.26, 0.16], { collide: false });
export const REEDS = style("Grass", [0.4, 0.45, 0.22], { collide: false, shadow: false });

// The lobby's gym hall (tools/tiles/lobby).
export const GYM_FLOOR = style("WoodPlanks", [0.8, 0.6, 0.38]);
export const COURT_LINE = style("SmoothPlastic", [0.93, 0.92, 0.88], { shadow: false, collide: false });
export const COURT_KEY = style("SmoothPlastic", [0.62, 0.22, 0.18], { shadow: false, collide: false });
export const HALL_BRICK = style("Brick", [0.55, 0.3, 0.24]);
export const DADO = style("SmoothPlastic", [0.42, 0.55, 0.47]);
export const HALL_PAINT = style("SmoothPlastic", [0.86, 0.84, 0.76]);
export const CEILING = style("SmoothPlastic", [0.9, 0.9, 0.88]);
export const STEEL = style("Metal", [0.42, 0.45, 0.5]);
export const STRIP_LIGHT = style("Neon", [0.95, 0.97, 1], { shadow: false });
export const WINDOW_GLASS = style("Glass", [0.95, 0.85, 0.62], { transparency: 0.55, shadow: false });
export const SUN_SHAFT = style("Neon", [1, 0.84, 0.55], { transparency: 0.93, shadow: false, collide: false });
export const MAT_BLUE = style("Fabric", [0.18, 0.32, 0.62]);
export const CURTAIN = style("Fabric", [0.45, 0.08, 0.1]);
export const CORK = style("Wood", [0.62, 0.45, 0.28]);
export const PICKUP = style("SmoothPlastic", [0.95, 0.78, 0.15], { shadow: false, collide: false });
export const EXIT_SIGN = style("Neon", [0.15, 0.75, 0.3], { shadow: false });
export const WOOD_DARK = style("Wood", [0.3, 0.2, 0.13]);
export const ORANGE = style("SmoothPlastic", [0.9, 0.42, 0.1]);
/** Cloth in any colour (coats, bags). */
export const fabric = (color: [number, number, number]): Style => style("Fabric", color);

/** What a mesh collides with: an invisible plain part inside it (meshes in tiles don't collide). */
export const COLLIDER = style("SmoothPlastic", [1, 1, 1], { transparency: 1, shadow: false });

/** Markers: seen in Studio, hidden by the game. */
export const MARKER = style("Neon", [1, 0.2, 0.2], { transparency: 0.5, collide: false, shadow: false });
/** Where something built by the game's code goes (the family house). */
export const PLOT = style("ForceField", [0.3, 0.55, 1], { transparency: 0.6, collide: false, shadow: false });
