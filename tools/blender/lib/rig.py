"""Roblox R15 skeleton for blocky characters.

A character is 15 meshes named `<Part>_Geo`, each bound 100% to the bone of the same name, so
Studio's importer recognises it as R15 and Roblox's own R15 animations can drive it.

Every bone is a short stub pointing straight up with no roll. That looks odd in Blender, but it
makes each joint's rest orientation line up with the world axes after the FBX Y-up conversion,
which is what R15 animations assume. Characters are modelled facing -Y, arms straight down, so
their left side is +X.
"""

import bpy
from mathutils import Vector

from . import mesh

# part: parent bone
R15 = {
	"LowerTorso": "HumanoidRootNode",
	"UpperTorso": "LowerTorso",
	"Head": "UpperTorso",
}
for _side in ("Left", "Right"):
	R15[f"{_side}UpperArm"] = "UpperTorso"
	R15[f"{_side}LowerArm"] = f"{_side}UpperArm"
	R15[f"{_side}Hand"] = f"{_side}LowerArm"
	R15[f"{_side}UpperLeg"] = "LowerTorso"
	R15[f"{_side}LowerLeg"] = f"{_side}UpperLeg"
	R15[f"{_side}Foot"] = f"{_side}LowerLeg"

STUB = 0.2  # bone length; only for display


def build_r15(joints):
	"""Armature from {part: (x, y, z) pivot}. Every R15 part needs a pivot."""
	missing = set(R15) - set(joints)
	if missing:
		raise ValueError(f"missing R15 joints: {sorted(missing)}")
	data = bpy.data.armatures.new("Armature")
	arm = bpy.data.objects.new("Armature", data)
	bpy.context.scene.collection.objects.link(arm)
	mesh.select_only(arm)
	bpy.context.view_layer.objects.active = arm
	bpy.ops.object.mode_set(mode="EDIT")

	def bone(name, at, parent):
		b = data.edit_bones.new(name)
		b.head = Vector(at)
		b.tail = Vector(at) + Vector((0, 0, STUB))
		b.roll = 0.0
		if parent:
			b.parent = data.edit_bones[parent]

	bone("Root", (0, 0, 0), None)
	bone("HumanoidRootNode", joints["LowerTorso"], "Root")
	for part, parent in R15.items():
		bone(part, joints[part], parent)
	bpy.ops.object.mode_set(mode="OBJECT")
	return arm


def bind(arm, part, pieces):
	"""Joins `pieces` into `<part>_Geo`, bound rigidly to the bone `part`."""
	ob = mesh.join_objects(pieces, f"{part}_Geo") if len(pieces) > 1 else pieces[0]
	ob.name = ob.data.name = f"{part}_Geo"
	mesh.select_only(ob)
	bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
	ob.vertex_groups.new(name=part).add(range(len(ob.data.vertices)), 1.0, "REPLACE")
	ob.parent = arm
	mod = ob.modifiers.new("Armature", "ARMATURE")
	mod.object = arm
	return ob
