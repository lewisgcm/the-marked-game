"""The map's buildings, each its own mesh in one FBX (uploaded apart from the map kit, so changing a building
never means uploading the trees again): the neighbours' bungalow, the barn, the ranger hut, the swamp shack,
the Fire Station and its training tower, and the treehouse.

Each one is modelled in its tile's own coordinates (tools/tiles: x right, y up, -z the front), from the same
numbers as its blockout, so its walls, doors and windows sit exactly on the blockout's. In the tile the
blockout's walls and roof stay as invisible colliders, and its floor, loot, counters, signs and lights stay
as they are (build.ts → `buildingMesh`). Doors and windows are open holes: kids and the infected go through.

Writes tools/tiles/lib/mapBuildings.ts (each mesh's size and middle; lib/tilekit.py).
"""

import math
import random

import bmesh
import bpy
from mathutils import Vector

from lib import lowpoly, palette, tilekit

EMBED_PALETTE = True
PREVIEW_DIRECTION = (0.45, -1.0, 0.75)
PREVIEW_MARGIN = 0.78
PREVIEW_BACKGROUND = (0.10, 0.11, 0.13)


# --- the tile's coordinates -----------------------------------------------------------------------


def V(x, y, z):
	"""A point in the tile's coordinates (Roblox: y up, front -z), in Blender's. The importer turns X round
	(KIT_X_SIGN), so x is negated here and lands where the tile code means it."""
	return Vector((-x, z, y))


def solid(name, points, faces, swatch):
	"""A mesh from points in tile coordinates and faces (lists of indices)."""
	bm = bmesh.new()
	verts = [bm.verts.new(V(*p)) for p in points]
	for face in faces:
		bm.faces.new([verts[i] for i in face])
	ob = lowpoly.to_object(name, bm)
	palette.paint(ob, swatch)
	return ob


def block(name, x0, x1, y0, y1, z0, z1, swatch):
	"""A box from x0..x1, y0..y1, z0..z1 (tile coordinates)."""
	points = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
	faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
	return solid(name, points, faces, swatch)


def cylinder(name, x, z, y0, y1, r0, r1, sides, swatch):
	bm = bmesh.new()
	lowpoly.tapered_prism(bm, V(x, y0, z), V(x, y1, z), r0, r1, sides, math.pi / sides)
	ob = lowpoly.to_object(name, bm)
	palette.paint(ob, swatch)
	return ob


def roof_along_x(name, x0, x1, profile, swatch, end_swatch):
	"""A roof running along X from x0 to x1: `profile` is its outline across it, [(z, y), ...] over the top
	from one eave to the other (the bottom edge closes it). Its ends take `end_swatch` (the gables)."""
	n = len(profile)
	points = [(x, y, z) for x in (x0, x1) for z, y in profile]
	faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
	faces += [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)]
	faces.append((n - 1, 0, n, 2 * n - 1))
	ob = solid(name, points, faces, swatch)
	palette.paint_where(ob, end_swatch, lambda f: abs(f.normal.x) > 0.9)
	return ob


# --- walls (as tools/tiles/lib/build.ts builds them) -------------------------------------------------


def door(center, width=5):
	return (center, width, 0, 8)


def window(center):
	return (center, 5, 3, 8)


def wall_pieces(start, finish, height, openings):
	"""The solid pieces of a wall with `openings` cut out (build.ts → wallPieces)."""
	pieces = []

	def add(a, b, bottom, top):
		if b - a > 0.01 and top - bottom > 0.01:
			pieces.append((a, b, bottom, top))

	cursor = start
	for center, width, bottom, top in sorted(openings):
		left, right = max(start, center - width / 2), min(finish, center + width / 2)
		add(cursor, left, 0, height)
		add(left, right, 0, bottom)
		add(left, right, top, height)
		cursor = right
	add(cursor, finish, 0, height)
	return pieces


