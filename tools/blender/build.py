"""Headless Blender build driver for this repo's game models.

    tools/blender/build.sh                    # build every asset in assets/
    tools/blender/build.sh teleport_pad       # build one asset
    tools/blender/build.sh --no-render        # skip preview PNGs (fast)

Each file in tools/blender/assets/ is a plain Python module with a `build()`
function that adds meshes to the scene. The driver handles everything else:
scene reset, export, stats and the preview render.

Output lands in assets/models/<asset>/:
    <asset>.fbx      upload this to Roblox (Studio 3D importer / Asset Manager)
    <asset>.glb      glTF for other engines or quick web previews
    preview.png      render of the asset
    <asset>.json     triangle count, dimensions and file list
"""

import argparse
import importlib.util
import json
import os
import sys
import time

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
ASSETS_DIR = os.path.join(HERE, "assets")
OUT_DIR = os.path.join(REPO, "assets", "models")

sys.path.insert(0, HERE)

from lib import mesh as mesh_lib  # noqa: E402
from lib import preview as preview_lib  # noqa: E402

# Roblox reads a Blender FBX as metres and converts to centimetres, and 1 cm imports as
# 1 stud — so a 10-unit pad arrives at 1000 studs. Exporting at 0.01 cancels that: the
# geometry stays authored in studs, the file stores it 100x smaller, and it imports at
# exactly the modelled size. Verified against Studio's own File Geometry readout.
EXPORT_SCALE = 0.01


def parse_args():
	args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
	parser = argparse.ArgumentParser(prog="build.sh", description="Build game models with Blender.")
	parser.add_argument("assets", nargs="*", help="asset names (default: every asset)")
	parser.add_argument("--no-render", action="store_true", help="skip preview renders")
	parser.add_argument("--samples", type=int, default=32, help="preview render samples")
	parser.add_argument("--resolution", type=int, default=768, help="preview render resolution")
	return parser.parse_args(args)


def discover(names):
	if not os.path.isdir(ASSETS_DIR):
		raise SystemExit(f"no assets directory at {ASSETS_DIR}")
	available = sorted(
		os.path.splitext(f)[0] for f in os.listdir(ASSETS_DIR) if f.endswith(".py") and not f.startswith("_")
	)
	if not names:
		return available
	unknown = [n for n in names if n not in available]
	if unknown:
		raise SystemExit(f"unknown asset(s): {', '.join(unknown)}\navailable: {', '.join(available)}")
	return names


def load_module(name):
	path = os.path.join(ASSETS_DIR, f"{name}.py")
	spec = importlib.util.spec_from_file_location(f"asset_{name}", path)
	module = importlib.util.module_from_spec(spec)
	spec.loader.exec_module(module)
	if not hasattr(module, "build"):
		raise SystemExit(f"{name}.py must define build()")
	return module


def export_asset(name, out_dir, args):
	started = time.time()
	module = load_module(name)
	scene = mesh_lib.reset_scene()

	module.build()

	meshes = [ob for ob in scene.objects if ob.type == "MESH"]
	export_objs = [ob for ob in meshes if not ob.get("preview_only")]
	if not export_objs:
		raise SystemExit(f"{name}.py built no exportable meshes")

	os.makedirs(out_dir, exist_ok=True)
	fbx_path = os.path.join(out_dir, f"{name}.fbx")
	glb_path = os.path.join(out_dir, f"{name}.glb")

	mesh_lib.select_only(export_objs)
	bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

	bpy.ops.export_scene.fbx(
		filepath=fbx_path,
		use_selection=True,
		object_types={"MESH"},
		global_scale=EXPORT_SCALE,
		apply_unit_scale=True,
		apply_scale_options="FBX_SCALE_ALL",
		mesh_smooth_type="OFF",
		use_mesh_modifiers=True,
		bake_space_transform=False,
		path_mode="AUTO",
	)

	mesh_lib.select_only(export_objs)
	bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=True, export_apply=True)

	if not args.no_render:
		preview_lib.setup(
			scene,
			resolution=args.resolution,
			samples=args.samples,
			background=getattr(module, "PREVIEW_BACKGROUND", (0.018, 0.022, 0.030)),
		)
		# Assets can stage their own preview (e.g. a night scene with their own lights).
		if getattr(module, "PREVIEW_GROUND", True):
			preview_lib.add_ground(meshes)
		if hasattr(module, "preview_lights"):
			module.preview_lights(export_objs)
		else:
			preview_lib.add_lights(export_objs)
		# Assets can pick their own camera angle (e.g. a face that should be seen head-on).
		direction = getattr(module, "PREVIEW_DIRECTION", None)
		if direction is not None:
			preview_lib.frame_camera(
				scene, export_objs, direction=direction, margin=getattr(module, "PREVIEW_MARGIN", 1.18)
			)
		else:
			preview_lib.frame_camera(scene, export_objs)
		preview_lib.render(scene, os.path.join(out_dir, "preview.png"))

	info = mesh_lib.stats(export_objs)
	info["name"] = name
	# Blender is Z-up, Roblox is Y-up: (x, y, z) -> (x, z, y). Both are reported,
	# because the Roblox one is what a MeshPart's Size has to match.
	info["size_roblox"] = [info["size"][0], info["size"][2], info["size"][1]]
	info["materials"] = sorted({m.name for ob in export_objs for m in ob.data.materials if m})
	info["export_scale"] = EXPORT_SCALE
	info["files"] = [
		os.path.relpath(p, REPO)
		for p in (fbx_path, glb_path, os.path.join(out_dir, "preview.png"))
		if os.path.exists(p)
	]
	with open(os.path.join(out_dir, f"{name}.json"), "w") as handle:
		json.dump(info, handle, indent="\t")
		handle.write("\n")

	elapsed = time.time() - started
	roblox_size = " x ".join(f"{v:g}" for v in info["size_roblox"])
	print(
		f"[{name}] {info['triangles']} tris, {info['vertices']} verts, {roblox_size} studs (Roblox axes), "
		f"materials={','.join(info['materials']) or '-'}, {elapsed:.1f}s"
	)
	return info


def main():
	args = parse_args()
	names = discover(args.assets)
	print(f"building {len(names)} asset(s) -> {os.path.relpath(OUT_DIR, REPO)}")
	infos = []
	for name in names:
		infos.append(export_asset(name, os.path.join(OUT_DIR, name), args))
	print("done")
	for info in infos:
		print(f"  {info['name']}: {', '.join(info['files']) or '(no files)'}")


main()
