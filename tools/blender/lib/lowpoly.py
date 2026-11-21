"""Low-poly, faceted prop builders in the Synty POLYGON style: chunky shapes, hard flat faces,
a few hundred triangles each, coloured from the shared palette (lib/palette.py).

Coordinates are Blender's: Z up, the prop's front faces -Y (imports as Roblox -Z, the
MeshPart's LookVector). Units are studs.
"""

import math
import random

import bmesh
import bpy
from mathutils import Vector

from . import mesh, palette


# --- building blocks -----------------------------------------------------------------------


def to_object(name, bm):
	me = bpy.data.meshes.new(name)
	bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
	bm.to_mesh(me)
	bm.free()
	me.validate()
	ob = bpy.data.objects.new(name, me)
	bpy.context.scene.collection.objects.link(ob)
	ob.data.materials.append(palette.material())
	ob.data.uv_layers.new(name="UVMap")
	palette.flat(ob)
	return ob


def extrude_outline(name, outline, depth):
	"""A slab: 2D outline [(x, z), ...] in the XZ plane, `depth` thick along Y (centred)."""
	bm = bmesh.new()
	front = [bm.verts.new((x, -depth / 2, z)) for x, z in outline]
	back = [bm.verts.new((x, depth / 2, z)) for x, z in outline]
	bm.faces.new(front)
	bm.faces.new(list(reversed(back)))
	n = len(outline)
	for i in range(n):
		j = (i + 1) % n
		bm.faces.new((front[i], front[j], back[j], back[i]))
	return to_object(name, bm)


def box(name, size, location=(0, 0, 0), swatch="stone"):
	ob = mesh.add_box(name, size, location)
	ob.data.materials.append(palette.material())
	palette.paint(ob, swatch)
	palette.flat(ob)
	return ob


def tapered_prism(bm, base, top, r_base, r_top, sides, phase=0.0):
	"""Rings of `sides` verts at `base` and `top` (Vectors), joined into a capped prism."""
	axis = (top - base).normalized()
	helper = Vector((1, 0, 0)) if abs(axis.x) < 0.9 else Vector((0, 1, 0))
	u = axis.cross(helper).normalized()
	v = axis.cross(u)

	def ring(centre, radius):
		return [
			bm.verts.new(centre + (u * math.cos(a) + v * math.sin(a)) * radius)
			for a in (phase + 2 * math.pi * i / sides for i in range(sides))
		]

	lower, upper = ring(base, r_base), ring(top, r_top)
	for i in range(sides):
		j = (i + 1) % sides
		bm.faces.new((lower[i], lower[j], upper[j], upper[i]))
	bm.faces.new(list(reversed(lower)))
	bm.faces.new(upper)
	return lower, upper


def jitter(ob, amount, seed, keep_bottom=True):
	"""Nudges vertices a little so shapes look hand-made rather than machined."""
	rng = random.Random(seed)
	lo_z = min(v.co.z for v in ob.data.vertices)
	for vert in ob.data.vertices:
		if keep_bottom and vert.co.z < lo_z + 0.05:
			continue
		vert.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * amount
	ob.data.update()


def join(objs, name):
	"""Joins meshes, keeping every part where it is (transforms are baked in first)."""
	mesh.select_only(list(objs))
	bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
	ob = mesh.join_objects(list(objs), name)
	palette.flat(ob)
	return ob


def place(ob, location=(0, 0, 0), rotation=(0, 0, 0)):
	ob.location = location
	ob.rotation_euler = rotation
	return ob


def faces_up(threshold=0.6):
	return lambda face: face.normal.z > threshold


# --- props ---------------------------------------------------------------------------------


