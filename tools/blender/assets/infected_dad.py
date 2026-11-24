"""Dad: the first infected. An original blocky character on an R15 rig (see lib/rig.py).

Caught on the sofa when the Signal landed: blue shirt, chinos, one slipper (the other foot is in
its sock), red eyes and the three glitch marks on his face. No blood (GAMEPLAY.md, content rules).
Faces -Y, about 5.4 studs tall.
"""

from lib import lowpoly, palette
from lib.blocky import ARM_X, LEG_X, bit, build_character, infected_face, loft, pose, preview_lights  # noqa: F401

RIGGED = True
PREVIEW_DIRECTION = (0.62, -1.0, 0.28)
PREVIEW_MARGIN = 1.0
PREVIEW_BACKGROUND = (0.10, 0.11, 0.13)

def head():
	skull = loft("skull", [
		(3.86, 0.40, -0.34, 0.34), (4.06, 0.56, -0.54, 0.46), (4.80, 0.58, -0.54, 0.52), (5.02, 0.54, -0.50, 0.50),
	], "infected_skin", cut=0.16)
	hair = loft("hair", [
		(4.42, 0.60, 0.06, 0.58), (4.92, 0.62, -0.06, 0.58), (5.18, 0.56, -0.30, 0.52), (5.26, 0.44, -0.20, 0.42),
	], "dad_hair", cut=0.16)
	pieces = [skull, hair, bit((0.78, 0.36, 0.20), (0.10, -0.38, 5.06), "dad_hair", 6)]
	for s in (-1, 1):
		pieces += [
			bit((0.34, 0.08, 0.09), (s * 0.25, -0.57, 4.74), "dad_hair", s * 14),
			bit((0.10, 0.24, 0.26), (s * 0.60, 0.00, 4.48), "infected_skin"),
		]
	pieces += infected_face()
	return pieces


def upper_torso():
	body = loft("body", [
		(2.36, 0.68, -0.50, 0.36), (2.72, 0.72, -0.56, 0.38), (3.20, 0.74, -0.46, 0.40),
		(3.66, 0.78, -0.40, 0.40), (3.86, 0.58, -0.34, 0.34),
	], "dad_shirt")
	neck = loft("neck", [(3.74, 0.28, -0.26, 0.24), (3.98, 0.28, -0.26, 0.24)], "infected_skin")
	pieces = [body, neck]
	# Open collar over a vest, then the button band (leans with the belly).
	pieces += [
		bit((0.30, 0.06, 0.34), (0, -0.40, 3.62), "dad_vest"),
		bit((0.11, 0.10, 0.42), (-0.20, -0.42, 3.66), "dad_shirt_dark", 22),
		bit((0.11, 0.10, 0.42), (0.20, -0.42, 3.66), "dad_shirt_dark", -22),
		bit((0.14, 0.06, 0.32), (0, -0.45, 3.30), "dad_shirt_dark"),
		bit((0.14, 0.06, 0.44), (0, -0.52, 2.94), "dad_shirt_dark"),
		bit((0.36, 0.06, 0.30), (0.40, -0.42, 3.34), "dad_shirt_dark"),  # chest pocket
		bit((0.05, 0.06, 0.16), (0.48, -0.45, 3.54), "iron"),  # pen
	]
	for z, y in ((3.36, -0.49), (3.02, -0.56), (2.82, -0.56)):
		pieces.append(bit((0.06, 0.04, 0.06), (0, y, z), "dad_vest"))
	return pieces


def lower_torso():
	hips = loft("hips", [(1.96, 0.66, -0.40, 0.36), (2.30, 0.68, -0.44, 0.37), (2.48, 0.66, -0.46, 0.34)], "dad_chinos")
	return [
		hips,
		bit((1.38, 0.84, 0.12), (0, -0.03, 2.30), "wood_dark"),
		bit((0.20, 0.06, 0.14), (0, -0.46, 2.30), "gold"),
		bit((0.44, 0.07, 0.46), (-0.40, -0.46, 2.20), "dad_shirt", 6),  # shirt tail hanging out
	]


