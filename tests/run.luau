--[[
	Unit-test runner for pure game logic, run with Lune (a standalone Luau runtime):

		npm test          # compiles TypeScript, then runs every tests/unit/<topic>/*.spec.luau

	Tests load the *compiled* modules from out/, so they test exactly what ships. Only code that
	doesn't touch the Roblox engine can be tested here (rules, maths, validation). Tests can build
	Roblox datatypes like Vector3 via @lune/roblox and pass them in, but modules must not
	construct them themselves (Roblox globals like Vector3.new don't exist in Lune) — do that
	maths on plain numbers. Engine-level tests need Studio (see the backlog in GAMEPLAY.md).

	A spec file returns `function(t)` and uses t.describe / t.it / t.expect(...).toBe(...).
]]

local fs = require("@lune/fs")
local process = require("@lune/process")


local passed, failed = 0, 0
local failures = {}
local path = {}

local function describe(name: string, fn: () -> ())
	table.insert(path, name)
	fn()
	table.remove(path)
end

local function it(name: string, fn: () -> ())
	local full = table.concat(path, " > ") .. " > " .. name
	local ok, err = pcall(fn)
	if ok then
		passed += 1
		print("  ok    " .. full)
	else
		failed += 1
		table.insert(failures, full .. "\n          " .. tostring(err))
		print("  FAIL  " .. full)
	end
end

local function expect(actual: any)
	return {
		toBe = function(expected: any)
			if actual ~= expected then
				error(`expected {tostring(expected)}, got {tostring(actual)}`, 0)
			end
		end,
		toBeCloseTo = function(expected: number, epsilon: number?)
			local eps = epsilon or 1e-6
			if type(actual) ~= "number" or math.abs(actual - expected) > eps then
				error(`expected ~{expected} (±{eps}), got {tostring(actual)}`, 0)
			end
		end,
		toBeBetween = function(low: number, high: number)
			if type(actual) ~= "number" or actual < low or actual > high then
				error(`expected between {low} and {high}, got {tostring(actual)}`, 0)
			end
		end,
	}
end

local t = { describe = describe, it = it, expect = expect }

local specs = {}
for _, folder in fs.readDir("tests/unit") do
	if fs.isDir("tests/unit/" .. folder) then
		for _, file in fs.readDir("tests/unit/" .. folder) do
			if string.match(file, "%.spec%.luau$") then
				table.insert(specs, folder .. "/" .. file)
			end
		end
	elseif string.match(folder, "%.spec%.luau$") then
		-- It would never run: specs live in topic folders.
		error(`tests/unit/{folder} should be in a folder`)
	end
end
table.sort(specs)

for _, file in specs do
	print(file)
	local spec = require("./unit/" .. string.gsub(file, "%.luau$", ""))
	spec(t)
end

print(`\n{passed} passed, {failed} failed`)
if failed > 0 then
	print("\nFailures:")
	for _, failure in failures do
		print("  " .. failure)
	end
	process.exit(1)
end
