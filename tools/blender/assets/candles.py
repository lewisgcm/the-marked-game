"""Candles — a melted cluster of ritual candles, one of the three ritual items.

Four pillar candles of different heights standing in a shared puddle of wax, each with a
melted dip in its top and wax drips running down its sides. Modelled as a signed distance
field (lib/sdf.py) so the candles, drips and puddle melt into one another.

The flames are not in the mesh: the game adds a Neon flame and a flickering PointLight at
each wick (CANDLE_WICKS in src/lobby/server/decor.ts mirrors CANDLES below).

Layout is mirror-symmetric left/right and the puddle sets the bounding box, so the mesh's
bounds centre is at (0, 0, HEIGHT / 2) in Blender terms and the wick offsets hold whichever
way the importer maps the X axis. Authored in studs; Blender -Y is the front.
"""

import math
import random

import bpy
import numpy as np

from lib import mesh, sdf

# (x, y, radius, height) per candle, in studs. Mirror-symmetric in x.
CANDLES = [
	(0.0, 0.25, 0.2, 1.2),  # back, tallest
	(-0.42, 0.0, 0.17, 0.8),  # sides
	(0.42, 0.0, 0.17, 0.8),
	(0.0, -0.32, 0.15, 0.5),  # front, shortest
]
PUDDLE = (0.75, 0.65, 0.1)  # radii; it also defines the X/Y bounds
HEIGHT = max(c[3] for c in CANDLES)
CELL = 0.018
TARGET_TRIS = 1500

WAX = (0.86, 0.80, 0.66)

PREVIEW_DIRECTION = (0.5, -1.2, 0.55)

# Fixed seed: the drips land in the same places every build.
_rng = random.Random(7)


def _cylinder(p, x, y, radius, height, rounding=0.03):
	"""Upright cylinder standing on z=0, with softened edges."""
	q = p - np.array([x, y, height / 2])
	radial = np.sqrt(q[..., 0] ** 2 + q[..., 1] ** 2) - (radius - rounding)
	vertical = np.abs(q[..., 2]) - (height / 2 - rounding)
	outside = np.sqrt(np.maximum(radial, 0) ** 2 + np.maximum(vertical, 0) ** 2)
	return outside + np.minimum(np.maximum(radial, vertical), 0) - rounding


def _drips(p, x, y, radius, height):
	"""A few wax runs down the side of a candle, each ending in a small bead."""
	d = None
	for _ in range(3):
		a = _rng.uniform(0, math.tau)
		length = _rng.uniform(0.15, height * 0.7)
		r = _rng.uniform(0.03, 0.045)
		top = (x + math.cos(a) * radius, y + math.sin(a) * radius, height - 0.02)
		bottom = (top[0], top[1], max(top[2] - length, 0.05))
		run = sdf.capsule(p, top, bottom, r)
		bead = sdf.sphere(p, bottom, r * 1.5)
		drip = sdf.smooth_union(run, bead, 0.03)
		d = drip if d is None else np.minimum(d, drip)
	return d


def field(p):
	# Puddle: the lower half of a flat ellipsoid, so the cluster sits flat on z=0.
	puddle = np.maximum(sdf.ellipsoid(p, (0.0, 0.0, 0.0), PUDDLE), -p[..., 2])
	shape = puddle
	for x, y, radius, height in CANDLES:
		candle = _cylinder(p, x, y, radius, height)
		# Melted top: a shallow dip, leaving a raised rim.
		candle = sdf.smooth_subtract(candle, sdf.sphere(p, (x, y, height + radius * 0.55), radius * 0.8), 0.03)
		candle = sdf.smooth_union(candle, _drips(p, x, y, radius, height), 0.04)
		shape = sdf.smooth_union(shape, candle, 0.08)
	# Nothing below the floor.
	return np.maximum(shape, -p[..., 2])


def _triangles(ob):
	ob.data.calc_loop_triangles()
	return len(ob.data.loop_triangles)


def build():
	wax = mesh.material("Wax", WAX, roughness=0.45)
	margin = 3 * CELL
	lo = (-PUDDLE[0] - margin, -PUDDLE[1] - margin, -margin)
	hi = (PUDDLE[0] + margin, PUDDLE[1] + margin, HEIGHT + margin)
	candles = sdf.to_mesh("Candles", field, lo, hi, CELL, mat=wax)

	mesh.select_only(candles)
	smooth = candles.modifiers.new("Smooth", "SMOOTH")
	smooth.factor = 0.5
	smooth.iterations = 2
	bpy.ops.object.modifier_apply(modifier=smooth.name)

	tris = _triangles(candles)
	if tris > TARGET_TRIS:
		decimate = candles.modifiers.new("Decimate", "DECIMATE")
		decimate.ratio = TARGET_TRIS / tris
		bpy.ops.object.modifier_apply(modifier=decimate.name)

	mesh.shade_smooth(candles, angle=60.0)
	mesh.unwrap(candles)

	# Preview-only flames, so the render shows the finished look.
	flame = mesh.material("FlamePreview", (1.0, 0.55, 0.15), emission=(1.0, 0.55, 0.15), emission_strength=8.0)
	for x, y, _, height in CANDLES:
		bpy.ops.mesh.primitive_uv_sphere_add(radius=0.07, location=(x, y, height + 0.08))
		ob = bpy.context.object
		ob.scale = (1.0, 1.0, 1.6)
		ob.data.materials.append(flame)
		mesh.mark_preview_only(ob)

	lo, hi = mesh.bounds([candles])
	centre = (lo + hi) / 2
	print(
		f"[candles] {_triangles(candles)} tris, {hi.x - lo.x:.3f} x {hi.y - lo.y:.3f} x {hi.z - lo.z:.3f} studs, "
		f"bounds centre ({centre.x:.3f}, {centre.y:.3f}, {centre.z:.3f}), bottom z={lo.z:.3f}"
	)
	for x, y, _, height in CANDLES:
		print(f"[candles] wick at x={x:+.2f} y={y:+.2f}, {height - centre.z:+.3f} above the mesh centre")
	return candles