def gravestone(name, style="round", seed=1):
	"""A headstone on a chunky plinth: style round | gothic | cross | broken."""
	rng = random.Random(seed)
	parts = []
	plinth = box(f"{name}_plinth", (2.1, 0.9, 0.35), (0, 0, 0.175), "stone_dark")
	parts.append(plinth)

	if style == "cross":
		post = box(f"{name}_post", (0.42, 0.38, 2.5), (0, 0, 0.35 + 1.25), "stone")
		arm = box(f"{name}_arm", (1.5, 0.38, 0.42), (0, 0, 0.35 + 1.75), "stone")
		parts += [post, arm]
	else:
		if style == "broken":
			outline = [(-0.7, 0), (0.7, 0), (0.7, 1.35), (0.35, 1.6), (0.1, 1.25), (-0.25, 1.75), (-0.7, 1.5)]
		elif style == "gothic":
			outline = [(-0.7, 0), (0.7, 0), (0.7, 1.4), (0.5, 1.85), (0.0, 2.25), (-0.5, 1.85), (-0.7, 1.4)]
		else:
			outline = [(-0.75, 0), (0.75, 0), (0.75, 1.3)]
			for i in range(1, 5):
				a = math.pi * i / 5
				outline.append((0.75 * math.cos(a), 1.3 + 0.75 * math.sin(a)))
			outline.append((-0.75, 1.3))
		slab = extrude_outline(f"{name}_slab", outline, 0.4)
		slab.location = (0, 0, 0.35)
		palette.paint(slab, "stone")
		# A sunken name panel on the front.
		panel = box(f"{name}_panel", (0.9, 0.06, 0.5), (0, -0.21, 0.35 + 0.85), "stone_dark")
		parts += [slab, panel]

	ob = join(parts, name)
	jitter(ob, 0.035, seed)
	palette.paint_where(ob, "moss", lambda f: f.normal.z > 0.7 and f.calc_center_median().z > 0.5)
	# A slight lean: graves settle.
	ob.rotation_euler = (math.radians(rng.uniform(-6, 6)), math.radians(rng.uniform(-4, 4)), 0)
	return ob


def dead_tree(name, height=11.0, seed=3):
	"""A gnarled, leafless tree: tapered hexagonal segments that bend, splitting into branches."""
	rng = random.Random(seed)
	bm = bmesh.new()

	def grow(start, direction, length, radius, depth):
		segments = 3 if depth == 0 else 2
		position = Vector(start)
		for s in range(segments):
			# Bend a little each segment.
			direction = (direction + Vector((rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35), 0.05))).normalized()
			end = position + direction * (length / segments)
			r_end = radius * (0.62 if s < segments - 1 else 0.38)
			if depth == 2 and s == segments - 1:
				r_end = 0.02
			tapered_prism(bm, position, end, radius, r_end, 6 if depth == 0 else 5, rng.uniform(0, 1))
			# Branch off.
			if depth < 2 and s >= (1 if depth == 0 else 0):
				for _ in range(2 if depth == 0 else rng.choice((1, 2))):
					side = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.3, 0.9))).normalized()
					grow(end, side, length * rng.uniform(0.45, 0.6), r_end * 0.85, depth + 1)
			position, radius = end, r_end
		# Leave the trunk's tip as a small spike.
		if depth == 0:
			tapered_prism(bm, position, position + direction * length * 0.25, radius, 0.02, 5)

	grow(Vector((0, 0, -0.2)), Vector((0, 0, 1)), height * 0.75, height * 0.07, 0)
	# Roots flaring out at the base.
	for i in range(4):
		a = i * math.pi / 2 + rng.uniform(-0.4, 0.4)
		out = Vector((math.cos(a), math.sin(a), -0.15))
		tapered_prism(bm, Vector((0, 0, 0.6)), out * height * 0.13, height * 0.045, 0.05, 4)

	ob = to_object(name, bm)
	palette.paint(ob, "bark")
	palette.paint_where(ob, "bark_dark", lambda f: f.normal.z < -0.2)
	return ob