class Building:
	"""A building's parts as it's made, painted inside and out: a face that looks back towards `middle` is
	inside (`inside` swatch), the rest outside."""

	def __init__(self, name, outside, inside, middle=(0, 0)):
		self.name = name
		self.parts = []
		self.outside, self.inside = outside, inside
		self.middle = middle

	def add(self, *obs):
		self.parts.extend(obs)

	def wall(self, along, at, start, finish, base, height, openings, frame=None, sill=True, thick=1.0):
		"""A wall like build.ts's `wall`, with a frame round each opening on the outside if `frame` is a
		swatch (and a sill under windows)."""
		for a, b, bottom, top in wall_pieces(start, finish, height, openings):
			y0, y1 = base + bottom, base + top
			if along == "X":
				ob = block("wall", a, b, y0, y1, at - thick / 2, at + thick / 2, self.outside)
			else:
				ob = block("wall", at - thick / 2, at + thick / 2, y0, y1, a, b, self.outside)
			self._paint_inside(ob)
			self.add(ob)
		if frame:
			out = 1 if at > (self.middle[1] if along == "X" else self.middle[0]) else -1
			for center, width, bottom, top in openings:
				self._frame(along, at + out * thick / 2, out, center, width, base + bottom, base + top, frame, sill and bottom > 0)

	def _frame(self, along, face, out, center, width, y0, y1, swatch, sill):
		"""Trim round an opening, standing out from the wall's outside `face` (towards `out`). It starts just
		off the face, so none of it lies in the same plane as the wall or the opening's sides (they'd
		flicker as the camera turns)."""
		t, d = 0.35, 0.25  # trim width, how far it stands out
		pieces = [
			(center - width / 2 - t, center - width / 2, y0, y1 + t),
			(center + width / 2, center + width / 2 + t, y0, y1 + t),
			(center - width / 2 - t, center + width / 2 + t, y1, y1 + t),
		]
		if sill:
			pieces.append((center - width / 2 - 0.5, center + width / 2 + 0.5, y0 - 0.3, y0))
		for a, b, lo, hi in pieces:
			z0, z1 = sorted((face + out * 0.02, face + out * (d + 0.02)))
			if along == "X":
				self.add(block("trim", a, b, lo, hi, z0, z1, swatch))
			else:
				self.add(block("trim", z0, z1, lo, hi, a, b, swatch))

	def _paint_inside(self, ob):
		mx, mz = self.middle

		def inward(f):
			c = f.calc_center_median()
			to_middle = V(mx, c.z, mz) - c
			to_middle.z = 0
			return f.normal.dot(to_middle) > 0.01 and abs(f.normal.z) < 0.5

		palette.paint_where(ob, self.inside, inward)

	def stripes(self, along, at, start, finish, base, height, openings, swatch, step, out):
		"""Thin bands across a wall's outside (logs, planks): `step` apart, standing `out` proud."""
		for a, b, bottom, top in wall_pieces(start, finish, height, openings):
			y = base + bottom + step / 2
			while y < base + top - 0.1:
				lo, hi = y - step * 0.18, y + step * 0.18
				# Ends just short of the piece's, off the plane of an opening's sides.
				a0, b0 = a + (0.03 if a > start else 0), b - (0.03 if b < finish else 0)
				if along == "X":
					self.add(block("band", a0, b0, lo, hi, at - out, at + out, swatch))
				else:
					self.add(block("band", at - out, at + out, lo, hi, a0, b0, swatch))
				y += step

	def done(self):
		return lowpoly.join(self.parts, self.name)


# --- the buildings (numbers from tools/tiles; keep them matching) ---------------------------------------


