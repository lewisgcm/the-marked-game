-- Paste into Studio's command bar (View > Command Bar) after importing lobby_kit.fbx.
-- Prints one "Name=rbxassetid://..." line per imported MeshPart; copy the Output and paste it
-- back so tools/blender/kit_rojo.py can write the IDs into assets/rojo.
local found = 0
for _, d in workspace:GetDescendants() do
	if d:IsA("MeshPart") and d:FindFirstAncestor("lobby_kit") then
		print(d.Name .. "=" .. d.MeshId)
		found += 1
	end
end
print(found .. " meshes found" .. (found == 0 and " (is the imported model named lobby_kit, in Workspace?)" or ""))
