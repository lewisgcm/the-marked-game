"""Light cone — the visible beam of a hunter's flashlight.

An open-ended cone (a thin frustum, so the tip isn't a needle point) with faces on both the
outside and the inside: Roblox culls back faces, so without the inner shell you'd only see
the half of the cone nearest the camera. Rendered in-game as translucent Neon, nested three
times at different lengths for a fade (see src/main/client/flashlight.ts).

Dimensions must match the beam: LENGTH is BEAM_VISUAL_LENGTH and the opening follows
FLASHLIGHT_HALF_ANGLE (src/shared/flashlight.ts). The cone opens toward Blender -Y, which
imports as Roblox -Z (a part's LookVector), and its origin is its bounds centre: the tip sits
LENGTH/2 behind the part's position.
"""

import math

import bmesh
import bpy

from lib import mesh

LENGTH = 32.0  # studs; = BEAM_VISUAL_LENGTH
HALF_ANGLE = 30.0  # degrees; = FLASHLIGHT_HALF_ANGLE
TIP_RADIUS = 0.2
SEGMENTS = 32

PREVIEW_DIRECTION = (1.0, -0.6, 0.5)


def build():
	glow = mesh.material("LightCone", (1.0, 0.95, 0.82), emission=(1.0, 0.95, 0.82), emission_strength=1.5)

	radius = LENGTH * math.tan(math.radians(HALF_ANGLE))
	tip_y = LENGTH / 2  # the tip is at the back (+Y)...
	mouth_y = -LENGTH / 2  # ...and it opens toward the front (-Y)

	bm = bmesh.new()
	tip = []
	mouth = []
	for i in range(SEGMENTS):
		a = math.tau * i / SEGMENTS
		c, s = math.cos(a), math.sin(a)
		tip.append(bm.verts.new((c * TIP_RADIUS, tip_y, s * TIP_RADIUS)))
		mouth.append(bm.verts.new((c * radius, mouth_y, s * radius)))

	for i in range(SEGMENTS):
		j = (i + 1) % SEGMENTS
		bm.faces.new((tip[i], tip[j], mouth[j], mouth[i]))  # outer shell
	for i in range(SEGMENTS):
		j = (i + 1) % SEGMENTS
		# Inner shell: same quad, opposite winding, on its own vertices so normals stay clean.
		verts = [bm.verts.new(v.co) for v in (mouth[i], mouth[j], tip[j], tip[i])]
		bm.faces.new(verts)

	me = bpy.data.meshes.new("LightCone")
	bm.to_mesh(me)
	bm.free()
	me.materials.append(glow)
	cone = bpy.data.objects.new("LightCone", me)
	bpy.context.scene.collection.objects.link(cone)

	mesh.shade_smooth(cone, angle=80.0)
	mesh.unwrap(cone)

	lo, hi = mesh.bounds([cone])
	print(f"[light_cone] {hi.x - lo.x:.2f} x {hi.y - lo.y:.2f} x {hi.z - lo.z:.2f} studs, mouth radius {radius:.2f}")
	return cone