def lantern_post(name, height=7.0):
	"""A wooden post with an iron arm and a hanging lantern (the glass glows)."""
	parts = [
		box(f"{name}_foot", (0.9, 0.9, 0.4), (0, 0, 0.2), "stone_dark"),
	]
	bm = bmesh.new()
	tapered_prism(bm, Vector((0, 0, 0.4)), Vector((0, 0, height)), 0.28, 0.2, 4, math.pi / 4)
	post = to_object(f"{name}_post", bm)
	palette.paint(post, "wood_dark")
	parts.append(post)

	arm_y = height - 0.35
	parts.append(box(f"{name}_arm", (0.16, 1.5, 0.16), (0, -0.7, arm_y), "iron"))
	parts.append(box(f"{name}_brace", (0.12, 0.12, 0.9), (0, -0.3, arm_y - 0.4), "iron"))
	parts[-1].rotation_euler = (math.radians(-40), 0, 0)
	parts.append(box(f"{name}_hook", (0.08, 0.08, 0.35), (0, -1.35, arm_y - 0.2), "iron"))

	# The lantern: glowing glass box, iron frame, pyramid cap.
	lantern_z = arm_y - 0.95
	parts.append(box(f"{name}_glass", (0.6, 0.6, 0.75), (0, -1.35, lantern_z), "lantern_glow"))
	for dx in (-0.31, 0.31):
		for dy in (-0.31, 0.31):
			parts.append(box(f"{name}_bar", (0.08, 0.08, 0.85), (dx, -1.35 + dy, lantern_z), "iron"))
	parts.append(box(f"{name}_base", (0.75, 0.75, 0.12), (0, -1.35, lantern_z - 0.43), "iron"))
	cap = bmesh.new()
	tapered_prism(cap, Vector((0, -1.35, lantern_z + 0.4)), Vector((0, -1.35, lantern_z + 0.8)), 0.55, 0.06, 4, math.pi / 4)
	cap_ob = to_object(f"{name}_cap", cap)
	palette.paint(cap_ob, "iron_light")
	parts.append(cap_ob)

	return join(parts, name)


def skull(name, size=1.0):
	"""A faceted skull: chunky cranium, cheek block, dark sockets, a row of teeth. Faces -Y."""
	s = size
	bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.5 * s, location=(0, 0.08 * s, 0.66 * s))
	cranium = bpy.context.object
	cranium.name = f"{name}_cranium"
	cranium.scale = (0.92, 1.12, 0.9)
	bpy.ops.object.transform_apply(scale=True)

	# Face: a block that narrows toward the chin, with sunken cheeks.
	face = mesh.add_box(f"{name}_face", (0.72 * s, 0.46 * s, 0.44 * s), (0, -0.16 * s, 0.38 * s))
	for vert in face.data.vertices:
		if vert.co.z < 0:
			vert.co.x *= 0.72
			vert.co.y *= 0.85
	face.data.update()
	jaw = mesh.add_box(f"{name}_jaw", (0.42 * s, 0.34 * s, 0.14 * s), (0, -0.2 * s, 0.12 * s))
	for vert in jaw.data.vertices:
		if vert.co.z < 0:
			vert.co.x *= 0.8
	jaw.data.update()
	# Fuse cranium and face into one closed solid (a plain join would leave overlapping shells,
	# which the socket cuts below can't handle).
	cranium.data.materials.append(palette.material())
	palette.paint(cranium, "bone")
	palette.paint(face, "bone")
	fuse = cranium.modifiers.new("fuse", "BOOLEAN")
	fuse.operation = "UNION"
	fuse.solver = "EXACT"
	fuse.object = face
	mesh.select_only(cranium)
	bpy.ops.object.modifier_apply(modifier=fuse.name)
	bpy.data.objects.remove(face)
	head = cranium
	head.name = f"{name}_head"

	# Cut the sockets and nose with booleans; the cut faces come out of the cutters, painted dark.
	cutters = []
	for x in (-0.18, 0.18):
		bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.135 * s, depth=0.5 * s, location=(x * s, -0.42 * s, 0.5 * s))
		cutters.append(bpy.context.object)
	bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.11 * s, radius2=0.0, depth=0.5 * s, location=(0, -0.42 * s, 0.33 * s))
	nose = bpy.context.object
	nose.rotation_euler = (math.radians(90), 0, math.radians(180))
	cutters.append(nose)
	for cutter in cutters:
		cutter.rotation_euler = (math.radians(90), cutter.rotation_euler.y, cutter.rotation_euler.z)
		cutter.data.materials.append(palette.material())
		cutter.data.uv_layers.new(name="UVMap")
		palette.paint(cutter, "socket")
		mod = head.modifiers.new(f"cut_{cutter.name}", "BOOLEAN")
		mod.operation = "DIFFERENCE"
		mod.solver = "EXACT"
		mod.object = cutter
		mesh.select_only(head)
		bpy.ops.object.modifier_apply(modifier=mod.name)
		bpy.data.objects.remove(cutter)

	palette.paint(jaw, "bone_shadow")
	teeth = [
		box(f"{name}_tooth", (0.07 * s, 0.07 * s, 0.11 * s), (x * s, -0.36 * s, 0.21 * s), "bone")
		for x in (-0.12, -0.04, 0.04, 0.12)
	]
	ob = join([head, jaw, *teeth], name)
	return ob


