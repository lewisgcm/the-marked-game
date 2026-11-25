--[[
	Lays the map tiles out to look at in Studio, without playing (see MAP.md):

		npm run tiles               # builds the tiles, then writes build/tiles/view
		npm run tiles -- 7 42 300   # the same, showing the maps for seeds 7, 42 and 300
		npm run serve:tiles         # builds, then live-syncs it into Studio

	- Gallery: every tile on its own, in a row, with its edge labels.
	- Layouts: the run's map (src/shared/world/mapRules.ts) for each seed, planned and placed the way the
	  game does it (src/shared/world/layout.ts), with the woods behind home's row and a roadblock wherever
	  a road runs off the map.

	build/tiles/view is thrown away and rebuilt: edit the tiles (tools/tiles/tiles) instead.
]]

local fs = require("@lune/fs")
local process = require("@lune/process")
local serde = require("@lune/serde")
local tiles = require("./tiles")
local layout = require("../../out/shared/world/layout")
local mapRules = require("../../out/shared/world/mapRules")
local MAP_RULES = mapRules.MAP_RULES

local OUT = "build/tiles/view"
local GAP = 60
--- The gallery's row, south of the layouts (and the woods behind them).
local GALLERY_Z = 460
--- Seeds to show when none are given.
local DEFAULT_SEEDS = { 1, 2, 3 }

local IDENTITY = { 1, 0, 0, 0, 1, 0, 0, 0, 1 }

--- A plain part (no material: SmoothPlastic).
local function block(name: string, size: { number }, cf: { number }, color: { number }): any
	return {
		name = name,
		className = "Part",
		properties = { Anchored = true, Size = size, CFrame = cf, Color = color },
	}
end

--- Text floating in the air.
local function label(text: string, x: number, y: number, z: number, height: number): any
	local cf = { x, y, z }
	table.move(IDENTITY, 1, 9, 4, cf)
	local part = block("Label", { 1, 1, 1 }, cf, { 1, 1, 1 })
	part.properties.CanCollide = false
	part.properties.Transparency = 1
	part.children = {
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
	}
	return part
end

--- A red and white barrier across a road where it leaves the map, `x, z` the edge's middle.
local function roadblock(side: string, x: number, z: number): any
	local alongX = side == "North" or side == "South"
	local cf = { x, 0, z }
	table.move(if alongX then IDENTITY else { 0, 0, 1, 0, 1, 0, -1, 0, 0 }, 1, 9, 4, cf)
	local function at(dx: number, y: number): { number }
		local moved = table.clone(cf)
		moved[2] = y
		if alongX then
			moved[1] += dx
		else
			moved[3] += dx
		end
		return moved
	end
	local parts = {}
	for i = 0, 3 do
		table.insert(parts, block("Board", { 6.5, 1, 0.4 }, at(-10.5 + 7 * i, 2.4), if i % 2 == 0 then { 0.8, 0.12, 0.1 } else { 0.95, 0.95, 0.95 }))
	end
	for _, dx in { -10.5, -3.5, 3.5, 10.5 } do
		table.insert(parts, block("Leg", { 0.4, 2.4, 0.4 }, at(dx, 1.2), { 0.3, 0.3, 0.3 }))
	end
	return { name = "Roadblock", className = "Model", children = parts }
end

local all = tiles.loadAll()
local names = {}
for name in all do
	table.insert(names, name)
end
table.sort(names)

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
	for side, out in tiles.OUTWARD do
		local reach = tiles.SIZE / 2 - 8
		table.insert(
			model.children,
			label(`{side}: {edges[side]}`, x + out[1] * reach, 12, GALLERY_Z + out[2] * reach, 5)
		)
	end
	write("Gallery", name, model)
end

-- The run's map, for each seed.
local seeds = {}
for _, arg in process.args do
	table.insert(seeds, tonumber(arg) or error(`"{arg}" isn't a seed (a number)`, 0))
end
if #seeds == 0 then
	seeds = DEFAULT_SEEDS
end
local catalogue = tiles.catalogue(all)
local failed = 0
local width = MAP_RULES.columns * tiles.SIZE + 120
for i, seed in seeds do
	local folder = `Layouts/Seed_{seed}`
	local offset = (i - (#seeds + 1) / 2) * width
	local planned = layout.planLayout(MAP_RULES, catalogue, tiles.RULES, layout.seededRandom(seed))
	if not planned then
		failed += 1
		print(`  Seed {seed}: no layout fits the rules`)
		continue
	end
	local problems = layout.checkLayout(planned, MAP_RULES, catalogue, tiles.RULES)
	for _, problem in problems do
		failed += 1
		print(`  Seed {seed}: {problem}`)
	end
	-- Placed as the game places them (layout.tilePlacement), but with the grid centred on `offset` and
	-- row 0 (home's) at z = 0.
	local home = MAP_RULES.fixed[1]
	local origin = { x = offset + (home.column - (MAP_RULES.columns - 1) / 2) * tiles.SIZE, z = 0 }
	local function centre(column: number, row: number): (number, number)
		local placed = layout.tilePlacement({ tile = "", column = column, row = row, turns = 0 }, home, origin)
		return placed.x, placed.z
	end
	for _, border in layout.borderPlacements(MAP_RULES, mapRules.SOUTH_BORDER, home, origin) do
		write(folder, `border_{border.x}_{border.tile}`, tiles.move(all[border.tile], 0, border.x, border.z))
	end
	local rows = {}
	for _, placement in planned.tiles do
		local x, z = centre(placement.column, placement.row)
		write(folder, `{placement.row}_{placement.column}_{placement.tile}`, tiles.move(all[placement.tile], placement.turns, x, z))
		rows[placement.row] = (rows[placement.row] or "") .. string.format("%-18s", `{placement.tile}{if placement.turns > 0 then ` ↻{placement.turns}` else ""}`)
	end
	local extras = { name = "Extras", className = "Model", children = {} }
	local _, top = centre(0, MAP_RULES.rows - 1)
	table.insert(extras.children, label(`Seed {seed}`, offset, 70, top - tiles.SIZE / 2 - 20, 20))
	for _, open in planned.openEnds do
		local x, z = centre(open.column, open.row)
		local out = tiles.OUTWARD[open.side]
		table.insert(extras.children, roadblock(open.side, x + out[1] * (tiles.SIZE / 2 - 2), z + out[2] * (tiles.SIZE / 2 - 2)))
	end
	write(folder, "Extras", extras)
	print(`Seed {seed}:`)
	for row = MAP_RULES.rows - 1, 0, -1 do
		print(`  {rows[row]}`)
	end
end

-- Clear out what's gone (file by file, not the whole folder: Rojo may be watching it).
local function prune(path: string): boolean
	local empty = true
	for _, entry in fs.readDir(path) do
		local full = `{path}/{entry}`
		if fs.isDir(full) then
			if prune(full) then
				fs.removeDir(full)
			else
				empty = false
			end
		elseif written[full] then
			empty = false
		else
			fs.removeFile(full)
		end
	end
	return empty
end
prune(OUT)

print(`{#names} tiles and {#seeds} layouts in {OUT}`)
if failed > 0 then
	print(`{failed} problems with the layouts`)
	process.exit(1)
end
