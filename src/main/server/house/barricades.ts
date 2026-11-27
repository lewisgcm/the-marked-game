import { CollectionService, TweenService } from "@rbxts/services";
import {
	addPlank,
	addShutter,
	Barricade,
	canAddPlank,
	damageBarricade,
	DamageResult,
	fixDoor,
	isBlocked,
	isBoarded,
	isWorthAttacking,
	newDoor,
	newPlank,
	newWindow,
	planksToTake,
	removePlank,
	repair,
	toggleDoor,
	wear,
} from "shared/house/barricade";
import { rootOf } from "shared/core/characters";
import { BUILD_PROMPT_TAG, PLANK_PILE_TAG, WINDOW_GLASS_TAG } from "shared/core/tags";
import { UpgradeId } from "shared/economy/upgrades";
import { gameConfig } from "../core/config";
import { giveItem, giveOrDrop, itemCount, itemRoom, takeItem } from "../items/inventory";
import { playSound } from "../core/effects";
import { holdsHammer } from "./hammer";
import { inReach, makePrompt, promptAnchor } from "../core/prompts";
import { recordStat } from "../core/roundStats";
import { Entry, MainWorld } from "../world/world";

/**
 * Barricades (rules in shared/house/barricade.ts). All state is server-side; the parts are drawn from it,
 * and a blocked opening is blocked by its (invisible) slot part.
 *
 * - **Windows** start glazed (the glass smashes at the first hit). Kids carry planks from the garage pile
 *   and nail them across: "Board up" (E, hold). A shutter is fitted by using one (from the inventory) next
 *   to a window; it stays for good, unless it's broken.
 * - **Doors** are real doors: "Open"/"Close" (E, anyone, no hammer). "Reinforce" (R, hold) nails a board
 *   onto the door itself, so it still opens. A door the infected break hangs off its hinge, an open gap,
 *   until a kid uses "Fix door" (R, hold: FixDoorPlanks planks and FixDoorNails nails). The garage door rolls
 *   up instead of swinging.
 *
 * Nailing a plank or board costs a plank and a nail; "Take down" (F, short hold) gives both back. Once
 * there's no room for another, the same prompt says "Repair": a nail brings the outermost damaged plank
 * (or a whole door) back to full, so kids can keep an opening up under attack. Planks darken as they wear. The
 * build prompts need the hammer in hand. Who may use them, and whether they have what it takes, is checked
 * here when a prompt fires.
 */

export interface BarricadeHooks {
	/** Whether `player` may use prompts right now (a kid who's still in, during play). */
	canAct: (player: Player) => boolean;
	notify: (player: Player, text: string) => void;
	/** Whether planks nailed now get the Night 1 bonus. */
	isFirstNight: () => boolean;
	/** Workbench upgrades the party has. */
	hasUpgrade: (id: UpgradeId) => boolean;
}

interface EntryState {
	entry: Entry;
	barricade: Barricade;
	visuals: Folder;
	board: ProximityPrompt;
	takeDown: ProximityPrompt;
	/** A door's: open or close it. */
	toggle?: ProximityPrompt;
	/** A door's: put it back up once it's broken. */
	fix?: ProximityPrompt;
	/** A door's parts (the door and its boards), moved as one. */
	doorModel?: Model;
}

const PLANK_COLOR = new Color3(0.55, 0.4, 0.26);
const DOOR_COLOR = new Color3(0.42, 0.27, 0.17);
/** A fixed door: nailed back together from planks. */
const PATCHED_COLOR = new Color3(0.58, 0.44, 0.3);
const GARAGE_COLOR = new Color3(0.78, 0.78, 0.74);
const GLASS_COLOR = new Color3(0.75, 0.85, 0.92);
const GLASS_SOUND = "rbxasset://sounds/glassbreak.wav";
const DOOR_SOUND = "rbxasset://sounds/button.wav";
/** How thick a door is. */
const DOOR_THICK = 0.3;
const SWING = new TweenInfo(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.Out);
const STRIP_COLOR = new Color3(0.5, 0.52, 0.55);
const SHUTTER_COLOR = new Color3(0.36, 0.38, 0.4);
// A built-in thud as a placeholder (no uploaded audio yet).
const NAIL_SOUND = "rbxasset://sounds/action_footsteps_plastic.mp3";
const NAIL_OPTIONS = { volume: 0.8, range: 80 };
/** How far inside the opening the prompts sit (the house side), in studs. */
const PROMPT_INSET = 1.2;

