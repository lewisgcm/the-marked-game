-- Cutting walls around doors and windows (src/shared/walls.ts).
return function(t)
	local walls = require("../../out/shared/walls")

	local function door(center)
		return { center = center, width = 4, bottom = 0, top = 8 }
	end
	local function window(center)
		return { center = center, width = 4, bottom = 1, top = 7 }
	end
	local function area(pieces)
		local total = 0
		for _, p in pieces do
			total += (p["to"] - p.from) * (p.top - p.bottom)
		end
		return total
	end

	t.describe("wallPieces", function()
		t.it("a wall with no openings is one piece", function()
			local pieces = walls.wallPieces(0, 20, 12, {})
			t.expect(#pieces).toBe(1)
			t.expect(pieces[1].from).toBe(0)
			t.expect(pieces[1]["to"]).toBe(20)
		end)
		t.it("a door leaves a left piece, a lintel and a right piece", function()
			local pieces = walls.wallPieces(0, 20, 12, { door(10) })
			t.expect(#pieces).toBe(3)
			-- 20x12 wall minus a 4x8 door.
			t.expect(area(pieces)).toBe(240 - 32)
		end)
		t.it("a window also leaves a sill", function()
			local pieces = walls.wallPieces(0, 20, 12, { window(10) })
			t.expect(#pieces).toBe(4)
			t.expect(area(pieces)).toBe(240 - 24)
		end)
		t.it("openings can come in any order", function()
			local a = walls.wallPieces(0, 30, 12, { door(25), window(5) })
			local b = walls.wallPieces(0, 30, 12, { window(5), door(25) })
			t.expect(#a).toBe(#b)
			t.expect(area(a)).toBe(area(b))
			t.expect(area(a)).toBe(360 - 32 - 24)
		end)
		t.it("an opening flush with the end leaves no empty piece", function()
			local pieces = walls.wallPieces(0, 20, 12, { door(18) })
			-- Left piece and lintel only: nothing to the right of the door.
			t.expect(#pieces).toBe(2)
			t.expect(area(pieces)).toBe(240 - 32)
		end)
	end)
end
