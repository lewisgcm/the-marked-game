"""Ordinary people on the same R15 rig as the infected (lib/blocky.py): the lobby's parents. Each piece takes
its swatches, so a character file only says what's different about them (MODELLING.md).

Same proportions and joints as the infected, so the same animations fit. Faces -Y, about 5.3 studs tall.
"""

from . import lowpoly, palette
from .blocky import ARM_X, LEG_X, bit, loft


def face(skin_shadow, brow):
	"""Plain human eyes (whites and pupils), brows, a nose and a mouth: nothing wrong with them. Yet."""
	pieces = []
	for s in (-1, 1):
		pieces += [
			bit((0.22, 0.05, 0.13), (s * 0.23, -0.555, 4.56), "eye_white"),
			bit((0.09, 0.05, 0.10), (s * 0.22, -0.575, 4.555), "pupil"),
			bit((0.26, 0.06, 0.06), (s * 0.24, -0.555, 4.72), brow, s * 7),  # inner ends up: tired, worried
		]
	return pieces + [
		bit((0.14, 0.14, 0.22), (0, -0.58, 4.38), skin_shadow),
		bit((0.26, 0.05, 0.06), (0, -0.55, 4.14), "lip"),
	]


def skull(skin):
	return loft("skull", [
		(3.86, 0.36, -0.34, 0.34), (4.06, 0.50, -0.54, 0.46), (4.80, 0.52, -0.54, 0.50), (4.98, 0.46, -0.48, 0.46),
	], skin, cut=0.14)


def ears(skin):
	return [bit((0.10, 0.22, 0.24), (s * 0.54, 0.00, 4.48), skin) for s in (-1, 1)]


def torso(shirt, shirt_dark, skin):
	"""An upper body in `shirt`, with a neck."""
	body = loft("body", [
		(2.36, 0.64, -0.38, 0.36), (2.70, 0.66, -0.40, 0.38), (3.30, 0.70, -0.38, 0.40),
		(3.66, 0.74, -0.36, 0.40), (3.86, 0.54, -0.30, 0.34),
	], shirt)
	neck = loft("neck", [(3.74, 0.26, -0.24, 0.22), (3.98, 0.26, -0.24, 0.22)], skin)
	collar = loft("collar", [(3.72, 0.46, -0.38, 0.42), (3.90, 0.40, -0.32, 0.40)], shirt_dark)
	return [body, neck, collar]


def hips(trousers):
	return [loft("hips", [(1.96, 0.60, -0.34, 0.34), (2.30, 0.62, -0.36, 0.35), (2.48, 0.60, -0.36, 0.33)], trousers)]


def arm(s, sleeve, sleeve_dark, skin, rolled=False):
	"""One arm: `sleeve` down to the wrist (or `rolled` to the elbow), and a hand."""
	side = "Left" if s > 0 else "Right"
	x = s * ARM_X
	upper = loft("upper", [(2.76, 0.24, -0.25, 0.25), (3.60, 0.27, -0.28, 0.28), (3.82, 0.21, -0.23, 0.23)], sleeve, x)
	if rolled:
		lower = [
			loft("lower", [(2.04, 0.19, -0.20, 0.20), (2.64, 0.22, -0.23, 0.23), (2.96, 0.21, -0.22, 0.22)], skin, x),
			loft("cuff", [(2.70, 0.27, -0.28, 0.28), (2.92, 0.27, -0.28, 0.28)], sleeve_dark, x),
		]
	else:
		lower = [
			loft("lower", [(2.10, 0.23, -0.24, 0.24), (2.64, 0.25, -0.26, 0.26), (2.96, 0.23, -0.24, 0.24)], sleeve, x),
			loft("cuff", [(2.02, 0.24, -0.25, 0.25), (2.18, 0.25, -0.26, 0.26)], sleeve_dark, x),
		]
	hand = loft("hand", [(1.68, 0.19, -0.21, 0.19), (1.92, 0.23, -0.25, 0.23), (2.16, 0.18, -0.19, 0.19)], skin, x)
	thumb = bit((0.10, 0.15, 0.22), (x - s * 0.13, -0.27, 1.94), skin)
	return {f"{side}UpperArm": [upper], f"{side}LowerArm": lower, f"{side}Hand": [hand, thumb]}


def leg(s, trousers, trousers_dark, shoe, sole="trainer_sole"):
	side = "Left" if s > 0 else "Right"
	x = s * LEG_X
	upper = loft("thigh", [(1.12, 0.27, -0.28, 0.28), (2.00, 0.31, -0.33, 0.33), (2.18, 0.27, -0.29, 0.29)], trousers, x)
	lower = loft("shin", [(0.40, 0.23, -0.24, 0.24), (0.60, 0.26, -0.27, 0.27), (1.30, 0.26, -0.27, 0.27)], trousers, x)
	hem = lowpoly.box("hem", (0.48, 0.50, 0.12), (x, 0, 0.40), trousers_dark)
	foot = loft("shoe", [(0.0, 0.26, -0.62, 0.29), (0.10, 0.27, -0.64, 0.29), (0.24, 0.25, -0.54, 0.27), (0.42, 0.19, -0.20, 0.23)], shoe, x)
	palette.paint_where(foot, sole, lambda f: f.calc_center_median().z < 0.08)
	return {f"{side}UpperLeg": [upper], f"{side}LowerLeg": [lower, hem], f"{side}Foot": [foot]}


def body(head, torso_pieces, hips_pieces, arms, legs):
	"""{part: pieces} for build_character: `arms` and `legs` are (left, right) dicts from arm() and leg()."""
	parts = {"Head": head, "UpperTorso": torso_pieces, "LowerTorso": hips_pieces}
	for limb in (*arms, *legs):
		parts.update(limb)
	return parts
