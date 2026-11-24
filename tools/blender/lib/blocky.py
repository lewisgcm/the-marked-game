"""Pieces every blocky character shares: R15 joints, lofts, detail blocks and an infected face.

Characters face -Y with their arms straight down; their left side is +X (see MODELLING.md).
"""

import math

import bmesh
import bpy
from mathutils import Euler

from . import lowpoly, mesh, palette, preview, rig

ARM_X, LEG_X = 1.03, 0.40
JOINTS = {
	"LowerTorso": (0, 0, 2.10),
	"UpperTorso": (0, 0, 2.42),
	"Head": (0, 0, 3.92),
}
for _side, _s in (("Left", 1), ("Right", -1)):
	JOINTS[f"{_side}UpperArm"] = (_s * ARM_X, 0, 3.62)
	JOINTS[f"{_side}LowerArm"] = (_s * ARM_X, 0, 2.86)
	JOINTS[f"{_side}Hand"] = (_s * ARM_X, 0, 2.10)
	JOINTS[f"{_side}UpperLeg"] = (_s * LEG_X, 0, 2.10)
	JOINTS[f"{_side}LowerLeg"] = (_s * LEG_X, 0, 1.22)
	JOINTS[f"{_side}Foot"] = (_s * LEG_X, 0, 0.36)


def loft(name, rings, swatch, x=0.0, cut=0.12):
	"""Stacked corner-cut rectangles: rings of (z, half width, front y, back y), bottom up."""
	bm = bmesh.new()
	loops = []
	for z, half, front, back in rings:
		c = min(cut, half * 0.45, (back - front) * 0.3)
		outline = [
			(-half + c, front), (half - c, front), (half, front + c), (half, back - c),
			(half - c, back), (-half + c, back), (-half, back - c), (-half, front + c),
		]
		loops.append([bm.verts.new((x + px, py, z)) for px, py in outline])
	for lo, hi in zip(loops, loops[1:]):
		for i in range(8):
			j = (i + 1) % 8
			bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
	bm.faces.new(list(reversed(loops[0])))
	bm.faces.new(loops[-1])
	ob = lowpoly.to_object(name, bm)
	palette.paint(ob, swatch)
	return ob


def bit(size, at, swatch, roll=0.0):
	"""A small detail block, optionally rolled about the front axis (degrees)."""
	ob = lowpoly.box("bit", size, at, swatch)
	ob.rotation_euler = Euler((0, math.radians(roll), 0))
	return ob


def infected_face():
	"""Sunken red eyes, nose, slack mouth and the three marks. Every infected has the same layout, so
	the game's glowing eyes (infected/body.ts) fit them all."""
	pieces = []
	for s in (-1, 1):
		pieces += [
			bit((0.30, 0.06, 0.24), (s * 0.24, -0.54, 4.56), "infected_shadow"),
			bit((0.18, 0.06, 0.11), (s * 0.23, -0.57, 4.55), "infected_eye"),
		]
	return pieces + [
		bit((0.16, 0.16, 0.24), (0, -0.58, 4.38), "infected_skin"),
		bit((0.34, 0.06, 0.16), (0.02, -0.53, 4.10), "socket", 5),
		bit((0.22, 0.05, 0.05), (-0.36, -0.55, 4.36), "glitch"),
		bit((0.14, 0.05, 0.05), (-0.42, -0.55, 4.26), "glitch_pink"),
		bit((0.20, 0.05, 0.05), (-0.33, -0.55, 4.16), "glitch"),
	]


def build_character(parts):
	"""Skeleton plus every {part: pieces}, bound."""
	armature = rig.build_r15(JOINTS)
	for part, pieces in parts.items():
		rig.bind(armature, part, pieces)
	return armature


def pose(angles):
	"""Preview only: {bone: (pitch, yaw, roll)} in degrees; negative pitch swings a limb forwards."""
	armature = bpy.data.objects["Armature"]
	for name, degrees in angles.items():
		bone = armature.pose.bones[name]
		bone.rotation_mode = "XYZ"
		bone.rotation_euler = [math.radians(a) for a in degrees]
	bpy.context.view_layer.update()


def preview_lights(objs):
	preview.add_lights(objs)
	data = bpy.data.lights.new("FrontSun", "SUN")
	data.energy = 2.2
	sun = bpy.data.objects.new("FrontSun", data)
	sun.rotation_euler = (math.radians(60), 0.0, math.radians(20))
	bpy.context.scene.collection.objects.link(sun)
	mesh.mark_preview_only(sun)
