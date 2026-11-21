"""PREVIEW ONLY (not uploaded): close-up of the lobby kit's smaller props."""

import math

from lib import lowpoly

PREVIEW_DIRECTION = (0.2, -1.0, 0.42)
PREVIEW_MARGIN = 0.8


def build():
	lowpoly.place(lowpoly.crypt("Crypt"), (-9, 4, 0), (0, 0, math.radians(20)))
	lowpoly.place(lowpoly.pedestal("Pedestal"), (0, 0, 0))
	lowpoly.place(lowpoly.fit_height(lowpoly.skull("Skull", 1.0), 1.1), (0, 0, 3.3), (0, 0, math.radians(15)))
	lowpoly.place(lowpoly.book("Book"), (-2.6, -2.5, 0), (0, 0, math.radians(20)))
	lowpoly.place(lowpoly.candle_cluster("Candles"), (-0.4, -3.2, 0))
	for i, (x, h) in enumerate([(1.7, 1.4), (2.6, 0.9), (3.4, 1.7)]):
		c = lowpoly.ritual_candle(f"Candle{i}", seed=31 + i)
		c.scale = (1, 1, h)
		lowpoly.place(c, (x, -2.6, 0))
	lowpoly.place(lowpoly.rock("Rock_A", (1.8, 1.4, 1.0), seed=11), (5.5, 0.5, 0))
	lowpoly.place(lowpoly.rock("Rock_B", (1.1, 1.0, 0.8), seed=14), (6.8, -1.6, 0))
	lowpoly.place(lowpoly.gate_pillar("GatePillar"), (9.5, 3, 0))
