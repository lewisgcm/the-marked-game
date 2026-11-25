--[[
	Reading, checking and turning map tiles (see MAP.md): the ones built from code (build.ts writes
	them to build/tiles/models) and any hand-edited ones (assets/tiles). Used by the gallery
	(gallery.luau) and tests/unit/world/tiles.spec.luau.

	A tile is 200x200 studs around the origin, its ground at y = 0. North is -Z, east is +X.
]]

local fs = require("@lune/fs")
local serde = require("@lune/serde")

local tiles = {}

tiles.SIZE = 200
--- Built from tools/tiles/tiles/*.ts, and edited by hand.
tiles.FOLDERS = { "build/tiles/models", "assets/tiles" }
--- Clockwise from above, so turning a tile moves each edge along this list.
tiles.SIDES = { "North", "East", "South", "West" }
tiles.ROUTES = { Road = true, Path = true, None = true }
--- Which grounds may meet at a seam.
tiles.GROUND_JOINS = {
	Town = { Town = true, Grass = true },
	Grass = { Town = true, Grass = true, Forest = true, Swamp = true },
	Forest = { Grass = true, Forest = true, Swamp = true },
	Swamp = { Grass = true, Forest = true, Swamp = true },
}

local EDGE = tiles.SIZE / 2
local OUTWARD = { North = { 0, -1 }, East = { 1, 0 }, South = { 0, 1 }, West = { -1, 0 } }

--- Every tile, by name, as decoded JSON. Run `npm run tiles` first, to build the coded ones.
function tiles.loadAll(): { [string]: any }
	local found = {}
	for _, folder in tiles.FOLDERS do
		for _, file in if fs.isDir(folder) then fs.readDir(folder) else {} do
			local name = string.match(file, "^(.+)%.model%.json$")
			if name then
				if found[name] then
					error(`There are two tiles called {name}: one coded, one hand-edited`, 0)
				end
				found[name] = serde.decode("json", fs.readFile(`{folder}/{file}`))
			end
		end
	end
	if next(found) == nil then
		error("No tiles: run `npm run tiles` to build them", 0)
	end
	return found
end

--- "Road/Forest" -> "Road", "Forest"; nil if it isn't a valid edge label.
function tiles.parseEdge(label: any): (string?, string?)
	if type(label) ~= "string" then
		return nil
	end
	local route, ground = string.match(label, "^(%a+)/(%a+)$")
	if route and tiles.ROUTES[route] and tiles.GROUND_JOINS[ground] then
		return route, ground
	end
	return nil
end

--- Whether two edges may touch: the same route, and grounds that can meet.
function tiles.edgesJoin(a: any, b: any): boolean
	local routeA, groundA = tiles.parseEdge(a)
	local routeB, groundB = tiles.parseEdge(b)
	if not routeA or not routeB then
		return false
	end
	return routeA == routeB and tiles.GROUND_JOINS[groundA][groundB] == true
end

--- A tile's edge labels after `turns` clockwise quarter turns.
function tiles.turnEdges(edges: { [string]: string }, turns: number): { [string]: string }
	local turned = {}
	for i, side in tiles.SIDES do
		turned[side] = edges[tiles.SIDES[(i - 1 - turns) % 4 + 1]]
	end
	return turned
end

local function round(value: number): number
	return math.round(value * 1000) / 1000
end

--- A JSON CFrame (x, y, z, then the rotation by rows) turned clockwise about the origin, then moved.
function tiles.moveCFrame(cf: { number }, turns: number, x: number, z: number): { number }
	local moved = table.clone(cf)
	for _ = 1, turns % 4 do
		-- Clockwise from above: (x, z) -> (-z, x), for the position and each axis.
		moved[1], moved[3] = -moved[3], moved[1]
		for axis = 0, 2 do
			moved[4 + axis], moved[10 + axis] = -moved[10 + axis], moved[4 + axis]
		end
	end
	moved[1] += x
	moved[3] += z
	for i, value in moved do
		moved[i] = round(value)
	end
	return moved
end

--- A copy of an instance with everything in it turned and moved.
function tiles.move(instance: any, turns: number, x: number, z: number): any
	local copy = table.clone(instance)
	if copy.properties and copy.properties.CFrame then
		copy.properties = table.clone(copy.properties)
		copy.properties.CFrame = tiles.moveCFrame(copy.properties.CFrame, turns, x, z)
	end
	if copy.children then
		local children = {}
		for i, child in copy.children do
			children[i] = tiles.move(child, turns, x, z)
		end
		copy.children = children
	end
	return copy
end

--- Calls `visit` on every instance inside the tile.
function tiles.each(instance: any, visit: (any) -> ())
	for _, child in instance.children or {} do
		visit(child)
		tiles.each(child, visit)
	end
end

local function has(list: { any }?, value: any): boolean
	return list ~= nil and table.find(list, value) ~= nil
end

--- How far a part reaches along world X and Z from its middle.
local function halfExtents(properties: any): (number, number)
	local cf, size = properties.CFrame, properties.Size
	local function along(row: number): number
		local total = 0
		for axis = 0, 2 do
			total += math.abs(cf[row + axis]) * size[axis + 1] / 2
		end
		return total
	end
	return along(4), along(10)
end

--- Everything wrong with a tile, as messages. `containerKinds` are the loot tables' names.
function tiles.check(name: string, tile: any, containerKinds: { [string]: any }): { string }
	local problems = {}
	local function problem(message: string)
		table.insert(problems, `{name}: {message}`)
	end

	if tile.className ~= "Model" then
		problem("should be a Model")
	end
	local edges = tile.attributes or {}
	local roadReaches = {}

	tiles.each(tile, function(instance)
		local label = `{instance.className} "{instance.name}"`
		local properties = instance.properties or {}
		if string.find(instance.className, "Script") then
			problem(`{label} is a script; tiles hold no code`)
		end
		if properties.Position then
			problem(`{label} uses Position; Rojo needs CFrame`)
		end
		if string.find(instance.className, "Part$") then
			if not properties.Anchored then
				problem(`{label} isn't anchored`)
			end
			if not properties.CFrame or not properties.Size then
				problem(`{label} needs a CFrame and a Size`)
				return
			end
			local halfX, halfZ = halfExtents(properties)
			local x, z = properties.CFrame[1], properties.CFrame[3]
			if math.abs(x) + halfX > EDGE + 0.01 or math.abs(z) + halfZ > EDGE + 0.01 then
				problem(`{label} at {x}, {z} sticks out of the tile`)
			end
			if instance.name == "Road" then
				for side, out in OUTWARD do
					local reach = out[1] * x + out[2] * z + math.abs(out[1]) * halfX + math.abs(out[2]) * halfZ
					local across = math.abs(out[2]) * x + math.abs(out[1]) * z
					if reach > EDGE - 0.01 and math.abs(across) < 0.01 then
						roadReaches[side] = true
					end
				end
			end
		end
		local attributes = instance.attributes or {}
		if has(properties.Tags, "LootContainer") and not containerKinds[attributes.Kind] then
			problem(`{label} has no loot Kind (it's {attributes.Kind})`)
		end
		if has(properties.Tags, "Trader") and not attributes.Base then
			problem(`{label} has no Base`)
		end
	end)

	for _, side in tiles.SIDES do
		local route = tiles.parseEdge(edges[side])
		if not route then
			problem(`{side} edge "{edges[side]}" isn't a Route/Ground label`)
		elseif (route == "Road") ~= (roadReaches[side] == true) then
			problem(`{side} edge is "{edges[side]}" but a road {if roadReaches[side] then "reaches" else "doesn't reach"} it`)
		end
	end
	return problems
end

return tiles
