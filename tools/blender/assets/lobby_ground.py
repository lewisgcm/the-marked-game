"""The lobby's ground: a 120 x 120 stud faceted low-poly sheet in the kit palette.

Mostly grass with darker moss and dirt patches, a worn dirt strip under the path, gentle dips.
Its top is at z = 0 and its bottom at exactly z = -DIP, so in Roblox its centre sits at
y = -DIP / 2 (src/lobby/server/kitDecor.ts). The lobby's flat floor Part stays underneath, made
invisible, for walking on.
"""

import math
import random

import bmesh

from lib import lowpoly, palette

SIZE = 120.0
CELLS = 30
DIP = 0.3
PREVIEW_DIRECTION = (0.0, -1.0, 0.9)


def _patch(x, y):
	"""Low-frequency noise in 0..1 for clustering patches."""
	return 0.5 + 0.25 * math.sin(x * 0.11 + 1.3) * math.cos(y * 0.09 - 0.4) + 0.25 * math.sin((x + y) * 0.05 + 2.1)


def build():
	rng = random.Random(97)
	bm = bmesh.new()
	step = SIZE / CELLS
	half = SIZE / 2
	grid = []
	for j in range(CELLS + 1):
		row = []
		for i in range(CELLS + 1):
			x, y = -half + i * step, -half + j * step
			edge = i in (0, CELLS) or j in (0, CELLS)
			# Jitter inner points sideways too, so the facets aren't a regular grid.
			jx = 0 if edge else rng.uniform(-0.35, 0.35) * step
			jy = 0 if edge else rng.uniform(-0.35, 0.35) * step
			z = 0.0 if edge else -rng.uniform(0, DIP)
			row.append(bm.verts.new((x + jx, y + jy, z)))
		grid.append(row)
	# Pin the exact bounds: one corner at the top (edges are 0) and one point at the very bottom.
	grid[CELLS // 2][CELLS // 2].co.z = -DIP
	for j in range(CELLS):
		for i in range(CELLS):
			a, b, c, d = grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]
			# Alternate the diagonal for a less regular triangle pattern.
			if (i + j) % 2:
				bm.faces.new((a, b, c))
				bm.faces.new((a, c, d))
			else:
				bm.faces.new((a, b, d))
				bm.faces.new((b, c, d))
	ob = lowpoly.to_object("Ground", bm)
	ob.rotation_euler = (0, 0, 0)

	def colour(face):
		c = face.calc_center_median()
		# Worn dirt under the gate path (Blender -Y is the lobby's south, the gate side).
		if abs(c.x) < 4.5 and c.y < -10:
			return "dirt"
		n = _patch(c.x, c.y) + rng.uniform(-0.12, 0.12)
		if n > 0.78:
			return "moss"
		if n < 0.25:
			return "dirt"
		if n < 0.42:
			return "moss_dark"
		return "grass"

	for swatch in ("grass", "moss", "moss_dark", "dirt"):
		pass
	# Paint each face once with its swatch.
	choices = {}
	import bpy  # noqa: F401  (bmesh face lookup below needs an up-to-date mesh)

	b2 = bmesh.new()
	b2.from_mesh(ob.data)
	for face in b2.faces:
		choices[face.index] = colour(face)
	b2.free()
	for swatch in set(choices.values()):
		palette.paint_where(ob, swatch, lambda f, s=swatch: choices.get(f.index) == s)
