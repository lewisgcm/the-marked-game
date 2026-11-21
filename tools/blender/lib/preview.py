"""Turntable-style preview rendering, so every asset can be eyeballed as a PNG."""

import math

import bpy
from mathutils import Vector

from . import mesh


def setup(scene, resolution=768, samples=32, background=(0.018, 0.022, 0.030)):
	scene.render.engine = "CYCLES"
	scene.cycles.device = "CPU"
	scene.cycles.samples = samples
	scene.cycles.use_denoising = True
	scene.cycles.max_bounces = 6
	scene.render.resolution_x = resolution
	scene.render.resolution_y = resolution
	scene.render.resolution_percentage = 100
	scene.render.film_transparent = False
	scene.render.image_settings.file_format = "PNG"

	# Punchier than the default AgX look, so saturated accents (neon, emissive)
	# survive the tone map instead of washing out to white.
	try:
		scene.view_settings.look = "AgX - Punchy"
	except TypeError:
		pass

	world = bpy.data.worlds.new("PreviewWorld")
	world.use_nodes = True
	node = world.node_tree.nodes["Background"]
	node.inputs[0].default_value = (*background, 1.0)
	node.inputs[1].default_value = 1.0
	scene.world = world


def add_ground(objs, color=(0.020, 0.023, 0.030)):
	"""A large matte plane just below the asset, for contact shadow and scale."""
	lo, hi = mesh.bounds(objs)
	size = (hi - lo).length * 6.0
	bpy.ops.mesh.primitive_plane_add(size=size, location=(0.0, 0.0, lo.z - 0.001))
	plane = bpy.context.object
	plane.name = "PreviewGround"
	plane.data.materials.append(mesh.material("PreviewGround", color, roughness=0.85))
	mesh.mark_preview_only(plane)
	return plane


def add_lights(objs):
	"""Key sun + warm rim + soft area fill, sized to the asset."""
	lo, hi = mesh.bounds(objs)
	center = (lo + hi) / 2.0
	radius = max((hi - lo).length / 2.0, 0.001)

	def sun(name, energy, rotation, color=(1.0, 1.0, 1.0), angle=0.12):
		data = bpy.data.lights.new(name, "SUN")
		data.energy = energy
		data.angle = angle
		data.color = color
		ob = bpy.data.objects.new(name, data)
		bpy.context.scene.collection.objects.link(ob)
		ob.rotation_euler = rotation
		mesh.mark_preview_only(ob)
		return ob

	sun("KeySun", 3.4, (math.radians(52), 0.0, math.radians(-38)))
	sun("RimSun", 2.2, (math.radians(64), 0.0, math.radians(150)), color=(0.55, 0.9, 0.75))

	fill_data = bpy.data.lights.new("AreaFill", "AREA")
	fill_data.energy = 55.0 * radius * radius
	fill_data.size = radius * 2.5
	fill_data.color = (0.72, 0.82, 1.0)
	fill = bpy.data.objects.new("AreaFill", fill_data)
	bpy.context.scene.collection.objects.link(fill)
	fill.location = center + Vector((-radius * 1.6, -radius * 1.4, radius * 2.0))
	fill.rotation_euler = (center - fill.location).to_track_quat("-Z", "Y").to_euler()
	mesh.mark_preview_only(fill)


def frame_camera(scene, objs, direction=(1.0, -1.05, 1.05), lens=52.0, margin=1.18):
	lo, hi = mesh.bounds(objs)
	center = (lo + hi) / 2.0
	radius = max((hi - lo).length / 2.0, 0.001)

	cam_data = bpy.data.cameras.new("PreviewCamera")
	cam_data.lens = lens
	cam = bpy.data.objects.new("PreviewCamera", cam_data)
	scene.collection.objects.link(cam)
	scene.camera = cam

	fov = 2.0 * math.atan(cam_data.sensor_width / 2.0 / lens)
	dist = radius / math.sin(fov / 2.0) * margin
	target = center + Vector((0.0, 0.0, radius * 0.06))
	cam.location = target + Vector(direction).normalized() * dist
	cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
	mesh.mark_preview_only(cam)
	return cam


def render(scene, path):
	scene.render.filepath = path
	bpy.ops.render.render(write_still=True)
