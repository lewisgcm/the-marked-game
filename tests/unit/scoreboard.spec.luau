-- End-of-run scoreboard: titles, order and stat lines (src/shared/scoreboard.ts).
return function(t)
	local scoreboard = require("../../out/shared/scoreboard")

	local function kid(id, stats, takenAt)
		return { userId = id, name = "K" .. id, stats = stats or {}, takenAt = takenAt }
	end
	local function byId(cards, id)
		for _, card in cards do
			if card.userId == id then
				return card
			end
		end
		return nil
	end

	t.describe("titles", function()
		t.it("most kills gets Slugger", function()
			local cards = scoreboard.buildScoreboard({ kid(1, { kills = 1 }), kid(2, { kills = 4 }) })
			t.expect(byId(cards, 2).title).toBe("Slugger")
		end)
		t.it("Slugger needs at least one kill", function()
			local cards = scoreboard.buildScoreboard({ kid(1, { hits = 5 }) })
			t.expect(byId(cards, 1).title).toBe("Survivor")
		end)
		t.it("First Taken is the earliest taken", function()
			local cards = scoreboard.buildScoreboard({ kid(1, {}, 200), kid(2, {}, 90), kid(3) })
			t.expect(byId(cards, 2).title).toBe("First Taken")
			t.expect(byId(cards, 1).title).toBe("Taken")
			t.expect(byId(cards, 3).title).toBe("Survivor")
		end)
		t.it("each title goes to one kid only", function()
			-- 1 is the Slugger and was taken first; First Taken falls to 2.
			local cards = scoreboard.buildScoreboard({ kid(1, { kills = 3 }, 10), kid(2, {}, 50) })
			t.expect(byId(cards, 1).title).toBe("Slugger")
			t.expect(byId(cards, 2).title).toBe("First Taken")
		end)
	end)

	t.describe("cards", function()
		t.it("best first", function()
			local cards = scoreboard.buildScoreboard({ kid(1), kid(2, { kills = 2 }), kid(3, { hits = 1 }) })
			t.expect(cards[1].userId).toBe(2)
			t.expect(cards[2].userId).toBe(3)
			t.expect(cards[3].userId).toBe(1)
		end)
		t.it("the last line is their fate", function()
			local taken = byId(scoreboard.buildScoreboard({ kid(1, { kills = 2 }, 125) }), 1)
			t.expect(taken.lines[1]).toBe("2 infected downed")
			t.expect(taken.lines[#taken.lines]).toBe("Taken at 2:05")
			t.expect(taken.taken).toBe(true)
			local made = byId(scoreboard.buildScoreboard({ kid(1) }), 1)
			t.expect(made.lines[#made.lines]).toBe("Made it")
		end)
		t.it("formats times as m:ss", function()
			t.expect(scoreboard.formatTime(65)).toBe("1:05")
			t.expect(scoreboard.formatTime(600)).toBe("10:00")
		end)
	end)
end