let hooks: BarricadeHooks | undefined;
const states = new Map<Entry, EntryState>();
let pileStock = 0;
let pilePrompt: ProximityPrompt | undefined;

/** How many planks an opening takes: a door bar adds to the front and back doors. */
function slotsOf(entry: Entry): number {
	const extra = entry.kind === "Door" && hooks?.hasUpgrade("DoorBar") ? gameConfig.doorBarSlots.Value : 0;
	return gameConfig.plankSlots.Value + extra;
}

function isDoor(entry: Entry): boolean {
	return entry.kind !== "Window";
}

/**
 * Where a door is: shut, in the opening; open, swung 90° into the house on its hinge (the garage door rolls
 * up under the ceiling); broken, hanging off a hinge (the garage door's fallen in). The slot's +Z is the house side.
 */
function doorFrame(entry: Entry, barricade: Barricade): CFrame {
	const door = barricade.door!;
	const [w, h] = [entry.width, entry.height];
	const garage = entry.kind === "GarageDoor";
	if (door.broken) {
		return garage
			? entry.cframe.mul(new CFrame(0, -h / 2 + 1.2, h / 2 - 0.6)).mul(CFrame.Angles(1.25, 0, 0.08))
			: entry.cframe
					.mul(new CFrame(-w / 2, 0, 0))
					.mul(CFrame.Angles(0, -0.55, 0))
					.mul(new CFrame(w / 2, -0.5, 0.15))
					.mul(CFrame.Angles(0, 0, -0.22));
	}
	if (!door.open) {
		return entry.cframe;
	}
	return garage
		? entry.cframe.mul(new CFrame(0, h / 2 - 0.4, h / 2)).mul(CFrame.Angles(math.pi / 2, 0, 0))
		: entry.cframe
				.mul(new CFrame(-w / 2, 0, 0))
				.mul(CFrame.Angles(0, -math.pi / 2, 0))
				.mul(new CFrame(w / 2, 0, 0));
}

function piece(parent: Instance, name: string, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material) {
	const p = new Instance("Part");
	p.Name = name;
	p.Size = size;
	p.CFrame = cframe;
	p.Anchored = true;
	p.CanCollide = false; // the slot blocks the way; a swinging door mustn't shove anyone
	p.Color = color;
	p.Material = material;
	p.Parent = parent;
	return p;
}

/** The door, with its boards on the house side, as one model at its frame. */
function drawDoor(state: EntryState) {
	const { entry, barricade, visuals } = state;
	const door = barricade.door!;
	const model = new Instance("Model");
	model.Name = "Door";
	const garage = entry.kind === "GarageDoor";
	const [w, h] = [entry.width, entry.height];
	const colour = garage ? GARAGE_COLOR : door.fixes > 0 ? PATCHED_COLOR : DOOR_COLOR;
	const leaf = piece(
		model,
		"Leaf",
		new Vector3(w - 0.1, h - 0.1, DOOR_THICK),
		new CFrame(),
		colour,
		garage ? Enum.Material.Metal : Enum.Material.Wood,
	);
	leaf.CanQuery = !door.open && !door.broken; // a shut door hides who's behind it
	model.PrimaryPart = leaf;
	if (garage) {
		for (let i = 1; i < 6; i++) {
			piece(
				model,
				"Rib",
				new Vector3(w - 0.1, 0.12, 0.05),
				new CFrame(0, -h / 2 + (i * h) / 6, -0.17),
				colour.Lerp(new Color3(), 0.15),
				Enum.Material.Metal,
			);
		}
	}
	if (door.fixes > 0 && !garage) {
		// Nailed back together: a Z of battens across it.
		for (const [y, angle] of [
			[h * 0.3, 0],
			[-h * 0.3, 0],
			[0, -0.9],
		] as const) {
			piece(
				model,
				"Batten",
				new Vector3(angle === 0 ? w - 0.4 : h * 0.62, 0.45, 0.12),
				new CFrame(0, y, -0.2).mul(CFrame.Angles(0, 0, angle)),
				PLANK_COLOR,
				Enum.Material.WoodPlanks,
			);
		}
	}
	if (!door.open && !door.broken) {
		// A handle, both sides.
		for (const side of [-1, 1]) {
			piece(
				model,
				"Handle",
				new Vector3(0.15, 0.15, 0.25),
				new CFrame(w / 2 - 0.6, -0.4, side * 0.25),
				new Color3(0.75, 0.7, 0.5),
				Enum.Material.Metal,
			);
		}
	}
	const tilts = [0.12, -0.1, 0.07, -0.05];
	const count = door.broken ? 0 : barricade.planks.size();
	for (let i = 0; i < count; i++) {
		const y = ((i + 1) / (slotsOf(entry) + 1) - 0.5) * h;
		drawPlank(
			w - 0.3,
			new CFrame(0, y, DOOR_THICK / 2 + 0.2).mul(CFrame.Angles(0, 0, tilts[i % tilts.size()] * 0.6)),
			barricade.planks[i].reinforced,
			model,
			barricade.planks[i].health / barricade.planks[i].max,
		);
	}
	model.PivotTo(doorFrame(entry, barricade));
	model.Parent = visuals;
	state.doorModel = model;
}