def ground_patch(name, radius=14.0, seed=5):
	"""Preview stage: a faceted, gently uneven disc of grass with dirt patches."""
	rng = random.Random(seed)
	bpy.ops.mesh.primitive_circle_add(vertices=24, radius=radius, fill_type="TRIFAN")
	ob = bpy.context.object
	ob.name = name
	mesh.select_only(ob)
	bpy.ops.object.mode_set(mode="EDIT")
	bpy.ops.mesh.subdivide(number_cuts=3)
	bpy.ops.object.mode_set(mode="OBJECT")
	for vert in ob.data.vertices:
		if vert.co.length < radius - 0.1:
			vert.co.z = rng.uniform(-0.12, 0.12)
	ob.data.materials.append(palette.material())
	palette.paint(ob, "grass")
	palette.paint_where(ob, "dirt", lambda f: rng.random() < 0.18)
	palette.paint_where(ob, "moss_dark", lambda f: rng.random() < 0.12)
	palette.flat(ob)
	return ob


# --- lobby kit -------------------------------------------------------------------------------


def _prism(name, base, top, r_base, r_top, sides, swatch, phase=None):
	bm = bmesh.new()
	tapered_prism(bm, Vector(base), Vector(top), r_base, r_top, sides, math.pi / sides if phase is None else phase)
	ob = to_object(name, bm)
	palette.paint(ob, swatch)
	return ob


def _moss_tops(ob, above=0.5, threshold=0.7):
	palette.paint_where(ob, "moss", lambda f: f.normal.z > threshold and f.calc_center_median().z > above)


def obelisk(name, seed=5):
	parts = [
		box(f"{name}_base", (1.8, 1.8, 0.6), (0, 0, 0.3), "stone_dark"),
		_prism(f"{name}_shaft", (0, 0, 0.6), (0, 0, 3.9), 0.62, 0.42, 4, "stone"),
		_prism(f"{name}_tip", (0, 0, 3.9), (0, 0, 4.6), 0.5, 0.02, 4, "stone_light"),
	]
	ob = join(parts, name)
	jitter(ob, 0.03, seed)
	_moss_tops(ob, 0.3)
	return ob


def rock(name, size=(1.6, 1.3, 0.9), seed=11):
	rng = random.Random(seed)
	bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.5)
	ob = bpy.context.object
	ob.name = name
	for vert in ob.data.vertices:
		vert.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * 0.12
		vert.co.x *= size[0]
		vert.co.y *= size[1]
		vert.co.z *= size[2]
		vert.co.z = max(vert.co.z, -size[2] * 0.25)  # flat-ish bottom, sunk into the ground
	ob.data.update()
	lo = min(v.co.z for v in ob.data.vertices)
	for vert in ob.data.vertices:
		vert.co.z -= lo
	ob.data.update()
	ob.data.materials.append(palette.material())
	palette.paint(ob, "stone")
	palette.paint_where(ob, "stone_dark", lambda f: f.normal.z < -0.2)
	_moss_tops(ob, 0.0, 0.93)
	palette.flat(ob)
	return ob


