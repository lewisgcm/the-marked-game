"""One shared colour palette for every low-poly prop (the Synty "POLYGON" approach).

Instead of textures, each face's UVs are collapsed onto the centre of a flat colour swatch in
a tiny palette image. Every prop shares the same image and the same material, so the whole
set looks consistent, and in Roblox it is one TextureID on every MeshPart.

    mat = palette.material()
    palette.paint(ob, "stone")                                   # whole object
    palette.paint_where(ob, "moss", lambda f: f.normal.z > 0.6)  # upward faces only

The palette PNG is written to assets/models/_palette/palette.png (upload it once to Roblox).
Swatches marked as glowing also light up in previews (an emission mask), e.g. lantern glass;
in Roblox, glow comes from a PointLight/Neon part added by code.
"""

import os

import bmesh
import bpy

# Uploaded models keep the palette they were uploaded with, so this can grow. (Except the lobby kit, which
# shares one uploaded image: if the kit is rebuilt, upload the new palette with it.)
GRID = 16  # swatches per row/column
CELL = 16  # pixels per swatch
SIZE = GRID * CELL

# name: (sRGB hex, glows?)
SWATCHES = {
	# stone
	"stone_light": ("#9a97a3", False),
	"stone": ("#73717e", False),
	"stone_dark": ("#4d4b58", False),
	"stone_deep": ("#2f2e38", False),
	# growth
	"moss": ("#5a7a4f", False),
	"moss_dark": ("#3a5538", False),
	"grass": ("#3d5444", False),
	"dirt": ("#4b3c34", False),
	# wood
	"bark": ("#4e3d33", False),
	"bark_dark": ("#30251f", False),
	"wood": ("#6f5139", False),
	"wood_dark": ("#46321f", False),
	# metal
	"iron": ("#2b2830", False),
	"iron_light": ("#4a4652", False),
	"rust": ("#8a4c2e", False),
	"gold": ("#b08a3c", False),
	# bone & wax
	"bone": ("#e4dac2", False),
	"bone_shadow": ("#b3a78c", False),
	"socket": ("#1d1714", False),
	"wax": ("#efe6cc", False),
	# accents
	"blood": ("#8f1c20", False),
	"blood_dark": ("#561013", False),
	"cloth": ("#3c3550", False),
	"mist": ("#5d527d", False),
	# light (glow in previews)
	"flame": ("#ffb347", True),
	"lantern_glow": ("#ffd27a", True),
	"window_glow": ("#ff9a3d", True),
	"ghost_glow": ("#9fe8ff", True),
	# infected (append only: a swatch's place in the image is its place in this list)
	"infected_skin": ("#9aa394", False),
	"infected_shadow": ("#4f5750", False),
	"infected_eye": ("#ff1a10", True),
	"glitch": ("#4fe3e0", True),
	"glitch_pink": ("#e0459b", True),
	# Dad
	"dad_hair": ("#3b2f2a", False),
	"dad_shirt": ("#46608a", False),
	"dad_shirt_dark": ("#33486b", False),
	"dad_vest": ("#d9d5c8", False),
	"dad_chinos": ("#8d7a5a", False),
	"dad_chinos_dark": ("#6f5f45", False),
	"dad_sock": ("#a8a39a", False),
	"dad_sock_toe": ("#7d4a3c", False),
	"dad_slipper": ("#6e3b34", False),
	# the neighbour (shambler)
	"hoodie": ("#5c4a56", False),
	"hoodie_dark": ("#41343e", False),
	"hoodie_lining": ("#2a2229", False),
	"joggers": ("#4a4f55", False),
	"joggers_dark": ("#373b40", False),
	"trainer": ("#b9b4a6", False),
	"trainer_sole": ("#6b675f", False),
	# vehicles
	"car_glass": ("#1f2833", False),
	"car_tail": ("#a3262a", False),
	"car_teal": ("#3d7a80", False),
	"car_teal_dark": ("#295559", False),
	"car_mustard": ("#bf9238", False),
	"car_mustard_dark": ("#86642a", False),
	"car_silver": ("#8e979e", False),
	"car_silver_dark": ("#5f676e", False),
	"ice_pink": ("#d98ba0", False),
	"fire_red": ("#b3302a", False),
	"light_blue": ("#3f86d9", True),
	# wrecks
	"char": ("#2a2624", False),
	"char_light": ("#4a423d", False),
	"rust_dark": ("#5c3321", False),
	"plum": ("#6f4b66", False),
	"plum_dark": ("#4c3347", False),
	"bus_yellow": ("#d3a032", False),
	"olive": ("#646e4b", False),
	"olive_dark": ("#474f36", False),
	# the map kit (trees, hedges, fields, camp)
	"pine": ("#2e4a33", False),
	"pine_dark": ("#1f3325", False),
	"leaf": ("#4c7238", False),
	"leaf_dark": ("#36552a", False),
	"hedge": ("#365a2c", False),
	"hedge_dark": ("#26421f", False),
	"dead_wood": ("#625a50", False),
	"dead_wood_dark": ("#433d36", False),
	"reed": ("#7f8443", False),
	"reed_head": ("#4a3424", False),
	"hay": ("#c9a650", False),
	"hay_dark": ("#97793a", False),
	"canvas": ("#6d7049", False),
	"canvas_dark": ("#4f5235", False),
	"barrier_white": ("#e6e3da", False),
	"wood_light": ("#9a7a55", False),
}