/** A worn plank is darker and splintery: how worn, 0 (as new) to 1. */
const WORN_COLOR = new Color3(0.22, 0.15, 0.1);

/** One plank across an opening; a reinforced one has metal strips near its ends. `health` is 0..1 of its max. */
function drawPlank(width: number, cframe: CFrame, reinforced: boolean, parent: Instance, health = 1) {
	const plank = new Instance("Part");
	plank.Name = "Plank";
	plank.Size = new Vector3(width, 0.9, 0.35);
	plank.CFrame = cframe;
	plank.Anchored = true;
	plank.CanCollide = false; // the slot blocks the way
	plank.CanQuery = false; // there are gaps: a bat, a stone or a beam gets through, and they see in
	plank.Material = Enum.Material.WoodPlanks;
	plank.Color = PLANK_COLOR.Lerp(WORN_COLOR, math.clamp(1 - health, 0, 1) * 0.85);
	plank.Parent = parent;
	for (const side of reinforced ? [-1, 1] : []) {
		const strip = new Instance("Part");
		strip.Name = "Strip";
		strip.Size = new Vector3(0.35, 1, 0.45);
		strip.CFrame = cframe.mul(new CFrame(side * width * 0.3, 0, 0));
		strip.Anchored = true;
		strip.CanCollide = false;
		strip.CanQuery = false;
		strip.Material = Enum.Material.Metal;
		strip.Color = STRIP_COLOR;
		strip.Parent = parent;
	}
}

/** The build prompt: nail another plank while there's room, else repair what's worn. */
function setBoardPrompt(state: EntryState, verb: string) {
	const { entry, barricade, board } = state;
	const slots = slotsOf(entry);
	const count = barricade.planks.size();
	const worn = wear(barricade);
	if (canAddPlank(barricade, slots)) {
		board.ActionText = `${verb} (${count}/${slots})`;
		board.Enabled = true;
	} else if (worn !== undefined) {
		board.ActionText = `Repair (${math.floor(worn * 100)}%)`;
		board.Enabled = true;
	} else {
		board.ActionText = `${verb} (${count}/${slots})`;
		board.Enabled = false;
	}
}

