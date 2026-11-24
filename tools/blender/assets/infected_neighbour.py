"""The neighbour: the ordinary shambler. An original blocky character on an R15 rig (lib/rig.py).

Hoodie with the hood up, so in the dark you mostly see red eyes; joggers and one untied trainer.
No blood (GAMEPLAY.md, content rules). Faces -Y, about 5.3 studs tall.
"""

from lib import lowpoly, palette
from lib.blocky import ARM_X, LEG_X, bit, build_character, infected_face, loft, pose, preview_lights  # noqa: F401

RIGGED = True
PREVIEW_DIRECTION = (0.62, -1.0, 0.28)
PREVIEW_MARGIN = 1.0
PREVIEW_BACKGROUND = (0.10, 0.11, 0.13)


def head():
	skull = loft("skull", [
		(3.86, 0.36, -0.34, 0.34), (4.06, 0.50, -0.54, 0.46), (4.80, 0.52, -0.54, 0.50), (4.98, 0.46, -0.48, 0.46),
	], "infected_skin", cut=0.14)
	# The hood is a shell round the skull: two sides, a back and a peaked top, open at the face.
	back = loft("hood_back", [
		(3.90, 0.56, 0.18, 0.60), (4.40, 0.66, 0.14, 0.72), (4.96, 0.62, 0.10, 0.70), (5.18, 0.44, 0.06, 0.52),
	], "hoodie", cut=0.18)
	top = loft("hood_top", [(4.90, 0.64, -0.66, 0.56), (5.12, 0.56, -0.60, 0.52), (5.28, 0.34, -0.36, 0.34)], "hoodie", cut=0.16)
	pieces = [skull, back, top, bit((1.02, 0.06, 0.10), (0, -0.60, 4.90), "hoodie_lining")]
	for s in (-1, 1):
		pieces += [
			bit((0.14, 0.94, 1.06), (s * 0.58, -0.17, 4.46), "hoodie"),
			bit((0.05, 0.08, 0.86), (s * 0.505, -0.57, 4.46), "hoodie_lining"),
			bit((0.24, 0.07, 0.07), (s * 0.24, -0.57, 4.72), "infected_shadow", s * 16),
		]
	return pieces + infected_face()


def upper_torso():
	body = loft("body", [
		(2.36, 0.66, -0.40, 0.38), (2.70, 0.68, -0.42, 0.40), (3.30, 0.72, -0.40, 0.42),
		(3.66, 0.76, -0.38, 0.42), (3.86, 0.56, -0.32, 0.36),
	], "hoodie")
	neck = loft("neck", [(3.74, 0.28, -0.26, 0.24), (3.98, 0.28, -0.26, 0.24)], "infected_skin")
	collar = loft("collar", [(3.72, 0.50, -0.40, 0.46), (3.94, 0.44, -0.34, 0.44)], "hoodie_dark")
	pieces = [body, neck, collar, bit((0.06, 0.05, 1.30), (0, -0.42, 3.04), "hoodie_lining")]
	for s in (-1, 1):
		# Pocket openings and drawstrings, one hanging lower than the other.
		pieces.append(bit((0.36, 0.06, 0.34), (s * 0.34, -0.42, 2.66), "hoodie_dark", s * 12))
		drop = 0.50 if s > 0 else 0.30
		pieces.append(bit((0.05, 0.05, drop), (s * 0.16, -0.45, 3.70 - drop / 2), "bone"))
	return pieces


def lower_torso():
	hips = loft("hips", [(1.96, 0.62, -0.36, 0.36), (2.30, 0.64, -0.38, 0.37), (2.48, 0.62, -0.38, 0.34)], "joggers")
	return [hips, lowpoly.box("ribbing", (1.36, 0.84, 0.16), (0, -0.01, 2.38), "hoodie_dark")]


