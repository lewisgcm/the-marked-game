"""Skull — one of the three ritual items (book, candles, skull).

Used on the lobby pedestal behind the middle pad, and later as the pickup in the main game.

Modelled as a signed distance field (lib/sdf.py): cranium, brow, midface, cheekbones,
upper jaw and mandible are blended with smooth unions so they read as one bone; the eye
sockets and nasal cavity are carved with smooth subtractions so their rims look worn.
Teeth are unioned with a tiny blend so they stay distinct.

Authored in "design units" (roughly centimetres, ~21 tall), then scaled to HEIGHT studs.
The face points down Blender's -Y. Single material, so it imports as one MeshPart.
"""

import math

import bpy
import numpy as np

from lib import mesh, sdf

HEIGHT = 1.1  # studs, top of cranium to bottom of jaw
TARGET_TRIS = 4000
CELL = 0.2  # sampling resolution in design units

# Front three-quarter view, so the preview shows the face rather than the cranium.
PREVIEW_DIRECTION = (0.55, -1.2, 0.35)

BONE = (0.80, 0.74, 0.60)


def _mirror(fn):
	"""Evaluate a left-side shape on both sides (skulls are symmetric)."""

	def both(p):
		mirrored = p * np.array([-1.0, 1.0, 1.0])
		return np.minimum(fn(p), fn(mirrored))

	return both


def _teeth(p, z, radius, half):
	"""A row of 8 rounded teeth along an arc, centred on the mouth."""
	d = None
	arc = math.radians(100)
	for i in range(8):
		a = -arc / 2 + arc * i / 7
		centre = (math.sin(a) * radius, -4.2 - math.cos(a) * radius, z)
		tooth = sdf.round_box(p, centre, half, rounding=0.14, yaw=-a)
		d = tooth if d is None else np.minimum(d, tooth)
	return d


def field(p):
	cranium = sdf.ellipsoid(p, (0.0, 1.0, 2.5), (7.0, 9.2, 7.6))
	brow = sdf.ellipsoid(p, (0.0, -7.1, 2.4), (5.0, 1.4, 1.1))
	midface = sdf.ellipsoid(p, (0.0, -5.0, -2.0), (4.8, 3.8, 4.4))
	cheeks = _mirror(lambda q: sdf.ellipsoid(q, (4.6, -4.8, -0.9), (1.7, 2.6, 1.4)))(p)
	arches = _mirror(lambda q: sdf.capsule(q, (5.5, -4.0, -0.8), (6.2, 0.5, -1.0), 0.7))(p)
	maxilla = sdf.ellipsoid(p, (0.0, -5.4, -5.2), (3.6, 3.3, 1.6))

	skull = sdf.smooth_union(cranium, brow, 1.8)
	skull = sdf.smooth_union(skull, midface, 2.0)
	skull = sdf.smooth_union(skull, cheeks, 2.0)
	skull = sdf.smooth_union(skull, arches, 0.8)
	skull = sdf.smooth_union(skull, maxilla, 1.2)

	# Mandible: chin, jaw body and rami, blended into one bone, then only lightly into the
	# skull so the jaw still reads as a separate piece.
	chin = sdf.ellipsoid(p, (0.0, -5.6, -8.4), (2.9, 2.6, 1.5))
	body = _mirror(lambda q: sdf.capsule(q, (2.0, -6.6, -8.0), (4.6, -1.6, -7.4), 1.2))(p)
	rami = _mirror(lambda q: sdf.round_box(q, (4.8, -1.2, -5.0), (0.7, 1.6, 2.8), rounding=0.6))(p)
	mandible = sdf.smooth_union(sdf.smooth_union(chin, body, 0.8), rami, 1.2)
	skull = sdf.smooth_union(skull, mandible, 0.6)

	# Teeth: upper and lower rows.
	teeth = np.minimum(
		_teeth(p, -6.3, 4.3, (0.38, 0.45, 0.6)),
		_teeth(p, -7.3, 4.1, (0.34, 0.42, 0.5)),
	)
	skull = sdf.smooth_union(skull, teeth, 0.1)

	# Eye sockets and nasal cavity.
	sockets = _mirror(lambda q: sdf.ellipsoid(q, (2.5, -7.6, 0.2), (1.9, 3.4, 2.0)))(p)
	skull = sdf.smooth_subtract(skull, sockets, 0.5)
	nose = sdf.ellipsoid(p, (0.0, -8.6, -2.7), (0.85, 1.8, 1.3))
	skull = sdf.smooth_subtract(skull, nose, 0.3)
	return skull


def _triangles(ob):
	ob.data.calc_loop_triangles()
	return len(ob.data.loop_triangles)


def build():
	bone = mesh.material("Bone", BONE, roughness=0.7)
	skull = sdf.to_mesh("Skull", field, (-8.5, -11.0, -11.0), (8.5, 11.5, 11.5), CELL, mat=bone)

	# Light smoothing removes the surface-nets stair-stepping without softening the form.
	mesh.select_only(skull)
	smooth = skull.modifiers.new("Smooth", "SMOOTH")
	smooth.factor = 0.5
	smooth.iterations = 2
	bpy.ops.object.modifier_apply(modifier=smooth.name)

	tris = _triangles(skull)
	if tris > TARGET_TRIS:
		decimate = skull.modifiers.new("Decimate", "DECIMATE")
		decimate.ratio = TARGET_TRIS / tris
		bpy.ops.object.modifier_apply(modifier=decimate.name)

	# Scale design units to studs, and centre the origin on the geometry.
	lo, hi = mesh.bounds([skull])
	scale = HEIGHT / (hi.z - lo.z)
	skull.scale = (scale, scale, scale)
	bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
	bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
	skull.location = (0.0, 0.0, 0.0)

	mesh.shade_smooth(skull, angle=60.0)
	mesh.unwrap(skull)

	lo, hi = mesh.bounds([skull])
	print(f"[skull] {_triangles(skull)} tris, {hi.x - lo.x:.2f} x {hi.y - lo.y:.2f} x {hi.z - lo.z:.2f} studs")
	return skull
