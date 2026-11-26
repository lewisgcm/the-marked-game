import { CFrame, turn } from "../lib/cframe.ts";
import {
	fence,
	line,
	log,
	oak,
	pine,
	pointLight,
	scatter,
	signText,
	streetLamp,
	wall,
	type Opening,
} from "../lib/build.ts";
import { Random } from "../lib/random.ts";
import * as S from "../lib/styles.ts";
import type { Style } from "../lib/styles.ts";
import { Tile } from "../lib/tile.ts";

/**
 * The lobby: the school gym hall after the last bell (GAMEPLAY.md §1). Built to build/lobby/Hall.model.json,
 * which Rojo puts straight into the lobby's Workspace, so it shows in Studio without playing
 * (`npm run serve:lobby`).
 *
 * The hall is 100 x 64 inside (x -50..50, z -32..32), 30 tall. The car park's double doors are along the
 * north wall (-z), with a pick-up pad inside each: a `LobbyPad` marker (`Order` 1, 2, 3) where the lobby's
 * code puts each party's zone and billboard (src/lobby/server/world.ts). Players spawn at the south side.
 * The stage is at the east end, its noticeboards on the wall behind (`Noticeboard`, `Board` BestRun or
 * TotalNights) for the leaderboards. High windows on the south and west let the late sun in.
 */

const [HALF_X, HALF_Z, HEIGHT] = [50, 32, 30];
const DOORS = [-30, 0, 30];
const DOOR: [number, number] = [10, 12]; // width, height
const SOUTH_WINDOWS = [-42, -30, -18, -6, 6, 18, 30, 42];
const WEST_WINDOWS = [-18, -6, 6, 18];
const HIGH_WINDOW = (center: number): Opening => [center, 8, 18, 25];

/** A thin flat strip on the floor from (x0, z0) to (x1, z1), its top at `top`. */
function stripe(t: Tile, x0: number, z0: number, x1: number, z1: number, top: number, style: Style, width = 0.3) {
	const length = Math.hypot(x1 - x0, z1 - z0);
	const angle = (Math.atan2(z1 - z0, x1 - x0) * 180) / Math.PI;
	t.part(
		"CourtLine",
		[length, 0.04, width],
		new CFrame((x0 + x1) / 2, top - 0.02, (z0 + z1) / 2).mul(turn(-angle)),
		style,
	);
}

/** An arc of court line round (cx, cz), radius `r`, from angle `a0` to `a1` (degrees from +x towards +z). */
function arc(t: Tile, cx: number, cz: number, r: number, a0: number, a1: number, segments: number) {
	for (let i = 0; i < segments; i++) {
		const [p, q] = [a0 + ((a1 - a0) * i) / segments, a0 + ((a1 - a0) * (i + 1)) / segments].map(
			(a) => (a * Math.PI) / 180,
		);
		// Alternate heights, so neighbours' overlapping ends don't share a top.
		const top = i % 2 === 0 ? 0.025 : 0.03;
		stripe(
			t,
			cx + r * Math.cos(p),
			cz + r * Math.sin(p),
			cx + r * Math.cos(q),
			cz + r * Math.sin(q),
			top,
			S.COURT_LINE,
		);
	}
}

/** The basketball court: centre (-6, 0), 76 x 38, keys and three-point lines at both ends. */
function court(t: Tile) {
	t.folder("Court");
	const [x0, x1, z0, z1, mid] = [-44, 32, -19, 19, -6];
	const w = 0.15; // half a line's width
	stripe(t, x0 - w, z0, x1 + w, z0, 0.02, S.COURT_LINE);
	stripe(t, x0 - w, z1, x1 + w, z1, 0.02, S.COURT_LINE);
	stripe(t, x0, z0 + w, x0, z1 - w, 0.02, S.COURT_LINE);
	stripe(t, x1, z0 + w, x1, z1 - w, 0.02, S.COURT_LINE);
	stripe(t, mid, z0 + w, mid, z1 - w, 0.02, S.COURT_LINE);
	arc(t, mid, 0, 6, 0, 360, 24);
	for (const [baseline, inward] of [
		[x0, 1],
		[x1, -1],
	]) {
		const keyEnd = baseline + inward * 15;
		// The key, painted, and its lines.
		t.slab(
			"Key",
			Math.min(baseline, keyEnd),
			Math.max(baseline, keyEnd),
			-6,
			6,
			0.01,
			S.COURT_KEY,
			undefined,
			0.04,
		);
		stripe(t, baseline + inward * w, -6, keyEnd + inward * w, -6, 0.02, S.COURT_LINE);
		stripe(t, baseline + inward * w, 6, keyEnd + inward * w, 6, 0.02, S.COURT_LINE);
		stripe(t, keyEnd, -6 + w, keyEnd, 6 - w, 0.02, S.COURT_LINE);
		arc(t, keyEnd, 0, 6, inward > 0 ? -90 : 90, inward > 0 ? 90 : 270, 12);
		// The three-point line: straight from the baseline, then round the basket.
		const basket = baseline + inward * 1.6;
		const reach = Math.sqrt(20 * 20 - 17 * 17);
		stripe(t, baseline + inward * w, -17, basket + inward * reach, -17, 0.02, S.COURT_LINE);
		stripe(t, baseline + inward * w, 17, basket + inward * reach, 17, 0.02, S.COURT_LINE);
		const edge = (Math.asin(17 / 20) * 180) / Math.PI;
		if (inward > 0) arc(t, basket, 0, 20, -edge, edge, 16);
		else arc(t, basket, 0, 20, 180 - edge, 180 + edge, 16);
	}
}

