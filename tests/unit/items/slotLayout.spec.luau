-- Fitting the inventory on the screen (src/shared/items/slotLayout.ts).
return function(t)
	local L = require("../../../out/shared/items/slotLayout")
	local CELL, HEADER, ROWS = 53, 34, 6

	local function grid(slots, width, height, topBar, touch)
		local space = L.inventorySpace(width, height, topBar, touch)
		return L.slotGrid(slots, space - HEADER, CELL, ROWS), space
	end

	t.describe("inventorySpace", function()
		t.it("stays above the jump button, which is bigger on tablets", function()
			t.expect(L.inventorySpace(844, 390, 58, true)).toBe(232)
			t.expect(L.inventorySpace(1024, 768, 58, true)).toBe(490)
		end)
		t.it("the shorter side decides, whichever way it's held", function()
			t.expect(L.inventorySpace(390, 844, 58, true)).toBe(686)
			t.expect(L.inventorySpace(900, 500, 0, true)).toBe(400)
			t.expect(L.inventorySpace(900, 501, 0, true)).toBe(281)
		end)
		t.it("a mouse has no jump button to avoid", function()
			t.expect(L.inventorySpace(1280, 758, 58, false)).toBe(560)
		end)
	end)

	t.describe("slotGrid", function()
		t.it("one column when it fits", function()
			local g = L.slotGrid(5, 5 * CELL, CELL, ROWS)
			t.expect(g.rows).toBe(5)
			t.expect(g.columns).toBe(1)
		end)
		t.it("another column when it only just doesn't", function()
			local g = L.slotGrid(5, 5 * CELL - 1, CELL, ROWS)
			t.expect(g.columns).toBe(2)
			t.expect(g.rows).toBe(3)
		end)
		t.it("never more rows than the most", function()
			local g = L.slotGrid(12, 9999, CELL, ROWS)
			t.expect(g.rows).toBe(6)
			t.expect(g.columns).toBe(2)
		end)
		t.it("no room at all is still one row", function()
			local g = L.slotGrid(5, -20, CELL, ROWS)
			t.expect(g.rows).toBe(1)
			t.expect(g.columns).toBe(5)
		end)
		t.it("every bag fits, on every screen", function()
			for _, screen in { { 667, 375 }, { 844, 390 }, { 932, 430 }, { 1024, 768 }, { 1366, 1024 } } do
				for _, slots in { 5, 8, 12 } do
					local g, space = grid(slots, screen[1], screen[2], 58, true)
					t.expect(g.rows * g.columns >= slots).toBe(true)
					t.expect(g.rows * CELL + HEADER <= space).toBe(true)
				end
			end
		end)
	end)
end