def bungalow(name):
	"""build.ts → bungalow: 36 x 26, walls 11 tall on a 0.3 floor, a pitched roof over them."""
	floor, half_w, half_d, height = 0.3, 18, 13, 11
	b = Building(name, "house_wall", "interior")
	trim = "house_trim"
	b.wall("X", -half_d, -half_w, half_w, floor, height, [window(-10), door(6)], trim)
	b.wall("X", half_d, -half_w, half_w, floor, height, [door(10)], trim)
	b.wall("Z", -half_w + 0.5, -half_d + 0.5, half_d - 0.5, floor, height, [window(4)], trim)
	b.wall("Z", half_w - 0.5, -half_d + 0.5, half_d - 0.5, floor, height, [window(-4)], trim)
	b.wall("Z", 0, -half_d + 0.5, half_d - 0.5, floor, height, [door(4)])
	eave = floor + height
	roof = roof_along_x(f"{name}_roof", -19.5, 19.5, [(-14.5, eave - 0.4), (0, eave + 6.5), (14.5, eave - 0.4)], "roof_slate", "house_wall")
	palette.paint_where(roof, "ceiling", lambda f: f.normal.z < -0.9)
	b.add(roof)
	b.add(block("chimney", 9, 12, eave + 2, eave + 8.5, 3, 6, "brick"))
	b.add(block("chimney_cap", 8.7, 12.3, eave + 8.5, eave + 9, 2.7, 6.3, "concrete_dark"))
	# Shutters by the front window, a step at each door.
	for x in (-14.05, -5.95):
		b.add(block("shutter", x - 1.1, x + 1.1, floor + 2.6, floor + 8.4, -13.75, -13.55, "shutter"))
	b.add(block("step", 3.2, 8.8, 0, floor, -15.2, -13.5, "concrete"))
	b.add(block("step", 7.2, 12.8, 0, floor, 13.5, 15.2, "concrete"))
	b.add(block("skirting", -18.2, 18.2, 0, floor, -13.7, -13.45, "concrete_dark"))
	return b.done()


def barn(name):
	"""Meadow_A's barn: 28 x 20, walls 12 tall on a 0.2 floor, a big door at the front, a gambrel roof."""
	floor, height = 0.2, 12
	b = Building(name, "barn_red", "barn_red_dark")
	white = "house_trim"
	b.wall("X", -10, -14, 14, floor, height, [(0, 10, 0, 9)], white, sill=False)
	b.wall("X", 10, -14, 14, floor, height, [door(-8)], white, sill=False)
	for x in (-13.5, 13.5):
		b.wall("Z", x, -9.5, 9.5, floor, height, [])
	# Boards up the outside, round the doors.
	for at, openings in ((-10.5, [(0, 10, 0, 9)]), (10.5, [door(-8)])):
		z0, z1 = sorted((at, at + 0.12 * (1 if at > 0 else -1)))
		for a, c, bottom, top in wall_pieces(-14, 14, height, openings):
			x = a + 0.75
			while x < c - 0.3:
				b.add(block("board", x - 0.08, x + 0.08, floor + bottom, floor + top, z0, z1, "barn_red_dark"))
				x += 1.5
	# The big door's X, folded back against the wall either side.
	for side in (-1, 1):
		x0, x1 = (-12, -5.2) if side < 0 else (5.2, 12)
		b.add(block("door_leaf", x0, x1, floor, floor + 9, -10.75, -10.5, "barn_red"))
		for (ya, yb) in ((0.3, 8.7), (8.7, 0.3)):
			b.add(_brace(x0, x1, floor + ya, floor + yb, -10.8, white))
	eave = floor + height
	profile = [(-11.5, eave - 0.3), (-7.5, eave + 4.6), (0, eave + 7.2), (7.5, eave + 4.6), (11.5, eave - 0.3)]
	roof = roof_along_x(f"{name}_roof", -15.5, 15.5, profile, "roof_slate_dark", "barn_red")
	palette.paint_where(roof, "barn_red_dark", lambda f: f.normal.z < -0.9)
	b.add(roof)
	b.add(block("loft_door", -2.5, 2.5, eave + 0.8, eave + 4.6, -11.6, -11.4, white))
	return b.done()


def _brace(x0, x1, y0, y1, z, swatch, width=0.35):
	"""A diagonal board from (x0, y0) to (x1, y1), flat on a wall facing -z at `z`."""
	along = Vector((x1 - x0, y1 - y0)).normalized()
	nx, ny = -along.y * width / 2, along.x * width / 2
	corners = [(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)]
	points = [(x, y, z0) for z0 in (z, z + 0.12) for x, y in corners]
	faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
	return solid("brace", points, faces, swatch)


