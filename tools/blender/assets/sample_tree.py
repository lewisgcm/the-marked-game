"""STYLE SAMPLE (not used in game): the low-poly dead tree on its own."""

from lib import lowpoly

PREVIEW_DIRECTION = (0.6, -1.0, 0.25)


def build():
	lowpoly.dead_tree("Tree", 11.0, seed=7)
