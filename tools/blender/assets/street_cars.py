"""Maple Street's cars: original low-poly vehicles, one per neighbour, abandoned as they were.

Four separate meshes (Minivan, Hatchback, Estate, IceCreamVan) in one FBX, so it's one import. They
face -Y with the boot at +Y, where the game puts the "Car boot" loot.
"""

from lib import lowpoly, mesh
from lib.blocky import preview_lights  # noqa: F401
from lib.vehicle import Cabin, bit, disc, hull, pair, side_strip, wheels

EMBED_PALETTE = True
PREVIEW_DIRECTION = (0.55, -1.0, 0.62)
PREVIEW_MARGIN = 1.0
PREVIEW_BACKGROUND = (0.10, 0.11, 0.13)
SPACING = 8.5


def ends(front, back, half, z, plate_z=1.25):
	"""Lights, bumpers and blank plates. `front`/`back` are the body's end Y positions."""
	pieces = [
		lowpoly.box("bumper", (half * 2 - 0.1, 0.4, 0.45), (0, front - 0.06, 1.0), "iron_light"),
		lowpoly.box("bumper", (half * 2 - 0.1, 0.4, 0.45), (0, back + 0.06, 1.0), "iron_light"),
		bit((1.2, 0.08, 0.3), (0, front - 0.26, plate_z - 0.2), "bone"),
		bit((1.2, 0.08, 0.3), (0, back + 0.26, plate_z - 0.2), "bone"),
	]
	return pieces + pair((0.75, 0.16, 0.4), half - 0.75, front - 0.02, z, "wax") + pair((0.4, 0.16, 0.6), half - 0.5, back + 0.02, z, "car_tail")


def doors(section, seams, handles, trim):
	"""Door seams and handles down both sides of a hull's straight part."""
	pieces = []
	for s in (-1, 1):
		pieces += [side_strip(section, s, y - 0.04, y + 0.04, trim, low=0.2, high=0.95) for y in seams]
	z0, z1, _, waist, _ = section
	for y in handles:
		pieces += pair((0.16, 0.4, 0.12), waist - 0.02, y, z0 + (z1 - z0) * 0.72, "stone_light")
	return pieces


def mirrors(x, y, z, swatch):
	return pair((0.45, 0.22, 0.3), x + 0.18, y, z, swatch)


def minivan():
	"""Mum's: tall and one-box, with a sliding door rail and a roof box."""
	paint, trim = "car_teal", "car_teal_dark"
	cabin = Cabin((-4.3, 6.2, 2.62), (-1.9, 5.8, 2.2), 2.9, 5.5)
	pieces = [
		hull("body", [
			(-6.5, 0.9, 2.0, 2.3, 2.5, 2.2), (-5.9, 0.75, 2.5, 2.55, 2.75, 2.45), (-4.2, 0.75, 2.95, 2.6, 2.8, 2.65),
			(6.0, 0.75, 2.95, 2.6, 2.8, 2.65), (6.5, 0.95, 2.8, 2.4, 2.6, 2.4),
		], paint),
		cabin.shell(paint),
		cabin.panel("front", 0.06, 0.94, 0.08, 0.92),
		cabin.panel("back", 0.10, 0.90, 0.22, 0.86),
	]
	for side in ("left", "right"):
		for u0, u1 in ((0.10, 0.34), (0.38, 0.66), (0.70, 0.94)):
			pieces.append(cabin.panel(side, u0, u1, 0.16, 0.84))
	pieces += wheels(2.72, (-4.0, 4.0), 1.0)
	pieces += ends(-6.5, 6.5, 2.4, 2.05)
	pieces += doors((0.75, 2.95, 2.6, 2.8, 2.65), (-2.4, 0.4, 2.7), (0.0, 0.9), trim)
	pieces += pair((0.08, 3.6, 0.1), 2.74, 3.4, 2.72, trim)  # sliding door rail
	pieces += mirrors(2.7, -3.0, 3.25, trim)
	pieces += [
		bit((1.7, 0.1, 0.3), (0, -6.5, 1.75), "iron"),
		lowpoly.box("roofbox", (2.6, 4.4, 0.7), (0, 2.2, 5.95), "iron_light"),
		lowpoly.box("roofbox_lid", (2.3, 4.0, 0.25), (0, 2.2, 6.38), "iron"),
	]
	return mesh.join_objects(pieces, "Minivan")


