"""Wrecks for the streets: original low-poly vehicles, each its own mesh in one FBX.

CrashedCar, BurntCar, SchoolBus (on its side), Ambulance and Tank. They face -Y before any tilt and
stand on Z = 0. No blood, no emblems and no writing (GAMEPLAY.md, content rules).
"""

import math

from mathutils import Matrix

from lib import lowpoly, mesh
from lib.blocky import preview_lights  # noqa: F401
from lib.vehicle import Cabin, bit, disc, hull, pair, side_strip

EMBED_PALETTE = True
PREVIEW_DIRECTION = (0.55, -1.0, 0.7)
PREVIEW_MARGIN = 0.85
PREVIEW_BACKGROUND = (0.10, 0.11, 0.13)


def tilted(ob, pitch=0.0, yaw=0.0, roll=0.0):
	"""Turns a piece (degrees about its own X, Z and Y) where it stands."""
	ob.rotation_euler = (math.radians(pitch), math.radians(roll), math.radians(yaw))
	return ob


def slab(size, at, swatch, pitch=0.0, yaw=0.0, roll=0.0):
	return tilted(lowpoly.box("slab", size, at, swatch), pitch, yaw, roll)


def settle(ob, roll=0.0, pitch=0.0, sink=0.0):
	"""Tips the finished wreck over and rests it on the ground, `sink` studs into it."""
	ob.data.transform(Matrix.Rotation(math.radians(roll), 4, "Y") @ Matrix.Rotation(math.radians(pitch), 4, "X"))
	xs = [v.co.x for v in ob.data.vertices]
	ys = [v.co.y for v in ob.data.vertices]
	low = min(v.co.z for v in ob.data.vertices)
	ob.data.transform(Matrix.Translation((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -low - sink)))
	return ob


def wheel(x, y, radius, swatch="iron", hub="stone_light", z=None, width=0.55):
	s = 1 if x > 0 else -1
	z = radius if z is None else z
	return [
		disc(x - s * width, x, y, z, radius, swatch),
		disc(x - s * 0.02, x + s * 0.06, y, z, radius * 0.52, hub, 8),
	]


def crashed_car():
	"""A saloon that hit something: crumpled nose, sprung bonnet, a door open, one wheel off."""
	paint, trim = "plum", "plum_dark"
	section = (0.7, 2.6, 2.4, 2.6, 2.4)
	cabin = Cabin((-2.2, 3.8, 2.4), (-0.6, 2.6, 1.95), 2.55, 4.5)
	pieces = [
		hull("body", [
			(-4.7, 1.3, 2.1, 1.6, 2.0, 1.3), (-4.2, 0.8, 2.9, 2.1, 2.5, 1.6), (-3.5, 0.75, 2.3, 2.4, 2.7, 2.3),
			(-2.2, 0.7, 2.6, 2.4, 2.6, 2.4), (6.0, 0.7, 2.6, 2.4, 2.6, 2.4), (6.6, 0.95, 2.4, 2.2, 2.4, 2.2),
		], paint),
		cabin.shell(paint),
		cabin.panel("front", 0.07, 0.93, 0.10, 0.90),
		cabin.panel("back", 0.10, 0.90, 0.14, 0.86),
		cabin.panel("left", 0.16, 0.48, 0.16, 0.82, "socket"),
		cabin.panel("left", 0.54, 0.86, 0.16, 0.82),
		cabin.panel("right", 0.16, 0.48, 0.16, 0.82),
		cabin.panel("right", 0.54, 0.86, 0.16, 0.82, "socket"),
	]
	# A jagged hole in the windscreen.
	for u0, u1, v0, v1 in ((0.20, 0.40, 0.38, 0.66), (0.27, 0.48, 0.28, 0.54), (0.32, 0.43, 0.50, 0.76)):
		pieces.append(cabin.panel("front", u0, u1, v0, v1, "socket", out=0.07))
	for s in (-1, 1):
		for y in (-1.6, 0.9, 3.0):
			pieces.append(side_strip(section, s, y - 0.04, y + 0.04, trim, low=0.2, high=0.95))
	pieces += [
		slab((3.6, 2.0, 0.14), (0.2, -3.1, 3.15), paint, pitch=-40, roll=6),  # bonnet
		slab((2.6, 1.4, 0.7), (0, -3.6, 2.1), "iron", yaw=8),  # engine
		slab((4.6, 0.4, 0.45), (-0.3, -4.9, 0.6), "iron_light", yaw=12, roll=-8),  # bumper, hanging
		slab((0.14, 2.3, 1.5), (3.2, -1.0, 1.75), paint, yaw=38),  # door, open
		slab((4.2, 0.4, 0.4), (0, 6.65, 1.0), "iron_light"),
	]
	pieces += pair((0.5, 0.16, 0.5), 1.7, 6.55, 1.9, "car_tail")
	pieces += [bit((0.8, 0.16, 0.4), (-1.3, -4.75, 1.9), "wax", 20)]
	pieces += wheel(2.65, 4.4, 0.95) + wheel(-2.65, 4.4, 0.95) + wheel(-2.7, -3.2, 0.95)
	pieces += [disc(2.2, 2.4, -3.2, 0.95, 0.5, "iron_light", 8)]  # a bare hub
	pieces += wheel(3.9, -4.4, 0.95)  # the wheel that came off
	return settle(mesh.join_objects(pieces, "CrashedCar"))


