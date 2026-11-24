"""Low-poly vehicle pieces. Vehicles face -Y, stand on Z = 0 and are symmetrical about X = 0, so a
MeshPart's centre is the vehicle's centre. Units are studs; colours come from the palette."""

import math

import bmesh
from mathutils import Vector

from . import lowpoly, palette
from .blocky import bit  # noqa: F401  (detail blocks, for the assets)


def hull(name, sections, swatch):
	"""Bodywork: six-sided cross sections of (y, bottom z, top z, half bottom, half waist, half top)."""
	bm = bmesh.new()
	rings = []
	for y, z0, z1, hb, hm, ht in sections:
		zm = z0 + (z1 - z0) * 0.55
		outline = [(-hb, z0), (hb, z0), (hm, zm), (ht, z1), (-ht, z1), (-hm, zm)]
		rings.append([bm.verts.new((x, y, z)) for x, z in outline])
	for a, b in zip(rings, rings[1:]):
		for i in range(6):
			j = (i + 1) % 6
			bm.faces.new((a[i], a[j], b[j], b[i]))
	bm.faces.new(list(reversed(rings[0])))
	bm.faces.new(rings[-1])
	ob = lowpoly.to_object(name, bm)
	palette.paint(ob, swatch)
	return ob


class Cabin:
	"""A tapered cabin. `base` and `top` are (front y, back y, half width); windows sit on its faces."""

	def __init__(self, base, top, z0, z1):
		(f0, b0, w0), (f1, b1, w1) = base, top
		self.corners = {
			"front": [(-w0, f0, z0), (w0, f0, z0), (w1, f1, z1), (-w1, f1, z1)],
			"back": [(-w0, b0, z0), (w0, b0, z0), (w1, b1, z1), (-w1, b1, z1)],
			"left": [(w0, f0, z0), (w0, b0, z0), (w1, b1, z1), (w1, f1, z1)],
			"right": [(-w0, f0, z0), (-w0, b0, z0), (-w1, b1, z1), (-w1, f1, z1)],
		}
		self.centre = Vector((0, (f0 + b0 + f1 + b1) / 4, (z0 + z1) / 2))
		self.base, self.top, self.z0, self.z1 = base, top, z0, z1

	def shell(self, swatch):
		bm = bmesh.new()
		rings = [
			[bm.verts.new(p) for p in ((-w, f, z), (w, f, z), (w, b, z), (-w, b, z))]
			for (f, b, w), z in ((self.base, self.z0), (self.top, self.z1))
		]
		for i in range(4):
			j = (i + 1) % 4
			bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))
		bm.faces.new(list(reversed(rings[0])))
		bm.faces.new(rings[1])
		ob = lowpoly.to_object("cabin", bm)
		palette.paint(ob, swatch)
		return ob

	def panel(self, face, u0, u1, v0, v1, swatch="car_glass", out=0.05):
		"""A thin slab on `face`, from (u0, v0) to (u1, v1) as fractions (u: left/front to right/back)."""
		a, b, c, d = (Vector(p) for p in self.corners[face])
		at = lambda u, v: (a.lerp(b, u)).lerp(d.lerp(c, u), v)  # noqa: E731
		quad = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)]
		normal = (quad[1] - quad[0]).cross(quad[3] - quad[0]).normalized()
		if normal.dot(quad[0] - self.centre) < 0:
			normal.negate()
		bm = bmesh.new()
		outer = [bm.verts.new(p + normal * out) for p in quad]
		inner = [bm.verts.new(p - normal * 0.1) for p in quad]
		bm.faces.new(outer)
		bm.faces.new(list(reversed(inner)))
		for i in range(4):
			j = (i + 1) % 4
			bm.faces.new((outer[i], outer[j], inner[j], inner[i]))
		ob = lowpoly.to_object("panel", bm)
		palette.paint(ob, swatch)
		return ob


def side_strip(section, side, y0, y1, swatch, low=0.0, high=1.0, out=0.03):
	"""A skin over one side (+1/-1) of a hull whose `section` is (bottom z, top z, half bottom, half
	waist, half top), following its bulge: a door seam if narrow, a whole door if wide. `low` and
	`high` trim it, as fractions of the lower and upper faces."""
	z0, z1, hb, hm, ht = section
	zm = z0 + (z1 - z0) * 0.55
	profile = [
		(hb + (hm - hb) * low, z0 + (zm - z0) * low), (hm, zm), (hm + (ht - hm) * high, zm + (z1 - zm) * high),
	]
	bm = bmesh.new()
	rings = []
	for y in (y0, y1):
		outer = [bm.verts.new((side * (x + out), y, z)) for x, z in profile]
		inner = [bm.verts.new((side * (x - 0.15), y, z)) for x, z in reversed(profile)]
		rings.append(outer + inner)
	n = len(rings[0])
	for i in range(n):
		j = (i + 1) % n
		bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))
	bm.faces.new(list(reversed(rings[0])))
	bm.faces.new(rings[1])
	ob = lowpoly.to_object("strip", bm)
	palette.paint(ob, swatch)
	return ob


def disc(x0, x1, y, z, radius, swatch, sides=10):
	"""A solid disc along X."""
	bm = bmesh.new()
	lowpoly.tapered_prism(bm, Vector((x0, y, z)), Vector((x1, y, z)), radius, radius, sides, math.pi / sides)
	ob = lowpoly.to_object("disc", bm)
	palette.paint(ob, swatch)
	return ob


def wheels(half, axles, radius=0.95, hub="stone_light"):
	"""Four wheels in dark arches; `half` is the body's half width at the axle."""
	pieces = []
	for s in (-1, 1):
		for y in axles:
			pieces += [
				disc(s * (half - 0.7), s * (half + 0.03), y, radius + 0.16, radius + 0.13, "iron_light"),
				disc(s * (half - 0.6), s * (half + 0.12), y, radius, radius, "iron"),
				disc(s * (half + 0.05), s * (half + 0.17), y, radius, radius * 0.52, hub, 8),
			]
	return pieces


def pair(size, x, y, z, swatch, roll=0.0):
	"""A detail on both sides."""
	return [bit(size, (s * x, y, z), swatch, s * roll) for s in (-1, 1)]
