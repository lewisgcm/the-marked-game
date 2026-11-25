-- Planning a run's map from tiles (src/shared/world/layout.ts, the map in mapRules.ts).
return function(t)
	local layout = require("../../../out/shared/world/layout")
	local MAP_RULES = require("../../../out/shared/world/mapRules").MAP_RULES
	local tiles = require("../../../tools/tiles/tiles")
	local RULES = tiles.RULES

	local function edges(n, e, s, w)
		return { North = n, East = e, South = s, West = w }
	end
	-- Small made-up tiles, so each test controls exactly what fits.
	local CATALOGUE = {
		Home = edges("Road/Grass", "Road/Grass", "None/Grass", "Road/Grass"),
		Cross = edges("Road/Grass", "Road/Grass", "Road/Grass", "Road/Grass"),
		Bend = edges("Road/Grass", "None/Grass", "None/Grass", "Road/Grass"),
		Field = edges("None/Grass", "None/Grass", "None/Grass", "None/Grass"),
		Town = edges("None/Town", "None/Town", "None/Town", "None/Town"),
		Woods = edges("None/Forest", "None/Forest", "None/Forest", "None/Forest"),
		Shop = edges("None/Grass", "None/Grass", "Road/Grass", "None/Grass"),
		Hut = edges("None/Grass", "None/Grass", "None/Grass", "None/Grass"),
	}
	local function rulesFor(places, fillers)
		return {
			columns = 3,
			rows = 2,
			fixed = { { tile = "Home", column = 1, row = 0, turns = 0 } },
			places = places,
			fillers = fillers,
			start = "Home",
		}
	end
	local function count(list)
		local n = 0
		for _ in list do
			n += 1
		end
		return n
	end
	local function describeLayout(planned)
		local parts = {}
		for _, p in planned.tiles do
			table.insert(parts, `{p.tile}{p.turns}@{p.column},{p.row}`)
		end
		return table.concat(parts, " ")
	end

	t.describe("planLayout", function()
		local rules = rulesFor(
			{ { tile = "Shop", nearest = 1, furthest = 1 } },
			{ { tile = "Cross", most = 2 }, { tile = "Bend", most = 4 }, { tile = "Field", most = 4 } }
		)
		t.it("fills every cell, and the result passes the checks", function()
			for seed = 1, 200 do
				local planned = layout.planLayout(rules, CATALOGUE, RULES, layout.seededRandom(seed))
				t.expect(planned ~= nil).toBe(true)
				t.expect(#planned.tiles).toBe(6)
				t.expect(table.concat(layout.checkLayout(planned, rules, CATALOGUE, RULES), "; ")).toBe("")
			end
		end)
		t.it("gives the same map for the same seed", function()
			local a = layout.planLayout(rules, CATALOGUE, RULES, layout.seededRandom(42))
			local b = layout.planLayout(rules, CATALOGUE, RULES, layout.seededRandom(42))
			t.expect(describeLayout(a)).toBe(describeLayout(b))
		end)
		t.it("gives different maps for different seeds", function()
			local seen = {}
			for seed = 1, 50 do
				seen[describeLayout(layout.planLayout(rules, CATALOGUE, RULES, layout.seededRandom(seed)))] = true
			end
			t.expect(count(seen) > 10).toBe(true)
		end)
		t.it("lists the roads that run off the map", function()
			local planned = layout.planLayout(rules, CATALOGUE, RULES, layout.seededRandom(7))
			for _, open in planned.openEnds do
				t.expect(RULES.hasRoute(open.edge)).toBe(true)
			end
		end)
		t.it("gives up when nothing fits", function()
			-- Woods can't meet Home's roads, and nothing else is allowed.
			local stuck = rulesFor({}, { { tile = "Woods", most = 5 } })
			t.expect(layout.planLayout(stuck, CATALOGUE, RULES, layout.seededRandom(1))).toBe(nil)
		end)
		t.it("gives up when a place has no room", function()
			local noRoom = rulesFor({ { tile = "Shop", nearest = 5, furthest = 6 } }, { { tile = "Field", most = 5 } })
			t.expect(layout.planLayout(noRoom, CATALOGUE, RULES, layout.seededRandom(1))).toBe(nil)
		end)
		t.it("only accepts maps where every place can be reached by road", function()
			-- Fields everywhere would fit, but leave the shop's road going nowhere.
			local cut = rulesFor({ { tile = "Shop", nearest = 1, furthest = 1 } }, { { tile = "Field", most = 5 } })
			t.expect(layout.planLayout(cut, CATALOGUE, RULES, layout.seededRandom(1))).toBe(nil)
		end)
	end)

	t.describe("checkLayout", function()
		local function at(tile, column, row, turns)
			return { tile = tile, column = column, row = row, turns = turns or 0 }
		end
		local function problems(list, rules)
			return layout.checkLayout({ tiles = list, openEnds = {} }, rules, CATALOGUE, RULES)
		end
		-- Whether one of `found` mentions `text`.
		local function mentions(found, text)
			for _, problem in found do
				if string.find(problem, text, 1, true) then
					return true
				end
			end
			return false
		end
		-- Home's road north runs into the shop; the side roads bend north and run off the map.
		local fine = {
			at("Cross", 0, 0),
			at("Home", 1, 0),
			at("Cross", 2, 0),
			at("Bend", 0, 1, 3),
			at("Shop", 1, 1),
			at("Bend", 2, 1, 2),
		}
		local loose = rulesFor({ { tile = "Shop", nearest = 1, furthest = 1 } }, {
			{ tile = "Cross", most = 2 },
			{ tile = "Bend", most = 2 },
		})
		t.it("passes a good map", function()
			t.expect(table.concat(problems(fine, loose), "; ")).toBe("")
		end)
		t.it("wants every cell filled", function()
			local missing = table.clone(fine)
			table.remove(missing)
			t.expect(#problems(missing, loose)).toBe(1)
		end)
		t.it("wants the fixed tiles where they're fixed, and turned the same way", function()
			local turned = table.clone(fine)
			turned[2] = at("Home", 1, 0, 2)
			t.expect(mentions(problems(turned, loose), "isn't where it's fixed")).toBe(true)
		end)
		t.it("wants each place once", function()
			local noShop = table.clone(fine)
			noShop[5] = at("Field", 1, 1)
			t.expect(mentions(problems(noShop, loose), "Shop is there 0 times")).toBe(true)
		end)
		t.it("wants places in their rows", function()
			local nearer = rulesFor({ { tile = "Shop", nearest = 0, furthest = 0 } }, loose.fillers)
			t.expect(table.concat(problems(fine, nearer), "; ")).toBe("Shop is in row 1, not 0-0")
		end)
		t.it("wants every place reachable by road from the start", function()
			-- Everything joins, but the shop's road only reaches a bend that runs off the map.
			local hut = rulesFor({ { tile = "Shop", nearest = 1, furthest = 1 } }, {
				{ tile = "Field", most = 4 },
				{ tile = "Bend", most = 1 },
			})
			hut.fixed = { at("Hut", 1, 0) }
			hut.start = "Hut"
			local island = {
				at("Field", 0, 0),
				at("Hut", 1, 0),
				at("Field", 2, 0),
				at("Shop", 0, 1, 3),
				at("Bend", 1, 1),
				at("Field", 2, 1),
			}
			t.expect(table.concat(problems(island, hut), "; ")).toBe("Shop can't be reached by road from Hut")
		end)
		t.it("wants neighbours to join", function()
			local clash = table.clone(fine)
			clash[1] = at("Field", 0, 0)
			t.expect(mentions(problems(clash, loose), "doesn't join its neighbours")).toBe(true)
		end)
		t.it("holds fillers to their limit", function()
			local strict = rulesFor({ { tile = "Shop", nearest = 1, furthest = 1 } }, {
				{ tile = "Cross", most = 1 },
				{ tile = "Bend", most = 2 },
			})
			t.expect(table.concat(problems(fine, strict), "; ")).toBe("Cross is used 2 times (at most 1)")
		end)
	end)

	t.describe("the run's map", function()
		local catalogue = tiles.catalogue(tiles.loadAll())
		t.it("plans a good map for every seed tried", function()
			for seed = 1, 500 do
				local planned = layout.planLayout(MAP_RULES, catalogue, RULES, layout.seededRandom(seed))
				t.expect(planned ~= nil).toBe(true)
				t.expect(table.concat(layout.checkLayout(planned, MAP_RULES, catalogue, RULES), "; ")).toBe("")
			end
		end)
		t.it("only uses tiles that exist", function()
			for _, list in { MAP_RULES.fixed, MAP_RULES.places, MAP_RULES.fillers } do
				for _, entry in list do
					t.expect(catalogue[entry.tile] ~= nil).toBe(true)
				end
			end
		end)
	end)

	t.describe("the fallback map", function()
		local rules = require("../../../out/shared/world/mapRules")
		t.it("is a good map", function()
			local catalogue = tiles.catalogue(tiles.loadAll())
			local fallback = layout.completeLayout(rules.FALLBACK_TILES, MAP_RULES, catalogue, RULES)
			t.expect(table.concat(layout.checkLayout(fallback, MAP_RULES, catalogue, RULES), "; ")).toBe("")
		end)
	end)

	t.describe("tilePlacement", function()
		local roblox = require("@lune/roblox")
		local anchor = { column = 1, row = 0 }
		local origin = { x = 0, z = -61 }
		local function at(column, row, turns)
			return layout.tilePlacement({ tile = "X", column = column, row = row, turns = turns }, anchor, origin)
		end
		t.it("puts the anchor's tile at the origin", function()
			local p = at(1, 0, 0)
			t.expect(p.x).toBe(0)
			t.expect(p.z).toBe(-61)
		end)
		t.it("puts columns east and rows north, a tile apart", function()
			t.expect(at(2, 0, 0).x).toBe(200)
			t.expect(at(0, 0, 0).x).toBe(-200)
			t.expect(at(1, 1, 0).z).toBe(-261)
		end)
		t.it("turns a tile the way its edges turn: one turn takes its north edge east", function()
			-- The middle of the north edge, turned as the game turns the tile.
			local turned = roblox.CFrame.Angles(0, at(1, 0, 1).yaw, 0) * roblox.Vector3.new(0, 0, -100)
			t.expect(turned.X).toBeCloseTo(100, 1e-3)
			t.expect(turned.Z).toBeCloseTo(0, 1e-3)
			local labels = require("../../../out/shared/world/tiles").turnEdges(edges("n", "e", "s", "w"), 1)
			t.expect(labels.East).toBe("n")
		end)
		t.it("agrees with how the gallery turns tiles", function()
			for turns = 0, 3 do
				local game = roblox.CFrame.Angles(0, at(1, 0, turns).yaw, 0) * roblox.Vector3.new(30, 0, -70)
				local moved = tiles.moveCFrame({ 30, 0, -70, 1, 0, 0, 0, 1, 0, 0, 0, 1 }, turns, 0, 0)
				t.expect(game.X).toBeCloseTo(moved[1], 1e-3)
				t.expect(game.Z).toBeCloseTo(moved[3], 1e-3)
			end
		end)
	end)

	t.describe("borderPlacements", function()
		local border = { behindAnchor = "Behind", elsewhere = "Plain" }
		local placed = layout.borderPlacements(MAP_RULES, border, { column = 1, row = 0 }, { x = 0, z = -61 })
		t.it("puts one behind each column of row 0, the special one behind home", function()
			t.expect(#placed).toBe(MAP_RULES.columns)
			for i, p in placed do
				t.expect(p.tile).toBe(if i - 1 == 1 then "Behind" else "Plain")
				t.expect(p.x).toBe((i - 2) * 200)
			end
		end)
		t.it("puts them just south of row 0, touching it", function()
			-- Home's tile reaches z -61 + 100 = 39; a border tile is 100 deep, so its middle is at 89.
			t.expect(placed[1].z).toBe(89)
		end)
		t.it("uses the real border tiles", function()
			local rules = require("../../../out/shared/world/mapRules")
			local catalogue = tiles.catalogue(tiles.loadAll())
			t.expect(catalogue[rules.SOUTH_BORDER.behindAnchor] ~= nil).toBe(true)
			t.expect(catalogue[rules.SOUTH_BORDER.elsewhere] ~= nil).toBe(true)
		end)
	end)

	t.describe("seededRandom", function()
		t.it("stays between 0 and 1, and repeats for a seed", function()
			local a, b = layout.seededRandom(9), layout.seededRandom(9)
			for _ = 1, 1000 do
				local value = a()
				t.expect(value >= 0 and value < 1).toBe(true)
				t.expect(b()).toBe(value)
			end
		end)
		t.it("starts somewhere different for neighbouring seeds", function()
			local low = 0
			for seed = 1, 100 do
				if layout.seededRandom(seed)() < 0.5 then
					low += 1
				end
			end
			t.expect(low).toBeBetween(30, 70)
		end)
	end)
end