def burnt_car():
	"""A burnt-out hatchback: rust and char, no glass, down on its rims, roof sagging."""
	cabin = Cabin((-2.5, 4.9, 2.36), (-0.9, 3.4, 1.85), 2.3, 4.1)
	pieces = [
		hull("body", [
			(-5.4, 0.7, 1.5, 1.9, 2.1, 1.8), (-4.9, 0.45, 2.0, 2.3, 2.5, 2.2), (-2.6, 0.4, 2.3, 2.35, 2.55, 2.38),
			(4.8, 0.4, 2.3, 2.35, 2.55, 2.38), (5.4, 0.65, 2.1, 2.15, 2.35, 2.1),
		], "rust_dark"),
		cabin.shell("rust"),
		cabin.panel("front", 0.06, 0.94, 0.08, 0.92, "char"),
		cabin.panel("back", 0.10, 0.90, 0.14, 0.88, "char"),
	]
	for side in ("left", "right"):
		pieces += [cabin.panel(side, 0.14, 0.52, 0.12, 0.86, "char"), cabin.panel(side, 0.57, 0.88, 0.12, 0.86, "char")]
	section = (0.4, 2.3, 2.35, 2.55, 2.38)
	for s in (-1, 1):
		for y0, y1, swatch in ((-2.2, -0.6, "char_light"), (0.4, 2.4, "char"), (3.2, 4.6, "rust")):
			pieces.append(side_strip(section, s, y0, y1, swatch, low=0.1, high=0.95, out=0.02))
	pieces += [
		slab((3.0, 2.4, 0.16), (0.1, 1.1, 4.14), "char", pitch=-4, roll=5),  # sagging roof
		slab((3.9, 2.2, 0.12), (0, -3.8, 2.14), "char_light", pitch=-6, roll=-3),  # bonnet
		slab((3.4, 0.3, 0.4), (0.4, -5.6, 0.35), "char", yaw=-9),
		slab((1.6, 0.9, 0.5), (0, -4.6, 1.95), "char"),
	]
	for x, y in ((2.45, -3.3), (-2.45, -3.3), (2.45, 3.3), (-2.45, 3.3)):
		pieces += wheel(x, y, 0.55, "iron_light", "rust")
	return settle(mesh.join_objects(pieces, "BurntCar"))


