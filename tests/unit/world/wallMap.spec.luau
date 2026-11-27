-- The wall map (src/shared/world/wallMap.ts).
return function(t)
	local W = require("../../../out/shared/world/wallMap")

	local function tile(name, x, z, north, east, south, west)
		local function side(label)
			if label == nil then
				return nil
			end
			local route, ground = string.match(label, "(%a+)/(%a+)")
			return { route = route, ground = ground }
		end
		return {
			name = name,
			x = x,
			z = z,
			sides = { North = side(north), East = side(east), South = side(south), West = side(west) },
		}
	end

	-- Three across, two deep: home's row at z = -61, the row behind it at z = -261.
	local tiles = {
		tile("Treehouse", -200, -61, "None/Forest", "Road/Town", "None/Forest", "None/Forest"),
		tile("Home", 0, -61, "Road/Town", "Road/Town", "None/Grass", "Road/Town"),
		tile("FireStation", 200, -61, "None/Town", "None/Town", "None/Town", "Road/Town"),
		tile("Meadow_A", 0, -261, "None/Grass", "None/Grass", "Road/Grass", "None/Grass"),
	}

	t.describe("mapBounds and toMap", function()
		local bounds = W.mapBounds(tiles, 200)
		t.it("covers every tile, edge to edge", function()
			t.expect(bounds.west).toBe(-300)
			t.expect(bounds.east).toBe(300)
			t.expect(bounds.north).toBe(-361)
			t.expect(bounds.south).toBe(39)
		end)
		t.it("north is at the top and west on the left", function()
			local nw = W.toMap(bounds, -300, -361)
			t.expect(nw.u).toBe(0)
			t.expect(nw.v).toBe(0)
			local home = W.toMap(bounds, 0, -61)
			t.expect(home.u).toBe(0.5)
			t.expect(home.v).toBe(0.75)
		end)
		t.it("keeps anything off the map on its edge", function()
			local off = W.toMap(bounds, 900, 500)
			t.expect(off.u).toBe(1)
			t.expect(off.v).toBe(1)
		end)
	end)

	t.describe("tileGround", function()
		t.it("is what most of its sides are", function()
			t.expect(W.tileGround(tiles[1])).toBe("Forest")
			t.expect(W.tileGround(tiles[4])).toBe("Grass")
		end)
		t.it("Town wins a tie", function()
			t.expect(W.tileGround(tile("X", 0, 0, "None/Grass", "None/Grass", "Road/Town", "Road/Town"))).toBe("Town")
		end)
	end)

	t.describe("routesOut", function()
		t.it("lists the sides with a road or path, in order", function()
			local out = W.routesOut(tiles[2])
			t.expect(#out).toBe(3)
			t.expect(out[1].side).toBe("North")
			t.expect(out[2].side).toBe("East")
			t.expect(out[3].side).toBe("West")
			t.expect(#W.routesOut(tiles[3])).toBe(1)
		end)
	end)
end