def ranger_hut(name):
	"""ForestRoad_A's hut: 24 x 18 of logs, walls 10 tall on a 0.3 floor, its roof out over the porch."""
	floor, height = 0.3, 10
	b = Building(name, "log", "wood")
	front = [window(-6), door(5)]
	b.wall("X", -9, -12, 12, floor, height, front, "wood_dark")
	b.wall("X", 9, -12, 12, floor, height, [])
	for x in (-11.5, 11.5):
		b.wall("Z", x, -8.5, 8.5, floor, height, [window(0)], "wood_dark")
	b.stripes("X", -9, -12, 12, floor, height, front, "log_dark", 1.25, 0.6)
	b.stripes("X", 9, -12, 12, floor, height, [], "log_dark", 1.25, 0.6)
	for x in (-11.5, 11.5):
		b.stripes("Z", x, -8.5, 8.5, floor, height, [window(0)], "log_dark", 1.25, 0.6)
	# Log ends crossing at the corners.
	for x in (-12, 12):
		for z in (-9, 9):
			b.add(block("corner", x - 0.7, x + 0.7, floor, floor + height, z - 0.7, z + 0.7, "log_dark"))
	for x in (-11, 11):
		b.add(block("porch_post", x - 0.35, x + 0.35, floor, floor + height, -13.85, -13.15, "wood_dark"))
	b.add(block("porch_rail", -11, -7.5, floor + 2.6, floor + 3, -13.7, -13.3, "wood_dark"))
	b.add(block("porch_rail", 8.5, 11, floor + 2.6, floor + 3, -13.7, -13.3, "wood_dark"))
	eave = floor + height
	roof = roof_along_x(f"{name}_roof", -13.5, 13.5, [(-15, eave - 0.6), (-2.25, eave + 5), (10.5, eave - 0.3)], "roof_slate", "log")
	palette.paint_where(roof, "wood_dark", lambda f: f.normal.z < -0.9)
	b.add(roof)
	b.add(cylinder("stovepipe", 7, 4, eave + 2, eave + 7, 0.45, 0.45, 6, "iron"))
	return b.done()


def swamp_shack(name):
	"""Swamp_A's shack: 22 x 18 of grey planks, walls 9 tall on a 0.3 floor, a rusty tin roof."""
	floor, height = 0.3, 9
	b = Building(name, "dead_wood", "dead_wood_dark")
	walls = [
		("X", 9, -11, 11, [door(0)]),
		("X", -9, -11, 11, [window(0)]),
		("Z", -10.5, -8.5, 8.5, []),
		("Z", 10.5, -8.5, 8.5, [door(-1)]),
	]
	for along, at, a, z, openings in walls:
		b.wall(along, at, a, z, floor, height, openings, "dead_wood_dark")
	# Upright planks, uneven.
	rng = random.Random(3)
	for along, at, start, finish, openings in walls:
		out = 0.62 if at > 0 else -0.62
		for a, c, bottom, top in wall_pieces(start, finish, height, openings):
			x = a + 0.4
			while x < c - 0.2:
				w = rng.uniform(0.15, 0.3)
				lo, hi = floor + bottom, floor + top - rng.uniform(0, 0.4)
				z0, z1 = sorted((at, at + out))
				if along == "X":
					b.add(block("plank", x - w, x + w, lo, hi, z0, z1, "dead_wood_dark"))
				else:
					b.add(block("plank", z0, z1, lo, hi, x - w, x + w, "dead_wood_dark"))
				x += rng.uniform(1.4, 2.2)
	# A boarded-over patch, and a tin roof that slopes to the back.
	b.add(_brace(-10.4, -6, floor + 5.5, floor + 6.5, -9.75, "wood"))
	b.add(_brace(-10.4, -6, floor + 3.5, floor + 4.0, -9.75, "wood"))
	eave = floor + height
	roof = roof_along_x(f"{name}_roof", -12.5, 12.5, [(-10.5, eave + 2.4), (-10.5, eave + 2.7), (10.5, eave + 0.2), (10.5, eave - 0.1)], "tin", "dead_wood")
	palette.paint_where(roof, "rust", lambda f: f.normal.z > 0.5 and f.calc_center_median().x > 4)
	palette.paint_where(roof, "dead_wood_dark", lambda f: f.normal.z < -0.5)
	b.add(roof)
	# The wall under the high side of the roof.
	b.add(block("gable", -11, 11, eave - 0.05, eave + 2.45, -9.5, -8.5, "dead_wood"))
	return b.done()


