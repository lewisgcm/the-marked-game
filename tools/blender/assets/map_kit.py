"""The map kit: the trees, hedges, fences, rocks, hay, reeds, lamps and camp things the map's tiles are
dressed with, each its own mesh in one FBX (one import).

Models go straight into the tile files (MAP.md → Making a tile), drawn at the size they're made: a mesh
can't be scaled there. So anything that comes in sizes comes as variants (Pine_A, _B, _C), and fences come
as rails of fixed lengths between posts.

Every prop stands on z = 0 at its own origin, its front facing -Y (Roblox -Z). Roblox centres a mesh on its
bounding box, so this build also writes tools/tiles/lib/mapKit.ts (lib/tilekit.py): each prop's size and where its middle
sits from its base point, which the tile builder uses to stand it on the ground.
"""

import math
import random

import bmesh
import bpy
from mathutils import Vector

from lib import lowpoly, palette, tilekit

EMBED_PALETTE = True
PREVIEW_DIRECTION = (0.35, -1.0, 0.95)
PREVIEW_MARGIN = 0.74
PREVIEW_BACKGROUND = (0.10, 0.11, 0.13)


# --- pieces ---------------------------------------------------------------------------------


def prism(name, base, top, r_base, r_top, sides, swatch, phase=0.0):
	bm = bmesh.new()
	lowpoly.tapered_prism(bm, Vector(base), Vector(top), r_base, r_top, sides, phase)
	ob = lowpoly.to_object(name, bm)
	palette.paint(ob, swatch)
	return ob


def blob(name, size, at, swatch, seed, roughness=0.12):
	"""A lumpy low-poly ball, `size` across: tree crowns, hedges."""
	rng = random.Random(seed)
	bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.5)
	ob = bpy.context.object
	ob.name = name
	for vert in ob.data.vertices:
		vert.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * roughness
		vert.co = Vector((vert.co.x * size[0], vert.co.y * size[1], vert.co.z * size[2])) + Vector(at)
	ob.data.update()
	ob.data.materials.append(palette.material())
	palette.paint(ob, swatch)
	palette.flat(ob)
	return ob


def shade_under(ob, swatch, below=-0.2):
	palette.paint_where(ob, swatch, lambda f: f.normal.z < below)


# --- trees ----------------------------------------------------------------------------------


def pine(name, height, width, seed):
	"""A trunk and three tiers of needles."""
	rng = random.Random(seed)
	parts = [prism(f"{name}_trunk", (0, 0, 0), (0, 0, height * 0.72), 0.9, 0.35, 6, "bark")]
	for i, (k0, k1, scale) in enumerate(((0.2, 0.56, 1.0), (0.42, 0.78, 0.74), (0.62, 1.0, 0.46))):
		r = width / 2 * scale
		bottom, top = height * k0, height * k1
		parts.append(prism(f"{name}_tier{i}", (0, 0, bottom), (0, 0, top), r, 0.15, 7, "pine", rng.uniform(0, 1)))
		# A skirt under each tier, so it reads as a cone from below too.
		parts.append(prism(f"{name}_skirt{i}", (0, 0, bottom - 0.6), (0, 0, bottom), r * 0.55, r, 7, "pine_dark"))
	ob = lowpoly.join(parts, name)
	lowpoly.jitter(ob, 0.18, seed)
	shade_under(ob, "pine_dark")
	return ob


def oak(name, trunk, width, seed):
	"""A broad tree: a trunk forking into two limbs under a crown of leafy lumps."""
	rng = random.Random(seed)
	parts = [prism(f"{name}_trunk", (0, 0, 0), (0, 0, trunk * 0.7), 1.05, 0.75, 6, "bark")]
	for i, angle in enumerate((rng.uniform(0, 1), rng.uniform(2.5, 3.6))):
		tip = (math.cos(angle) * width * 0.22, math.sin(angle) * width * 0.22, trunk + 0.6)
		parts.append(prism(f"{name}_limb{i}", (0, 0, trunk * 0.62), tip, 0.7, 0.4, 5, "bark"))
	crown = trunk + width * 0.28
	lumps = [((0, 0, crown), (width, width, width * 0.62))]
	for i in range(4):
		a = i * math.pi / 2 + rng.uniform(-0.4, 0.4)
		at = (math.cos(a) * width * 0.28, math.sin(a) * width * 0.28, crown + rng.uniform(-0.6, 1.2))
		lumps.append((at, (width * 0.58, width * 0.58, width * 0.48)))
	lumps.append(((rng.uniform(-1, 1), rng.uniform(-1, 1), crown + width * 0.32), (width * 0.55, width * 0.55, width * 0.4)))
	for j, (at, size) in enumerate(lumps):
		parts.append(blob(f"{name}_leaves{j}", size, at, "leaf", seed * 10 + j))
	ob = lowpoly.join(parts, name)
	shade_under(ob, "leaf_dark", -0.35)
	palette.paint_where(ob, "bark", lambda f: f.calc_center_median().z < trunk * 0.62)
	return ob


