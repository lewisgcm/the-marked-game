"""A parent on the phone, waiting at a pick-up pad in the lobby: a grey suit with the tie pulled loose, a work
lanyard, greying hair, and the phone. In the lobby the phone is held up and never put down, and the eyes on it
never blink. An original blocky character on an R15 rig (lib/people.py, MODELLING.md). Faces -Y, about 5.3
studs tall.
"""

from lib import people
from lib.blocky import ARM_X, bit, build_character, loft, pose, preview_lights  # noqa: F401

RIGGED = True
PREVIEW_DIRECTION = (0.62, -1.0, 0.28)
PREVIEW_MARGIN = 1.0
PREVIEW_BACKGROUND = (0.10, 0.11, 0.13)

SKIN, SHADOW = "skin_dark", "skin_dark_shadow"


def head():
	hair = loft("hair", [(4.40, 0.58, -0.10, 0.56), (4.94, 0.58, -0.40, 0.54), (5.12, 0.48, -0.34, 0.46)], "hair_grey", cut=0.16)
	sides = [bit((0.10, 0.40, 0.40), (s * 0.55, 0.10, 4.58), "hair_grey") for s in (-1, 1)]
	return [people.skull(SKIN), hair, *sides, *people.ears(SKIN), *people.face(SHADOW, "hair_grey")]


def upper_torso():
	pieces = people.torso("slate_grey", "slate_grey_dark", SKIN)
	# Shirt and loose tie in the jacket's opening, lapels, and the lanyard.
	pieces += [
		bit((0.34, 0.06, 0.80), (0, -0.40, 3.42), "shirt_white"),
		bit((0.12, 0.06, 0.62), (0.02, -0.43, 3.30), "tie_red", 4),
		bit((0.16, 0.07, 0.12), (0.03, -0.44, 3.66), "tie_red"),
	]
	for s in (-1, 1):
		pieces.append(bit((0.20, 0.07, 0.80), (s * 0.24, -0.42, 3.30), "slate_grey_dark", s * -12))
		pieces.append(bit((0.04, 0.05, 0.70), (s * 0.14, -0.44, 3.30), "navy", s * 10))
	pieces.append(bit((0.22, 0.05, 0.30), (0, -0.46, 2.90), "shirt_white"))
	return pieces


def phone(x):
	"""The phone in the right hand, its screen to the front: when the forearm comes up, it faces the eyes."""
	return [
		bit((0.30, 0.06, 0.56), (x, -0.32, 1.86), "pupil"),
		bit((0.24, 0.02, 0.46), (x, -0.36, 1.87), "phone_glow"),
	]


def build():
	left = people.arm(1, "slate_grey", "slate_grey_dark", SKIN)
	right = people.arm(-1, "slate_grey", "slate_grey_dark", SKIN)
	right["RightHand"] += phone(-ARM_X)
	legs = [people.leg(s, "slate_grey", "slate_grey_dark", "leather", "pupil") for s in (1, -1)]
	return build_character(people.body(head(), upper_torso(), people.hips("slate_grey"), [left, right], legs))


def preview_pose():
	"""Phone up, head down to it (never exported)."""
	pose({"Head": (18, 0, 0), "RightUpperArm": (-20, 0, 10), "RightLowerArm": (-95, 0, 0), "RightHand": (0, 0, 0)})
