"""The Fire Station's engine: an original low-poly pumper, one static mesh (FireEngine).

Crew cab, locker shutters, a pump panel, hose reel and a roof ladder. Faces -Y, stands on Z = 0.
Sized for the station's bay (16 wide, 12 high; src/main/server/world/bases.ts).
"""

from lib import lowpoly, mesh
from lib.blocky import preview_lights  # noqa: F401
from lib.vehicle import Cabin, bit, disc, hull, pair, side_strip, wheels

EMBED_PALETTE = True
PREVIEW_DIRECTION = (0.75, -1.0, 0.5)
PREVIEW_MARGIN = 0.9
PREVIEW_BACKGROUND = (0.10, 0.11, 0.13)

RED, DARK = "fire_red", "blood"
HALF = 3.7


def cab():
	shell = Cabin((-9.7, -3.6, 3.6), (-9.1, -3.6, 3.45), 4.3, 8.0)
	pieces = [
		hull("cab_base", [
			(-9.9, 1.3, 4.3, 3.3, 3.5, 3.45), (-9.5, 1.0, 4.35, 3.6, 3.7, 3.6), (-3.6, 1.0, 4.35, 3.6, 3.7, 3.6),
		], RED),
		shell.shell(RED),
		shell.panel("front", 0.05, 0.485, 0.14, 0.82),
		shell.panel("front", 0.515, 0.95, 0.14, 0.82),
		lowpoly.box("cab_roof", (7.1, 5.6, 0.25), (0, -6.35, 8.1), "wax"),
	]
	for side in ("left", "right"):
		for u0, u1 in ((0.14, 0.46), (0.55, 0.90)):
			pieces.append(shell.panel(side, u0, u1, 0.16, 0.80))
	for y in (-9.0, -6.6, -4.0):
		for s in (-1, 1):
			pieces.append(side_strip((1.0, 4.35, 3.6, 3.7, 3.6), s, y - 0.05, y + 0.05, DARK, low=0.1))
	for y in (-6.9, -4.4):
		pieces += pair((0.16, 0.5, 0.14), 3.72, y, 3.9, "stone_light")
	pieces += pair((0.5, 0.3, 1.0), 3.95, -9.2, 5.6, "iron")  # mirrors
	# Grille, lights and the big bumper.
	pieces += [
		lowpoly.box("grille", (3.4, 0.2, 1.3), (0, -9.95, 3.0), "iron"),
		lowpoly.box("bumper", (7.3, 0.9, 0.8), (0, -10.1, 1.5), "stone_light"),
		bit((1.6, 0.1, 0.4), (0, -10.58, 1.5), "bone"),
	]
	pieces += [bit((3.0, 0.1, 0.12), (0, -10.07, z), "stone_light") for z in (2.65, 3.0, 3.35)]
	pieces += pair((0.9, 0.2, 0.6), 2.7, -9.95, 3.0, "wax")
	pieces += pair((0.5, 0.2, 0.3), 2.9, -9.95, 2.35, "flame")
	# Light bar.
	pieces += [lowpoly.box("bar", (5.6, 0.8, 0.2), (0, -8.2, 8.32), "iron")]
	pieces += pair((1.9, 0.7, 0.5), 1.75, -8.2, 8.65, "light_blue")
	pieces.append(lowpoly.box("bar_mid", (1.3, 0.6, 0.4), (0, -8.2, 8.6), "wax"))
	return pieces