def pedestal(name):
	"""The ritual-item pedestal: top surface at 3.3 studs."""
	parts = [
		box(f"{name}_base", (2.4, 2.4, 0.4), (0, 0, 0.2), "stone_dark"),
		_prism(f"{name}_column", (0, 0, 0.4), (0, 0, 3.0), 0.95, 0.8, 4, "stone"),
		box(f"{name}_top", (2.2, 2.2, 0.3), (0, 0, 3.15), "stone_light"),
	]
	ob = join(parts, name)
	jitter(ob, 0.02, 21)
	# Old blood dribbling down the front.
	palette.paint_where(ob, "blood_dark", lambda f: f.normal.y < -0.6 and 2.2 < f.calc_center_median().z < 3.35)
	return ob


def ritual_candle(name, seed=31):
	"""One pillar candle, exactly 1 stud tall (code scales it): a slumped top and a drip."""
	rng = random.Random(seed)
	bm = bmesh.new()
	lower, upper = tapered_prism(bm, Vector((0, 0, 0)), Vector((0, 0, 1.0)), 0.22, 0.2, 6, 0)
	for vert in upper:
		vert.co.z -= rng.uniform(0, 0.12)
	ob = to_object(name, bm)
	palette.paint(ob, "wax")
	drip = _prism(f"{name}_drip", (0.2, 0, 0.55), (0.21, 0, 0.98), 0.07, 0.05, 4, "wax")
	return join([ob, drip], name)


def candle_cluster(name):
	"""The Candles ritual item: four candles in a wax puddle. Wicks match CANDLE_WICKS (decor.ts)."""
	parts = []
	puddle = _prism(f"{name}_puddle", (0, 0, 0), (0, 0, 0.1), 0.75, 0.7, 8, "wax", 0)
	puddle.scale = (1, 0.87, 1)
	parts.append(puddle)
	for i, (x, y, r, h) in enumerate([(0.0, 0.25, 0.2, 1.2), (-0.42, 0.0, 0.17, 0.8), (0.42, 0.0, 0.17, 0.8), (0.0, -0.32, 0.15, 0.5)]):
		parts.append(_prism(f"{name}_c{i}", (x, y, 0.05), (x, y, h), r, r * 0.92, 6, "wax", 0))
		parts.append(box(f"{name}_w{i}", (0.04, 0.04, 0.08), (x, y, h + 0.03), "socket"))
	return join(parts, name)


def book(name):
	"""The Book ritual item: closed, lying flat, pages painted in (0.52 tall)."""
	parts = [
		box(f"{name}_back", (1.4, 1.0, 0.12), (0, 0, 0.06), "blood_dark"),
		box(f"{name}_pages", (1.3, 0.92, 0.28), (0, -0.02, 0.26), "bone"),
		box(f"{name}_front", (1.4, 1.0, 0.12), (0, 0, 0.46), "blood"),
		box(f"{name}_spine", (1.4, 0.14, 0.52), (0, 0.48, 0.26), "blood_dark"),
		box(f"{name}_emblem", (0.36, 0.36, 0.03), (0, 0, 0.53), "gold"),
	]
	for x in (-0.62, 0.62):
		parts.append(box(f"{name}_corner", (0.18, 0.18, 0.54), (x, -0.43, 0.27), "gold"))
	ob = join(parts, name)
	# Keep it exactly 0.52 tall: the emblem sits flush.
	return ob


def fence_section(name, length=6.0):
	"""A run of low stone wall with iron railings, `length` long along X, centred."""
	half = length / 2
	parts = [box(f"{name}_wall", (length, 0.9, 1.0), (0, 0, 0.5), "stone_dark")]
	parts.append(box(f"{name}_coping", (length, 1.05, 0.18), (0, 0, 1.09), "stone"))
	for z in (1.6, 4.6):
		parts.append(box(f"{name}_rail", (length, 0.12, 0.14), (0, 0, z), "iron"))
	count = int(length / 0.6)
	for i in range(count):
		x = -half + 0.3 + i * 0.6
		parts.append(box(f"{name}_bar", (0.1, 0.1, 4.2), (x, 0, 1.18 + 2.1), "iron"))
		parts.append(_prism(f"{name}_tip", (x, 0, 5.28), (x, 0, 5.65), 0.1, 0.01, 4, "iron_light"))
	ob = join(parts, name)
	jitter(ob, 0.015, 41)
	_moss_tops(ob, 0.9, 0.8)
	return ob


