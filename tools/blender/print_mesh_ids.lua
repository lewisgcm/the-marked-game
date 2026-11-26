-- Paste into Studio's command bar (View > Command Bar) after importing map_kit.fbx or map_buildings.fbx.
-- Prints one "Name=rbxassetid://..." line per imported MeshPart, and the palette as "Texture=...";
-- save the Output to a file for tools/blender/map_kit_ids.py. (With the Studio MCP, the agent reads the
-- IDs itself from the uploaded model: tools/blender/README.md.)
local found = 0
for _, kit in { "map_kit", "map_buildings" } do
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
		do
			print("Texture=" .. (texture or "(none: was the palette uploaded with the FBX?)"))
		end
	end
end
print(found .. " meshes found" .. (found == 0 and " (is the imported model named map_kit or map_buildings, in Workspace?)" or ""))