def body():
	pieces = [
		lowpoly.box("chassis", (5.6, 19.0, 0.7), (0, 0.0, 1.3), "iron"),
		lowpoly.box("pump", (7.0, 1.6, 5.6), (0, -2.9, 4.3), "stone_light"),
		lowpoly.box("body", (HALF * 2, 11.6, 6.2), (0, 3.9, 4.5), RED),
		lowpoly.box("body_top", (HALF * 2 - 0.6, 11.0, 0.3), (0, 3.9, 7.65), "iron_light"),
	]
	for s in (-1, 1):
		# Pump panel: dials, outlets and a lever.
		for y, z in ((-3.25, 5.9), (-2.65, 5.9), (-3.25, 5.1), (-2.65, 5.1)):
			pieces.append(disc(s * 3.4, s * 3.58, y, z, 0.24, "iron", 8))
		for y in (-3.3, -2.5):
			pieces.append(disc(s * 3.4, s * 3.8, y, 3.2, 0.32, "gold", 8))
		pieces.append(bit((0.2, 1.0, 0.14), (s * 3.55, -2.9, 4.3), "car_tail"))
		# Roller shutters: three lockers, the middle one short to clear the wheel.
		for y, width, z0 in ((-0.4, 2.4, 2.2), (4.4, 5.2, 4.4), (8.4, 2.0, 2.2)):
			z1 = 6.9
			pieces.append(bit((0.14, width, z1 - z0), (s * 3.70, y, (z0 + z1) / 2), "car_silver"))
			z = z0 + 0.5
			while z < z1 - 0.2:
				pieces.append(bit((0.05, width, 0.07), (s * 3.79, y, z), "car_silver_dark"))
				z += 0.6
			pieces.append(bit((0.12, width * 0.4, 0.12), (s * 3.82, y, z0 + 0.2), "iron"))
		pieces.append(bit((0.12, 11.4, 0.4), (s * 3.70, 3.9, 7.2), "car_mustard"))
		pieces.append(bit((0.12, 5.8, 0.4), (s * 3.70, -6.6, 2.0), "car_mustard"))
	# The back: steps, a shutter, lights and chevrons.
	pieces += [
		lowpoly.box("step", (7.2, 0.8, 0.4), (0, 10.0, 1.5), "stone_light"),
		bit((3.4, 0.14, 4.0), (0, 9.72, 4.6), "car_silver"),
		bit((1.6, 0.1, 0.4), (0, 10.43, 1.5), "bone"),
	]
	pieces += [bit((3.4, 0.08, 0.08), (0, 9.8, 3.0 + 0.6 * i), "car_silver_dark") for i in range(6)]
	for s in (-1, 1):
		pieces += [bit((1.6, 0.1, 0.3), (s * 2.7, 9.74, 2.6 + i * 0.8), "car_mustard", s * 35) for i in range(5)]
	pieces += pair((0.5, 0.16, 0.9), 3.3, 9.76, 6.9, "car_tail")
	return pieces


def roof():
	"""A ladder either side (so the mesh stays centred), a hose reel and folded hose between."""
	pieces = []
	for s in (-1, 1):
		x = s * 2.1
		for dx in (-0.55, 0.55):
			pieces.append(lowpoly.box("rail", (0.18, 12.0, 0.3), (x + dx, 3.4, 8.45), "stone_light"))
		pieces += [lowpoly.box("rung", (1.1, 0.16, 0.16), (x, -2.2 + i * 1.12, 8.45), "stone_light") for i in range(11)]
		pieces += [lowpoly.box("bracket", (0.9, 0.3, 0.7), (x, y, 8.0), "iron") for y in (-0.4, 3.6, 7.6)]
	pieces += [
		disc(-0.75, 0.75, 1.6, 8.55, 0.85, "bone_shadow", 10),
		disc(-0.95, -0.75, 1.6, 8.55, 1.0, DARK, 10),
		disc(0.75, 0.95, 1.6, 8.55, 1.0, DARK, 10),
		lowpoly.box("hose_bed", (1.8, 4.4, 0.5), (0, 6.2, 7.95), "bone"),
	]
	pieces += [lowpoly.box("fold", (1.84, 0.12, 0.52), (0, 4.6 + i * 0.8, 7.96), "bone_shadow") for i in range(5)]
	pieces += pair((0.8, 0.6, 0.5), 3.1, 9.2, 8.05, "light_blue")
	return pieces


def build():
	pieces = cab() + body() + roof() + wheels(3.72, (-7.6, 4.6), 1.35)
	return mesh.join_objects(pieces, "FireEngine")