def dead_tree(name, height, seed):
	"""A bare, grey tree for the swamp (the lobby's gnarled tree, bleached)."""
	ob = lowpoly.dead_tree(name, height, seed=seed)
	palette.paint(ob, "dead_wood")
	shade_under(ob, "dead_wood_dark")
	return ob


# --- ground cover ---------------------------------------------------------------------------


def reeds(name, seed):
	"""A clump of reeds, a couple with bulrush heads."""
	rng = random.Random(seed)
	parts = []
	for i in range(12):
		x, y = rng.uniform(-1.4, 1.4), rng.uniform(-1.4, 1.4)
		height = rng.uniform(2.8, 4.6)
		lean = (x + rng.uniform(-0.6, 0.6), y + rng.uniform(-0.6, 0.6), height)
		parts.append(prism(f"{name}_blade{i}", (x, y, 0), lean, 0.24, 0.03, 4, "reed", rng.uniform(0, 2)))
		if i < 3:
			k = 0.8
			at = Vector((x, y, 0)).lerp(Vector(lean), k)
			parts.append(prism(f"{name}_head{i}", at, at + (Vector(lean) - Vector((x, y, 0))) * 0.14, 0.2, 0.2, 5, "reed_head"))
	return lowpoly.join(parts, name)


def hedge(name, length, seed):
	"""A clipped hedge `length` long along X, 3 wide and 3 tall: a box with lumpy sides."""
	rng = random.Random(seed)
	parts = [lowpoly.box(f"{name}_core", (length - 0.6, 2.4, 2.6), (0, 0, 1.3), "hedge_dark")]
	count = int(length / 2.4)
	for i in range(count):
		x = -length / 2 + 1.3 + i * (length - 2.6) / (count - 1)
		parts.append(blob(f"{name}_lump{i}", (2.9, 3.0, 3.0), (x, 0, 1.5 + rng.uniform(-0.1, 0.1)), "hedge", seed + i, 0.08))
	ob = lowpoly.join(parts, name)
	# Flat on the ground.
	for vert in ob.data.vertices:
		vert.co.z = max(vert.co.z, 0.0)
	ob.data.update()
	shade_under(ob, "hedge_dark")
	return ob


def hay_bale(name, seed):
	"""A rectangular bale, 5 long (X), 4 deep, 3 tall, tied twice."""
	ob = lowpoly.box(f"{name}_bale", (5, 4, 3), (0, 0, 1.5), "hay")
	bands = [lowpoly.box(f"{name}_twine{i}", (0.25, 4.08, 3.08), (x, 0, 1.5), "hay_dark") for i, x in enumerate((-1.3, 1.3))]
	ob = lowpoly.join([ob, *bands], name)
	lowpoly.jitter(ob, 0.06, seed)
	return ob


# --- fences, lamps, camp ------------------------------------------------------------------------


def fence_rails(name, length, seed):
	"""Two rails `length` long along X, between posts (FencePost) at either end."""
	rng = random.Random(seed)
	parts = []
	for i, z in enumerate((1.2, 2.4)):
		sag = rng.uniform(-0.06, 0.06)
		parts.append(lowpoly.box(f"{name}_rail{i}", (length, 0.3, 0.5), (0, 0, z + sag), "wood"))
	ob = lowpoly.join(parts, name)
	lowpoly.jitter(ob, 0.03, seed, keep_bottom=False)
	return ob


def fence_post(name):
	ob = lowpoly.join(
		[
			lowpoly.box(f"{name}_post", (0.6, 0.6, 3.0), (0, 0, 1.5), "wood_dark"),
			prism(f"{name}_cap", (0, 0, 3.0), (0, 0, 3.3), 0.42, 0.05, 4, "wood_dark", math.pi / 4),
		],
		name,
	)
	return ob


def street_lamp(name):
	"""A lamp post 14 tall, its head hanging out over the road (-Y): the light comes from the tile."""
	parts = [
		prism(f"{name}_foot", (0, 0, 0), (0, 0, 0.6), 0.55, 0.45, 6, "iron"),
		prism(f"{name}_pole", (0, 0, 0.6), (0, 0, 14.2), 0.3, 0.2, 6, "iron_light"),
		lowpoly.box(f"{name}_arm", (0.25, 2.2, 0.25), (0, -1.0, 14.1), "iron_light"),
		lowpoly.box(f"{name}_head", (1.6, 2.6, 0.5), (0, -1.6, 14.0), "iron"),
		lowpoly.box(f"{name}_glass", (1.3, 2.2, 0.08), (0, -1.6, 13.72), "lantern_glow"),
	]
	return lowpoly.join(parts, name)