def fence_pillar(name):
	parts = [
		box(f"{name}_body", (1.4, 1.4, 6.0), (0, 0, 3.0), "stone"),
		box(f"{name}_cap", (1.8, 1.8, 0.35), (0, 0, 6.17), "stone_light"),
		_prism(f"{name}_top", (0, 0, 6.35), (0, 0, 7.1), 0.75, 0.02, 4, "stone_dark"),
	]
	ob = join(parts, name)
	jitter(ob, 0.025, 43)
	return ob


def gate_pillar(name):
	parts = [
		box(f"{name}_foot", (2.4, 2.4, 0.6), (0, 0, 0.3), "stone_dark"),
		box(f"{name}_body", (2.0, 2.0, 7.4), (0, 0, 4.3), "stone"),
		box(f"{name}_cap", (2.6, 2.6, 0.5), (0, 0, 8.25), "stone_light"),
	]
	bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.65, location=(0, 0, 9.1))
	orb = bpy.context.object
	orb.data.materials.append(palette.material())
	palette.paint(orb, "stone_light")
	parts.append(orb)
	ob = join(parts, name)
	jitter(ob, 0.03, 47)
	_moss_tops(ob, 7.0, 0.7)
	return ob


def gate_leaf(name, length=4.6, height=7.0):
	"""One iron gate leaf, centred on X (code hinges it to a pillar)."""
	half = length / 2
	parts = []
	for z in (0.5, height - 0.6, height * 0.45):
		parts.append(box(f"{name}_rail", (length, 0.14, 0.16), (0, 0, z), "iron"))
	for x in (-half + 0.08, half - 0.08):
		parts.append(box(f"{name}_stile", (0.18, 0.18, height), (x, 0, height / 2), "iron"))
	count = 8
	for i in range(1, count):
		x = -half + i * length / count
		parts.append(box(f"{name}_bar", (0.1, 0.1, height - 0.2), (x, 0, height / 2), "iron"))
		parts.append(_prism(f"{name}_tip", (x, 0, height - 0.1), (x, 0, height + 0.35), 0.12, 0.01, 4, "iron_light"))
	# A ring of iron in the middle panel.
	bpy.ops.mesh.primitive_torus_add(major_segments=8, minor_segments=4, major_radius=0.7, minor_radius=0.07, location=(0, 0, height * 0.7))
	ring = bpy.context.object
	ring.rotation_euler = (math.radians(90), 0, 0)
	ring.data.materials.append(palette.material())
	palette.paint(ring, "rust")
	parts.append(ring)
	return join(parts, name)


def gate_arch(name, span=11.0, rise=2.6):
	"""The iron arch over the gateway; its base line is the top of the gate pillars."""
	half = span / 2
	parts = []
	segments = 10
	points = [Vector((math.cos(math.pi * i / segments) * half, 0, math.sin(math.pi * i / segments) * rise)) for i in range(segments + 1)]
	for a, b in zip(points, points[1:]):
		parts.append(_prism(f"{name}_seg", a, b, 0.16, 0.16, 4, "iron"))
	for i in range(1, segments):
		p = points[i]
		parts.append(box(f"{name}_drop", (0.08, 0.08, p.z), (p.x, 0, p.z / 2), "iron"))
	parts.append(box(f"{name}_beam", (span, 0.16, 0.18), (0, 0, 0.09), "iron"))
	parts.append(_prism(f"{name}_finial", (0, 0, rise), (0, 0, rise + 1.0), 0.22, 0.01, 4, "iron_light"))
	bpy.ops.mesh.primitive_torus_add(major_segments=8, minor_segments=4, major_radius=0.45, minor_radius=0.07, location=(0, 0, rise * 0.55))
	ring = bpy.context.object
	ring.rotation_euler = (math.radians(90), 0, 0)
	ring.data.materials.append(palette.material())
	palette.paint(ring, "rust")
	parts.append(ring)
	return join(parts, name)


