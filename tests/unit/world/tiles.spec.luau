-- The rules for joining map tiles (src/shared/world/tiles.ts), and the checks every tile must pass
-- (tools/tiles/tiles.luau, MAP.md). Needs the tiles built: `npm test` does that first.
return function(t)
	local edges = require("../../../out/shared/world/tiles")
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

	t.describe("what the game needs from the tiles", function()
		local all = tiles.loadAll()
		local function tagged(tile, tag)
			local n = 0
			tiles.each(tile, function(instance)
				local tags = instance.properties and instance.properties.Tags
				if tags and table.find(tags, tag) then
					n += 1
				end
			end)
			return n
		end
		-- The night's spawns' Order attributes, in Home and the woods behind it.
		local function spawnOrders()
			local orders = {}
			for _, name in { "Home", "Woods_BehindHome" } do
				tiles.each(all[name], function(instance)
					local tags = instance.properties and instance.properties.Tags
					if tags and table.find(tags, "InfectedSpawn") then
						table.insert(orders, tonumber(instance.attributes and instance.attributes.Order))
					end
				end)
			end
			table.sort(orders)
			return orders
		end
		t.it("Home has one Dad spot and the house's plot", function()
			t.expect(tagged(all.Home, "DadSpot")).toBe(1)
			t.expect(tagged(all.Home, "HomePlot")).toBe(1)
		end)
		t.it("the night's spawns are numbered 1, 2, 3... and the first (Dad's) is Home's", function()
			local orders = spawnOrders()
			t.expect(#orders >= 2).toBe(true)
			for i, order in orders do
				t.expect(order).toBe(i)
			end
			t.expect(tagged(all.Home, "InfectedSpawn")).toBe(1)
		end)
		t.it("no other tile has a Dad spot, spawns or a plot", function()
			for name, tile in all do
				local spawnsAllowed = name == "Home" or name == "Woods_BehindHome"
				local count = tagged(tile, "DadSpot") + tagged(tile, "HomePlot")
				if name ~= "Home" then
					t.expect(count + (if spawnsAllowed then 0 else tagged(tile, "InfectedSpawn"))).toBe(0)
				end
			end
		end)
		t.it("each base's tile has its trading counter", function()
			t.expect(tagged(all.Treehouse, "Trader")).toBe(1)
			t.expect(tagged(all.FireStation, "Trader")).toBe(1)
		end)
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

	t.describe("parseEdge", function()
		t.it("reads a route and a ground", function()
			local edge = edges.parseEdge("Road/Forest")
			t.expect(edge.route).toBe("Road")
			t.expect(edge.ground).toBe("Forest")
		end)
		t.it("refuses anything else", function()
			for _, label in { "Motorway/Grass", "Road/Lava", "Road", "Road/Grass/Town", "", 5 } do
				t.expect(edges.parseEdge(label)).toBe(nil)
			end
		end)
	end)

	t.describe("edgesJoin", function()
		t.it("needs the same route", function()
			t.expect(edges.edgesJoin("Road/Grass", "Road/Grass")).toBe(true)
			t.expect(edges.edgesJoin("Road/Grass", "None/Grass")).toBe(false)
		end)
		t.it("needs grounds that can meet", function()
			t.expect(edges.edgesJoin("Road/Town", "Road/Grass")).toBe(true)
			t.expect(edges.edgesJoin("Road/Town", "Road/Forest")).toBe(false)
		end)
		t.it("refuses a label that isn't one", function()
			t.expect(edges.edgesJoin("Road/Grass", "Road/Lava")).toBe(false)
		end)
		t.it("works the same both ways round", function()
			for a in edges.GROUND_JOINS do
				for b in edges.GROUND_JOINS do
					t.expect(edges.edgesJoin("None/" .. a, "None/" .. b)).toBe(edges.edgesJoin("None/" .. b, "None/" .. a))
				end
			end
		end)
	end)

	t.describe("turning", function()
		local labels = { North = "n", East = "e", South = "s", West = "w" }
		t.it("one turn moves the north edge to the east", function()
			local turned = edges.turnEdges(labels, 1)
			t.expect(turned.East).toBe("n")
			t.expect(turned.North).toBe("w")
			t.expect(turned.South).toBe("e")
		end)
		t.it("four turns change nothing, and three undo one", function()
			for side, label in edges.turnEdges(labels, 4) do
				t.expect(label).toBe(labels[side])
			end
			for side, label in edges.turnEdges(edges.turnEdges(labels, 1), 3) do
				t.expect(label).toBe(labels[side])
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