/**
 * The walls: brick outside; inside, a painted dado to 10 and pale paint above. Each wall is a brick wall
 * with two thin skins on its inside face, all cut round the same doors and windows.
 */
function walls(t: Tile) {
	t.folder("Walls");
	const doors: Opening[] = DOORS.map((x) => [x, DOOR[0], 0, DOOR[1]]);
	const south = SOUTH_WINDOWS.map(HIGH_WINDOW);
	const west = WEST_WINDOWS.map(HIGH_WINDOW);
	// [along, at (the wall's middle), from, to, openings, which way is in]
	const sides: Array<["X" | "Z", number, number, number, Opening[], number]> = [
		["X", -HALF_Z - 0.5, -HALF_X - 1, HALF_X + 1, doors, 1],
		["X", HALF_Z + 0.5, -HALF_X - 1, HALF_X + 1, south, -1],
		["Z", -HALF_X - 0.5, -HALF_Z, HALF_Z, west, 1],
		["Z", HALF_X + 0.5, -HALF_Z, HALF_Z, [], -1],
	];
	for (const [along, at, from, to, openings, inward] of sides) {
		wall(t, along, at, from, to, 0, HEIGHT, openings, S.HALL_BRICK);
		// The skins: inside the face, and (along X) stopping short of the skins along Z at the corners.
		const skin = at + inward * 0.56;
		const [a, b] = along === "X" ? [-HALF_X + 0.12, HALF_X - 0.12] : [-HALF_Z, HALF_Z];
		const lower = openings
			.filter(([, , bottom]) => bottom < 10)
			.map(([c, w, bottom, top]): Opening => [c, w, bottom, Math.min(top, 10)]);
		const upper = openings
			.filter(([, , , top]) => top > 10)
			.map(([c, w, bottom, top]): Opening => [c, w, Math.max(bottom, 10) - 10, top - 10]);
		wall(t, along, skin, a, b, 0, 10, lower, S.DADO, undefined, 0.12, "Paint");
		wall(t, along, skin, a, b, 10, HEIGHT - 10, upper, S.HALL_PAINT, undefined, 0.12, "Paint");
	}
	// Glass in the high windows, and the late sun slanting in through the south ones.
	for (const [c, w, bottom, top] of south) {
		t.box("Glass", c, (bottom + top) / 2, HALF_Z + 0.5, w, top - bottom, 0.2, S.WINDOW_GLASS);
		sunShaft(t, [c, (bottom + top) / 2, HALF_Z], [c + 5, 0, HALF_Z - 22]);
	}
	for (const [c, w, bottom, top] of west) {
		t.box("Glass", -HALF_X - 0.5, (bottom + top) / 2, c, 0.2, top - bottom, w, S.WINDOW_GLASS);
	}
	// The ceiling, steel trusses under it, and the strip lights hanging from them.
	t.slab("Ceiling", -HALF_X - 1, HALF_X + 1, -HALF_Z - 1, HALF_Z + 1, HEIGHT + 1, S.CEILING);
	for (const x of [-40, -20, 0, 20, 40]) t.box("Truss", x, HEIGHT - 0.8, 0, 0.6, 1.6, HALF_Z * 2, S.STEEL);
	t.folder("Lights");
	let i = 0;
	for (const x of [-30, -10, 10, 30]) {
		for (const z of [-16, 0, 16]) {
			// Two of them buzz and flicker (src/lobby/client: FaultyLight).
			const faulty = i === 4 || i === 9;
			t.box("LightRod", x, HEIGHT - 1.8, z, 0.15, 2.4, 0.15, S.STEEL);
			t.box("StripLight", x, HEIGHT - 3, z, 6, 0.3, 0.7, S.STRIP_LIGHT, undefined, {
				tags: faulty ? ["FaultyLight"] : undefined,
				children: [pointLight([0.92, 0.95, 1], 36, 0.9)],
			});
			i++;
		}
	}
}

