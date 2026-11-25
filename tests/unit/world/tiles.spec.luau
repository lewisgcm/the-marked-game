-- The map's tiles (assets/tiles) and the rules for joining them (tools/tiles/tiles.luau, MAP.md).
return function(t)
	local tiles = require("../../../tools/tiles/tiles")
	local kinds = require("../../../out/shared/items/loot").LOOT_TABLES

	local function part(name, size, x, z, extra)
		local instance = {
			name = name,
			className = "Part",
			properties = { Anchored = true, Size = size, CFrame = { x, 0, z, 1, 0, 0, 0, 1, 0, 0, 0, 1 } },
		}
		for key, value in extra or {} do
			instance.properties[key] = value
		end
		return instance
	end
	local function tileWith(children, edges)
		edges = edges or {}
		return {
			className = "Model",
			attributes = {
				North = edges.North or "None/Grass",
				East = edges.East or "None/Grass",
				South = edges.South or "None/Grass",
				West = edges.West or "None/Grass",
			},
			children = children,
		}
	end
	local function problems(tile)
		return #tiles.check("Test", tile, kinds)
	end

	t.describe("the tiles", function()
		for name, tile in tiles.loadAll() do
			t.it(name .. " is sound", function()
				t.expect(table.concat(tiles.check(name, tile, kinds), "\n")).toBe("")
			end)
		end
	end)

	t.describe("check", function()
		t.it("passes a good tile", function()
			local ground = part("Ground", { 200, 2, 200 }, 0, 0)
			local road = part("Road", { 22, 1, 100 }, 0, -50)
			t.expect(problems(tileWith({ ground, road }, { North = "Road/Grass" }))).toBe(0)
		end)
		t.it("wants a valid label on every edge", function()
			t.expect(problems(tileWith({}, { East = "Motorway/Grass" }))).toBe(1)
			t.expect(problems(tileWith({}, { East = "None/Lava" }))).toBe(1)
		end)
		t.it("wants a road at a Road edge, and none elsewhere", function()
			t.expect(problems(tileWith({}, { North = "Road/Grass" }))).toBe(1)
			t.expect(problems(tileWith({ part("Road", { 22, 1, 100 }, 0, -50) }))).toBe(1)
		end)
		t.it("wants the road in the middle of the edge", function()
			local road = part("Road", { 22, 1, 100 }, 30, -50)
			t.expect(problems(tileWith({ road }, { North = "Road/Grass" }))).toBe(1)
		end)
		t.it("catches parts sticking out, unanchored or placed by Position", function()
			t.expect(problems(tileWith({ part("Tree", { 4, 4, 4 }, 99, 0) }))).toBe(1)
			t.expect(problems(tileWith({ part("Tree", { 4, 4, 4 }, 0, 0, { Anchored = false }) }))).toBe(1)
			t.expect(problems(tileWith({ part("Tree", { 4, 4, 4 }, 0, 0, { Position = { 0, 0, 0 } }) }))).toBe(1)
		end)
		t.it("looks inside folders, and refuses scripts", function()
			local script = { name = "Sneaky", className = "Script" }
			t.expect(problems(tileWith({ { name = "Props", className = "Folder", children = { script } } }))).toBe(1)
		end)
		t.it("wants a real Kind on loot and a Base on traders", function()
			local box = part("Box", { 2, 2, 2 }, 0, 0, { Tags = { "LootContainer" } })
			t.expect(problems(tileWith({ box }))).toBe(1)
			box.attributes = { Kind = "Garage" }
			t.expect(problems(tileWith({ box }))).toBe(0)
			t.expect(problems(tileWith({ part("Counter", { 8, 3, 1 }, 0, 0, { Tags = { "Trader" } }) }))).toBe(1)
		end)
	end)

	t.describe("edgesJoin", function()
		t.it("needs the same route", function()
			t.expect(tiles.edgesJoin("Road/Grass", "Road/Grass")).toBe(true)
			t.expect(tiles.edgesJoin("Road/Grass", "None/Grass")).toBe(false)
		end)
		t.it("needs grounds that can meet", function()
			t.expect(tiles.edgesJoin("Road/Town", "Road/Grass")).toBe(true)
			t.expect(tiles.edgesJoin("Road/Town", "Road/Forest")).toBe(false)
		end)
		t.it("works the same both ways round", function()
			for a, joins in tiles.GROUND_JOINS do
				for b in tiles.GROUND_JOINS do
					t.expect(joins[b] == true).toBe(tiles.GROUND_JOINS[b][a] == true)
				end
			end
		end)
	end)

	t.describe("turning", function()
		local edges = { North = "n", East = "e", South = "s", West = "w" }
		t.it("one turn moves the north edge to the east", function()
			local turned = tiles.turnEdges(edges, 1)
			t.expect(turned.East).toBe("n")
			t.expect(turned.North).toBe("w")
		end)
		t.it("four turns change nothing", function()
			for side, label in tiles.turnEdges(edges, 4) do
				t.expect(label).toBe(edges[side])
			end
		end)
		t.it("parts turn the same way as the edges, and face round too", function()
			-- At the north edge, facing north (-Z): the CFrame's third column is -look.
			local cf = tiles.moveCFrame({ 0, 5, -90, 1, 0, 0, 0, 1, 0, 0, 0, 1 }, 1, 0, 0)
			t.expect(cf[1]).toBe(90)
			t.expect(cf[2]).toBe(5)
			t.expect(cf[3]).toBe(0)
			t.expect(-cf[6]).toBe(1) -- now facing east (+X)
			t.expect(-cf[12]).toBe(0)
		end)
		t.it("moves after turning", function()
			local cf = tiles.moveCFrame({ 0, 0, -90, 1, 0, 0, 0, 1, 0, 0, 0, 1 }, 2, 200, 400)
			t.expect(cf[1]).toBe(200)
			t.expect(cf[3]).toBe(490)
		end)
	end)
end
