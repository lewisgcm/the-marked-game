--[[
	Lays the map tiles out to look at in Studio, without playing (see MAP.md):

		npm run tiles         # builds the tiles, then writes build/tiles/view
		npm run serve:tiles   # the same, then live-syncs it into Studio

	- Gallery: every tile on its own, in a row, with its edge labels.
	- Sample: tiles joined up as they could be in a run, to check the seams.

	build/tiles/view is thrown away and rebuilt: edit the tiles (tools/tiles/tiles) instead.
]]

local fs = require("@lune/fs")
local process = require("@lune/process")
local serde = require("@lune/serde")
local tiles = require("./tiles")

local OUT = "build/tiles/view"
local GAP = 60
--- The gallery's row, south of the sample map.
local GALLERY_Z = 460

--- Rows from north to south; `turns` is clockwise quarter turns.
local SAMPLE = {
	{ { tile = "Swamp_A", turns = 0 }, { tile = "ForestRoad_A", turns = 0 }, { tile = "Meadow_A", turns = 3 } },
	{ { tile = "Treehouse", turns = 0 }, { tile = "Houses_A", turns = 0 }, { tile = "Meadow_A", turns = 0 } },
}

local IDENTITY = { 1, 0, 0, 0, 1, 0, 0, 0, 1 }

--- Text floating in the air.
local function label(text: string, x: number, y: number, z: number, height: number): any
	local cf = { x, y, z }
	table.move(IDENTITY, 1, 9, 4, cf)
	return {
		name = "Label",
		className = "Part",
		properties = {
			Anchored = true,
			CanCollide = false,
			Transparency = 1,
			Size = { 1, 1, 1 },
			CFrame = cf,
		},
		children = {
			{
				name = "Text",
				className = "BillboardGui",
				properties = { Size = { UDim2 = { { height * 8, 0 }, { height, 0 } } }, AlwaysOnTop = true },
				children = {
					{
						name = "Label",
						className = "TextLabel",
						properties = {
							Size = { UDim2 = { { 1, 0 }, { 1, 0 } } },
							BackgroundTransparency = 1,
							TextScaled = true,
							TextColor3 = { 1, 1, 1 },
							TextStrokeTransparency = 0,
							Text = text,
						},
					},
				},
			},
		},
	}
end

local all = tiles.loadAll()
local names = {}
for name in all do
	table.insert(names, name)
end
table.sort(names)

local function tileNamed(name: string): any
	return all[name] or error(`The sample map needs {name}, which isn't a tile`, 0)
end

local written = {}
local function write(folder: string, name: string, model: any)
	fs.writeDir(`{OUT}/{folder}`)
	local path = `{OUT}/{folder}/{name}.model.json`
	fs.writeFile(path, serde.encode("json", model))
	written[path] = true
end

-- The gallery.
for i, name in names do
	local x = (i - (#names + 1) / 2) * (tiles.SIZE + GAP)
	local model = tiles.move(all[name], 0, x, GALLERY_Z)
	table.insert(model.children, label(name, x, 60, GALLERY_Z, 14))
	local edges = all[name].attributes or {}
	for side, out in { North = { 0, -1 }, East = { 1, 0 }, South = { 0, 1 }, West = { -1, 0 } } do
		local reach = tiles.SIZE / 2 - 8
		table.insert(
			model.children,
			label(`{side}: {edges[side]}`, x + out[1] * reach, 12, GALLERY_Z + out[2] * reach, 5)
		)
	end
	write("Gallery", name, model)
end

-- The sample map, checking each seam.
local badSeams = 0
for row, slots in SAMPLE do
	for column, slot in slots do
		local x = (column - (#slots + 1) / 2) * tiles.SIZE
		local z = (row - (#SAMPLE + 1) / 2) * tiles.SIZE
		write("Sample", `{row}_{column}_{slot.tile}`, tiles.move(tileNamed(slot.tile), slot.turns, x, z))

		local edges = tiles.turnEdges(tileNamed(slot.tile).attributes, slot.turns)
		local function seam(other: any, mine: string, theirs: string)
			if other then
				local joined = tiles.turnEdges(tileNamed(other.tile).attributes, other.turns)
				if not tiles.edgesJoin(edges[mine], joined[theirs]) then
					badSeams += 1
					print(`  {slot.tile} {mine} ({edges[mine]}) doesn't join {other.tile} {theirs} ({joined[theirs]})`)
				end
			end
		end
		seam(slots[column + 1], "East", "West")
		seam(SAMPLE[row + 1] and SAMPLE[row + 1][column], "South", "North")
	end
end

-- Clear out tiles that have gone (not the whole folder: Rojo may be watching it).
for _, folder in { "Gallery", "Sample" } do
	for _, file in fs.readDir(`{OUT}/{folder}`) do
		local path = `{OUT}/{folder}/{file}`
		if not written[path] then
			fs.removeFile(path)
		end
	end
end

print(`{#names} tiles laid out in {OUT}`)
if badSeams > 0 then
	print(`{badSeams} seams in the sample map don't join`)
	process.exit(1)
end