def school_bus():
	"""A school bus lying on its side: blocks a road, and you can hide behind it."""
	paint = "bus_yellow"
	body = Cabin((-6.8, 11.0, 3.9), (-6.6, 10.9, 3.3), 3.4, 8.4)
	pieces = [
		hull("base", [
			(-10.8, 1.4, 3.6, 2.6, 2.9, 2.3), (-10.2, 1.1, 4.3, 2.9, 3.1, 2.6), (-6.9, 1.1, 4.6, 3.1, 3.3, 2.8),
			(-6.8, 1.1, 3.5, 3.7, 3.9, 3.9), (11.0, 1.1, 3.5, 3.7, 3.9, 3.9),
		], paint),
		body.shell(paint),
		body.panel("front", 0.08, 0.92, 0.22, 0.82),
		body.panel("back", 0.36, 0.64, 0.02, 0.86, "car_mustard_dark"),
		body.panel("back", 0.40, 0.60, 0.45, 0.80),
		body.panel("back", 0.08, 0.30, 0.45, 0.80),
		body.panel("back", 0.70, 0.92, 0.45, 0.80, "socket"),
		lowpoly.box("underside", (6.6, 20.5, 0.5), (0, 0.4, 1.0), "iron"),
	]
	for side in ("left", "right"):
		for i in range(7):
			u = 0.12 + i * 0.122
			pieces.append(body.panel(side, u, u + 0.10, 0.34, 0.76, "socket" if i in (1, 4) else "car_glass"))
		pieces.append(body.panel(side, 0.0, 1.0, 0.16, 0.22, "iron", out=0.04))
	pieces.append(body.panel("right", 0.015, 0.10, 0.02, 0.80, "iron"))  # the door
	for s in (-1, 1):
		pieces += [bit((0.1, 17.6, 0.22), (s * 3.9, 2.1, 2.1), "iron")]
	pieces += [
		lowpoly.box("grille", (3.0, 0.2, 1.4), (0, -10.9, 2.7), "iron"),
		lowpoly.box("bumper", (6.4, 0.5, 0.6), (0, -11.0, 1.4), "iron"),
		lowpoly.box("bumper", (7.6, 0.5, 0.6), (0, 11.2, 1.4), "iron"),
		lowpoly.box("hatch", (2.4, 2.4, 0.2), (0, 3.0, 8.45), "car_mustard_dark"),
		lowpoly.box("lights", (4.4, 0.4, 0.4), (0, -6.5, 8.3), "iron"),
		disc(-2.6, 2.6, -8.0, 1.15, 0.22, "iron_light", 6),
		disc(-2.8, 2.8, 6.6, 1.15, 0.26, "iron_light", 6),
		lowpoly.box("exhaust", (0.35, 9.0, 0.35), (1.5, 2.0, 0.7), "rust"),
		lowpoly.box("tank", (1.6, 3.0, 0.7), (-2.0, 1.0, 0.75), "iron_light"),
	]
	pieces += pair((0.8, 0.2, 0.7), 2.1, -10.85, 2.7, "wax") + pair((0.7, 0.2, 0.5), 2.9, 11.1, 2.6, "car_tail")
	pieces += pair((0.5, 0.2, 0.4), 1.7, -6.75, 8.3, "car_tail")
	for x, y in ((3.2, -8.0), (-3.2, -8.0), (3.75, 6.6), (-3.75, 6.6)):
		pieces += wheel(x, y, 1.25, hub="bus_yellow", width=0.8)
	return settle(mesh.join_objects(pieces, "SchoolBus"), roll=86, sink=0.15)


