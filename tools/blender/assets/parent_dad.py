"""A dad, waiting at a pick-up pad in the lobby: a polo shirt and work trousers, glasses, and his kid's
raincoat over his arm. One odd detail: his watch has stopped (it's on the wrong wrist, too). An original
blocky character on an R15 rig (lib/people.py, MODELLING.md). Faces -Y, about 5.3 studs tall.
"""

from lib import people
from lib.blocky import ARM_X, bit, build_character, loft, pose, preview_lights  # noqa: F401

RIGGED = True
PREVIEW_DIRECTION = (0.62, -1.0, 0.28)
PREVIEW_MARGIN = 1.0
PREVIEW_BACKGROUND = (0.10, 0.11, 0.13)

SKIN, SHADOW = "skin_brown", "skin_brown_shadow"


def head():
	# Cropped hair, and glasses.
	hair = loft("hair", [(4.50, 0.56, -0.40, 0.52), (4.96, 0.56, -0.48, 0.52), (5.08, 0.46, -0.38, 0.44)], "pupil", cut=0.14)
	# Frames round each eye (top, bottom, sides), so the eyes show through.
	glasses = []
	for s in (-1, 1):
		x = s * 0.23
		glasses += [
			bit((0.32, 0.04, 0.04), (x, -0.585, 4.67), "pupil"),
			bit((0.32, 0.04, 0.04), (x, -0.585, 4.47), "pupil"),
			bit((0.04, 0.04, 0.24), (x - 0.15, -0.585, 4.57), "pupil"),
			bit((0.04, 0.04, 0.24), (x + 0.15, -0.585, 4.57), "pupil"),
		]
	glasses += [bit((0.14, 0.04, 0.04), (0, -0.585, 4.62), "pupil")]
	glasses += [bit((0.04, 0.46, 0.04), (s * 0.40, -0.34, 4.62), "pupil") for s in (-1, 1)]
	return [people.skull(SKIN), hair, *people.ears(SKIN), *people.face(SHADOW, "pupil"), *glasses]


def upper_torso():
	pieces = people.torso("polo_green", "navy_dark", SKIN)
	pieces += [bit((0.12, 0.06, 0.40), (0, -0.40, 3.62), "navy_dark"), bit((0.08, 0.05, 0.08), (0, -0.42, 3.50), "shirt_white")]
	return pieces


def raincoat(x):
	"""A kid's yellow raincoat folded over his left forearm, hanging both sides."""
	return [
		bit((0.62, 0.70, 0.18), (x, -0.06, 2.58), "raincoat"),
		bit((0.16, 0.62, 0.86), (x + 0.26, -0.08, 2.14), "raincoat"),
		bit((0.16, 0.56, 0.70), (x - 0.26, -0.04, 2.22), "raincoat_dark"),
		bit((0.08, 0.40, 0.30), (x + 0.36, -0.12, 1.72), "raincoat_dark", 18),
	]


def build():
	left = people.arm(1, "polo_green", "navy_dark", SKIN, rolled=True)
	right = people.arm(-1, "polo_green", "navy_dark", SKIN, rolled=True)
	left["LeftLowerArm"] += raincoat(ARM_X)
	right["RightLowerArm"].append(bit((0.44, 0.46, 0.14), (-ARM_X, -0.02, 2.24), "leather"))
	right["RightLowerArm"].append(bit((0.18, 0.05, 0.12), (-ARM_X, -0.26, 2.24), "eye_white"))
	legs = [people.leg(s, "slate_grey", "slate_grey_dark", "leather", "pupil") for s in (1, -1)]
	return build_character(people.body(head(), upper_torso(), people.hips("slate_grey"), [left, right], legs))


def preview_pose():
	"""The coat arm bent across him (never exported)."""
	pose({"Head": (4, 10, 0), "LeftUpperArm": (-12, 0, -6), "LeftLowerArm": (-70, 0, 0)})
