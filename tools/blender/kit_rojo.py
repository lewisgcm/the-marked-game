"""Writes the lobby kit's Rojo model files from pasted mesh IDs.

    python3 tools/blender/kit_rojo.py ids.txt [palette_image_id]

`ids.txt` holds the "Name=rbxassetid://123" lines printed by print_mesh_ids.lua (other lines
are ignored). With no file, writes every model with an empty MeshId (the game falls back to the
old blockout). The ritual items (Skull, Book, Candles) update their existing model files, which
both places share; everything else goes in assets/rojo/kit/ (ReplicatedStorage.Assets.LobbyKit).
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
MANIFEST = os.path.join(REPO, "assets", "models", "lobby_kit", "manifest.json")
KIT_DIR = os.path.join(REPO, "assets", "rojo", "kit")
RITUAL = {"Skull": "skull", "Book": "book", "Candles": "candles"}
PALETTE_FILE = os.path.join(REPO, "assets", "rojo", "palette_id.txt")


def model(mesh_id, texture_id, queryable=False):
	props = {
		"Size": [1, 1, 1],
		"MeshId": mesh_id,
		"Anchored": True,
		# Collisions are invisible Parts placed by code (Rojo can't bake mesh collision data).
		"CanCollide": False,
		"CanQuery": queryable,
		"CanTouch": False,
		"CollisionFidelity": "Box",
		"Material": "SmoothPlastic",
		"Color": [1, 1, 1],
		"TopSurface": "Smooth",
		"BottomSurface": "Smooth",
	}
	if texture_id:
		props["TextureID"] = texture_id
	return {"ClassName": "MeshPart", "Properties": props}


def main():
	ids = {}
	if len(sys.argv) > 1:
		with open(sys.argv[1]) as handle:
			for line in handle:
				match = re.search(r"([A-Za-z_]+)=(rbxassetid://\d+)", line)
				if match:
					ids[match.group(1)] = match.group(2)
	palette = sys.argv[2] if len(sys.argv) > 2 else (open(PALETTE_FILE).read().strip() if os.path.exists(PALETTE_FILE) else "")
	if palette and not palette.startswith("rbxassetid://"):
		palette = f"rbxassetid://{palette}"
	if palette:
		with open(PALETTE_FILE, "w") as handle:
			handle.write(palette + "\n")

	with open(MANIFEST) as handle:
		names = list(json.load(handle))
	os.makedirs(KIT_DIR, exist_ok=True)
	for name in names:
		mesh_id = ids.get(name, "")
		if name in RITUAL:
			path = os.path.join(REPO, "assets", "rojo", f"{RITUAL[name]}.model.json")
			if not mesh_id:
				continue  # keep the current ritual item until the new one is uploaded
		else:
			path = os.path.join(KIT_DIR, f"{name}.model.json")
		with open(path, "w") as handle:
			json.dump(model(mesh_id, palette, queryable=name in RITUAL), handle, indent=2)
			handle.write("\n")
	missing = [n for n in names if n not in ids]
	print(f"wrote {len(names) - len(missing)} meshes with IDs; missing: {', '.join(missing) or 'none'}")
	print(f"palette: {palette or '(none yet)'}")


main()
