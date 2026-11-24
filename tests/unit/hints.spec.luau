-- Night 1 tips (src/shared/hints.ts).
return function(t)
	local hints = require("../../out/shared/hints")
	local function hint(overrides)
		local s = { firstNight = true, phase = "Day", planks = 0, anyBoarded = false, powered = false }
		for k, v in overrides do
			s[k] = v
		end
		return hints.chooseHint(s)
	end

	t.describe("chooseHint", function()
		t.it("no tips after Night 1", function()
			t.expect(hint({ firstNight = false })).toBe(nil)
			t.expect(hint({ firstNight = false, phase = "Night", attacked = "Back door" })).toBe(nil)
		end)
		t.it("walks through planks, boarding, the generator, then the street", function()
			t.expect(hint({})).toBe(hints.GRAB_PLANKS)
			t.expect(hint({ planks = 3 })).toBe(hints.BOARD_UP)
			t.expect(hint({ anyBoarded = true })).toBe(hints.START_GENERATOR)
			t.expect(hint({ anyBoarded = true, powered = true })).toBe(hints.EXPLORE)
		end)
		t.it("at dusk, once ready, sends you inside", function()
			t.expect(hint({ phase = "Dusk", anyBoarded = true, powered = true })).toBe(hints.GET_INSIDE)
		end)
		t.it("at night says where they're attacking, else how to fight", function()
			t.expect(hint({ phase = "Night", attacked = "Kitchen back window" })).toBe("They're at the kitchen back window!")
			t.expect(hint({ phase = "Night" })).toBe(hints.FIGHT)
		end)
		t.it("nothing at dawn", function()
			t.expect(hint({ phase = "Dawn" })).toBe(nil)
		end)
	end)
end
