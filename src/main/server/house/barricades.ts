import { CollectionService } from "@rbxts/services";
import {
	addPlank,
	addShutter,
	Barricade,
	canAddPlank,
	damageBarricade,
	DamageResult,
	emptyBarricade,
	isBlocked,
	isWorthAttacking,
	newPlank,
	planksToTake,
	removePlank,
} from "shared/house/barricade";
import { rootOf } from "shared/core/characters";
import { BUILD_PROMPT_TAG, PLANK_PILE_TAG } from "shared/core/tags";
import { UpgradeId } from "shared/economy/upgrades";
import { gameConfig } from "../core/config";
import { giveItem, giveOrDrop, itemCount, itemRoom, takeItem } from "../items/inventory";
import { playSound } from "../core/effects";
import { holdsHammer } from "./hammer";
import { inReach, makePrompt, promptAnchor } from "../core/prompts";
import { recordStat } from "../core/roundStats";
import { Entry, MainWorld } from "../world/world";

/**
 * Barricades: kids carry planks from the garage pile and nail them over doors and windows
 * (rules in shared/house/barricade.ts). All state is server-side; the planks are real parts, and an
 * opening with any plank up is blocked by its (invisible) slot part. Nailing one up costs a
 * plank and a nail from the kid's inventory; taking it down gives both back.
 *
 * A shutter is fitted by using one (from the inventory) next to a window. It stays for good, unless
 * it's broken.
 *
 * Prompts: "Board up" (E, hold) and "Take down" (F, short hold) at every opening, and
 * "Take planks" on the pile. The ones at openings need the hammer in hand. Who may use them, and whether they have planks, is checked here
 * when a prompt fires.
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
}

const PLANK_COLOR = new Color3(0.55, 0.4, 0.26);
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

/** One plank across an opening; a reinforced one has metal strips near its ends. */
function drawPlank(width: number, cframe: CFrame, reinforced: boolean, parent: Instance) {
	const plank = new Instance("Part");
	plank.Name = "Plank";
	plank.Size = new Vector3(width, 0.9, 0.35);
	plank.CFrame = cframe;
	plank.Anchored = true;
	plank.Material = Enum.Material.WoodPlanks;
	plank.Color = PLANK_COLOR;
	plank.Parent = parent;
	for (const side of reinforced ? [-1, 1] : []) {
		const strip = new Instance("Part");
		strip.Name = "Strip";
		strip.Size = new Vector3(0.35, 1, 0.45);
		strip.CFrame = cframe.mul(new CFrame(side * width * 0.3, 0, 0));
		strip.Anchored = true;
		strip.CanCollide = false;
		strip.Material = Enum.Material.Metal;
		strip.Color = STRIP_COLOR;
		strip.Parent = parent;
	}
}

/** Redraws an opening's planks and updates its prompts and blocker. */
function refresh(state: EntryState) {
	const { entry, barricade, visuals } = state;
	visuals.ClearAllChildren();
	const count = barricade.planks.size();
	// Spread the planks over the opening, each at a slight angle, on the house side.
	const tilts = [0.12, -0.1, 0.07, -0.05];
	for (let i = 0; i < count; i++) {
		const y = ((i + 1) / (slotsOf(entry) + 1) - 0.5) * entry.height;
		const at = entry.cframe.mul(new CFrame(0, y, 0.55)).mul(CFrame.Angles(0, 0, tilts[i % tilts.size()]));
		drawPlank(entry.width + 1, at, barricade.planks[i].reinforced, visuals);
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
	entry.slot.CanCollide = isBlocked(barricade);
	const slots = slotsOf(entry);
	state.board.ActionText = `Board up (${count}/${slots})`;
	state.board.Enabled = canAddPlank(barricade, slots);
	state.takeDown.Enabled = count > 0;
}

/** Whether `player` can use one of the prompts at an opening. */
function canBuild(player: Player, prompt: ProximityPrompt): boolean {
	return hooks !== undefined && hooks.canAct(player) && holdsHammer(player) && inReach(player, prompt);
}

function onBoard(player: Player, state: EntryState) {
	if (!hooks || !canBuild(player, state.board)) {
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
	// The slot's +Z is the house side (its LookVector points out).
	const anchor = promptAnchor(entry.slot, new Vector3(0, 0, PROMPT_INSET));

	const board = makePrompt(anchor, "Board up", Enum.KeyCode.E, gameConfig.boardHoldSeconds.Value);
	board.ObjectText = entry.name;
	const takeDown = makePrompt(anchor, "Take down", Enum.KeyCode.F, gameConfig.holdTakeDown.Value);
	takeDown.UIOffset = new Vector2(0, 70); // below the board prompt
	for (const prompt of [board, takeDown]) {
		prompt.MaxActivationDistance = gameConfig.buildReach.Value;
		CollectionService.AddTag(prompt, BUILD_PROMPT_TAG);
	}

	const visuals = new Instance("Folder");
	visuals.Name = "Planks";
	visuals.Parent = entry.slot;

	const state: EntryState = { entry, barricade: emptyBarricade(), visuals, board, takeDown };
	states.set(entry, state);
	board.Triggered.Connect((player) => onBoard(player, state));
	takeDown.Triggered.Connect((player) => onTakeDown(player, state));
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

/** Whether `entry` currently has any plank, or a shutter, up. */
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
		if (isBlocked(state.barricade)) {
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
	const result = damageBarricade(state.barricade, amount, breaksShutters);
	if (result.broken > 0 || result.opened) {
		playSound(entry.slot, NAIL_SOUND, NAIL_OPTIONS);
		refresh(state);
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