/** A shaft of hazy light from `from` to `to`: a long, nearly clear box between them. */
function sunShaft(t: Tile, from: [number, number, number], to: [number, number, number]) {
	const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
	const length = Math.hypot(...d);
	const u = d.map((v) => v / length); // its length runs along its Y
	const r0 = [u[1], -u[0], 0];
	const rl = Math.hypot(...r0);
	const r = r0.map((v) => v / rl);
	const b = [r[1] * u[2] - r[2] * u[1], r[2] * u[0] - r[0] * u[2], r[0] * u[1] - r[1] * u[0]];
	const rotation: [[number, number, number], [number, number, number], [number, number, number]] = [
		[r[0], u[0], b[0]],
		[r[1], u[1], b[1]],
		[r[2], u[2], b[2]],
	];
	const middle = from.map((v, k) => v + d[k] / 2) as [number, number, number];
	t.part("SunShaft", [7, length, 4], new CFrame(...middle, rotation), S.SUN_SHAFT);
}

/** The doors to the car park: open double doors, an EXIT sign over each, a pick-up pad inside. */
function doors(t: Tile) {
	t.folder("Doors");
	const [w, h] = DOOR;
	DOORS.forEach((x, k) => {
		// Thresholds in the gap the wall leaves under each door.
		t.slab("Threshold", x - w / 2, x + w / 2, -HALF_Z - 1, -HALF_Z, 0.03, S.CONCRETE);
		t.box("DoorFrame", x, h + 0.4, -HALF_Z - 0.5, w + 1.2, 0.8, 1.3, S.STEEL);
		for (const side of [-1, 1]) {
			t.box("DoorFrame", x + side * (w / 2 + 0.3), h / 2, -HALF_Z - 0.5, 0.6, h, 1.3, S.STEEL);
			// Each leaf swung right out, against the outside wall.
			const hinge = new CFrame(x + side * (w / 2), 0, -HALF_Z - 1.15).mul(turn(side * -100));
			t.box("DoorLeaf", side * -2.5, h / 2 - 0.3, 0, 5, h - 0.6, 0.3, S.DADO, hinge);
			t.box("DoorBar", side * -2.5, 4, -0.25, 4, 0.25, 0.2, S.STEEL, hinge);
		}
		t.box("ExitSign", x, h + 1.6, -HALF_Z + 0.25, 3, 1, 0.3, S.EXIT_SIGN, undefined, {
			children: [signText("EXIT", "Back", [1, 1, 1])],
		});

		// The pick-up pad inside the door: a yellow box painted on the floor, and the marker for the lobby.
		t.folder("Pads");
		const [p0, p1, q0, q1] = [x - 5, x + 5, -HALF_Z + 2, -HALF_Z + 12];
		line(t, p0, q0, p1, q0, 0.5, S.PICKUP);
		line(t, p0, q1, p1, q1, 0.5, S.PICKUP);
		line(t, p0, q0 + 0.25, p0, q1 - 0.25, 0.5, S.PICKUP);
		line(t, p1, q0 + 0.25, p1, q1 - 0.25, 0.5, S.PICKUP);
		// Words on a floor run along the part's Z, so it's turned to read from the hall (top towards the door).
		t.part("PadWords", [2.4, 0.02, 7], new CFrame(x, 0.03, q1 - 2.2).mul(turn(-90)), S.PICKUP, {
			properties: { Transparency: 1 },
			children: [signText("PICK UP", "Top", [0.95, 0.78, 0.15])],
		});
		t.box("LobbyPad", x, 2.5, (q0 + q1) / 2, 2, 5, 1, S.MARKER, undefined, {
			tags: ["LobbyPad"],
			attributes: { Order: `${k + 1}` },
		});
		t.folder("Doors");
	});
}

