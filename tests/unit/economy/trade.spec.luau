-- Trading with the bases (src/shared/economy/bases.ts, pricing.ts, trade.ts).
return function(t)
	local B = require("../../../out/shared/economy/bases")
	local P = require("../../../out/shared/economy/pricing")
	local T = require("../../../out/shared/economy/trade")
	local I = require("../../../out/shared/items/inventory")

	local function find(rows, item)
		for _, row in rows do
			if row.item == item then
				return row
			end
		end
		return nil
	end
	local function view(id, day, order, open)
		local stall = { stock = { Nails = 0, Stones = 2, Planks = 2 }, order = order }
		return P.tradeView(B.findBase(id), day, open ~= false, stall, 0.15, 2)
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
		t.it("nobody buys what's sold, or what's free at home", function()
			local never = { Stones = true, Planks = true }
			for _, base in B.BASES do
				for _, offer in base.sells do
					never[offer.item] = true
				end
			end
			for _, base in B.BASES do
				for _, want in base.buys do
					t.expect(never[want.item]).toBe(nil)
				end
			end
		end)
		t.it("there's something different for every base to want", function()
			local items, count = {}, 0
			for _, base in B.BASES do
				for _, want in base.buys do
					if not items[want.item] then
						items[want.item] = true
						count += 1
					end
				end
			end
			t.expect(count >= #B.BASES).toBe(true)
		end)
	end)

	t.describe("tradeView", function()
		t.it("shows today's prices and stock", function()
			local v = view("Treehouse", 3, { item = "Food", left = 2 })
			t.expect(v.base).toBe("Treehouse")
			t.expect(find(v.sells, "Nails").price).toBe(8)
			t.expect(find(v.sells, "Nails").stock).toBe(0)
			t.expect(find(v.sells, "Nails").count).toBe(10)
			t.expect(find(v.sells, "Stones").price).toBe(4)
			t.expect(find(v.sells, "Stones").stock).toBe(2)
		end)
		t.it("nothing in stock before the first morning", function()
			local v = P.tradeView(B.findBase("FireStation"), 1, true, { stock = {} }, 0.15, 2)
			t.expect(find(v.sells, "Fuel").stock).toBe(0)
			t.expect(find(v.buys, "Food").wanted).toBe(0)
		end)
		t.it("shows how many are on order, for that item only", function()
			local v = view("Treehouse", 1, { item = "Food", left = 2 })
			t.expect(find(v.buys, "Food").wanted).toBe(2)
			t.expect(find(v.buys, "Food").orderPrice).toBe(4)
			t.expect(find(v.buys, "Food").price).toBe(2)
			t.expect(find(v.buys, "Batteries").wanted).toBe(0)
		end)
		t.it("says whether it's open", function()
			t.expect(view("Treehouse", 1).open).toBe(true)
			t.expect(view("Treehouse", 1, nil, false).open).toBe(false)
		end)
	end)

	-- A kid with these coins and items, and room for `room` more of anything.
	local function kid(coins, items, room)
		local w = { purse = coins, items = items or {} }
		w.coins = function()
			return w.purse
		end
		w.spend = function(n)
			if w.purse < n then
				return false
			end
			w.purse -= n
			return true
		end
		w.earn = function(n)
			w.purse += n
		end
		w.room = function()
			return room or 99
		end
		w.count = function(item)
			return w.items[item] or 0
		end
		w.give = function(item, n)
			w.items[item] = w.count(item) + n
		end
		w.take = function(item, n)
			if w.count(item) < n then
				return false
			end
			w.items[item] -= n
			return true
		end
		return w
	end

	t.describe("buyLot", function()
		local function row(stock)
			return { item = "Nails", count = 10, price = 6, stock = stock }
		end
		t.it("takes the coins, gives the lot and lowers the stock", function()
			local w, stall = kid(20), { stock = { Nails = 3 } }
			t.expect(T.buyLot(row(3), stall, w)).toBe("ok")
			t.expect(w.purse).toBe(14)
			t.expect(w.items.Nails).toBe(10)
			t.expect(stall.stock.Nails).toBe(2)
		end)
		t.it("changes nothing when refused", function()
			for status, case in
				{
					tooExpensive = { kid(5), row(3) },
					noRoom = { kid(20, {}, 9), row(3) },
					soldOut = { kid(20), row(0) },
				}
			do
				local w, stall = case[1], { stock = { Nails = case[2].stock } }
				local before = w.purse
				t.expect(T.buyLot(case[2], stall, w)).toBe(status)
				t.expect(w.purse).toBe(before)
				t.expect(w.items.Nails).toBe(nil)
				t.expect(stall.stock.Nails).toBe(case[2].stock)
			end
		end)
		t.it("gives nothing if the payment doesn't go through", function()
			local w, stall = kid(20), { stock = { Nails = 3 } }
			w.spend = function()
				return false
			end
			t.expect(T.buyLot(row(3), stall, w)).toBe("tooExpensive")
			t.expect(w.items.Nails).toBe(nil)
			t.expect(stall.stock.Nails).toBe(3)
		end)
	end)

	t.describe("sellItems", function()
		local function row(wanted)
			return { item = "Food", price = 2, wanted = wanted, orderPrice = 4 }
		end
		t.it("fills the order in one go, at the order's price", function()
			local w, stall = kid(0, { Food = 5 }), { stock = {}, order = { item = "Food", left = 3 } }
			t.expect(T.sellItems(row(3), stall, w)).toBe(3)
			t.expect(w.purse).toBe(12)
			t.expect(w.items.Food).toBe(2)
			t.expect(stall.order.left).toBe(0)
		end)
		t.it("part-fills it with what you have", function()
			local w, stall = kid(0, { Food = 1 }), { stock = {}, order = { item = "Food", left = 3 } }
			t.expect(T.sellItems(row(3), stall, w)).toBe(1)
			t.expect(w.purse).toBe(4)
			t.expect(stall.order.left).toBe(2)
		end)
		t.it("otherwise one at a time, at the usual price, leaving the order alone", function()
			local w, stall = kid(0, { Food = 5 }), { stock = {}, order = { item = "Scrap", left = 3 } }
			t.expect(T.sellItems(row(0), stall, w)).toBe(1)
			t.expect(w.purse).toBe(2)
			t.expect(w.items.Food).toBe(4)
			t.expect(stall.order.left).toBe(3)
		end)
		t.it("nothing to sell, nothing paid", function()
			local w, stall = kid(0), { stock = {}, order = { item = "Food", left = 3 } }
			t.expect(T.sellItems(row(3), stall, w)).toBe(0)
			t.expect(w.purse).toBe(0)
			t.expect(stall.order.left).toBe(3)
		end)
		t.it("nothing paid if the items can't be taken", function()
			local w, stall = kid(0, { Food = 2 }), { stock = {}, order = { item = "Food", left = 3 } }
			w.take = function()
				return false
			end
			t.expect(T.sellItems(row(3), stall, w)).toBe(0)
			t.expect(w.purse).toBe(0)
			t.expect(stall.order.left).toBe(3)
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
