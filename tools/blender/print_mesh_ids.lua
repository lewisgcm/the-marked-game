-- Paste into Studio's command bar (View > Command Bar) after importing lobby_kit.fbx or map_kit.fbx.
-- Prints one "Name=rbxassetid://..." line per imported MeshPart (and the map kit's palette as
-- "Texture=..."); copy the Output and paste it back so tools/blender/kit_rojo.py (lobby kit) or
-- tools/blender/map_kit_ids.py (map kit) can write the IDs in.
local found = 0
for _, kit in { "lobby_kit", "map_kit" } do
	local model = workspace:FindFirstChild(kit)
	if model then
		local texture
		for _, d in model:GetDescendants() do
			if d:IsA("MeshPart") then
				print(d.Name .. "=" .. d.MeshId)
				-- The importer puts the palette in TextureID, or in a SurfaceAppearance.
				local look = d:FindFirstChildOfClass("SurfaceAppearance")
				texture = texture
					or (d.TextureID ~= "" and d.TextureID)
					or (look and look.ColorMap ~= "" and look.ColorMap)
					or nil
				found += 1
			end
		end
		if kit == "map_kit" then
			print("Texture=" .. (texture or "(none: was the palette uploaded with the FBX?)"))
		end
	end
end
print(found .. " meshes found" .. (found == 0 and " (is the imported model named lobby_kit or map_kit, in Workspace?)" or ""))
