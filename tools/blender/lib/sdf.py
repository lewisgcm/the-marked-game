"""Signed-distance-field modelling for organic props (skulls, roots, melted wax...).

Shapes are numpy functions of points `p` (shape `(..., 3)`) that return the signed distance
to the surface: negative inside, positive outside. Combine them with `smooth_union` /
`smooth_subtract`, which blend over a radius `k` — that blend is what makes separate pieces
read as one organic form, and what gives carved holes soft, worn edges.

`to_mesh` samples the field on a grid and polygonises it with naive surface nets (a vertex
per surface-crossing cell, a quad per sign-changing grid edge). No lookup tables, and the
output is a clean quad mesh that decimates well.
"""

import bmesh
import bpy
import numpy as np

# --- Primitives -------------------------------------------------------------------------


def _length(v):
	return np.sqrt((v * v).sum(-1))


def _rotate_z(p, centre, angle):
	"""Rotate points about a vertical axis through `centre` by -angle (into shape space)."""
	q = p - centre
	c, s = np.cos(-angle), np.sin(-angle)
	x = q[..., 0] * c - q[..., 1] * s
	y = q[..., 0] * s + q[..., 1] * c
	return np.stack([x, y, q[..., 2]], -1)


def sphere(p, centre, radius):
	return _length(p - np.asarray(centre)) - radius


def ellipsoid(p, centre, radii):
	"""Approximate (but well-behaved) ellipsoid distance."""
	q = p - np.asarray(centre)
	r = np.asarray(radii, dtype=float)
	k0 = _length(q / r)
	k1 = _length(q / (r * r))
	return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)


def capsule(p, a, b, radius):
	"""Rounded segment from `a` to `b`."""
	a = np.asarray(a, dtype=float)
	ba = np.asarray(b, dtype=float) - a
	pa = p - a
	h = np.clip((pa * ba).sum(-1) / (ba * ba).sum(), 0.0, 1.0)
	return _length(pa - ba * h[..., None]) - radius


def round_box(p, centre, half, rounding=0.0, yaw=0.0):
	"""Box with half-extents `half`, edges rounded by `rounding`, turned `yaw` about Z."""
	q = _rotate_z(p, np.asarray(centre, dtype=float), yaw) if yaw else p - np.asarray(centre)
	d = np.abs(q) - (np.asarray(half, dtype=float) - rounding)
	outside = _length(np.maximum(d, 0.0))
	inside = np.minimum(d.max(-1), 0.0)
	return outside + inside - rounding


# --- Operators --------------------------------------------------------------------------


def union(*ds):
	out = ds[0]
	for d in ds[1:]:
		out = np.minimum(out, d)
	return out


def smooth_union(a, b, k):
	"""Union that blends the two surfaces over radius `k`."""
	h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
	return b * (1.0 - h) + a * h - k * h * (1.0 - h)


def smooth_subtract(a, b, k):
	"""`a` with `b` carved out, edges softened over radius `k`."""
	h = np.clip(0.5 - 0.5 * (a + b) / k, 0.0, 1.0)
	return a * (1.0 - h) - b * h + k * h * (1.0 - h)


# --- Meshing ----------------------------------------------------------------------------

_CORNERS = np.array([(0, 0, 0), (1, 0, 0), (0, 1, 0), (1, 1, 0), (0, 0, 1), (1, 0, 1), (0, 1, 1), (1, 1, 1)])
_EDGES = [(0, 1), (2, 3), (4, 5), (6, 7), (0, 2), (1, 3), (4, 6), (5, 7), (0, 4), (1, 5), (2, 6), (3, 7)]


def _surface_nets(values, origin, cell):
	nx, ny, nz = values.shape
	corner_vals = [values[dx : nx - 1 + dx, dy : ny - 1 + dy, dz : nz - 1 + dz] for dx, dy, dz in _CORNERS]
	inside = [v < 0 for v in corner_vals]
	active = np.logical_or.reduce(inside) & ~np.logical_and.reduce(inside)

	# One vertex per active cell: the mean of its edges' zero crossings.
	total = np.zeros(active.shape + (3,))
	count = np.zeros(active.shape)
	for a, b in _EDGES:
		va, vb = corner_vals[a], corner_vals[b]
		crosses = (va < 0) != (vb < 0)
		denom = np.where(crosses, va - vb, 1.0)
		t = np.where(crosses, va / denom, 0.0)
		pos = _CORNERS[a] + t[..., None] * (_CORNERS[b] - _CORNERS[a])
		total += np.where(crosses[..., None], pos, 0.0)
		count += crosses
	local = total / np.maximum(count, 1)[..., None]

	index = -np.ones(active.shape, dtype=np.int64)
	ci, cj, ck = np.nonzero(active)
	index[ci, cj, ck] = np.arange(len(ci))
	verts = origin + (np.stack([ci, cj, ck], 1) + local[ci, cj, ck]) * cell

	# One quad per sign-changing grid edge, joining the four cells around it.
	quads = []
	inside_pts = values < 0
	# X edges: cells (i, j-1..j, k-1..k)
	ei, ej, ek = np.nonzero(inside_pts[:-1, 1:-1, 1:-1] != inside_pts[1:, 1:-1, 1:-1])
	ej, ek = ej + 1, ek + 1
	quads.append(np.stack([index[ei, ej - 1, ek - 1], index[ei, ej, ek - 1], index[ei, ej, ek], index[ei, ej - 1, ek]], 1))
	# Y edges: cells (i-1..i, j, k-1..k)
	ei, ej, ek = np.nonzero(inside_pts[1:-1, :-1, 1:-1] != inside_pts[1:-1, 1:, 1:-1])
	ei, ek = ei + 1, ek + 1
	quads.append(np.stack([index[ei - 1, ej, ek - 1], index[ei, ej, ek - 1], index[ei, ej, ek], index[ei - 1, ej, ek]], 1))
	# Z edges: cells (i-1..i, j-1..j, k)
	ei, ej, ek = np.nonzero(inside_pts[1:-1, 1:-1, :-1] != inside_pts[1:-1, 1:-1, 1:])
	ei, ej = ei + 1, ej + 1
	quads.append(np.stack([index[ei - 1, ej - 1, ek], index[ei, ej - 1, ek], index[ei, ej, ek], index[ei - 1, ej, ek]], 1))
	faces = np.concatenate(quads)
	faces = faces[(faces >= 0).all(1)]
	return verts, faces


def to_mesh(name, field, lo, hi, cell, mat=None):
	"""Polygonise `field` inside the box `lo`..`hi` at resolution `cell` into a mesh object.

	Keep a margin of at least one cell between the shape and the box, or it gets clipped open.
	"""
	lo = np.asarray(lo, dtype=float)
	axes = [np.arange(lo[i], hi[i] + cell, cell) for i in range(3)]
	grid = np.stack(np.meshgrid(*axes, indexing="ij"), -1)
	values = field(grid)
	verts, faces = _surface_nets(values, lo, cell)

	me = bpy.data.meshes.new(name)
	me.from_pydata(verts.tolist(), [], faces.tolist())
	me.validate()

	# Surface nets doesn't promise consistent winding; recalc to point every normal outward.
	bm = bmesh.new()
	bm.from_mesh(me)
	bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=cell * 0.01)
	bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
	bm.to_mesh(me)
	bm.free()
	if mat is not None:
		me.materials.append(mat)

	ob = bpy.data.objects.new(name, me)
	bpy.context.scene.collection.objects.link(ob)
	return ob