def chapel_front(name, seed=51):
	"""The ruined chapel's front wall: jagged broken sections either side of a tall pointed
	window between two piers, a doorway under it, buttresses. 54 wide, symmetric bounds."""
	rng = random.Random(seed)
	parts = []
	thickness = 2.0
	# Broken wall sections: column heights from the outer end inward to the pier.
	left = [3, 5, 4, 8, 10, 9, 12, 14, 13, 16, 17]
	right = [2, 5, 4, 6, 10, 9, 11, 14, 13, 16, 17]
	for side, heights in ((-1, left), (1, right)):
		outline = []
		x_outer, x_inner = side * 27, side * 5
		cols = len(heights)
		step = (x_inner - x_outer) / cols
		outline.append((x_outer, 0))
		for i, h in enumerate(heights):
			x0 = x_outer + step * i
			x1 = x0 + step
			outline.append((x0, h + rng.uniform(-0.4, 0.4)))
			outline.append((x0 + step * 0.55, h + rng.uniform(-0.6, 0.6)))
		outline.append((x_inner, heights[-1]))
		outline.append((x_inner, 0))
		if side == 1:
			outline.reverse()
		slab = extrude_outline(f"{name}_wall", outline, thickness)
		palette.paint(slab, "stone")
		parts.append(slab)
	# Piers framing the window, and the pointed arch over it.
	for side in (-1, 1):
		parts.append(box(f"{name}_pier", (2.2, thickness + 0.6, 20.0), (side * 4.1, 0, 10.0), "stone_light"))
		parts.append(box(f"{name}_pierCap", (2.8, thickness + 1.0, 0.6), (side * 4.1, 0, 20.3), "stone"))
	arch = []
	for i in range(9):
		t = i / 8
		a = t * math.pi
		x = -3.1 * math.cos(a)
		z = 15.0 + 4.6 * math.sin(a) ** 0.75
		arch.append((x, z))
	outer = [(x * 1.25, 15.0 + (z - 15.0) * 1.2 + 0.3) for x, z in arch]
	outline = outer + list(reversed(arch))
	rib = extrude_outline(f"{name}_arch", outline, thickness + 0.3)
	palette.paint(rib, "stone_light")
	parts.append(rib)
	# Wall under the window with the doorway.
	parts.append(box(f"{name}_sill", (6.2, thickness, 5.0), (0, 0, 2.5), "stone"))
	parts.append(box(f"{name}_door", (3.0, 0.1, 4.0), (0, -thickness / 2 - 0.02, 2.0), "socket"))
	door_arch = [(-1.9, 4.0), (-1.9, 4.6), (0, 5.6), (1.9, 4.6), (1.9, 4.0), (1.5, 4.0), (1.5, 4.3), (0, 5.1), (-1.5, 4.3), (-1.5, 4.0)]
	door = extrude_outline(f"{name}_doorArch", door_arch, 0.4)
	door.location = (0, -thickness / 2 - 0.15, 0)
	palette.paint(door, "stone_light")
	parts.append(door)
	# Iron tracery in the window.
	parts.append(box(f"{name}_mullion", (0.25, 0.25, 13.5), (0, 0.3, 11.5), "iron"))
	parts.append(box(f"{name}_transom", (6.0, 0.25, 0.25), (0, 0.3, 11.0), "iron"))
	# Buttresses.
	for x in (-22, -13, 13, 22):
		but = [(-0.9, 0), (0.9, 0), (0.9, 6.5), (-0.9, 5.0)]
		b = extrude_outline(f"{name}_buttress", but, 1.6)
		# extrude_outline builds in XZ; turn the slab so its profile faces sideways.
		b.rotation_euler = (0, 0, math.radians(90))
		b.location = (x, -thickness / 2 - 0.8, 0)
		palette.paint(b, "stone_dark")
		parts.append(b)
	ob = join(parts, name)
	jitter(ob, 0.04, seed)
	_moss_tops(ob, 1.0, 0.7)
	palette.paint_where(ob, "stone_dark", lambda f: f.calc_center_median().z < 0.8 and abs(f.normal.z) < 0.5)
	return ob


