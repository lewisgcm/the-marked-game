-- Trading with the bases (src/shared/bases.ts, pricing.ts, trade.ts).
return function(t)
	local B = require("../../out/shared/bases")
	local P = require("../../out/shared/pricing")
	local T = require("../../out/shared/trade")
	local I = require("../../out/shared/inventory")

	local function find(rows, item)
		for _, row in rows do
			if row.item == item then
				return row
			end
		end
		return nil
	end
	local function view(id, day, wanted)
		return P.tradeView(B.findBase(id), day, wanted, function(item)
			return if item == "Nails" then 0 else 2
		end, 0.15, 2)
	end

	t.describe("the bases", function()
		t.it("have unique IDs and real numbers", function()
			local seen = {}
			for _, base in B.BASES do
				t.expect(seen[base.id]).toBe(nil)
				seen[base.id] = true
				t.expect(base.opens >= 1).toBe(true)
				t.expect(#base.sells > 0 and #base.buys > 1).toBe(true)
				local sold = {}
				for _, offer in base.sells do
					t.expect(sold[offer.item]).toBe(nil)
					sold[offer.item] = true
					t.expect(offer.price > 0 and offer.count > 0 and offer.stock > 0).toBe(true)
				end
				for _, want in base.buys do
					t.expect(want.price > 0).toBe(true)
				end
			end
		end)
		t.it("a lot always fits in an empty starting inventory", function()
			for _, base in B.BASES do
				for _, offer in base.sells do
					t.expect(I.roomFor(I.emptyInventory(5), offer.item) >= offer.count).toBe(true)
				end
			end
		end)
		t.it("nobody buys what's sold, or what comes back every dawn", function()
			local endless = { Stones = true, Planks = true }
			for _, base in B.BASES do
				for _, offer in base.sells do
					endless[offer.item] = true
				end
			end
			for _, base in B.BASES do
				for _, want in base.buys do
					t.expect(endless[want.item]).toBe(nil)
				end
			end
		end)
	end)

	t.describe("tradeView", function()
		t.it("shows today's prices and stock", function()
			local v = view("Treehouse", 3, "Food")
			t.expect(v.base).toBe("Treehouse")
			t.expect(find(v.sells, "Nails").price).toBe(8)
			t.expect(find(v.sells, "Nails").stock).toBe(0)
			t.expect(find(v.sells, "Nails").count).toBe(10)
			t.expect(find(v.sells, "Stones").price).toBe(4)
			t.expect(find(v.sells, "Stones").stock).toBe(2)
		end)
		t.it("pays more for the want, and only the want", function()
			local v = view("Treehouse", 1, "Food")
			t.expect(find(v.buys, "Food").price).toBe(4)
			t.expect(find(v.buys, "Food").wanted).toBe(true)
			t.expect(find(v.buys, "Batteries").price).toBe(2)
			t.expect(find(v.buys, "Batteries").wanted).toBe(false)
		end)
	end)

	t.describe("saleStatus", function()
		local function status(overrides, coins, room)
			local row = { item = "Nails", count = 10, price = 6, stock = 1 }
			for k, v in overrides do
				row[k] = v
			end
			return T.saleStatus(row, coins, room)
		end
		t.it("exactly enough coins and room is enough", function()
			t.expect(status({}, 6, 10)).toBe("ok")
			t.expect(status({}, 5, 10)).toBe("tooExpensive")
			t.expect(status({}, 6, 9)).toBe("noRoom")
		end)
		t.it("sold out comes first", function()
			t.expect(status({ stock = 0 }, 0, 0)).toBe("soldOut")
		end)
	end)

	t.describe("isTrading", function()
		local station = { opens = 3 }
		t.it("from its first day", function()
			t.expect(T.isTrading(station, 2, false, false)).toBe(false)
			t.expect(T.isTrading(station, 3, false, false)).toBe(true)
		end)
		t.it("never at night", function()
			t.expect(T.isTrading(station, 5, true, false)).toBe(false)
			t.expect(T.isTrading(station, 5, true, true)).toBe(false)
		end)
		t.it("early when every base is opened for testing", function()
			t.expect(T.isTrading(station, 1, false, true)).toBe(true)
		end)
	end)

	t.describe("parseTradeRequest", function()
		local function parse(payload)
			return T.parseTradeRequest(payload, B.BASES)
		end
		t.it("accepts a real base and item", function()
			local r = parse({ base = "FireStation", item = "Fuel", price = 0 })
			t.expect(r.base).toBe("FireStation")
			t.expect(r.item).toBe("Fuel")
			t.expect(r.price).toBe(nil)
			t.expect(parse({ base = "FireStation", item = "Scrap" }).item).toBe("Scrap")
		end)
		t.it("rejects anything else", function()
			t.expect(parse(nil)).toBe(nil)
			t.expect(parse("Fuel")).toBe(nil)
			t.expect(parse({})).toBe(nil)
			t.expect(parse({ base = "Bank", item = "Fuel" })).toBe(nil)
			t.expect(parse({ base = "FireStation" })).toBe(nil)
			t.expect(parse({ base = "FireStation", item = "Coins" })).toBe(nil)
			t.expect(parse({ base = "FireStation", item = 1 })).toBe(nil)
			t.expect(parse({ base = "FireStation", item = "Nails" })).toBe(nil)
			t.expect(parse({ base = { "FireStation" }, item = "Fuel" })).toBe(nil)
		end)
	end)
end
