import { CollectionService } from "@rbxts/services";
import {
	addPlank,
	Barricade,
	canAddPlank,
	damageBarricade,
	DamageResult,
	emptyBarricade,
	isBlocked,
	newPlankHealth,
	planksToTake,
	removePlank,
} from "shared/barricade";
import { PLANK_PILE_TAG } from "shared/tags";
import { UpgradeId } from "shared/upgrades";
import { gameConfig } from "./config";
import { giveItem, itemCount, itemRoom, takeItem } from "./inventory";
import { playSound } from "./effects";
import { inReach, makePrompt, promptAnchor } from "./prompts";
import { recordStat } from "./roundStats";
import { Entry, MainWorld } from "./world";

/**
 * Barricades: kids carry planks from the garage pile and nail them over doors and windows
 * (rules in shared/barricade.ts). All state is server-side; the planks are real parts, and an
 * opening with any plank up is blocked by its (invisible) slot part. Nailing one up costs a
 * plank and a nail from the kid's inventory; taking it down gives both back.
 *
 * Prompts: "Board up" (E, hold) and "Take down" (F, short hold) at every opening, and
 * "Take planks" on the pile. Who may use them, and whether they have planks, is checked here
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

/** Redraws an opening's planks and updates its prompts and blocker. */
function refresh(state: EntryState) {
	const { entry, barricade, visuals } = state;
	visuals.ClearAllChildren();
	const count = barricade.planks.size();
	// Spread the planks over the opening, each at a slight angle, on the house side.
	const tilts = [0.12, -0.1, 0.07, -0.05];
	for (let i = 0; i < count; i++) {
		const y = ((i + 1) / (slotsOf(entry) + 1) - 0.5) * entry.height;
		const plank = new Instance("Part");
		plank.Name = "Plank";
		plank.Size = new Vector3(entry.width + 1, 0.9, 0.35);
		plank.CFrame = entry.cframe.mul(new CFrame(0, y, 0.55)).mul(CFrame.Angles(0, 0, tilts[i % tilts.size()]));
		plank.Anchored = true;
		plank.Material = Enum.Material.WoodPlanks;
		plank.Color = PLANK_COLOR;
		plank.Parent = visuals;
	}
	entry.slot.CanCollide = isBlocked(barricade);
	const slots = slotsOf(entry);
	state.board.ActionText = `Board up (${count}/${slots})`;
	state.board.Enabled = canAddPlank(barricade, slots);
	state.takeDown.Enabled = count > 0;
}

function onBoard(player: Player, state: EntryState) {
	if (!hooks || !hooks.canAct(player) || !inReach(player, state.board)) {
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
	const health = newPlankHealth({
		base: gameConfig.plankHealth.Value,
		firstNight: hooks.isFirstNight() ? gameConfig.firstNightPlankMultiplier.Value : 1,
		reinforced: hooks.hasUpgrade("ReinforcedPlanks") ? gameConfig.reinforcedPlankMultiplier.Value : 1,
		index: barricade.planks.size(),
		normalSlots: gameConfig.plankSlots.Value,
		doorBar: gameConfig.doorBarMultiplier.Value,
	});
	if (!addPlank(barricade, slotsOf(entry), health)) {
		return;
	}
	takeItem(player, "Planks", 1);
	takeItem(player, "Nails", 1);
	recordStat(player, "planksNailed");
	playSound(state.entry.slot, NAIL_SOUND, NAIL_OPTIONS);
	refresh(state);
}

function onTakeDown(player: Player, state: EntryState) {
	if (!hooks || !hooks.canAct(player) || !inReach(player, state.takeDown)) {
		return;
	}
	if (itemRoom(player, "Planks") <= 0) {
		hooks.notify(player, "Your pockets are full.");
		return;
	}
	if (removePlank(state.barricade)) {
		giveItem(player, "Planks", 1);
		giveItem(player, "Nails", 1);
		recordStat(player, "planksNailed", -1); // nailing and un-nailing doesn't earn Carpenter
		refresh(state);
	}
}

function setUpEntry(entry: Entry) {
	// The slot's +Z is the house side (its LookVector points out).
	const anchor = promptAnchor(entry.slot, new Vector3(0, 0, PROMPT_INSET));

	const board = makePrompt(anchor, "Board up", Enum.KeyCode.E, gameConfig.boardHoldSeconds.Value);
	board.ObjectText = entry.name;
	const takeDown = makePrompt(anchor, "Take down", Enum.KeyCode.F, 0.5);
	takeDown.UIOffset = new Vector2(0, 70); // below the board prompt

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
	const prompt = makePrompt(anchor, "Take planks", Enum.KeyCode.E, 0.4);
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

/** Whether `entry` currently has any plank up. */
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

/** Whether any door or window has a plank up. */
export function anyBoarded(): boolean {
	for (const [, state] of states) {
		if (isBlocked(state.barricade)) {
			return true;
		}
	}
	return false;
}

/** Damage from the infected: wears down `entry`'s outermost plank. */
export function damageEntry(entry: Entry, amount: number): DamageResult {
	const state = states.get(entry);
	if (!state) {
		return { broken: 0, breached: true };
	}
	const result = damageBarricade(state.barricade, amount);
	if (result.broken > 0) {
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
