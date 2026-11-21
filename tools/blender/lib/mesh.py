"""Mesh helpers for headless Blender asset scripts.

Everything here works on plain meshes so the output stays predictable when it is
exported to FBX and imported into Roblox. No UI-only features, no surprises.
"""

import math

import bmesh
import bpy
from mathutils import Vector


def reset_scene():
	"""Wipe Blender back to an empty metric scene and return it."""
	bpy.ops.wm.read_factory_settings(use_empty=True)
	scene = bpy.context.scene
	scene.unit_settings.system = "METRIC"
	scene.unit_settings.scale_length = 1.0
	return scene


def select_only(objs):
	"""Deselect everything, then select + activate `objs` (list or single object)."""
	if not isinstance(objs, (list, tuple)):
		objs = [objs]
	bpy.ops.object.select_all(action="DESELECT")
	for ob in objs:
		ob.select_set(True)
	if objs:
		bpy.context.view_layer.objects.active = objs[0]


def _set_input(node, names, value):
	"""Set the first socket that exists — Principled BSDF renamed sockets over versions."""
	for name in names:
		socket = node.inputs.get(name)
		if socket is not None:
			socket.default_value = value
			return True
	return False


def material(name, color, roughness=0.6, metallic=0.0, emission=None, emission_strength=0.0):
	"""Create a Principled material. `color`/`emission` are linear RGB triples."""
	mat = bpy.data.materials.new(name)
	mat.use_nodes = True
	bsdf = mat.node_tree.nodes["Principled BSDF"]
	bsdf.inputs["Base Color"].default_value = (*color, 1.0)
	bsdf.inputs["Roughness"].default_value = roughness
	bsdf.inputs["Metallic"].default_value = metallic
	if emission is not None:
		_set_input(bsdf, ("Emission Color", "Emission"), (*emission, 1.0))
		_set_input(bsdf, ("Emission Strength",), emission_strength)
	# Viewport / FBX fallback colour, so the model is not flat grey in Studio.
	mat.diffuse_color = (*color, 1.0)
	return mat


def add_box(name, size, location=(0.0, 0.0, 0.0), mat=None, bevel_width=None, bevel_segments=2):
	"""Axis-aligned box with dimensions `size` (X, Y, Z), optional edge bevel."""
	bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
	ob = bpy.context.object
	ob.name = name
	ob.scale = size
	bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
	if mat is not None:
		ob.data.materials.append(mat)
	if bevel_width:
		bevel(ob, bevel_width, bevel_segments)
	return ob


def add_cylinder(name, radius, depth, location=(0.0, 0.0, 0.0), mat=None, vertices=16):
	"""Capped cylinder, centred on `location`."""
	bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
	ob = bpy.context.object
	ob.name = name
	if mat is not None:
		ob.data.materials.append(mat)
	return ob


def bevel(ob, width, segments=2, angle=30.0):
	"""Apply a bevel modifier limited to edges sharper than `angle` degrees."""
	select_only(ob)
	mod = ob.modifiers.new("Bevel", "BEVEL")
	mod.width = width
	mod.segments = segments
	mod.limit_method = "ANGLE"
	mod.angle_limit = math.radians(angle)
	mod.miter_outer = "MITER_ARC"
	bpy.ops.object.modifier_apply(modifier=mod.name)


def bevel_vertical_edges(ob, width, segments=2):
	"""Round only the walls parallel to Z, leaving the top face its full size.

	A full-angle bevel would also pull the top perimeter inwards, which silently
	changes any dimension measured on that face. Corner rounding that keeps exact
	footprint and inset maths is worth this bit of bmesh.
	"""
	bm = bmesh.new()
	bm.from_mesh(ob.data)
	edges = []
	for edge in bm.edges:
		direction = (edge.verts[1].co - edge.verts[0].co).normalized()
		if abs(direction.z) > 0.99:
			edges.append(edge)
	bmesh.ops.bevel(
		bm,
		geom=edges,
		offset=width,
		offset_type="OFFSET",
		segments=segments,
		profile=0.5,
		affect="EDGES",
		clamp_overlap=True,
	)
	bm.to_mesh(ob.data)
	bm.free()
	ob.data.update()


def rounded_rect_ring(half, radius, corner_segments=4):
	"""Outline of a rounded square, as `4 * corner_segments` (x, y) points.

	Corner arcs are sampled with the same point count regardless of radius, so
	consecutive rings in a profile solid always connect vertex-for-vertex.
	"""
	radius = max(0.001, min(radius, half))
	inner = half - radius
	corners = ((inner, inner), (-inner, inner), (-inner, -inner), (inner, -inner))
	starts = (0.0, 90.0, 180.0, 270.0)
	points = []
	for (cx, cy), start in zip(corners, starts):
		for i in range(corner_segments):
			angle = math.radians(start + 90.0 * i / (corner_segments - 1))
			points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
	return points


