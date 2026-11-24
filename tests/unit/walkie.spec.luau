-- The walkie-talkie (src/shared/walkie.ts).
return function(t)
	local W = require("../../out/shared/walkie")

	local function report(overrides)
		local r = {
			name = "Treehouse",
			trader = "Gang",
			where = "the left end",
			opens = 2,
			hello = "Hi!",
			inContact = true,
			openNow = true,
			wanted = "Food",
			wantedPrice = 4,
		}
		for k, v in overrides do
			r[k] = if v == "none" then nil else v
		end
		return r
	end
	local function message(id, at)
		return { from = "Mum", text = "Hello", id = id, day = 1, at = at or 0 }
	end

	t.describe("morningReport", function()
		t.it("Mum first on Day 1, and nothing from bases out of contact", function()
			local lines = W.morningReport(1, { report({ inContact = false }) })
			t.expect(#lines).toBe(1)
			t.expect(lines[1].from).toBe("Mum")
		end)
		t.it("a base says hello the day it opens, then what it wants", function()
			local lines = W.morningReport(2, { report({}) })
			t.expect(#lines).toBe(3)
			t.expect(lines[1].from).toBe("Mum")
			t.expect(lines[2].from).toBe("Gang")
			t.expect(lines[2].text).toBe("Hi!")
			t.expect(lines[3].text).toBe("We need food today. 4 coins each.")
		end)
		t.it("after that, only what it wants", function()
			local lines = W.morningReport(9, { report({ wantedPrice = 1 }) })
			t.expect(#lines).toBe(1)
			t.expect(lines[1].text).toBe("We need food today. 1 coin each.")
		end)
		t.it("every base in contact reports", function()
			t.expect(#W.morningReport(9, { report({}), report({ name = "Station" }) })).toBe(2)
		end)
		t.it("quiet when there's nothing to say", function()
			t.expect(#W.morningReport(9, { report({ wanted = "none" }) })).toBe(0)
		end)
	end)

	t.describe("baseStatus", function()
		t.it("not in contact: says when", function()
			local s = W.baseStatus(report({ inContact = false, openNow = false }))
			t.expect(s.status).toBe("No contact yet")
			t.expect(s.detail).toBe("Trades from Day 2")
			t.expect(s.open).toBe(false)
		end)
		t.it("trading: where, and what it wants", function()
			local s = W.baseStatus(report({}))
			t.expect(s.name).toBe("Treehouse")
			t.expect(s.status).toBe("Trading")
			t.expect(s.detail).toBe("At the left end. Wants food (4 coins each)")
			t.expect(s.open).toBe(true)
		end)
		t.it("closed at night", function()
			local s = W.baseStatus(report({ openNow = false, wanted = "none" }))
			t.expect(s.status).toBe("Closed until morning")
			t.expect(s.detail).toBe("At the left end")
			t.expect(s.open).toBe(false)
		end)
	end)

	t.describe("trimLog", function()
		t.it("keeps the newest, in order", function()
			local kept = W.trimLog({ message(1), message(2), message(3) }, 2)
			t.expect(#kept).toBe(2)
			t.expect(kept[1].id).toBe(2)
			t.expect(kept[2].id).toBe(3)
		end)
		t.it("leaves a short log alone", function()
			t.expect(#W.trimLog({ message(1) }, 2)).toBe(1)
		end)
	end)

	t.describe("freshMessages", function()
		t.it("only ones not shown yet, oldest first", function()
			local fresh = W.freshMessages({ message(1), message(2), message(3) }, 1, 0, 30)
			t.expect(#fresh).toBe(2)
			t.expect(fresh[1].id).toBe(2)
		end)
		t.it("old news doesn't pop up", function()
			local fresh = W.freshMessages({ message(1, 69), message(2, 70) }, 0, 100, 30)
			t.expect(#fresh).toBe(1)
			t.expect(fresh[1].id).toBe(2)
		end)
	end)

	t.describe("unreadCount", function()
		t.it("counts messages after the last one read", function()
			local log = { message(4), message(5), message(6) }
			t.expect(W.unreadCount(log, 0)).toBe(3)
			t.expect(W.unreadCount(log, 5)).toBe(1)
			t.expect(W.unreadCount(log, 6)).toBe(0)
		end)
	end)
end
