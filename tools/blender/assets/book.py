"""Book — an old grimoire, one of the three ritual items (book, candles, skull).

A closed tome lying flat: two leather boards, a rounded spine with raised bands, a raised
border and sigil on each cover, metal corner guards, and a heavy clasp over the fore-edge.

The *pages* are not in this mesh. A MeshPart has a single colour, so cream pages inside dark
covers would come out the same colour; instead the game fills the gap between the boards
with a plain Part (PAGES below, mirrored as BOOK_PAGES_SIZE in src/lobby/server/decor.ts).

The mesh is deliberately symmetric about its bounding-box centre on every axis (the clasp
sticks out exactly as far as the spine), so the pages Part sits at the MeshPart's position
with no offset, whichever way the importer maps the axes.

Authored in studs; the cover faces up (+Z), the spine is on -X.
"""

import math

import bpy

from lib import mesh

# Pages block (the gap between the boards), in studs: X (spine to fore-edge), Y, Z (thickness).
PAGES = (1.4, 1.0, 0.3)
BOARD = 0.07  # cover board thickness
OVERHANG = 0.05  # boards stick out past the pages
SPINE_RADIUS = PAGES[2] / 2 + BOARD
RELIEF = 0.025  # height of raised details on the covers
BAND = 0.018  # spine bands stand this far proud of the spine

HALF_X = PAGES[0] / 2
HALF_Y = PAGES[1] / 2 + OVERHANG
TOP = PAGES[2] / 2 + BOARD  # outer face of the top board
EXTENT_X = HALF_X + SPINE_RADIUS + BAND  # spine bands reach this far on -X; the clasp matches on +X

LEATHER = (0.22, 0.04, 0.04)

PREVIEW_DIRECTION = (0.6, -1.0, 0.9)


def _box(name, lo, hi, bevel=None):
	size = tuple(h - l for l, h in zip(lo, hi))
	centre = tuple((l + h) / 2 for l, h in zip(lo, hi))
	return mesh.add_box(name, size, centre, bevel_width=bevel)


def _y_cylinder(name, radius, length, x, y, z, vertices=16):
	ob = mesh.add_cylinder(name, radius, length, (x, y, z), vertices=vertices)
	ob.rotation_euler = (math.pi / 2, 0.0, 0.0)
	return ob


def _relief(sign, height):
	"""(lo_z, hi_z) for a raised detail of `height` on the top (+1) or bottom (-1) cover."""
	return tuple(sorted((sign * TOP, sign * (TOP + height))))


def _cover_details(sign):
	"""Raised border, sigil and corner guards on one cover (sign=+1 top, -1 bottom).

	Details that overlap get different heights: coplanar faces in one mesh z-fight, which
	shows up as black specks.
	"""
	lo_z, hi_z = _relief(sign, RELIEF)
	parts = []

	# Border frame, inset from the board edge.
	inset = 0.1
	bx0, bx1 = -HALF_X + inset, HALF_X + OVERHANG - inset
	by = HALF_Y - inset
	w = 0.03
	parts += [
		# The long sides butt against the short ones instead of overlapping them.
		_box("BorderN", (bx0 + w, by - w, lo_z), (bx1 - w, by, hi_z)),
		_box("BorderS", (bx0 + w, -by, lo_z), (bx1 - w, -by + w, hi_z)),
		_box("BorderW", (bx0, -by, lo_z), (bx0 + w, by, hi_z)),
		_box("BorderE", (bx1 - w, -by, lo_z), (bx1, by, hi_z)),
	]

	# Sigil: two concentric rings and a raised boss, centred on the cover.
	cx = (bx0 + bx1) / 2
	for major in (0.24, 0.13):
		bpy.ops.mesh.primitive_torus_add(
			major_radius=major,
			minor_radius=0.022,
			major_segments=20,
			minor_segments=4,
			location=(cx, 0.0, (lo_z + hi_z) / 2),
		)
		ring = bpy.context.object
		ring.scale = (1.0, 1.0, RELIEF / 0.044)
		parts.append(ring)
	parts.append(mesh.add_cylinder("Boss", 0.05, RELIEF, (cx, 0.0, (lo_z + hi_z) / 2), vertices=12))

	# Metal corner guards on the fore-edge corners (the spine covers the other two), standing
	# proud of the border they sit over.
	lo_z, hi_z = _relief(sign, RELIEF * 1.6)
	g = 0.2
	t = 0.035
	gx = HALF_X + OVERHANG + 0.006  # stands just proud of the board edges, again to avoid z-fighting
	for sy in (-1, 1):
		y_edge = sy * (HALF_Y + 0.006)
		parts.append(_box("GuardX", (gx - g, min(y_edge, y_edge - sy * t), lo_z), (gx, max(y_edge, y_edge - sy * t), hi_z)))
		parts.append(_box("GuardY", (gx - t, min(y_edge, y_edge - sy * g), lo_z), (gx, max(y_edge, y_edge - sy * g), hi_z)))
	return parts


def build():
	leather = mesh.material("Leather", LEATHER, roughness=0.75)

	parts = []
	# Boards.
	for sign in (-1, 1):
		lo_z, hi_z = sorted((sign * PAGES[2] / 2, sign * TOP))
		parts.append(_box("Board", (-HALF_X, -HALF_Y, lo_z), (HALF_X + OVERHANG, HALF_Y, hi_z), bevel=0.012))
		parts += _cover_details(sign)

	# Rounded spine with raised bands.
	# A hair shorter than the boards, so its end caps aren't coplanar with the board ends.
	parts.append(_y_cylinder("Spine", SPINE_RADIUS, HALF_Y * 2 - 0.012, -HALF_X, 0.0, 0.0, vertices=20))
	for y in (-0.3, 0.0, 0.3):
		parts.append(_y_cylinder("SpineBand", SPINE_RADIUS + BAND, 0.06, -HALF_X, y, 0.0, vertices=20))

	# Clasp: a strap over the fore-edge, buckled at the front. Its outer face lines up with
	# the far side of the spine, keeping the mesh centred.
	strap = 0.09
	strap_height = RELIEF * 1.3  # between the border and the corner guards
	parts.append(
		_box("Clasp", (HALF_X + OVERHANG - 0.02, -strap, -TOP - strap_height), (EXTENT_X, strap, TOP + strap_height), bevel=0.01)
	)
	for sign in (-1, 1):
		lo_z, hi_z = _relief(sign, strap_height)
		parts.append(_box("Strap", (HALF_X - 0.3, -strap * 0.75, lo_z), (HALF_X + OVERHANG, strap * 0.75, hi_z)))

	mesh.select_only(parts)
	bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
	book = mesh.join_objects(parts, "Book")
	book.data.materials.clear()
	book.data.materials.append(leather)
	mesh.shade_smooth(book, angle=30.0)
	mesh.unwrap(book)

	# Preview-only pages, so the render shows the finished look.
	pages = _box("PagesPreview", (-PAGES[0] / 2, -PAGES[1] / 2, -PAGES[2] / 2), (PAGES[0] / 2, PAGES[1] / 2, PAGES[2] / 2))
	pages.data.materials.append(mesh.material("PagesPreview", (0.78, 0.72, 0.58), roughness=0.9))
	mesh.mark_preview_only(pages)

	lo, hi = mesh.bounds([book])
	centre = (lo + hi) / 2
	print(
		f"[book] {hi.x - lo.x:.3f} x {hi.y - lo.y:.3f} x {hi.z - lo.z:.3f} studs, "
		f"bounds centre ({centre.x:.4f}, {centre.y:.4f}, {centre.z:.4f}) — must be ~0 so the pages line up"
	)
	return book
