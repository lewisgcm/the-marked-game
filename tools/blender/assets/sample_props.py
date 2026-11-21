"""STYLE SAMPLE (not used in game): the same props as sample_scene, lined up under plain studio
lighting so shapes and colours can be judged on their own.
"""

import math

from lib import lowpoly

PREVIEW_DIRECTION = (0.25, -1.0, 0.3)
PREVIEW_MARGIN = 0.9


def build():
	lowpoly.place(lowpoly.gravestone("Grave_Round", "round", seed=1), (-6.0, 0, 0), (0, 0, 0))
	lowpoly.place(lowpoly.gravestone("Grave_Gothic", "gothic", seed=2), (-3.4, 0, 0))
	lowpoly.place(lowpoly.gravestone("Grave_Cross", "cross", seed=3), (-0.9, 0, 0))
	lowpoly.place(lowpoly.gravestone("Grave_Broken", "broken", seed=4), (1.6, 0, 0))
	lowpoly.place(lowpoly.skull("Skull", 1.2), (3.8, -0.5, 0), (0, 0, math.radians(20)))
	lowpoly.place(lowpoly.lantern_post("Lantern"), (6.5, 0.8, 0), (0, 0, math.radians(-90)))