/** Redraws an opening (its door or glass, planks and shutter) and updates its prompts and blocker. */
function refresh(state: EntryState) {
	const { entry, barricade, visuals } = state;
	visuals.ClearAllChildren();
	state.doorModel = undefined;
	const count = barricade.planks.size();
	entry.slot.CanCollide = isBlocked(barricade);
	if (barricade.door) {
		const door = barricade.door;
		drawDoor(state);
		setBoardPrompt(state, "Reinforce");
		if (door.broken) {
			state.board.Enabled = false; // "Fix door" instead
		}
		state.takeDown.Enabled = count > 0 && !door.broken;
		if (state.toggle) {
			state.toggle.ActionText = door.open ? "Close" : "Open";
			state.toggle.Enabled = !door.broken;
		}
		if (state.fix) {
			state.fix.Enabled = door.broken;
		}
		return;
	}
	if (barricade.glass) {
		const glass = piece(
			visuals,
			"Glass",
			new Vector3(entry.width, entry.height, 0.1),
			entry.cframe,
			GLASS_COLOR,
			Enum.Material.Glass,
		);
		glass.Transparency = 0.6;
		// Stones and the bat stop at it (smash it first: the infected do); a torch shines through.
		CollectionService.AddTag(glass, WINDOW_GLASS_TAG);
	}
	// Spread the planks over the opening, each at a slight angle, on the house side.
	const tilts = [0.12, -0.1, 0.07, -0.05];
	for (let i = 0; i < count; i++) {
		const y = ((i + 1) / (slotsOf(entry) + 1) - 0.5) * entry.height;
		const at = entry.cframe.mul(new CFrame(0, y, 0.55)).mul(CFrame.Angles(0, 0, tilts[i % tilts.size()]));
		const plank = barricade.planks[i];
		drawPlank(entry.width + 1, at, plank.reinforced, visuals, plank.health / plank.max);
	}
	if (barricade.shutter !== undefined) {
		const shutter = new Instance("Part");
		shutter.Name = "Shutter";
		shutter.Size = new Vector3(entry.width + 0.8, entry.height + 0.6, 0.25);
		shutter.CFrame = entry.cframe.mul(new CFrame(0, 0, 0.95)); // behind the planks
		shutter.Anchored = true;
		shutter.Material = Enum.Material.DiamondPlate;
		shutter.Color = SHUTTER_COLOR;
		shutter.Parent = visuals;
	}
	setBoardPrompt(state, "Board up");
	state.takeDown.Enabled = count > 0;
}

/** Whether `player` can use one of the prompts at an opening. */
function canBuild(player: Player, prompt: ProximityPrompt): boolean {
	return hooks !== undefined && hooks.canAct(player) && holdsHammer(player) && inReach(player, prompt);
}

/** "Repair": a nail brings the outermost worn plank (or the door) back to full. */
function onRepair(player: Player, state: EntryState) {
	if (!hooks) {
		return;
	}
	if (itemCount(player, "Nails") <= 0) {
		hooks.notify(player, "You need a nail to repair it.");
		return;
	}
	if (repair(state.barricade)) {
		takeItem(player, "Nails", 1);
		playSound(state.entry.slot, NAIL_SOUND, NAIL_OPTIONS);
		refresh(state);
	}
}

function onBoard(player: Player, state: EntryState) {
	if (!hooks || !canBuild(player, state.board)) {
		return;
	}
	if (!canAddPlank(state.barricade, slotsOf(state.entry))) {
		onRepair(player, state); // full up: the prompt says Repair
		return;
	}
	if (itemCount(player, "Planks") <= 0) {
		hooks.notify(player, "You need planks. There's a pile in the garage.");
		return;
	}
	if (itemCount(player, "Nails") <= 0) {
		hooks.notify(player, "You need nails. Search the houses on Maple Street.");
		return;
	}
	const { entry, barricade } = state;
	const plank = newPlank({
		base: gameConfig.plankHealth.Value,
		firstNight: hooks.isFirstNight() ? gameConfig.firstNightPlankMultiplier.Value : 1,
		reinforced: hooks.hasUpgrade("ReinforcedPlanks"),
		reinforcedBy: gameConfig.reinforcedPlankMultiplier.Value,
		index: barricade.planks.size(),
		normalSlots: gameConfig.plankSlots.Value,
		doorBar: gameConfig.doorBarMultiplier.Value,
	});
	if (!addPlank(barricade, slotsOf(entry), plank)) {
		return;
	}
	takeItem(player, "Planks", 1);
	takeItem(player, "Nails", 1);
	recordStat(player, "planksNailed");
	playSound(state.entry.slot, NAIL_SOUND, NAIL_OPTIONS);
	refresh(state);
}

function onTakeDown(player: Player, state: EntryState) {
	if (!hooks || !canBuild(player, state.takeDown)) {
		return;
	}
	if (itemRoom(player, "Planks") <= 0) {
		hooks.notify(player, "Your pockets are full.");
		return;
	}
	if (removePlank(state.barricade)) {
		giveItem(player, "Planks", 1);
		giveOrDrop(player, "Nails", 1, state.entry.cframe.mul(new CFrame(0, 0, 2)).Position);
		recordStat(player, "planksNailed", -1); // nailing and un-nailing doesn't earn Carpenter
		refresh(state);
	}
}