def bell_tower(name):
	"""A square bell tower with an open belfry, a bell and a spire (~33 tall)."""
	parts = [
		box(f"{name}_plinth", (8.0, 8.0, 1.2), (0, 0, 0.6), "stone_dark"),
		_prism(f"{name}_tower", (0, 0, 1.2), (0, 0, 22.0), 3.6 * math.sqrt(2), 3.3 * math.sqrt(2), 4, "stone"),
		box(f"{name}_ledge", (7.6, 7.6, 0.6), (0, 0, 22.3), "stone_light"),
	]
	for cx in (-2.8, 2.8):
		for cy in (-2.8, 2.8):
			parts.append(box(f"{name}_post", (1.3, 1.3, 4.8), (cx, cy, 25.0), "stone"))
	parts.append(box(f"{name}_roof", (8.2, 8.2, 0.8), (0, 0, 27.8), "stone_light"))
	parts.append(_prism(f"{name}_spire", (0, 0, 28.2), (0, 0, 35.0), 4.0 * math.sqrt(2) * 0.95, 0.05, 4, "stone_deep"))
	parts.append(_prism(f"{name}_bell", (0, 0, 23.2), (0, 0, 25.4), 1.25, 0.6, 8, "gold", 0))
	parts.append(box(f"{name}_window", (1.6, 0.1, 3.0), (0, -3.42, 14.0), "window_glow"))
	parts.append(box(f"{name}_slit", (0.8, 0.1, 2.0), (0, -3.5, 7.0), "socket"))
	ob = join(parts, name)
	jitter(ob, 0.04, 53)
	_moss_tops(ob, 1.0, 0.7)
	return ob


def crypt(name):
	"""A small family crypt: stepped platform, columned porch, pediment roof, iron door."""
	parts = [
		box(f"{name}_step1", (9.0, 11.0, 0.5), (0, 0, 0.25), "stone_dark"),
		box(f"{name}_step2", (8.2, 10.2, 0.5), (0, 0, 0.75), "stone"),
		box(f"{name}_body", (7.0, 7.5, 6.0), (0, 1.0, 4.0), "stone"),
		box(f"{name}_door", (2.4, 0.15, 3.8), (0, -2.8, 2.9), "iron"),
		box(f"{name}_doorFrame", (3.2, 0.3, 0.5), (0, -2.85, 5.05), "stone_light"),
		box(f"{name}_lintel", (8.0, 3.2, 0.6), (0, -3.6, 7.3), "stone_light"),
	]
	for x in (-3.2, 3.2):
		parts.append(_prism(f"{name}_column", (x, -4.6, 1.0), (x, -4.6, 7.0), 0.45, 0.4, 6, "stone_light", 0))
	roof = extrude_outline(f"{name}_roof", [(-4.3, 0), (4.3, 0), (0, 2.6)], 11.0)
	roof.location = (0, -0.4, 7.6)
	palette.paint(roof, "stone_dark")
	parts.append(roof)
	parts.append(box(f"{name}_crossV", (0.35, 0.35, 1.9), (0, -5.5, 11.1), "stone_light"))
	parts.append(box(f"{name}_crossH", (1.2, 0.35, 0.35), (0, -5.5, 11.5), "stone_light"))
	parts.append(box(f"{name}_ring", (0.4, 0.1, 0.4), (0.6, -2.9, 2.9), "rust"))
	ob = join(parts, name)
	jitter(ob, 0.03, 61)
	_moss_tops(ob, 1.2, 0.97)  # flat tops only, not the sloped roof
	return ob


def fit_height(ob, height):
	"""Scales `ob` uniformly so it is exactly `height` tall, standing on z = 0."""
	lo = min(v.co.z for v in ob.data.vertices)
	hi = max(v.co.z for v in ob.data.vertices)
	factor = height / (hi - lo)
	for vert in ob.data.vertices:
		vert.co = Vector((vert.co.x * factor, vert.co.y * factor, (vert.co.z - lo) * factor))
	ob.data.update()
	return ob
