-- Making things at the workbench (src/shared/economy/recipes.ts).
return function(t)
	local R = require("../../../out/shared/economy/recipes")
	local B = require("../../../out/shared/economy/bases")
	local I = require("../../../out/shared/items/inventory")
	local U = require("../../../out/shared/economy/upgrades")

	local function wallet(coins, items, room)
		local w = { items = items, money = coins }
		w.coins = function()
			return w.money
		end
		w.spend = function(n)
			if n <= 0 or w.money < n then
				return false
			end
			w.money -= n
			return true
		end
		w.earn = function(n)
			w.money += n
		end
		w.room = function()
			return room or 99
		end
		w.count = function(item)
			return w.items[item] or 0
		end
		w.give = function(item, n)
			w.items[item] = (w.items[item] or 0) + n
		end
		w.take = function(item, n)
			if (w.items[item] or 0) < n then
				return false
			end
			w.items[item] -= n
			return true
		end
		return w
	end
	local SHUTTER = { id = "Shutter", name = "S", coins = 30, scrap = 5, makes = "Shutter", count = 1 }
	local PRESS =
		{ id = "PressNails", name = "P", coins = 0, scrap = 2, makes = "Nails", count = 3, needs = "ScrapPress" }

	t.describe("recipeStatus", function()
		local function status(recipe, owned, coins, scrap, room)
			return R.recipeStatus(recipe, owned, { coins = coins, scrap = scrap, room = room })
		end
		t.it("exactly enough of everything is enough", function()
			t.expect(status(SHUTTER, {}, 30, 5, 1)).toBe("ok")
		end)
		t.it("says what's missing", function()
			t.expect(status(SHUTTER, {}, 30, 4, 1)).toBe("needsScrap")
			t.expect(status(SHUTTER, {}, 29, 5, 1)).toBe("tooExpensive")
			t.expect(status(SHUTTER, {}, 30, 5, 0)).toBe("noRoom")
			t.expect(status(PRESS, { "ScrapPress" }, 0, 2, 2)).toBe("noRoom")
		end)
		t.it("needs the upgrade it needs", function()
			t.expect(status(PRESS, { "DoorBar" }, 0, 2, 3)).toBe("unknown")
			t.expect(status(PRESS, { "ScrapPress" }, 0, 2, 3)).toBe("ok")
		end)
	end)

	t.describe("craft", function()
		t.it("takes the coins and scrap and gives the thing", function()
			local w = wallet(40, { Scrap = 7 })
			t.expect(R.craft(SHUTTER, {}, w)).toBe("ok")
			t.expect(w.money).toBe(10)
			t.expect(w.items.Scrap).toBe(2)
			t.expect(w.items.Shutter).toBe(1)
		end)
		t.it("works with no coins when it costs none", function()
			local w = wallet(0, { Scrap = 2 })
			t.expect(R.craft(PRESS, { "ScrapPress" }, w)).toBe("ok")
			t.expect(w.items.Scrap).toBe(0)
			t.expect(w.items.Nails).toBe(3)
		end)
		t.it("takes nothing when it can't be made", function()
			local function unchanged(recipe, owned, coins, scrap, room)
				local w = wallet(coins, { Scrap = scrap }, room)
				t.expect(R.craft(recipe, owned, w) ~= "ok").toBe(true)
				t.expect(w.money).toBe(coins)
				t.expect(w.items.Scrap).toBe(scrap)
				t.expect(w.items[recipe.makes]).toBe(nil)
			end
			unchanged(SHUTTER, {}, 29, 5)
			unchanged(SHUTTER, {}, 30, 4)
			unchanged(SHUTTER, {}, 30, 5, 0)
			unchanged(PRESS, {}, 50, 5)
		end)
		t.it("gives the scrap back if the coins can't be taken", function()
			local w = wallet(30, { Scrap = 5 })
			w.spend = function()
				return false
			end
			t.expect(R.craft(SHUTTER, {}, w)).toBe("tooExpensive")
			t.expect(w.items.Scrap).toBe(5)
			t.expect(w.items.Shutter).toBe(nil)
		end)
	end)

	t.describe("the list", function()
		t.it("has unique IDs, real amounts, and upgrades that exist", function()
			local seen = {}
			for _, recipe in R.RECIPES do
				t.expect(seen[recipe.id]).toBe(nil)
				seen[recipe.id] = true
				t.expect(recipe.scrap > 0 and recipe.count > 0 and recipe.coins >= 0).toBe(true)
				t.expect(recipe.needs == nil or U.findUpgrade(recipe.needs) ~= nil).toBe(true)
				t.expect(I.roomFor(I.emptyInventory(5), recipe.makes) >= recipe.count).toBe(true)
			end
		end)
		t.it("no base buys what's made", function()
			for _, recipe in R.RECIPES do
				for _, base in B.BASES do
					for _, want in base.buys do
						t.expect(want.item == recipe.makes).toBe(false)
					end
				end
			end
		end)
		t.it("pressing never beats selling the scrap and buying", function()
			local scrapPrice = 0
			for _, base in B.BASES do
				for _, want in base.buys do
					if want.item == "Scrap" then
						scrapPrice = math.max(scrapPrice, want.price)
					end
				end
			end
			t.expect(scrapPrice > 0).toBe(true)
			local checked = 0
			for _, recipe in R.RECIPES do
				for _, base in B.BASES do
					for _, offer in base.sells do
						if offer.item == recipe.makes then
							checked += 1
							local each = (recipe.coins + recipe.scrap * scrapPrice) / recipe.count
							t.expect(each >= offer.price / offer.count).toBe(true)
						end
					end
				end
			end
			t.expect(checked).toBe(2)
		end)
	end)

	t.describe("isKnown", function()
		t.it("hides what needs an upgrade the party hasn't got", function()
			t.expect(R.isKnown(SHUTTER, {})).toBe(true)
			t.expect(R.isKnown(PRESS, {})).toBe(false)
			t.expect(R.isKnown(PRESS, { "ScrapPress" })).toBe(true)
		end)
	end)

	t.describe("parseRecipe", function()
		t.it("accepts only real IDs", function()
			t.expect(R.parseRecipe("Shutter").makes).toBe("Shutter")
			t.expect(R.parseRecipe("PressNails").makes).toBe("Nails")
			t.expect(R.parseRecipe("Nails")).toBe(nil)
			t.expect(R.parseRecipe("shutter")).toBe(nil)
			t.expect(R.parseRecipe(nil)).toBe(nil)
			t.expect(R.parseRecipe(1)).toBe(nil)
			t.expect(R.parseRecipe({})).toBe(nil)
		end)
	end)
end
