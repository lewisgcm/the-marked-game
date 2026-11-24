-- Night waves (src/shared/waves.ts).
return function(t)
	local waves = require("../../out/shared/waves")

	local function total(plan)
		local n = 0
		for _, wave in plan do
			n += wave.shamblers
		end
		return n
	end

	t.describe("planNight", function()
		t.it("Night 1 is two small waves, Dad in the first", function()
			local plan = waves.planNight(1, 1)
			t.expect(#plan).toBe(2)
			t.expect(plan[1].dad).toBe(true)
			t.expect(plan[2].dad).toBe(false)
			-- Solo: Dad plus 3 shamblers at most.
			t.expect(total(plan) <= 3).toBe(true)
		end)
		t.it("later nights have three waves, the last the biggest", function()
			local plan = waves.planNight(5, 2)
			t.expect(#plan).toBe(3)
			t.expect(plan[3].shamblers > plan[1].shamblers).toBe(true)
		end)
		t.it("waves arrive in order during the night", function()
			local plan = waves.planNight(3, 2)
			t.expect(plan[1].at < plan[2].at).toBe(true)
			t.expect(plan[2].at < plan[3].at).toBe(true)
			t.expect(plan[3].at < 1).toBe(true)
		end)
		t.it("gets bigger every night", function()
			t.expect(total(waves.planNight(6, 2)) > total(waves.planNight(3, 2))).toBe(true)
		end)
		t.it("scales with the party", function()
			t.expect(total(waves.planNight(4, 6)) > total(waves.planNight(4, 1))).toBe(true)
		end)
		t.it("every wave has at least one shambler", function()
			for night = 1, 10 do
				for _, wave in waves.planNight(night, 1) do
					t.expect(wave.shamblers >= 1).toBe(true)
				end
			end
		end)
	end)

	t.describe("waveSize", function()
		t.it("more come with the power off", function()
			t.expect(waves.waveSize(4, 2, true, 1.5)).toBe(4)
			t.expect(waves.waveSize(4, 2, false, 1.5)).toBe(6)
		end)
		t.it("never on Night 1", function()
			t.expect(waves.waveSize(4, 1, false, 1.5)).toBe(4)
		end)
	end)

	t.describe("powerCounts", function()
		t.it("once it's been on long enough", function()
			t.expect(waves.powerCounts(20, 20)).toBe(true)
			t.expect(waves.powerCounts(19.9, 20)).toBe(false)
			t.expect(waves.powerCounts(0, 20)).toBe(false)
		end)
		t.it("never when it's off", function()
			t.expect(waves.powerCounts(nil, 0)).toBe(false)
		end)
	end)

	t.describe("infectedHealth", function()
		t.it("base health on Night 1, +10% per night after", function()
			t.expect(waves.infectedHealth(1, 60, 0.1)).toBe(60)
			t.expect(waves.infectedHealth(3, 60, 0.1)).toBe(72)
		end)
	end)

	t.describe("partyFactor", function()
		t.it("is clamped to 1-6 kids", function()
			t.expect(waves.partyFactor(0)).toBe(waves.partyFactor(1))
			t.expect(waves.partyFactor(10)).toBe(waves.partyFactor(6))
		end)
	end)
end
