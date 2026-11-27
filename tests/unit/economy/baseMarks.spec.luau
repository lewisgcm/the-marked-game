-- The Signal's marks on the adult bases (src/shared/economy/baseMarks.ts).
return function(t)
	local M = require("../../../out/shared/economy/baseMarks")
	local B = require("../../../out/shared/economy/bases")
	local L = require("../../../out/shared/world/layout")

	local WINDOWS = {
		{ first = 4, last = 6, opens = 3 }, -- Fire Station
		{ first = 6, last = 8, opens = 5 }, -- Hardware Store
		{ first = 10, last = 14, opens = 8 }, -- Church
	}

	t.describe("planMarks", function()
		t.it("falls inside its window, with two marks on different earlier nights", function()
			for _, w in WINDOWS do
				local seen = {}
				for seed = 1, 200 do
					local s = M.planMarks(w, w.opens, L.seededRandom(seed))
					t.expect(s[3] >= w.first and s[3] <= w.last).toBe(true)
					t.expect(s[1] >= 1).toBe(true)
					t.expect(s[1] < s[2]).toBe(true)
					t.expect(s[2] < s[3]).toBe(true)
					seen[s[3]] = true
				end
				-- Every night in the window comes up.
				for night = w.first, w.last do
					t.expect(seen[night]).toBe(true)
				end
			end
		end)
		t.it("its first mark comes no earlier than the night before it opens, if there's room", function()
			for seed = 1, 100 do
				local s = M.planMarks({ first = 6, last = 8 }, 5, L.seededRandom(seed))
				t.expect(s[1] >= 4).toBe(true)
			end
		end)
		t.it("an override sets the night it falls, but never before Night 3", function()
			t.expect(M.planMarks({ first = 4, last = 6 }, 3, L.seededRandom(1), 5)[3]).toBe(5)
			local early = M.planMarks({ first = 4, last = 6 }, 3, L.seededRandom(1), 1)
			t.expect(early[1]).toBe(1)
			t.expect(early[2]).toBe(2)
			t.expect(early[3]).toBe(3)
		end)
		t.it("every adult base has a fall window, and no kids' base does", function()
			for _, base in B.BASES do
				if base.kind == "Adults" then
					t.expect(base.falls ~= nil).toBe(true)
					t.expect(base.falls.first <= base.falls.last).toBe(true)
					t.expect(base.falls.first >= 3).toBe(true)
				else
					t.expect(base.falls).toBe(nil)
				end
			end
		end)
	end)

	t.describe("marksAfter and markTonight", function()
		local s = { 2, 4, 5 }
		t.it("counts the marks that have landed, and never goes down", function()
			local last = 0
			for night = 1, 8 do
				local n = M.marksAfter(s, night)
				t.expect(n >= last).toBe(true)
				last = n
			end
			t.expect(M.marksAfter(s, 1)).toBe(0)
			t.expect(M.marksAfter(s, 2)).toBe(1)
			t.expect(M.marksAfter(s, 3)).toBe(1)
			t.expect(M.marksAfter(s, 5)).toBe(3)
		end)
		t.it("says which broadcasts bring one", function()
			t.expect(M.markTonight(s, 2)).toBe(true)
			t.expect(M.markTonight(s, 3)).toBe(false)
			t.expect(M.markTonight(s, 5)).toBe(true)
		end)
	end)

	t.describe("markMeter", function()
		t.it("fills from the left", function()
			t.expect(M.markMeter(0)).toBe("○○○")
			t.expect(M.markMeter(2)).toBe("●●○")
			t.expect(M.markMeter(3)).toBe("●●●")
		end)
	end)

	t.describe("underAttackTonight", function()
		-- The chance with 0, 1 and 2 marks (a TS array: chances[marks] is Luau index marks + 1).
		local list = { 0.2, 0.4, 0.6 }
		t.it("never before Night 3", function()
			t.expect(M.underAttackTonight(2, 2, list, 0)).toBe(false)
			t.expect(M.underAttackTonight(3, 0, list, 0)).toBe(true)
		end)
		t.it("more likely with more marks", function()
			t.expect(M.underAttackTonight(4, 0, list, 0.3)).toBe(false)
			t.expect(M.underAttackTonight(4, 1, list, 0.3)).toBe(true)
			t.expect(M.underAttackTonight(4, 2, list, 0.5)).toBe(true)
		end)
		t.it("never once it's fallen", function()
			t.expect(M.underAttackTonight(6, 3, list, 0)).toBe(false)
		end)
	end)

	t.describe("splitWave", function()
		t.it("all at the house with no nests", function()
			local s = M.splitWave(8, 0, 0.3)
			t.expect(s.house).toBe(8)
			t.expect(s.perNest).toBe(0)
		end)
		t.it("each nest takes its share, and nobody's lost", function()
			local s = M.splitWave(10, 1, 0.3)
			t.expect(s.perNest).toBe(3)
			t.expect(s.house).toBe(7)
			local two = M.splitWave(10, 2, 0.3)
			t.expect(two.house + two.perNest * 2).toBe(10)
		end)
		t.it("the house always gets at least one", function()
			for count = 1, 12 do
				for nests = 0, 3 do
					local s = M.splitWave(count, nests, 0.9)
					t.expect(s.house >= 1).toBe(true)
					t.expect(s.house + s.perNest * nests).toBe(count)
				end
			end
		end)
	end)
end
