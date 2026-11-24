-- Loot tables and scarcity (src/shared/loot.ts).
return function(t)
	local L = require("../../out/shared/loot")

	-- Hands out the given numbers in order.
	local function sequence(...)
		local values, i = { ... }, 0
		return function()
			i += 1
			return values[i]
		end
	end
	local function near(a, b)
		return math.abs(a - b) < 1e-9
	end

	t.describe("ammoScale", function()
		t.it("100% on Night 1, 40% on Night 10, 25% from Night 20", function()
			t.expect(near(L.ammoScale(1), 1)).toBe(true)
			t.expect(near(L.ammoScale(10), 0.4)).toBe(true)
			t.expect(near(L.ammoScale(20), 0.25)).toBe(true)
			t.expect(near(L.ammoScale(50), 0.25)).toBe(true)
		end)
		t.it("never goes up", function()
			for night = 1, 30 do
				t.expect(L.ammoScale(night + 1) <= L.ammoScale(night)).toBe(true)
			end
		end)
	end)

	t.describe("rollLoot", function()
		t.it("one find, at the low end of its range", function()
			-- one roll, first entry (food), lowest count
			local finds = L.rollLoot("Kitchen", 1, sequence(0.9, 0, 0))
			t.expect(#finds).toBe(1)
			t.expect(finds[1].item).toBe("Food")
			t.expect(finds[1].count).toBe(1)
		end)
		t.it("the top of the range is reachable and never passed", function()
			local finds = L.rollLoot("Kitchen", 1, sequence(0.9, 0, 0.999))
			t.expect(finds[1].count).toBe(2)
			t.expect(L.rollLoot("Kitchen", 1, sequence(0.9, 0, 1))[1].count).toBe(2)
		end)
		t.it("two of the same merge", function()
			local finds = L.rollLoot("Kitchen", 1, sequence(0.1, 0, 0, 0, 0))
			t.expect(#finds).toBe(1)
			t.expect(finds[1].count).toBe(2)
		end)
		t.it("ammo can be missing on later nights, not on Night 1", function()
			-- Garage's first entry is nails; the last number is the scarcity roll.
			t.expect(#L.rollLoot("Garage", 1, sequence(0.9, 0, 0, 0.9))).toBe(1)
			t.expect(#L.rollLoot("Garage", 10, sequence(0.9, 0, 0, 0.9))).toBe(0)
			t.expect(#L.rollLoot("Garage", 10, sequence(0.9, 0, 0, 0.3))).toBe(1)
		end)
		t.it("weights: the last entry comes at the top of the roll", function()
			t.expect(L.rollLoot("Kitchen", 1, sequence(0.9, 0.99, 0))[1].item).toBe("Medkit")
		end)
	end)

	t.describe("fuel", function()
		local function chance(kind)
			local total, fuel = 0, 0
			for _, entry in L.LOOT_TABLES[kind] do
				total += entry.weight
				if entry.item == "Fuel" then
					fuel += entry.weight
				end
			end
			return fuel / total
		end
		t.it("turns up in garages and cars, not indoors, and isn't common", function()
			for _, kind in { "Garage", "Car" } do
				t.expect(chance(kind) > 0.1 and chance(kind) < 0.25).toBe(true)
			end
			t.expect(chance("Kitchen")).toBe(0)
			t.expect(chance("Drawers")).toBe(0)
		end)
		t.it("is one can at a time, and doesn't get scarcer", function()
			local finds = L.rollLoot("Garage", 20, sequence(0.9, 0.99, 0.99))
			t.expect(finds[1].item).toBe("Fuel")
			t.expect(finds[1].count).toBe(1)
		end)
	end)

	t.describe("pickSome", function()
		t.it("picks without repeats, and leaves the list alone", function()
			local list = { "a", "b", "c" }
			local picked = L.pickSome(list, 2, sequence(0, 0))
			t.expect(#picked).toBe(2)
			t.expect(picked[1]).toBe("a")
			t.expect(picked[2]).toBe("b")
			t.expect(#list).toBe(3)
		end)
		t.it("never more than there are", function()
			t.expect(#L.pickSome({ "a", "b" }, 5, sequence(1, 1))).toBe(2)
			t.expect(#L.pickSome({}, 3, sequence())).toBe(0)
		end)
	end)

	t.describe("rollRestock", function()
		t.it("takes turns through the items", function()
			local finds = L.rollRestock({ "Food", "Scrap" }, 3, 2, sequence(0, 0, 0))
			t.expect(#finds).toBe(3)
			t.expect(finds[1].item).toBe("Food")
			t.expect(finds[2].item).toBe("Scrap")
			t.expect(finds[3].item).toBe("Food")
		end)
		t.it("one to the most of each", function()
			local finds = L.rollRestock({ "Food" }, 3, 2, sequence(0, 0.5, 1))
			t.expect(finds[1].count).toBe(1)
			t.expect(finds[2].count).toBe(2)
			t.expect(finds[3].count).toBe(2)
			t.expect(L.rollRestock({ "Food" }, 1, 0, sequence(0))[1].count).toBe(1)
		end)
		t.it("nothing on order, nothing restocked", function()
			t.expect(#L.rollRestock({}, 3, 2, sequence())).toBe(0)
		end)
	end)
end