def ambulance():
	"""Nose-down into a ditch, back doors open on an empty stretcher bay."""
	paint = "wax"
	cab = Cabin((-5.4, -2.0, 2.6), (-4.2, -2.0, 2.45), 2.9, 5.3)
	pieces = [
		hull("base", [
			(-6.5, 1.1, 2.0, 2.0, 2.3, 1.9), (-6.0, 0.8, 2.8, 2.5, 2.7, 2.4), (-5.2, 0.8, 3.0, 2.6, 2.75, 2.6),
			(7.0, 0.8, 3.0, 2.8, 2.9, 2.8),
		], paint),
		cab.shell(paint),
		cab.panel("front", 0.07, 0.93, 0.10, 0.88),
		cab.panel("left", 0.30, 0.85, 0.16, 0.82),
		cab.panel("right", 0.30, 0.85, 0.16, 0.82, "socket"),
		lowpoly.box("box_floor", (5.9, 9.2, 0.3), (0, 2.5, 3.1), "iron_light"),
		lowpoly.box("box_roof", (6.0, 9.2, 0.4), (0, 2.5, 7.4), paint),
		lowpoly.box("box_front", (6.0, 0.3, 4.4), (0, -1.95, 5.2), paint),
		lowpoly.box("box_left", (0.25, 9.2, 4.4), (2.88, 2.5, 5.2), paint),
		lowpoly.box("box_right", (0.25, 9.2, 4.4), (-2.88, 2.5, 5.2), paint),
		lowpoly.box("stretcher", (1.6, 5.0, 0.4), (0, 3.0, 4.3), "cloth"),
		lowpoly.box("frame", (1.2, 4.4, 0.8), (0, 3.0, 3.7), "iron"),
		lowpoly.box("shelf", (0.9, 6.0, 1.8), (-2.2, 1.6, 5.6), "car_silver"),
	]
	for s in (-1, 1):
		pieces += [
			bit((0.08, 9.0, 0.5), (s * 3.02, 2.5, 4.2), "car_teal"),
			bit((0.08, 9.0, 0.18), (s * 3.02, 2.5, 3.7), "car_teal_dark"),
			bit((0.08, 2.0, 1.1), (s * 3.02, 0.8, 6.0), "car_glass"),
			slab((0.2, 2.8, 4.0), (s * 4.0, 8.0, 5.2), paint, yaw=s * -52),  # back doors, open
			bit((0.5, 0.2, 0.6), (s * 2.5, 7.1, 2.4), "car_tail"),
		]
	pieces += [
		lowpoly.box("bar", (4.6, 0.8, 0.2), (0, -2.9, 5.45), "iron"),
		slab((4.2, 0.4, 0.5), (0.4, -6.6, 0.9), "iron_light", yaw=-8, roll=10),
		slab((3.6, 1.6, 0.14), (0, -5.9, 3.0), paint, pitch=-24, roll=-5),
		lowpoly.box("engine", (2.4, 1.2, 0.6), (0, -5.9, 2.6), "iron"),
		lowpoly.box("step", (5.4, 0.7, 0.3), (0, 7.3, 1.0), "iron_light"),
	]
	pieces += pair((1.5, 0.7, 0.45), 1.45, -2.9, 5.75, "light_blue")
	pieces += pair((0.8, 0.16, 0.4), 1.6, -6.4, 1.8, "stone_light")
	for x, y in ((2.8, -4.0), (-2.8, -4.0), (2.95, 4.4), (-2.95, 4.4)):
		pieces += wheel(x, y, 1.05)
	return settle(mesh.join_objects(pieces, "Ambulance"), pitch=5, roll=-4, sink=0.25)


