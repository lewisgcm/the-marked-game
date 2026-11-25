-- What wakes a dormant infected (src/shared/infected/wake.ts).
return function(t)
	local W = require("../../../out/shared/infected/wake")
	local settings = { sightRange = 14, halfAngle = 60, touchRange = 4 }
	local function wakes(overrides)
		local s = { distance = 10, facing = 1, canSee = true, lit = false }
		for k, v in overrides do
			s[k] = v
		end
		return W.shouldWake(s, settings)
	end

	t.describe("shouldWake", function()
		t.it("a kid in front, in range", function()
			t.expect(wakes({})).toBe(true)
			t.expect(wakes({ distance = 15 })).toBe(false)
		end)
		t.it("you can slip past behind it", function()
			t.expect(wakes({ facing = -1 })).toBe(false)
			t.expect(wakes({ facing = math.cos(math.rad(65)) })).toBe(false)
			t.expect(wakes({ facing = math.cos(math.rad(55)) })).toBe(true)
		end)
		t.it("but not touching it", function()
			t.expect(wakes({ facing = -1, distance = 3 })).toBe(true)
		end)
		t.it("not through walls", function()
			t.expect(wakes({ canSee = false })).toBe(false)
			t.expect(wakes({ canSee = false, distance = 2 })).toBe(false)
		end)
		t.it("a torch beam always does", function()
			t.expect(wakes({ lit = true, facing = -1, distance = 50, canSee = false })).toBe(true)
		end)
	end)
end