def fire_station(name):
	"""The Fire Station: 44 x 32 of brick, walls 15 tall on a 0.3 floor, the engine bay and the counter's
	hatch at the front, a flat roof with a parapet."""
	floor, height = 0.3, 15
	b = Building(name, "brick", "concrete")
	front = [(-10, 16, 0, 12), (12, 12, 0, 9)]
	b.wall("X", -16, -22, 22, floor, height, front, "concrete", sill=False)
	b.wall("X", 16, -22, 22, floor, height, [])
	for x in (-21.5, 21.5):
		b.wall("Z", x, -15.5, 15.5, floor, height, [])
	# Concrete bands round the outside.
	for y, top in ((floor, floor + 0.6), (floor + 12.6, floor + 13.5)):
		if y < 1:  # not across the bay and the hatch
			for x0, x1 in ((-22.3, -18.35), (-1.65, 5.65), (18.35, 22.3)):
				b.add(block("band", x0, x1, y, top, -16.8, -16.5, "concrete"))
		else:
			b.add(block("band", -22.3, 22.3, y, top, -16.8, -16.5, "concrete"))
		b.add(block("band", -22.3, 22.3, y, top, 16.5, 16.8, "concrete"))
		for x in (-22.3, 22.0):
			b.add(block("band", x, x + 0.3, y, top, -16.5, 16.5, "concrete"))
	# The bay's roller door, rolled up under the lintel.
	b.add(block("roller", -17.6, -2.4, floor + 10.6, floor + 12, -16.2, -15.6, "fire_red"))
	roof = block(f"{name}_roof", -23, 23, 15, 16, -17, 17, "concrete_dark")
	palette.paint_where(roof, "ceiling", lambda f: f.normal.z < -0.9)
	b.add(roof)
	for x0, x1, z0, z1 in ((-23, 23, -17, -16.4), (-23, 23, 16.4, 17), (-23, -22.4, -17, 17), (22.4, 23, -17, 17)):
		b.add(block("parapet", x0, x1, 16, 17.2, z0, z1, "concrete"))
	b.add(block("aircon", 8, 13, 16, 17.6, 2, 6, "iron_light"))
	return b.done()


def training_tower(name):
	"""The Fire Station's training tower across the road: 12 x 12, 30 tall, its door at the back (+z)."""
	b = Building(name, "brick", "brick_dark")
	b.add(block("tower", -6, 6, 0, 30, -6, 6, "brick"))
	b.add(block("door", -2, 2, 0, 8, 6, 6.1, "wood_dark"))
	b.add(block("door_frame", -2.4, 2.4, 8, 8.4, 6, 6.25, "concrete"))
	for y in (12, 20, 27):
		b.add(block("window", -1.5, 1.5, y - 1.5, y + 1.5, 6, 6.1, "car_glass"))
		b.add(block("sill", -1.9, 1.9, y - 1.8, y - 1.5, 6, 6.35, "concrete"))
	for y in (10, 18, 25.5):
		b.add(block("band", -6.15, 6.15, y, y + 0.4, -6.15, 6.15, "concrete"))
	b.add(block("cap", -6.4, 6.4, 30, 30.6, -6.4, 6.4, "concrete_dark"))
	for x0, x1, z0, z1 in ((-6.2, 6.2, -6.2, -5.9), (-6.2, 6.2, 5.9, 6.2), (-6.2, -5.9, -6.2, 6.2), (5.9, 6.2, -6.2, 6.2)):
		b.add(block("rail", x0, x1, 32.2, 32.5, z0, z1, "fire_red"))
	for x in (-6, 6):
		for z in (-6, 6):
			b.add(block("rail_post", x - 0.12, x + 0.12, 30.6, 32.5, z - 0.12, z + 0.12, "fire_red"))
	return b.done()


