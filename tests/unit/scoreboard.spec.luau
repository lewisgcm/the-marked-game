-- End-of-round scoreboard: titles, order and stat lines (src/shared/scoreboard.ts).
return function(t)
	local scoreboard = require("../../out/shared/scoreboard")

	local function hunter(id, stats, diedAt)
		return { userId = id, name = "H" .. id, role = "Hunter", stats = stats or {}, diedAt = diedAt }
	end
	local function ghost(stats)
		return { userId = 99, name = "G", role = "Ghost", stats = stats or {} }
	end
	local function build(players, ghostWon, huntSeconds)
		return scoreboard.buildScoreboard(players, { ghostWon = ghostWon, huntSeconds = huntSeconds or 300 })
	end
	local function byId(cards, id)
		for _, card in cards do
			if card.userId == id then
				return card
			end
		end
		return nil
	end

	t.describe("hunter titles", function()
		t.it("the banisher gets The Banisher", function()
			local cards = build({ ghost(), hunter(1, { banisher = 1, lightSeconds = 50 }), hunter(2) }, false)
			t.expect(byId(cards, 1).title).toBe("The Banisher")
		end)
		t.it("each title goes to one hunter only; the rest fall to the next title", function()
			-- Both lit the ghost a lot; 1 is the banisher, so Spotlight goes to 2.
			local cards = build({ hunter(1, { banisher = 1, lightSeconds = 50 }), hunter(2, { lightSeconds = 10 }) }, false)
			t.expect(byId(cards, 1).title).toBe("The Banisher")
			t.expect(byId(cards, 2).title).toBe("Spotlight")
		end)
		t.it("First to Fall is the earliest death", function()
			local cards = build({ hunter(1, {}, 200), hunter(2, {}, 90), hunter(3) }, true)
			t.expect(byId(cards, 2).title).toBe("First to Fall")
			t.expect(byId(cards, 1).title).toBe("Haunted")
			t.expect(byId(cards, 3).title).toBe("Survivor")
		end)
		t.it("Spotlight needs at least 3 seconds", function()
			local cards = build({ hunter(1, { lightSeconds = 2 }) }, true)
			t.expect(byId(cards, 1).title).toBe("Survivor")
		end)
		t.it("most chests gets Locksmith", function()
			local cards = build({ hunter(1, { chests = 1 }), hunter(2, { chests = 3 }) }, true)
			t.expect(byId(cards, 2).title).toBe("Locksmith")
		end)
	end)

	t.describe("ghost titles", function()
		t.it("killing every hunter is The Reaper", function()
			local cards = build({ ghost({ kills = 2, damageTaken = 40 }), hunter(1, {}, 10), hunter(2, {}, 20) }, true)
			t.expect(byId(cards, 99).title).toBe("The Reaper")
		end)
		t.it("never hit in a real round is Untouchable", function()
			local cards = build({ ghost({}), hunter(1) }, true, 300)
			t.expect(byId(cards, 99).title).toBe("Untouchable")
		end)
		t.it("not Untouchable in a round that barely started", function()
			local cards = build({ ghost({}), hunter(1) }, false, 20)
			t.expect(byId(cards, 99).title).toBe("Lost Soul")
		end)
		t.it("3+ scream hits is Banshee", function()
			local cards = build({ ghost({ screamHits = 4, damageTaken = 20 }), hunter(1) }, false)
			t.expect(byId(cards, 99).title).toBe("Banshee")
		end)
		t.it("defaults: Phantom on a win, Lost Soul on a loss", function()
			t.expect(byId(build({ ghost({ damageTaken = 20 }), hunter(1) }, true), 99).title).toBe("Phantom")
			t.expect(byId(build({ ghost({ damageTaken = 20 }), hunter(1) }, false), 99).title).toBe("Lost Soul")
		end)
	end)

	t.describe("cards", function()
		t.it("the ghost comes first, then hunters best first", function()
			local cards = build({ hunter(1), hunter(2, { items = 3, chests = 2 }), ghost() }, false)
			t.expect(cards[1].userId).toBe(99)
			t.expect(cards[2].userId).toBe(2)
			t.expect(cards[3].userId).toBe(1)
		end)
		t.it("a hunter's last line is their fate", function()
			local cards = build({ hunter(1, { keys = 2, chests = 1 }, 125) }, true)
			local lines = byId(cards, 1).lines
			t.expect(lines[1]).toBe("2 keys, 1 chest")
			t.expect(lines[#lines]).toBe("Died at 2:05")
		end)
		t.it("formats times as m:ss", function()
			t.expect(scoreboard.formatTime(65)).toBe("1:05")
			t.expect(scoreboard.formatTime(600)).toBe("10:00")
		end)
	end)
end