_NAMES = list(SWATCHES)
assert len(_NAMES) <= GRID * GRID, "the palette is full"
_material = None


def _rgb(hex_code):
	hex_code = hex_code.lstrip("#")
	return tuple(int(hex_code[i : i + 2], 16) / 255.0 for i in (0, 2, 4))


def uv_of(name):
	"""UV at the centre of a swatch (row 0 is the top of the image)."""
	index = _NAMES.index(name)
	col, row = index % GRID, index // GRID
	u = (col + 0.5) / GRID
	v = 1.0 - (row + 0.5) / GRID
	return u, v


def _make_image(name, pick):
	image = bpy.data.images.new(name, SIZE, SIZE, alpha=False)
	pixels = [0.0] * (SIZE * SIZE * 4)
	for index, swatch in enumerate(_NAMES):
		col, row = index % GRID, index // GRID
		r, g, b = pick(swatch)
		for y in range(CELL):
			# Blender images start at the bottom row.
			py = SIZE - 1 - (row * CELL + y)
			for x in range(CELL):
				i = (py * SIZE + col * CELL + x) * 4
				pixels[i : i + 4] = (r, g, b, 1.0)
	image.pixels = pixels
	return image


def save_png(path):
	"""Writes the palette image (what gets uploaded to Roblox)."""
	os.makedirs(os.path.dirname(path), exist_ok=True)
	image = _make_image("PaletteExport", lambda s: _rgb(SWATCHES[s][0]))
	image.filepath_raw = path
	image.file_format = "PNG"
	image.save()


def link_png(path):
	"""Points the material's image at the saved PNG, so exporters can embed it."""
	image = bpy.data.images["Palette"]
	image.source = "FILE"
	image.filepath = path
	image.reload()


def material():
	"""The one shared palette material (image colour, glowing swatches emit in previews)."""
	global _material
	if _material is not None:
		try:
			if _material.name in bpy.data.materials:
				return _material
		except ReferenceError:
			pass  # the scene was reset between assets
	colour = _make_image("Palette", lambda s: _rgb(SWATCHES[s][0]))
	mask = _make_image("PaletteGlow", lambda s: (1.0, 1.0, 1.0) if SWATCHES[s][1] else (0.0, 0.0, 0.0))
	mask.colorspace_settings.name = "Non-Color"

	mat = bpy.data.materials.new("Palette")
	mat.use_nodes = True
	nodes, links = mat.node_tree.nodes, mat.node_tree.links
	bsdf = nodes["Principled BSDF"]
	bsdf.inputs["Roughness"].default_value = 0.85

	tex = nodes.new("ShaderNodeTexImage")
	tex.image = colour
	tex.interpolation = "Closest"
	glow = nodes.new("ShaderNodeTexImage")
	glow.image = mask
	glow.interpolation = "Closest"
	links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

	# Emission = colour x mask, so only glowing swatches emit.
	mix = nodes.new("ShaderNodeMix")
	mix.data_type = "RGBA"
	mix.blend_type = "MULTIPLY"
	mix.inputs["Factor"].default_value = 1.0
	links.new(tex.outputs["Color"], mix.inputs[6])
	links.new(glow.outputs["Color"], mix.inputs[7])
	emission = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
	links.new(mix.outputs[2], emission)
	strength = bsdf.inputs.get("Emission Strength")
	if strength is not None:
		strength.default_value = 6.0
	mat.diffuse_color = (0.5, 0.5, 0.5, 1.0)
	_material = mat
	return mat


def _ensure(ob):
	if not ob.data.materials:
		ob.data.materials.append(material())
	if not ob.data.uv_layers:
		ob.data.uv_layers.new(name="UVMap")
	# Paint the layer that renders and exports.
	ob.data.uv_layers.active = ob.data.uv_layers[0]


def paint_where(ob, name, test=lambda face: True):
	"""Colours every face of `ob` that passes `test(face)` (a BMFace) with swatch `name`."""
	_ensure(ob)
	u, v = uv_of(name)
	bm = bmesh.new()
	bm.from_mesh(ob.data)
	uv = bm.loops.layers.uv.verify()
	for face in bm.faces:
		if test(face):
			for loop in face.loops:
				loop[uv].uv = (u, v)
	bm.to_mesh(ob.data)
	bm.free()
	ob.data.update()


def paint(ob, name):
	paint_where(ob, name)


def flat(ob):
	"""Faceted look: flat shading on every face."""
	for poly in ob.data.polygons:
		poly.use_smooth = False