def tank():
	"""A knocked-out tank: turret slewed, barrel drooping, one track unrolled behind it."""
	paint, dark = "olive", "olive_dark"
	pieces = [
		hull("hull", [
			(-7.2, 1.7, 2.3, 2.3, 2.4, 2.2), (-6.4, 1.2, 3.1, 2.6, 2.7, 2.6), (-4.4, 1.1, 3.6, 2.7, 2.8, 2.7),
			(6.0, 1.1, 3.7, 2.7, 2.8, 2.7), (6.8, 1.6, 3.4, 2.5, 2.6, 2.5),
		], paint),
	]
	for s in (-1, 1):
		x = s * 3.55
		pieces += [lowpoly.box("skirt", (1.7, 11.2, 0.3), (x, -0.2, 3.35), dark)]
		# Road wheels, with the track round them: whole on the right, thrown on the left.
		for y in (-5.6, -3.4, -1.2, 1.0, 3.2, 5.4):
			pieces += [disc(s * 2.9, s * 4.1, y, 1.2, 0.95, "iron_light", 10), disc(s * 4.1, s * 4.18, y, 1.2, 0.45, dark, 8)]
		if s < 0:
			pieces += [
				lowpoly.box("track", (1.3, 11.4, 0.3), (x, -0.1, 0.15), "iron"),
				lowpoly.box("track", (1.3, 11.4, 0.25), (x, -0.1, 2.25), "iron"),
				slab((1.3, 1.6, 0.3), (x, -6.4, 1.2), "iron", pitch=-70),
				slab((1.3, 1.6, 0.3), (x, 6.2, 1.2), "iron", pitch=70),
			]
			pieces += [lowpoly.box("link", (1.36, 0.14, 0.36), (x, -5.4 + i * 1.06, 0.18), "char") for i in range(11)]
	# The thrown track, flat on the ground in links that wander off.
	for i in range(9):
		pieces.append(slab((1.3, 0.95, 0.22), (3.6 + 0.04 * i * i, 5.8 + i * 1.0, 0.11), "iron", yaw=-4.0 * i))
	turret = [
		Cabin((-2.6, 3.2, 2.3), (-1.4, 2.4, 1.5), 3.8, 5.7).shell(paint),
		lowpoly.box("ring", (3.8, 3.8, 0.3), (0, 0.2, 3.75), dark),
		lowpoly.box("mantlet", (1.6, 0.9, 1.0), (0, -2.5, 4.6), dark),
		lowpoly.box("hatch_ring", (1.3, 1.3, 0.25), (0.6, 0.9, 5.75), dark),
		slab((1.2, 0.14, 1.2), (0.6, 1.7, 6.25), dark, pitch=-14),  # hatch, open
		slab((0.5, 6.4, 0.5), (0, -5.7, 4.05), dark, pitch=10),  # barrel, drooping
		slab((0.75, 0.9, 0.75), (0, -8.6, 3.55), dark, pitch=10),
		lowpoly.box("bin", (2.6, 0.9, 1.0), (0, 3.4, 4.6), dark),
		slab((0.08, 0.08, 2.6), (-1.1, 2.0, 6.7), "iron", roll=18),  # aerial, bent
	]
	spin = Matrix.Rotation(math.radians(32), 4, "Z")
	for piece in turret:
		piece.matrix_world = spin @ piece.matrix_basis
	pieces += turret
	# Scorching over the engine deck, and a hole in the side.
	pieces += [
		lowpoly.box("deck", (3.6, 2.6, 0.12), (0, 4.5, 3.74), "char"),
		slab((1.8, 1.2, 0.2), (0.5, 4.3, 3.95), "char_light", pitch=12, yaw=20),
		disc(2.55, 2.95, -2.2, 2.75, 0.5, "char", 7),
		lowpoly.box("box", (1.2, 2.0, 0.6), (-3.5, 2.4, 3.8), dark),
		slab((0.9, 1.6, 0.5), (3.5, -3.0, 3.7), "rust_dark", yaw=14),
	]
	pieces += pair((0.5, 0.2, 0.35), 1.9, -7.15, 2.1, "stone_light")
	return settle(mesh.join_objects(pieces, "Tank"))


def build():
	wrecks = [crashed_car(), burnt_car(), ambulance(), tank(), school_bus()]
	x = 0.0
	for ob in wrecks:
		width = ob.dimensions.x
		ob.location.x = x + width / 2
		x += width + 2.5
	for ob in wrecks:
		ob.location.x -= x / 2
	return wrecks[0]