function onToggle(player: Player, state: EntryState) {
	const toggle = state.toggle;
	if (!hooks || !toggle || !hooks.canAct(player) || !inReach(player, toggle)) {
		return;
	}
	const from = state.doorModel?.GetPivot();
	if (!toggleDoor(state.barricade)) {
		return;
	}
	playSound(state.entry.slot, DOOR_SOUND, { volume: 0.5, range: 40 });
	refresh(state);
	// Swing it from where it was.
	const model = state.doorModel;
	if (model && from) {
		const to = model.GetPivot();
		const value = new Instance("CFrameValue");
		value.Value = from;
		model.PivotTo(from);
		value.Changed.Connect((at) => model.Parent && model.PivotTo(at));
		const tween = TweenService.Create(value, SWING, { Value: to });
		tween.Completed.Connect(() => value.Destroy());
		tween.Play();
	}
}

function onFix(player: Player, state: EntryState) {
	const fix = state.fix;
	if (!hooks || !fix || !canBuild(player, fix) || !state.barricade.door?.broken) {
		return;
	}
	const planks = gameConfig.fixDoorPlanks.Value;
	const nails = gameConfig.fixDoorNails.Value;
	if (itemCount(player, "Planks") < planks || itemCount(player, "Nails") < nails) {
		hooks.notify(player, `Fixing a door takes ${planks} planks and ${nails} nails.`);
		return;
	}
	if (!fixDoor(state.barricade, gameConfig.doorHealth.Value)) {
		return;
	}
	takeItem(player, "Planks", planks);
	takeItem(player, "Nails", nails);
	recordStat(player, "planksNailed", planks);
	playSound(state.entry.slot, NAIL_SOUND, NAIL_OPTIONS);
	refresh(state);
}

/** The closest window `player` can reach that `suits`. */
function windowNear(player: Player, suits: (state: EntryState) => boolean): EntryState | undefined {
	const root = rootOf(player.Character);
	let best: EntryState | undefined;
	let bestDistance = math.huge;
	for (const [entry, state] of states) {
		if (!root || entry.kind !== "Window" || !inReach(player, state.board) || !suits(state)) {
			continue;
		}
		const distance = entry.cframe.Position.sub(root.Position).Magnitude;
		if (distance < bestDistance) {
			best = state;
			bestDistance = distance;
		}
	}
	return best;
}

/** Fits a shutter to the window `player` is next to. Returns why not, or undefined if it's fitted. */
export function fitShutter(player: Player): string | undefined {
	if (!holdsHammer(player)) {
		return "Hold your hammer to fit it.";
	}
	const state = windowNear(player, (s) => s.barricade.shutter === undefined);
	if (!state || !addShutter(state.barricade, gameConfig.shutterHealth.Value)) {
		return windowNear(player, () => true) ? "It already has a shutter." : "Stand next to a window to fit it.";
	}
	playSound(state.entry.slot, NAIL_SOUND, NAIL_OPTIONS);
	refresh(state);
	return undefined;
}

function setUpEntry(entry: Entry) {
	const door = isDoor(entry);
	// The slot's +Z is the house side (its LookVector points out).
	const anchor = promptAnchor(entry.slot, new Vector3(0, 0, PROMPT_INSET));

	// At a door, E opens it, so nailing is R.
	const buildKey = door ? Enum.KeyCode.R : Enum.KeyCode.E;
	const board = makePrompt(anchor, "Board up", buildKey, gameConfig.boardHoldSeconds.Value);
	board.ObjectText = entry.name;
	const takeDown = makePrompt(anchor, "Take down", Enum.KeyCode.F, gameConfig.holdTakeDown.Value);
	takeDown.UIOffset = new Vector2(0, 70); // below the board prompt
	const build = [board, takeDown];
	let fix: ProximityPrompt | undefined;
	if (door) {
		fix = makePrompt(anchor, "Fix door", Enum.KeyCode.R, gameConfig.fixDoorSeconds.Value);
		fix.ObjectText = `${entry.name}: ${gameConfig.fixDoorPlanks.Value} planks, ${gameConfig.fixDoorNails.Value} nails`;
		build.push(fix);
	}
	for (const prompt of build) {
		prompt.MaxActivationDistance = gameConfig.buildReach.Value;
		CollectionService.AddTag(prompt, BUILD_PROMPT_TAG);
	}
	let toggle: ProximityPrompt | undefined;
	if (door) {
		// In the middle of the doorway, so it works from either side.
		toggle = makePrompt(
			promptAnchor(entry.slot, new Vector3(0, -0.5, 0)),
			"Open",
			Enum.KeyCode.E,
			gameConfig.holdQuick.Value,
		);
		toggle.ObjectText = entry.name;
		toggle.MaxActivationDistance = 7;
		toggle.UIOffset = new Vector2(0, -70); // above the build prompts
	}

	const visuals = new Instance("Folder");
	visuals.Name = "Planks";
	visuals.Parent = entry.slot;

	const barricade = door ? newDoor(gameConfig.doorHealth.Value) : newWindow();
	const state: EntryState = { entry, barricade, visuals, board, takeDown, toggle, fix };
	states.set(entry, state);
	board.Triggered.Connect((player) => onBoard(player, state));
	takeDown.Triggered.Connect((player) => onTakeDown(player, state));
	toggle?.Triggered.Connect((player) => onToggle(player, state));
	fix?.Triggered.Connect((player) => onFix(player, state));
	refresh(state);
}