def hatchback():
	"""Small and round-nosed; one door has been swapped for a scrapyard one."""
	paint, trim = "car_mustard", "car_mustard_dark"
	section = (0.7, 2.65, 2.35, 2.55, 2.38)
	cabin = Cabin((-2.6, 5.0, 2.36), (-0.9, 3.5, 1.9), 2.6, 4.75)
	pieces = [
		hull("body", [
			(-5.4, 0.95, 1.8, 1.9, 2.1, 1.8), (-4.9, 0.75, 2.3, 2.3, 2.5, 2.2), (-2.6, 0.7, 2.65, 2.35, 2.55, 2.38),
			(4.8, 0.7, 2.65, 2.35, 2.55, 2.38), (5.4, 0.95, 2.4, 2.15, 2.35, 2.1),
		], paint),
		cabin.shell(paint),
		cabin.panel("front", 0.07, 0.93, 0.10, 0.90),
		cabin.panel("back", 0.10, 0.90, 0.16, 0.86),
	]
	for side in ("left", "right"):
		pieces += [cabin.panel(side, 0.14, 0.52, 0.14, 0.84), cabin.panel(side, 0.57, 0.88, 0.14, 0.84)]
	pieces += wheels(2.5, (-2.9, 3.3), 0.85)
	pieces += ends(-5.4, 5.4, 2.1, 1.75)
	pieces += doors(section, (-1.6, 1.8), (1.3,), trim)
	pieces += mirrors(2.4, -1.8, 2.95, trim)
	pieces += [
		side_strip(section, 1, -1.55, 1.75, "car_silver_dark", low=0.2, high=0.95, out=0.02),  # the odd door
		bit((1.3, 0.1, 0.2), (0, -5.4, 1.45), "iron"),
	]
	return mesh.join_objects(pieces, "Hatchback")


def estate():
	"""Long and low, loaded up to leave: boxes, a rolled mattress and a lamp on the roof rack."""
	paint, trim = "car_silver", "car_silver_dark"
	cabin = Cabin((-2.4, 6.5, 2.5), (-0.6, 5.9, 2.1), 2.6, 4.6)
	pieces = [
		hull("body", [
			(-7.0, 0.9, 2.1, 2.3, 2.45, 2.2), (-6.6, 0.75, 2.4, 2.5, 2.65, 2.4), (-2.4, 0.7, 2.65, 2.5, 2.7, 2.5),
			(6.5, 0.7, 2.65, 2.5, 2.7, 2.5), (7.0, 0.9, 2.5, 2.35, 2.5, 2.3),
		], paint),
		cabin.shell(paint),
		cabin.panel("front", 0.07, 0.93, 0.10, 0.90),
		cabin.panel("back", 0.10, 0.90, 0.18, 0.86),
	]
	for side in ("left", "right"):
		for u0, u1 in ((0.13, 0.37), (0.41, 0.64), (0.68, 0.93)):
			pieces.append(cabin.panel(side, u0, u1, 0.16, 0.84))
	pieces += wheels(2.6, (-4.5, 4.3), 0.95)
	pieces += ends(-7.0, 7.0, 2.35, 1.85)
	pieces += pair((0.1, 8.6, 0.4), 2.7, 0.1, 1.77, "wood_dark")  # wood side trim
	pieces += doors((0.7, 2.65, 2.5, 2.7, 2.5), (-1.8, 0.6, 2.9), (0.2, 2.5), trim)
	pieces += mirrors(2.5, -1.6, 2.95, trim)
	pieces += pair((0.12, 5.6, 0.14), 1.75, 2.6, 4.85, "iron")
	pieces += [bit((3.6, 0.12, 0.12), (0, y, 4.78), "iron") for y in (0.6, 2.6, 4.6)]
	pieces += [
		bit((2.2, 0.1, 0.3), (0, -7.0, 1.55), "iron"),
		lowpoly.box("box", (1.7, 1.5, 1.2), (-0.8, 1.1, 5.5), "wood"),
		lowpoly.box("box", (1.4, 1.3, 0.9), (0.95, 1.0, 5.35), "wood"),
		lowpoly.box("tape", (0.2, 1.54, 1.22), (-0.8, 1.1, 5.51), "bone_shadow"),
		disc(-1.6, 1.6, 4.0, 5.62, 0.75, "wax", 8),
		disc(-0.9, -0.7, 4.0, 5.62, 0.79, "cloth", 8),
		disc(0.7, 0.9, 4.0, 5.62, 0.79, "cloth", 8),
	]
	return mesh.join_objects(pieces, "Estate")