/** The stage at the east end: steps up, red curtains, the noticeboards on the wall behind. */
function stage(t: Tile) {
	t.folder("Stage");
	const [front, top] = [38, 4];
	t.slab("Stage", front, HALF_X, -26, 26, top, S.WOOD, undefined, top);
	[1.33, 2.67, 4].forEach((y, i) =>
		t.slab("Step", front - 3.75 + 1.25 * i, front - 2.5 + 1.25 * i, 18, 24, y, S.WOOD, undefined, y),
	);
	for (const z of [-24, 24]) t.box("Curtain", front + 0.6, 13, z, 1, 18, 4, S.CURTAIN);
	t.box("Pelmet", front + 0.6, 21, 0, 1, 2, 52, S.CURTAIN);
	for (const [z, board, title] of [
		[-7, "BestRun", "BEST RUN"],
		[7, "TotalNights", "TOTAL NIGHTS"],
	] as const) {
		const at = new CFrame(HALF_X - 0.3, 0, z).mul(turn(90));
		t.box("BoardFrame", 0, 12.5, 0.05, 12.8, 8.8, 0.3, S.WOOD_DARK, at);
		t.box("Noticeboard", 0, 12.5, -0.15, 12, 8, 0.2, S.CORK, at, {
			tags: ["Noticeboard"],
			attributes: { Board: board },
		});
		t.box("BoardTitle", 0, 17.8, -0.1, 10, 1.6, 0.2, S.WOOD_DARK, at, { children: [signText(title)] });
	}
}

/** Kit along the walls: wall bars, crash mats, hoops, the coats and bags, the news on its trolley. */
function kit(t: Tile) {
	const random = new Random(5);
	// Wall bars on the west wall, south of its hoop.
	t.folder("WallBars");
	const barX = -HALF_X + 0.9;
	for (let z = 12; z <= 28; z += 4) t.box("BarPost", barX, 8, z, 0.5, 16, 0.5, S.WOOD);
	for (let z = 12; z < 28; z += 4) {
		for (let y = 1; y <= 15; y++) log(t, "Bar", 4, 0.3, new CFrame(barX, y, z + 2).mul(turn(90)), S.WOOD);
	}
	// Crash mats stacked in the north-west corner.
	t.folder("Mats");
	for (let i = 0; i < 4; i++) {
		t.box(
			"CrashMat",
			0,
			0.5 + i,
			0,
			8,
			1,
			5,
			S.MAT_BLUE,
			new CFrame(-44 + random.between(-0.3, 0.3), 0, -26.5).mul(turn(random.between(-4, 4))),
		);
	}
	// The hoops: one on the west wall, one hanging from the roof at the east end.
	t.folder("Hoops");
	hoop(t, -42.4, 1, () => {
		t.box("HoopArm", -46.2, 12.6, 0, 7.6, 0.4, 0.4, S.STEEL);
		t.box("HoopArm", -46.2, 11.4, 0, 7.6, 0.4, 0.4, S.STEEL);
	});
	hoop(t, 30.4, -1, () => {
		t.box("HoopArm", 31.4, 21.8, 0, 0.4, 16.4, 0.4, S.STEEL);
		t.box("HoopArm", 31, 13.6, 0, 1.2, 0.4, 0.4, S.STEEL);
	});
	// Coats on hooks along the south wall, a bench under them, bags on it and on the floor.
	t.folder("LostProperty");
	t.box("HookRail", 0, 6.6, HALF_Z - 0.3, 72, 0.4, 0.2, S.WOOD);
	t.box("Bench", 0, 1.6, HALF_Z - 1.3, 72, 0.3, 1.6, S.WOOD);
	for (const x of [-34, -17, 0, 17, 34]) t.box("BenchLeg", x, 0.75, HALF_Z - 1.3, 0.4, 1.5, 1.4, S.STEEL);
	const colours: Array<[number, number, number]> = [
		[0.2, 0.25, 0.45],
		[0.55, 0.12, 0.12],
		[0.18, 0.35, 0.2],
		[0.6, 0.45, 0.15],
		[0.3, 0.3, 0.32],
		[0.45, 0.2, 0.45],
	];
	const fabric = () => S.fabric(colours[Math.floor(random.between(0, colours.length - 0.01))]);
	for (let x = -34; x <= 34; x += 3) {
		if (random.between(0, 1) < 0.3) continue;
		t.box(
			"Coat",
			0,
			-1.9,
			0,
			1.9,
			3.8,
			0.6,
			fabric(),
			new CFrame(x, 6.6, HALF_Z - 0.75).mul(turn(random.between(-6, 6))),
		);
	}
	for (let x = -33; x <= 33; x += 2.6) {
		if (random.between(0, 1) < 0.45) continue;
		const onBench = random.between(0, 1) < 0.5;
		const at = new CFrame(x, onBench ? 1.75 : 0, onBench ? HALF_Z - 1.3 : HALF_Z - 3).mul(
			turn(random.between(-25, 25)),
		);
		bag(t, at, fabric());
	}
	// The news on a trolley by the stage, facing the pads.
	t.folder("Trolley");
	const trolley = new CFrame(34, 0, -22).mul(turn(90));
	for (const y of [0.8, 3]) t.box("Shelf", 0, y, 0, 3.4, 0.2, 2, S.STEEL, trolley);
	for (const [x, z] of [
		[-1.5, -0.8],
		[1.5, -0.8],
		[-1.5, 0.8],
		[1.5, 0.8],
	])
		t.box("TrolleyLeg", x, 1.6, z, 0.2, 3.2, 0.2, S.STEEL, trolley);
	t.box("TV", 0, 4.6, 0, 4.2, 2.8, 0.6, S.METAL, trolley);
	t.box("Screen", 0, 4.6, -0.32, 3.8, 2.4, 0.06, S.SCREEN, trolley, {
		tags: ["HallScreen"],
		children: [
			signText("BREAKING: STRANGE SIGNAL ON TV AND RADIO ACROSS THE COUNTY", "Front", [1, 1, 1]),
			pointLight([0.55, 0.75, 1], 10, 0.8),
		],
	});
}