def tent(name):
	"""A ridge tent, 9 wide (X), 10 long (Y, the ridge) and 5.5 tall, its door at the front (-Y)."""
	body = lowpoly.extrude_outline(f"{name}_body", [(-4.5, 0), (4.5, 0), (0, 5.5)], 10)
	palette.paint(body, "canvas")
	palette.paint_where(body, "canvas_dark", lambda f: f.normal.x < -0.3)
	door = lowpoly.extrude_outline(f"{name}_door", [(-1.6, 0), (1.6, 0), (0, 3.9)], 0.06)
	door.location = (0, -5.02, 0)
	palette.paint(door, "dirt")
	poles = [prism(f"{name}_pole{i}", (0, y, 0), (0, y, 6.1), 0.12, 0.1, 4, "wood_dark") for i, y in enumerate((-5.15, 5.15))]
	return lowpoly.join([body, door, *poles], name)


def campfire(name, seed):
	"""A cold fire: a ring of stones round two crossed logs and their ash."""
	rng = random.Random(seed)
	parts = [prism(f"{name}_ash", (0, 0, 0), (0, 0, 0.08), 1.6, 1.4, 8, "char")]
	for i in range(7):
		a = i * 2 * math.pi / 7 + rng.uniform(-0.15, 0.15)
		stone = lowpoly.rock(f"{name}_stone{i}", (1.1, 0.95, 0.8), seed=seed + i)
		stone.location = (math.cos(a) * 2.0, math.sin(a) * 2.0, 0)
		stone.rotation_euler = (0, 0, a)
		parts.append(stone)
	for i, a in enumerate((0.3, 1.9)):
		d = Vector((math.cos(a), math.sin(a), 0)) * 1.5
		parts.append(prism(f"{name}_log{i}", Vector((0, 0, 0.3 + 0.3 * i)) - d, Vector((0, 0, 0.3 + 0.3 * i)) + d, 0.3, 0.28, 6, "bark"))
	return lowpoly.join(parts, name)


def log_seat(name):
	"""A log to sit on, 7 long (X), 1.6 thick, with cut ends."""
	ob = prism(name, (-3.5, 0, 0.8), (3.5, 0, 0.8), 0.8, 0.78, 8, "bark", math.pi / 8)
	palette.paint_where(ob, "wood_light", lambda f: abs(f.normal.x) > 0.9)
	return ob


def roadblock(name):
	"""Red and white boards across a road where it runs off the map, 28.5 wide (X), on trestle legs."""
	parts = []
	for i in range(4):
		x = -10.5 + 7 * i
		parts.append(lowpoly.box(f"{name}_board{i}", (6.5, 0.4, 1.0), (x, 0, 2.4), "fire_red" if i % 2 == 0 else "barrier_white"))
	for i, x in enumerate((-10.5, -3.5, 3.5, 10.5)):
		for j, s in enumerate((-1, 1)):
			parts.append(prism(f"{name}_leg{i}{j}", (x + 0.3 * s, s * 0.7, 0), (x, 0, 2.9), 0.14, 0.12, 4, "iron_light"))
	return lowpoly.join(parts, name)


# --- the kit --------------------------------------------------------------------------------


def props():
	"""(name, builder) for every prop in the kit. Names become the MeshPart names in Roblox."""
	return [
		("Pine_A", lambda n: pine(n, 20, 8.0, 1)),
		("Pine_B", lambda n: pine(n, 25, 9.2, 2)),
		("Pine_C", lambda n: pine(n, 30, 10.5, 3)),
		("Oak_A", lambda n: oak(n, 9, 8.5, 4)),
		("Oak_B", lambda n: oak(n, 11, 9.5, 5)),
		("Oak_C", lambda n: oak(n, 13, 11, 6)),
		("DeadTree_A", lambda n: dead_tree(n, 10, 7)),
		("DeadTree_B", lambda n: dead_tree(n, 13.5, 12)),
		("DeadTree_C", lambda n: dead_tree(n, 17, 19)),
		("Reeds", lambda n: reeds(n, 5)),
		("Rock_A", lambda n: lowpoly.rock(n, (6, 4.8, 3.6), seed=21)),
		("Rock_B", lambda n: lowpoly.rock(n, (4, 3.2, 2.6), seed=22)),
		("Rock_C", lambda n: lowpoly.rock(n, (3.5, 2.8, 2.2), seed=23)),
		("Hedge", lambda n: hedge(n, 12, 31)),
		("HayBale", lambda n: hay_bale(n, 41)),
		("FenceRails_8", lambda n: fence_rails(n, 8, 51)),
		("FenceRails_6", lambda n: fence_rails(n, 6, 52)),
		("FenceRails_4", lambda n: fence_rails(n, 4, 53)),
		("FenceRails_2", lambda n: fence_rails(n, 2, 54)),
		("FencePost", fence_post),
		("StreetLamp", street_lamp),
		("Tent", tent),
		("Campfire", lambda n: campfire(n, 61)),
		("LogSeat", log_seat),
		("Roadblock", roadblock),
	]


def build():
	built = tilekit.measure(props())
	tilekit.write_manifest(built, "MAP_KIT", "mapKit.ts", "map_kit")
	return tilekit.lay_out(built, 75.0, 3.0)
