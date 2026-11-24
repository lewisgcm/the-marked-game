"""The kids' flashlight: an original camping torch, one static mesh (Torch).

Ribbed rubber grip, a taped repair and a wrist strap. It points along -Y with its axis on the origin,
sized to replace the grey-box handle in src/main/server/flashlight.ts. The front is open: the game's
Lens part sits in it, so it can glow when the light is on.
"""

import math

import bmesh

from lib import lowpoly, mesh, palette
from lib.blocky import bit, preview_lights  # noqa: F401

EMBED_PALETTE = True
PREVIEW_DIRECTION = (0.9, -1.0, 0.55)
PREVIEW_MARGIN = 0.95
PREVIEW_BACKGROUND = (0.10, 0.11, 0.13)


def lathe(name, rings, swatch, sides=8):
	"""A solid round the Y axis: rings of (y, radius), front to back. Flat caps at both ends."""
	bm = bmesh.new()
	loops = []
	for y, r in rings:
		loops.append([
			bm.verts.new((r * math.cos(a), y, r * math.sin(a)))
			for a in (math.pi / sides + 2 * math.pi * i / sides for i in range(sides))
		])
	for a, b in zip(loops, loops[1:]):
		for i in range(sides):
			j = (i + 1) % sides
			bm.faces.new((a[i], a[j], b[j], b[i]))
	bm.faces.new(loops[0])
	bm.faces.new(list(reversed(loops[-1])))
	ob = lowpoly.to_object(name, bm)
	palette.paint(ob, swatch)
	return ob


def build():
	# The head: a flared bell, then a rim ring that runs inwards to make the socket for the lens.
	bell = lathe("bell", [
		(-0.58, 0.24), (-0.58, 0.30), (-0.74, 0.34), (-0.80, 0.34), (-0.80, 0.27), (-0.70, 0.24),
	], "iron")
	neck = lathe("neck", [(-0.58, 0.30), (-0.50, 0.31), (-0.34, 0.20), (-0.30, 0.18)], "car_teal")
	collar = lathe("collar", [(-0.46, 0.29), (-0.40, 0.29)], "car_teal_dark")
	grip = lathe("grip", [(-0.30, 0.18), (0.50, 0.18)], "iron_light")
	pieces = [bell, neck, collar, grip]
	# Rubber ribs, with a wrap of tape over the last two.
	for i in range(6):
		y = -0.22 + i * 0.10
		pieces.append(lathe("rib", [(y, 0.20), (y + 0.05, 0.20)], "iron"))
	pieces += [
		lathe("tape", [(0.20, 0.205), (0.34, 0.205)], "bone"),
		lathe("tape_edge", [(0.34, 0.208), (0.37, 0.208)], "bone_shadow"),
		lathe("cap", [(0.50, 0.19), (0.56, 0.20), (0.64, 0.18), (0.66, 0.12)], "car_teal"),
		# The sliding switch on top.
		bit((0.12, 0.24, 0.05), (0, -0.02, 0.20), "iron"),
		bit((0.08, 0.09, 0.06), (0, -0.08, 0.235), "car_tail"),
	]
	# The wrist strap: a flat loop hanging off the tail cap, in the Y-Z plane.
	loop = [
		(0.64, 0.05), (0.80, 0.02), (0.92, -0.14), (0.88, -0.34), (0.74, -0.42), (0.62, -0.32), (0.60, -0.12),
	]
	for (y0, z0), (y1, z1) in zip(loop, loop[1:]):
		length = math.hypot(y1 - y0, z1 - z0)
		piece = lowpoly.box("strap", (0.05, length + 0.02, 0.035), (0, 0, 0), "cloth")
		piece.location = (0, (y0 + y1) / 2, (z0 + z1) / 2)
		piece.rotation_euler = (math.atan2(z1 - z0, y1 - y0), 0, 0)
		pieces.append(piece)
	return mesh.join_objects(pieces, "Torch")