def arm(s):
	side = "Left" if s > 0 else "Right"
	x = s * ARM_X
	upper = loft("upper", [(2.76, 0.25, -0.26, 0.26), (3.60, 0.28, -0.29, 0.29), (3.82, 0.22, -0.24, 0.24)], "hoodie", x)
	hand = loft("hand", [(1.68, 0.20, -0.22, 0.20), (1.92, 0.24, -0.26, 0.24), (2.16, 0.19, -0.20, 0.20)], "infected_skin", x)
	if s > 0:  # sleeve pushed up
		lower = [
			loft("lower", [(2.04, 0.20, -0.21, 0.21), (2.64, 0.23, -0.24, 0.24), (2.96, 0.22, -0.23, 0.23)], "infected_skin", x),
			loft("cuff", [(2.56, 0.28, -0.29, 0.29), (2.84, 0.28, -0.29, 0.29)], "hoodie_dark", x),
		]
	else:  # sleeve down over the wrist
		lower = [
			loft("lower", [(2.10, 0.24, -0.25, 0.25), (2.64, 0.26, -0.27, 0.27), (2.96, 0.24, -0.25, 0.25)], "hoodie", x),
			loft("cuff", [(2.00, 0.25, -0.26, 0.26), (2.18, 0.26, -0.27, 0.27)], "hoodie_dark", x),
		]
	return {
		f"{side}UpperArm": [upper],
		f"{side}LowerArm": lower,
		f"{side}Hand": [hand, bit((0.11, 0.16, 0.24), (x - s * 0.14, -0.28, 1.94), "infected_skin")],
	}


def leg(s):
	side = "Left" if s > 0 else "Right"
	x = s * LEG_X
	upper = loft("thigh", [(1.12, 0.28, -0.29, 0.29), (2.00, 0.32, -0.34, 0.34), (2.18, 0.28, -0.30, 0.30)], "joggers", x)
	lower = loft("shin", [(0.40, 0.24, -0.25, 0.25), (0.60, 0.28, -0.29, 0.29), (1.30, 0.27, -0.28, 0.28)], "joggers", x)
	cuff = lowpoly.box("cuff", (0.50, 0.52, 0.16), (x, 0, 0.38), "joggers_dark")
	shoe = loft("shoe", [(0.0, 0.27, -0.64, 0.30), (0.10, 0.28, -0.66, 0.30), (0.24, 0.26, -0.56, 0.28), (0.42, 0.20, -0.20, 0.24)], "trainer", x)
	palette.paint_where(shoe, "trainer_sole", lambda f: f.calc_center_median().z < 0.08)
	feet = [shoe]
	if s > 0:  # the lace has come undone
		feet += [bit((0.30, 0.05, 0.05), (x + 0.20, -0.46, 0.22), "bone", 35), bit((0.22, 0.05, 0.05), (x - 0.10, -0.44, 0.28), "bone", -10)]
	return {f"{side}UpperLeg": [upper], f"{side}LowerLeg": [lower, cuff], f"{side}Foot": feet}


def build():
	parts = {"Head": head(), "UpperTorso": upper_torso(), "LowerTorso": lower_torso()}
	for s in (1, -1):
		parts.update(arm(s))
		parts.update(leg(s))
	return build_character(parts)


def preview_pose():
	"""Head down, arms hanging (never exported)."""
	pose({
		"UpperTorso": (14, -6, 0), "Head": (2, 10, -12),
		"LeftUpperArm": (-18, 0, 8), "LeftLowerArm": (-30, 0, 0),
		"RightUpperArm": (-44, 0, -4), "RightLowerArm": (-18, 0, 0), "RightHand": (24, 0, 0),
		"RightUpperLeg": (-22, 0, 0), "RightLowerLeg": (14, 0, 0), "RightFoot": (8, 0, 0),
		"LeftUpperLeg": (14, 0, 0), "LeftLowerLeg": (12, 0, 0), "LeftFoot": (-20, 0, 0),
	})
