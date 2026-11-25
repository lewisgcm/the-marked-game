-- Who may stay in a main-game server (src/main/server/run/admission.ts).
return function(t)
	local decide = require("../../../out/main/server/run/admission").decideAdmission
	local party = { 111, 222 }

	t.describe("decideAdmission", function()
		t.it("allows everyone in Studio", function()
			t.expect(decide({ studio = true, roundServer = false, partyKnown = false }, 999)).toBe("allow")
		end)
		t.it("sends everyone in a public main-game server to the lobby", function()
			t.expect(decide({ studio = false, roundServer = false, partyKnown = true, partyUserIds = party }, 111)).toBe("lobby")
		end)
		t.it("waits while the party list is unknown", function()
			t.expect(decide({ studio = false, roundServer = true, partyKnown = false }, 111)).toBe("wait")
		end)
		t.it("allows a party member", function()
			t.expect(decide({ studio = false, roundServer = true, partyKnown = true, partyUserIds = party }, 222)).toBe("allow")
		end)
		t.it("sends someone who followed a friend (not in the party) to the lobby", function()
			t.expect(decide({ studio = false, roundServer = true, partyKnown = true, partyUserIds = party }, 999)).toBe("lobby")
		end)
		t.it("allows everyone if the party list couldn't be loaded", function()
			t.expect(decide({ studio = false, roundServer = true, partyKnown = true }, 999)).toBe("allow")
		end)
	end)
end