def treehouse(name):
	"""The Treehouse: a great tree with the gang's hut up on a deck at 14, a ladder of rungs up the trunk's
	front (-z). Numbers from Treehouse.ts."""
	rng = random.Random(9)
	parts = [cylinder("trunk", 0, 0, -1, 30, 3.0, 2.2, 8, "bark")]
	# Roots, and limbs up into the leaves.
	for i in range(5):
		a = i * 2 * math.pi / 5 + 0.3
		out = (math.cos(a) * 5.5, -0.5, math.sin(a) * 5.5)
		bm = bmesh.new()
		lowpoly.tapered_prism(bm, V(0, 2.5, 0), V(*out), 1.6, 0.3, 5)
		parts.append(lowpoly.to_object("root", bm))
		palette.paint(parts[-1], "bark")
	for x, y, z in ((-9, 29, 4), (9, 30, -3), (0, 32, 0)):
		bm = bmesh.new()
		lowpoly.tapered_prism(bm, V(0, 22, 0), V(x * 0.8, y, z * 0.8), 1.3, 0.6, 5)
		parts.append(lowpoly.to_object("limb", bm))
		palette.paint(parts[-1], "bark_dark")
	# Leaves (the blockout's three balls, as lumps).
	for x, y, z, size in ((0, 34, 0, 26), (-10, 30, 4, 16), (10, 31, -3, 17)):
		for j in range(4 if size > 20 else 3):
			dx, dy, dz = (rng.uniform(-0.25, 0.25) * size for _ in range(3))
			s = size * rng.uniform(0.55, 0.75)
			parts.append(_blob(V(x + dx, y + dy * 0.5, z + dz), (s, s, s * 0.8), rng.randint(0, 999)))
	# The deck (top at 14), its rail, and the hut on it.
	parts.append(block("deck", -11, 11, 13, 14, -9, 9, "wood"))
	for x0, x1, z0, z1 in ((-11, 11, -9, -8.7), (-11, 11, 8.7, 9), (-11, -10.7, -9, 9), (10.7, 11, -9, 9)):
		parts.append(block("rail", x0, x1, 16.6, 16.9, z0, z1, "wood_dark"))
	for x in (-11, -5.5, 5.5, 11):
		for z in (-9, 9):
			parts.append(block("rail_post", x - 0.15, x + 0.15, 14, 16.9, z - 0.15, z + 0.15, "wood_dark"))
	b = Building(name, "wood", "wood_dark")
	b.wall("X", -7, -8, 8, 14, 7, [(0, 4, 2, 5)], "wood_light")
	b.wall("X", 7, -8, 8, 14, 7, [])
	for x in (-7.5, 7.5):
		b.wall("Z", x, -6.5, 6.5, 14, 7, [])
	b.stripes("X", -7, -8, 8, 14, 7, [(0, 4, 2, 5)], "wood_dark", 1.0, 0.55)
	roof = roof_along_x("roof", -10, 10, [(-9, 20.8), (0, 24.5), (9, 20.8)], "bark", "wood")
	b.add(roof)
	# Rungs up the front of the trunk.
	for i in range(9):
		y = 1 + 1.5 * i
		parts.append(block("rung", -1.5, 1.5, y - 0.2, y + 0.2, -3.45, -2.95, "wood_light"))
	b.add(*parts)
	return b.done()


def _blob(centre, size, seed):
	rng = random.Random(seed)
	bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.5)
	ob = bpy.context.object
	for vert in ob.data.vertices:
		vert.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * 0.1
		vert.co = Vector((vert.co.x * size[0], vert.co.y * size[1], vert.co.z * size[2])) + centre
	ob.data.update()
	ob.data.materials.append(palette.material())
	palette.paint(ob, "leaf")
	palette.paint_where(ob, "leaf_dark", lambda f: f.normal.z < -0.3)
	palette.flat(ob)
	return ob


def props():
	return [
		("Bungalow", bungalow),
		("Barn", barn),
		("RangerHut", ranger_hut),
		("SwampShack", swamp_shack),
		("FireStationBuilding", fire_station),
		("TrainingTower", training_tower),
		("TreehouseTree", treehouse),
	]


def build():
	built = tilekit.measure(props())
	tilekit.write_manifest(built, "MAP_BUILDINGS", "mapBuildings.ts", "map_buildings")
	return tilekit.lay_out(built, 140.0, 8.0)
