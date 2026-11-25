-- The flashlight stun (src/shared/infected/stun.ts).
return function(t)
	local stun = require("../../../out/shared/infected/stun")
	local settings = { litSeconds = 0.6, stunSeconds = 2, immuneSeconds = 5 }

	-- Shines (or not) for `seconds` in 0.2s steps starting at `from`; returns the time after.
	local function shine(state, from, seconds, lit)
		local now = from
		local started = false
		while now < from + seconds - 1e-9 do
			now += 0.2
			if stun.stepStun(state, lit, 0.2, now, settings) then
				started = true
			end
		end
		return now, started
	end

	t.describe("stepStun", function()
		t.it("needs the beam held for a moment", function()
			local s = stun.newStun()
			local now, started = shine(s, 0, 0.4, true)
			t.expect(started).toBe(false)
			t.expect(stun.isStunned(s, now)).toBe(false)
		end)
		t.it("stuns once held long enough, for the stun time", function()
			local s = stun.newStun()
			local now, started = shine(s, 0, 0.6, true)
			t.expect(started).toBe(true)
			t.expect(stun.isStunned(s, now + 1.9)).toBe(true)
			t.expect(stun.isStunned(s, now + 2.1)).toBe(false)
		end)
		t.it("looking away resets the count", function()
			local s = stun.newStun()
			local now = shine(s, 0, 0.4, true)
			now = shine(s, now, 0.2, false)
			local _, started = shine(s, now, 0.4, true)
			t.expect(started).toBe(false)
		end)
		t.it("can't be stunned again until the immunity wears off", function()
			local s = stun.newStun()
			local now = shine(s, 0, 0.6, true)
			-- Keep shining through the stun and most of the immunity: no new stun.
			local later, again = shine(s, now, 6.6, true)
			t.expect(again).toBe(false)
			-- After stun (2) + immunity (5), it works again.
			local _, finally = shine(s, later, 0.8, true)
			t.expect(finally).toBe(true)
		end)
	end)
end