def ice_cream_van():
	"""A boxy van with a striped awning, a serving hatch and a giant cone on the roof."""
	paint, trim = "wax", "ice_pink"
	nose = Cabin((-5.2, -2.0, 2.5), (-3.9, -2.0, 2.4), 2.8, 5.2)
	pieces = [
		hull("body", [
			(-6.4, 0.95, 2.2, 2.2, 2.4, 2.1), (-6.0, 0.75, 2.7, 2.45, 2.6, 2.4), (-4.9, 0.75, 2.95, 2.5, 2.65, 2.5),
			(6.2, 0.75, 2.95, 2.55, 2.7, 2.6), (6.4, 0.85, 2.95, 2.5, 2.65, 2.55),
		], trim),
		nose.shell(paint),
		nose.panel("front", 0.07, 0.93, 0.10, 0.88),
		lowpoly.box("back", (5.2, 8.6, 3.6), (0, 2.0, 4.65), paint),
		lowpoly.box("roof", (5.4, 8.8, 0.25), (0, 2.0, 6.5), trim),
		bit((3.0, 0.1, 1.5), (0, 6.32, 4.9), "car_glass"),
	]
	for side in ("left", "right"):
		pieces.append(nose.panel(side, 0.32, 0.86, 0.14, 0.82))
	pieces += wheels(2.58, (-4.0, 3.9), 1.0)
	pieces += ends(-6.4, 6.4, 2.3, 2.1)
	pieces += mirrors(2.5, -4.3, 3.2, trim)
	pieces.append(bit((1.8, 0.1, 0.35), (0, -6.4, 1.75), "iron"))
	# Both sides get a hatch and awning, so the van stays symmetrical.
	for s in (-1, 1):
		pieces += [
			bit((0.12, 4.0, 1.7), (s * 2.58, 2.2, 4.75), "car_glass"),
			bit((0.6, 4.3, 0.14), (s * 2.8, 2.2, 3.78), "stone_light"),
		]
		for i in range(6):
			y = 0.2 + i * 0.8
			pieces.append(bit((1.2, 0.8, 0.14), (s * 3.05, y, 5.75), "ice_pink" if i % 2 else "wax", s * 24))
	for i, (r, z) in enumerate(((0.28, 6.9), (0.5, 7.35), (0.75, 7.8))):
		pieces.append(lowpoly.box("cone", (r * 2, r * 2, 0.5), (0, 0.4, z), "gold"))
	for r, z, swatch in ((1.0, 8.25, "wax"), (0.78, 8.7, "ice_pink"), (0.45, 9.1, "wax")):
		pieces.append(lowpoly.box("scoop", (r * 2, r * 2, 0.5), (0, 0.4, z), swatch))
	return mesh.join_objects(pieces, "IceCreamVan")


def build():
	cars = [minivan(), hatchback(), estate(), ice_cream_van()]
	for i, car in enumerate(cars):
		car.location.x = (i - 1.5) * SPACING
	return cars[0]