function refreshPile() {
	if (pilePrompt) {
		pilePrompt.ActionText = `Take planks (${pileStock} left)`;
	}
}

function setUpPile() {
	const pile = CollectionService.GetTagged(PLANK_PILE_TAG)[0];
	if (!pile || !pile.IsA("BasePart")) {
		warn("[Barricades] No plank pile in the world.");
		return;
	}
	const anchor = promptAnchor(pile, new Vector3(0, 2, 0));
	const prompt = makePrompt(anchor, "Take planks", Enum.KeyCode.E, gameConfig.holdTakePlanks.Value);
	prompt.ObjectText = "Plank pile";
	pilePrompt = prompt;
	prompt.Triggered.Connect((player) => {
		if (!hooks || !hooks.canAct(player) || !inReach(player, prompt)) {
			return;
		}
		const take = planksToTake(0, math.min(itemRoom(player, "Planks"), gameConfig.planksPerGrab.Value), pileStock);
		if (take <= 0) {
			hooks.notify(player, pileStock <= 0 ? "The pile is empty. More at dawn." : "Your pockets are full.");
			return;
		}
		pileStock -= take;
		giveItem(player, "Planks", take);
		refreshPile();
	});
	refreshPile();
}

/** Dawn: a few more planks turn up in the pile. */
export function refillPile() {
	pileStock += gameConfig.plankPileDawnRefill.Value;
	refreshPile();
}

/** Whether `entry` is blocked: a shut, whole door; a window's glass, planks or shutter. */
export function isEntryBlocked(entry: Entry): boolean {
	const state = states.get(entry);
	return state !== undefined && isBlocked(state.barricade);
}

/** Updates every opening (a door bar changes how many planks they take). */
export function refreshBarricades() {
	for (const [, state] of states) {
		refresh(state);
	}
}

/** Whether any door or window has a plank, or a shutter, up. */
export function anyBoarded(): boolean {
	for (const [, state] of states) {
		if (isBoarded(state.barricade)) {
			return true;
		}
	}
	return false;
}

/** Whether an infected gets anywhere by attacking `entry`. */
export function isEntryWorthAttacking(entry: Entry, breaksShutters: boolean): boolean {
	const state = states.get(entry);
	return state === undefined || isWorthAttacking(state.barricade, breaksShutters);
}

/** Damage from the infected: wears down `entry`'s outermost plank, then (some of them) its shutter. */
export function damageEntry(entry: Entry, amount: number, breaksShutters: boolean): DamageResult {
	const state = states.get(entry);
	if (!state) {
		return { broken: 0, breached: true, opened: false };
	}
	const hadGlass = state.barricade.glass === true;
	const result = damageBarricade(state.barricade, amount, breaksShutters);
	if (hadGlass && !state.barricade.glass) {
		playSound(entry.slot, GLASS_SOUND, { volume: 1, range: 120 });
		refresh(state);
	} else {
		if (result.broken > 0 || result.opened) {
			playSound(entry.slot, NAIL_SOUND, NAIL_OPTIONS);
		}
		refresh(state); // the wear shows, and the prompt's Repair %
	}
	return result;
}

/** Sets up every opening and the plank pile. Call once, after the world is built. */
export function startBarricades(world: MainWorld, barricadeHooks: BarricadeHooks) {
	hooks = barricadeHooks;
	pileStock = gameConfig.plankPileStart.Value;
	world.entries.forEach(setUpEntry);
	setUpPile();
}