def arm(s):
	side = "Left" if s > 0 else "Right"
	x = s * ARM_X
	upper = loft("upper", [(2.76, 0.25, -0.26, 0.26), (3.60, 0.29, -0.30, 0.30), (3.82, 0.22, -0.24, 0.24)], "dad_shirt", x)
	lower = loft("lower", [(2.04, 0.20, -0.21, 0.21), (2.64, 0.23, -0.24, 0.24), (2.96, 0.22, -0.23, 0.23)], "infected_skin", x)
	hand = loft("hand", [(1.68, 0.20, -0.22, 0.20), (1.92, 0.24, -0.26, 0.24), (2.16, 0.19, -0.20, 0.20)], "infected_skin", x)
	return {
		f"{side}UpperArm": [upper],
		# Sleeves rolled to the elbow, one still neat, the other slipping down.
		f"{side}LowerArm": [lower, loft("cuff", [(2.46 if s > 0 else 2.66, 0.28, -0.29, 0.29), (2.82, 0.28, -0.29, 0.29)], "dad_shirt_dark", x)],
		f"{side}Hand": [hand, bit((0.11, 0.16, 0.24), (x - s * 0.14, -0.28, 1.94), "infected_skin")],
	}


def leg(s):
	side = "Left" if s > 0 else "Right"
	x = s * LEG_X
	upper = loft("thigh", [(1.12, 0.28, -0.29, 0.29), (2.00, 0.33, -0.35, 0.34), (2.18, 0.28, -0.30, 0.30)], "dad_chinos", x)
	lower = loft("shin", [(0.28, 0.26, -0.27, 0.27), (0.42, 0.28, -0.29, 0.29), (1.30, 0.27, -0.28, 0.28)], "dad_chinos", x)
	above_hem = lowpoly.box("hem", (0.60, 0.62, 0.10), (x, 0, 0.36), "dad_chinos_dark")
	if s > 0:  # the sock
		foot = loft("sock", [(0.0, 0.25, -0.60, 0.28), (0.18, 0.25, -0.56, 0.28), (0.42, 0.20, -0.20, 0.22)], "dad_sock", x)
		feet = [foot, bit((0.36, 0.10, 0.14), (x, -0.57, 0.09), "dad_sock_toe")]
	else:
		foot = loft("slipper", [(0.0, 0.31, -0.70, 0.32), (0.08, 0.31, -0.70, 0.32), (0.26, 0.29, -0.60, 0.26), (0.42, 0.20, -0.20, 0.22)], "dad_slipper", x)
		palette.paint_where(foot, "wood_dark", lambda f: f.calc_center_median().z < 0.06)
		feet = [foot, bit((0.50, 0.36, 0.10), (x, -0.14, 0.38), "bone")]  # fluffy lining
	return {f"{side}UpperLeg": [upper], f"{side}LowerLeg": [lower, above_hem], f"{side}Foot": feet}


def build():
	parts = {"Head": head(), "UpperTorso": upper_torso(), "LowerTorso": lower_torso()}
	for s in (1, -1):
		parts.update(arm(s))
		parts.update(leg(s))
	return build_character(parts)


def preview_pose():
	"""A slack shamble, so the preview also proves the joints bend (never exported)."""
	pose({
		"UpperTorso": (10, 8, 0), "Head": (6, -12, 16),
		"LeftUpperArm": (-52, 0, 4), "LeftLowerArm": (-28, 0, 0), "LeftHand": (30, 0, 0),
		"RightUpperArm": (8, 0, -5), "RightLowerArm": (-14, 0, 0),
		"LeftUpperLeg": (-22, 0, 0), "LeftLowerLeg": (14, 0, 0), "LeftFoot": (8, 0, 0),
		"RightUpperLeg": (14, 0, 0), "RightLowerLeg": (12, 0, 0), "RightFoot": (-20, 0, 0),
	})
