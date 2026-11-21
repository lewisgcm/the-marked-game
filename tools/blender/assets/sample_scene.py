"""STYLE SAMPLE (not used in game): low-poly Synty-style props together under lobby-like night
lighting, to judge the look before the lobby is rebuilt. See lib/lowpoly.py and lib/palette.py.
"""

import math
import os

import bpy
from mathutils import Vector

from lib import lowpoly, mesh, palette

PREVIEW_GROUND = False
PREVIEW_BACKGROUND = (0.012, 0.014, 0.03)
PREVIEW_DIRECTION = (0.35, -1.0, 0.38)
PREVIEW_MARGIN = 0.78

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
LANTERN_AT = Vector((-4.2, -2.0, 0))


def build():
	palette.save_png(os.path.join(REPO, "assets", "models", "_palette", "palette.png"))

	lowpoly.place(lowpoly.gravestone("Grave_Round", "round", seed=1), (-1.2, 1.5, 0))
	lowpoly.place(lowpoly.gravestone("Grave_Gothic", "gothic", seed=2), (1.6, 2.4, 0))
	lowpoly.place(lowpoly.gravestone("Grave_Cross", "cross", seed=3), (4.3, 1.2, 0))
	lowpoly.place(lowpoly.gravestone("Grave_Broken", "broken", seed=4), (-3.6, 3.8, 0))
	lowpoly.place(lowpoly.dead_tree("Tree", 11.0, seed=7), (6.5, 5.5, 0))
	lowpoly.place(lowpoly.lantern_post("Lantern"), LANTERN_AT, (0, 0, math.radians(-30)))

	pedestal = lowpoly.box("Pedestal", (1.2, 1.2, 1.4), (1.5, -1.6, 0.7), "stone_dark")
	lowpoly.jitter(pedestal, 0.03, 9)
	skull = lowpoly.skull("Skull", 1.2)
	lowpoly.place(skull, (1.5, -1.6, 1.4), (0, 0, math.radians(15)))

	ground = lowpoly.ground_patch("Ground", 10.0)
	mesh.mark_preview_only(ground)


def _light(name, kind, energy, color, location=(0, 0, 0), rotation=(0, 0, 0), size=None):
	data = bpy.data.lights.new(name, kind)
	data.energy = energy
	data.color = color
	if size is not None:
		data.shadow_soft_size = size
	ob = bpy.data.objects.new(name, data)
	bpy.context.scene.collection.objects.link(ob)
	ob.location = location
	ob.rotation_euler = rotation
	mesh.mark_preview_only(ob)


def preview_lights(objs):
	# Cool moonlight from behind-left, a warm lantern pool, a faint purple fill.
	_light("Moon", "SUN", 2.6, (0.6, 0.7, 1.0), rotation=(math.radians(50), 0, math.radians(160)))
	lantern = LANTERN_AT + Vector((0.68, -1.18, 5.7))
	_light("LanternLight", "POINT", 900, (1.0, 0.6, 0.28), lantern, size=0.3)
	_light("Fill", "SUN", 0.8, (0.6, 0.5, 1.0), rotation=(math.radians(60), 0, math.radians(-30)))
	_light("SkullGlow", "POINT", 60, (1.0, 0.25, 0.2), (1.5, -2.8, 2.4), size=0.2)