/** A hoop at backboard x `board`, facing +x (`facing` 1) or -x: board, ring, and its `supports`. */
function hoop(t: Tile, board: number, facing: number, supports: () => void) {
	t.box("Backboard", board, 11.8, 0, 0.3, 3.6, 6, S.CEILING);
	t.box("BoardSquare", board + facing * 0.17, 11, 0, 0.04, 1.4, 2, S.COURT_KEY);
	const ring = board + facing * 1.1;
	for (let i = 0; i < 8; i++) {
		const a = (i * 45 * Math.PI) / 180;
		t.box(
			"Ring",
			0,
			0,
			0,
			0.75,
			0.12,
			0.12,
			S.ORANGE,
			new CFrame(ring + 0.9 * Math.cos(a), 10.2, 0.9 * Math.sin(a)).mul(turn(-i * 45 - 90)),
		);
	}
	supports();
}

/** A school bag at `at` (on the floor, or a bench): a body, a pocket and a strap. */
function bag(t: Tile, at: CFrame, style: Style) {
	t.box("Bag", 0, 0.9, 0, 1.6, 1.8, 0.9, style, at);
	t.box("BagPocket", 0, 0.6, -0.5, 1.2, 0.8, 0.25, style, at);
	t.box("BagStrap", 0, 1.95, 0, 0.9, 0.15, 0.15, S.ROAD, at);
}

/** Outside the doors: the car park, a pavement along the wall, lamps, trees and a fence beyond. */
function carPark(t: Tile) {
	t.folder("CarPark");
	t.slab("Tarmac", -75, 75, -86, -HALF_Z - 5, 0, S.ROAD, undefined, 1);
	t.slab("Pavement", -75, 75, -HALF_Z - 5, -HALF_Z - 1, 0.2, S.PAVING, undefined, 1.2);
	for (let x = -64; x <= 64; x += 8) t.box("BayLine", x, 0.1, -58, 0.4, 0.1, 12, S.ROAD_LINE);
	for (const x of [-48, 0, 48]) streetLamp(t, new CFrame(x, 0, -66).mul(turn(180)));
	t.folder("Trees");
	scatter(
		t,
		10,
		11,
		[
			[-100, 100, -76, 100],
			[-100, 100, -86, -82],
			[-100, -72, -100, 100],
			[72, 100, -100, 100],
		],
		new Random(11),
		(tile, x, z, r) => (r.between(0, 1) < 0.6 ? pine : oak)(tile, x, z, r),
	);
	fence(t, -74, -84, 74, -84);
	// Invisible walls round the car park, so nobody walks off.
	for (const [x, z, sx, sz] of [
		[-76, -59.5, 1, 53],
		[76, -59.5, 1, 53],
		[0, -87, 153, 1],
	]) {
		t.box("Boundary", x, 20, z, sx, 40, sz, S.COLLIDER);
	}
}

export function lobbyHall(): Tile {
	const t = new Tile("Hall");
	t.slab("Floor", -HALF_X, HALF_X, -HALF_Z, HALF_Z, 0, S.GYM_FLOOR);
	court(t);
	walls(t);
	doors(t);
	stage(t);
	kit(t);
	carPark(t);
	t.folder("Spawn");
	t.part("LobbySpawn", [8, 0.2, 8], new CFrame(0, 0.1, 22), S.COLLIDER, {
		className: "SpawnLocation",
		properties: { Neutral: true, Duration: 0, CanCollide: false },
	});
	return t;
}