def profile_solid(name, profile, mat=None, bottom_z=None, corner_segments=4):
	"""Build a closed solid by stacking rounded-rect outlines.

	`profile` is a list of (half_size, corner_radius, z) ordered from the outer
	top edge downwards, ending with the ring that becomes the top face. Each
	consecutive pair becomes a band of quads, so a list of five rings gives you a
	rim, a groove and a raised plateau in one mesh — no booleans, no insets, and
	every dimension is exactly what the caller asked for.

	The bottom is closed with a copy of the first outline at `bottom_z`.
	"""
	if len(profile) < 2:
		raise ValueError("profile needs at least two rings")

	bm = bmesh.new()
	rings = []
	for half, radius, z in profile:
		rings.append([bm.verts.new((x, y, z)) for x, y in rounded_rect_ring(half, radius, corner_segments)])
	bm.verts.ensure_lookup_table()

	count = len(rings[0])
	for lower, upper in zip(rings, rings[1:]):
		for j in range(count):
			k = (j + 1) % count
			bm.faces.new((lower[j], lower[k], upper[k], upper[j]))
	bm.faces.new(tuple(rings[-1]))

	if bottom_z is not None:
		half, radius, _ = profile[0]
		bottom = [bm.verts.new((x, y, bottom_z)) for x, y in rounded_rect_ring(half, radius, corner_segments)]
		for j in range(count):
			k = (j + 1) % count
			bm.faces.new((bottom[j], bottom[k], rings[0][k], rings[0][j]))
		bm.faces.new(tuple(bottom))

	# Winding above is not guaranteed outward for every profile; recalculating is
	# cheaper than reasoning about it, and it keeps normals correct for export.
	bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))

	me = bpy.data.meshes.new(name)
	bm.to_mesh(me)
	bm.free()
	me.validate()
	if mat is not None:
		me.materials.append(mat)

	ob = bpy.data.objects.new(name, me)
	bpy.context.scene.collection.objects.link(ob)
	return ob


def join_objects(objs, name):
	"""Join meshes into one object with the origin at the world origin."""
	select_only(objs)
	bpy.context.view_layer.objects.active = objs[0]
	bpy.ops.object.convert(target="MESH")
	bpy.ops.object.join()
	ob = bpy.context.object
	ob.name = name
	ob.data.name = name
	ob.location = (0.0, 0.0, 0.0)
	return ob


def shade_flat(ob):
	select_only(ob)
	bpy.ops.object.shade_flat()


def shade_smooth(ob, angle=32.0):
	"""Smooth shading with sharp edges preserved (auto-smooth by angle)."""
	select_only(ob)
	for op in ("shade_smooth_by_angle", "shade_auto_smooth", "shade_smooth"):
		fn = getattr(bpy.ops.object, op, None)
		if fn is None:
			continue
		try:
			if op == "shade_smooth":
				fn()
			else:
				fn(angle=math.radians(angle))
			return
		except (TypeError, RuntimeError):
			continue


def unwrap(ob, angle=66.0, margin=0.02):
	"""Smart-UV-project the object so textures/SurfaceAppearance stay possible later."""
	select_only(ob)
	bpy.ops.object.mode_set(mode="EDIT")
	bpy.ops.mesh.select_all(action="SELECT")
	bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin)
	bpy.ops.object.mode_set(mode="OBJECT")


def mark_preview_only(*objs):
	"""Excluded from export; still used for the preview render (e.g. glow parts)."""
	for ob in objs:
		ob["preview_only"] = True


def bounds(objs):
	"""World-space (min, max) corners of the bounding box covering `objs`."""
	points = []
	for ob in objs:
		for corner in ob.bound_box:
			points.append(ob.matrix_world @ Vector(corner))
	lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
	hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
	return lo, hi


def stats(objs):
	"""Triangle/vertex/dimension summary used for the build log and meta file."""
	tris = verts = 0
	seen = set()
	for ob in objs:
		if ob.data.name in seen:
			continue
		seen.add(ob.data.name)
		me = ob.data
		me.calc_loop_triangles()
		tris += len(me.loop_triangles)
		verts += len(me.vertices)
	lo, hi = bounds(objs)
	size = hi - lo
	return {
		"triangles": tris,
		"vertices": verts,
		"size": [round(size.x, 3), round(size.y, 3), round(size.z, 3)],
	}
