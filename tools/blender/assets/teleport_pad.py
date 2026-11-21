"""Teleport pad — the platform each lobby queue zone stands on.

Profile, outside in: rounded rim, drop into a flat glow groove, step up to a centre
plateau, then a machined disc flush with the rim. The groove is where
`createPadGlowRing` (src/lobby/server/world.ts) drops four Neon parts, so the pad
stays a single-material mesh mostly: one MeshId, one MeshPart, no importer splits.

Built in studs at exactly SIZE, with the origin at the geometric centre. The MeshPart's
Size stays at 1,1,1 — a MeshPart's Size is a multiplier of the mesh's own scale, so the
geometry here *is* the size and no scaling is applied. Everything below is proportional to
SIZE via `_s()`, so changing SIZE rebuilds the same shape at a different size; the game
code mirrors the resulting dimensions (world.ts) and positions the pad with PAD_HEIGHT.
"""

from lib import mesh

# The pad was designed at 14 studs; SIZE scales the whole design proportionally.
DESIGN_SIZE = 14.0
SIZE = 10.0        # studs across (should match ZONE_PLATFORM_SIZE)


def _s(value):
	"""Design units (authored at DESIGN_SIZE) -> studs at the current SIZE."""
	return value * SIZE / DESIGN_SIZE


CORNER = _s(0.45)          # outer corner rounding
EDGE_CORNER = _s(0.12)     # rounding on the inner steps (never 0 — keeps ring topology uniform)
RIM = _s(1.3)              # rim width
GROOVE = _s(1.9)           # flat glow groove width
DEPTH = _s(1.1)            # studs tall
FLOOR_Z = _s(0.30)         # groove floor height above centre
PLATEAU_Z = _s(0.50)       # centre plateau height
DISC_RADIUS = _s(3.15)
GLOW_THICKNESS = _s(0.11)

# Derived, and duplicated in src/lobby/server/world.ts — keep the two in sync.
GROOVE_OUTER = SIZE - 2 * RIM
GROOVE_INNER = GROOVE_OUTER - 2 * GROOVE
GLOW_COLOR = (0.06, 0.72, 0.30)

TOP_Z = DEPTH / 2


def _glow_ring(mat):
	"""Preview-only neon ring in the groove — the game builds this from Parts."""
	band = GROOVE - _s(0.04)
	mid = (GROOVE_OUTER + GROOVE_INNER) / 4
	z = FLOOR_Z + GLOW_THICKNESS / 2
	overlap = _s(0.08)
	parts = [
		mesh.add_box("Glow_N", (GROOVE_OUTER - overlap, band, GLOW_THICKNESS), (0.0, mid, z), mat),
		mesh.add_box("Glow_S", (GROOVE_OUTER - overlap, band, GLOW_THICKNESS), (0.0, -mid, z), mat),
		mesh.add_box("Glow_E", (band, GROOVE_INNER + overlap, GLOW_THICKNESS), (mid, 0.0, z), mat),
		mesh.add_box("Glow_W", (band, GROOVE_INNER + overlap, GLOW_THICKNESS), (-mid, 0.0, z), mat),
	]
	mesh.mark_preview_only(*parts)


def build():
	metal = mesh.material("PadMetal", (0.055, 0.062, 0.075), roughness=0.40, metallic=0.75)
	disc_mat = mesh.material("PadDisc", (0.42, 0.45, 0.50), roughness=0.45, metallic=0.20)
	glow_mat = mesh.material(
		"PadGlowPreview",
		GLOW_COLOR,
		roughness=0.3,
		emission=GLOW_COLOR,
		emission_strength=0.55,
	)

	profile = [
		(SIZE / 2, CORNER, TOP_Z - _s(0.13)),               # top of the outer wall
		(SIZE / 2 - _s(0.14), CORNER, TOP_Z),               # chamfer up to the rim
		(GROOVE_OUTER / 2, EDGE_CORNER, TOP_Z),             # rim inner edge
		(GROOVE_OUTER / 2, EDGE_CORNER, FLOOR_Z),           # groove wall, down
		(GROOVE_INNER / 2, EDGE_CORNER, FLOOR_Z),           # groove floor, inwards
		(GROOVE_INNER / 2, EDGE_CORNER, PLATEAU_Z),         # plateau edge, up
	]
	base = mesh.profile_solid("PadBase", profile, metal, bottom_z=-TOP_Z)

	disc_depth = TOP_Z - PLATEAU_Z
	disc = mesh.add_cylinder(
		"PadDisc",
		radius=DISC_RADIUS,
		depth=disc_depth,
		location=(0.0, 0.0, PLATEAU_Z + disc_depth / 2),
		mat=disc_mat,
		vertices=24,
	)

	pad = mesh.join_objects([base, disc], "TeleportPad")
	mesh.shade_smooth(pad, angle=30.0)
	mesh.unwrap(pad)

	_glow_ring(glow_mat)

	lo, hi = mesh.bounds([pad])
	print(
		f"[teleport_pad] groove {GROOVE_INNER:.2f}..{GROOVE_OUTER:.2f} studs, "
		f"floor z={FLOOR_Z:.3f}, top z={hi.z:.3f}, footprint {hi.x - lo.x:g}x{hi.y - lo.y:g}"
	)
	return pad

