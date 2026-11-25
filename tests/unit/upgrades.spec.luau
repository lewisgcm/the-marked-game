-- The workbench's upgrades (src/shared/upgrades.ts).
return function(t)
	local U = require("../../out/shared/upgrades")

	t.describe("upgradeStatus", function()
		t.it("exactly enough coins is enough", function()
			t.expect(U.upgradeStatus("ReinforcedPlanks", 20, {})).toBe("ok")
			t.expect(U.upgradeStatus("ReinforcedPlanks", 19, {})).toBe("tooExpensive")
		end)
		t.it("can't be bought twice", function()
			t.expect(U.upgradeStatus("DoorBar", 999, { "DoorBar" })).toBe("owned")
		end)
		t.it("the hiking rucksack needs the school one", function()
			t.expect(U.upgradeStatus("HikingRucksack", 999, { "DoorBar" })).toBe("needsOther")
			t.expect(U.upgradeStatus("HikingRucksack", 60, { "SchoolRucksack" })).toBe("ok")
		end)
	end)

	t.describe("the list", function()
		t.it("has unique IDs, real costs, and needs that exist", function()
			local seen = {}
			for _, upgrade in U.UPGRADES do
				t.expect(seen[upgrade.id]).toBe(nil)
				seen[upgrade.id] = true
				t.expect(upgrade.cost > 0).toBe(true)
			end
			for _, upgrade in U.UPGRADES do
				if upgrade.needs then
					t.expect(seen[upgrade.needs]).toBe(true)
				end
			end
		end)
		t.it("only rucksacks are personal", function()
			t.expect(U.findUpgrade("SchoolRucksack").personal).toBe(true)
			t.expect(U.findUpgrade("HikingRucksack").personal).toBe(true)
			t.expect(U.findUpgrade("ReinforcedPlanks").personal).toBe(false)
			t.expect(U.findUpgrade("DoorBar").personal).toBe(false)
			t.expect(U.findUpgrade("TuneUp").personal).toBe(false)
			t.expect(U.findUpgrade("ScrapPress").personal).toBe(false)
		end)
	end)

	t.describe("parseUpgrade", function()
		t.it("accepts only real IDs", function()
			t.expect(U.parseUpgrade("DoorBar")).toBe("DoorBar")
			t.expect(U.parseUpgrade("doorbar")).toBe(nil)
			t.expect(U.parseUpgrade(1)).toBe(nil)
			t.expect(U.parseUpgrade(nil)).toBe(nil)
			t.expect(U.parseUpgrade({})).toBe(nil)
		end)
	end)
end
