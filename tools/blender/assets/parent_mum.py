"""Mum, waiting at a pick-up pad in the lobby: a long camel coat, jeans and boots, a bag on her shoulder and
her car keys in her hand. One odd detail: her coat's buttoned up wrong. An original blocky character on an
R15 rig (lib/people.py, MODELLING.md). Faces -Y, about 5.3 studs tall.
"""

from lib import people
from lib.blocky import ARM_X, LEG_X, bit, build_character, loft, pose, preview_lights  # noqa: F401

RIGGED = True
PREVIEW_DIRECTION = (0.62, -1.0, 0.28)
PREVIEW_MARGIN = 1.0
PREVIEW_BACKGROUND = (0.10, 0.11, 0.13)

SKIN, SHADOW = "skin_light", "skin_light_shadow"


def head():
	# Shoulder-length hair: over the top and back, down past the neck, a side parting.
	hair = loft("hair", [
		(3.70, 0.58, 0.04, 0.58), (4.30, 0.62, -0.02, 0.62), (4.90, 0.62, -0.10, 0.60), (5.16, 0.52, -0.40, 0.50), (5.24, 0.38, -0.30, 0.38),
	], "hair_auburn", cut=0.18)
	fringe = bit((0.74, 0.30, 0.22), (0.10, -0.40, 4.98), "hair_auburn", 8)
	sides = [bit((0.14, 0.62, 0.96), (s * 0.58, -0.06, 4.30), "hair_auburn") for s in (-1, 1)]
	return [people.skull(SKIN), hair, fringe, *sides, *people.face(SHADOW, "hair_auburn")]


def upper_torso():
	pieces = people.torso("camel", "camel_dark", SKIN)
	# Lapels, and the buttons: done up one hole out, so the left side sits higher.
	for s in (-1, 1):
		pieces.append(bit((0.22, 0.06, 0.70), (s * 0.18, -0.42, 3.40), "camel_dark", s * -14))
	for i, z in enumerate((3.10, 2.80, 2.50)):
		pieces.append(bit((0.09, 0.06, 0.09), (0.06, -0.43, z + (0.12 if i == 0 else 0)), "leather"))
	# The bag: a strap over the left shoulder, the bag on the right hip.
	pieces.append(bit((0.10, 0.06, 1.70), (0.05, -0.43, 3.00), "leather", -32))
	pieces.append(bit((0.10, 0.06, 1.70), (0.05, 0.41, 3.00), "leather", 32))
	return pieces


def lower_torso():
	# The coat's skirt, down over the thighs.
	skirt = loft("coat_skirt", [(1.36, 0.66, -0.40, 0.40), (1.90, 0.66, -0.40, 0.39), (2.48, 0.64, -0.39, 0.37)], "camel")
	bag = bit((0.46, 0.22, 0.40), (-0.70, -0.08, 2.26), "leather")
	return [*people.hips("denim"), skirt, bag, bit((0.06, 0.05, 0.9), (0.06, -0.42, 1.90), "camel_dark")]


def keys(x):
	"""Car keys hanging from her right hand: a fob, a ring and two keys."""
	return [
		bit((0.10, 0.10, 0.18), (x, -0.20, 1.60), "pupil"),
		bit((0.14, 0.04, 0.14), (x, -0.20, 1.48), "key_metal"),
		bit((0.05, 0.03, 0.26), (x - 0.04, -0.20, 1.34), "key_metal", 12),
		bit((0.05, 0.03, 0.22), (x + 0.05, -0.20, 1.36), "key_metal", -16),
	]


def build():
	left = people.arm(1, "camel", "camel_dark", SKIN)
	right = people.arm(-1, "camel", "camel_dark", SKIN)
	right["RightHand"] += keys(-ARM_X)
	legs = [people.leg(s, "denim", "denim_dark", "leather", "pupil") for s in (1, -1)]
	for leg in legs:  # boots, up over the jeans
		side = "Left" if leg.get("LeftFoot") else "Right"
		x = (1 if side == "Left" else -1) * LEG_X
		leg[f"{side}LowerLeg"].append(loft("boot", [(0.30, 0.27, -0.28, 0.28), (0.90, 0.28, -0.29, 0.29)], "leather", x))
	return build_character(people.body(head(), upper_torso(), lower_torso(), [left, right], legs))


def preview_pose():
	"""Weight on one leg, keys held up a little (never exported)."""
	pose({
		"Head": (0, -12, 4), "RightUpperArm": (-16, 0, 0), "RightLowerArm": (-50, 0, 0),
		"LeftUpperLeg": (-4, 0, 0), "RightUpperLeg": (6, 0, 0),
	})
