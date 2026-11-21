"""STYLE SAMPLE (not used in game): the low-poly skull on its own."""

import math

from lib import lowpoly

PREVIEW_DIRECTION = (0.45, -1.0, 0.3)


def build():
	lowpoly.place(lowpoly.skull("Skull", 1.2), (0, 0, 0), (0, 0, math.radians(15)))
