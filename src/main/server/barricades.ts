import { CollectionService, Players } from "@rbxts/services";
import {
	addPlank,
	Barricade,
	canAddPlank,
	damageBarricade,
	DamageResult,
	emptyBarricade,
	isBlocked,
	planksToTake,
	removePlank,
} from "shared/barricade";
import { PLANK_PILE_TAG } from "shared/tags";
import { gameConfig } from "./config";
import { inReach, makePrompt, promptAnchor } from "./prompts";
import { recordStat } from "./roundStats";
import { Entry, MainWorld } from "./world";

/**
 * Barricades: kids carry planks from the garage pile and nail them over doors and windows
 * (rules in shared/barricade.ts). All state is server-side; the planks are real parts, and an
 * opening with any plank up is blocked by its (invisible) slot part.
 *
 * Prompts: "Board up" (E, hold) and "Take down" (F, short hold) at every opening, and
 * "Take planks" on the pile. Who may use them, and whether they have planks, is checked here
 * when a prompt fires.
 */

export interface BarricadeHooks {
	/** Whether `player` may use prompts right now (a kid who's still in, during play). */
	canAct: (player: Player) => boolean;
	notify: (player: Player, text: string) => void;
	/** Tells a kid how many planks they're carrying. */
	sendPlanks: (player: Player, count: number) => void;
	/** Whether planks nailed now get the Night 1 bonus. */
	isFirstNight: () => boolean;
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
/** How far inside the opening the prompts sit (the house side), in studs. */
const PROMPT_INSET = 1.2;

let hooks: BarricadeHooks | undefined;
const states = new Map<Entry, EntryState>();
const carrying = new Map<Player, number>();
let pileStock = 0;
let pilePrompt: ProximityPrompt | undefined;

Players.PlayerRemoving.Connect((player) => carrying.delete(player));

/** Planks `player` is carrying. */
export function planksOf(player: Player): number {
	return carrying.get(player) ?? 0;
}

function setPlanks(player: Player, count: number) {
	carrying.set(player, count);
	hooks?.sendPlanks(player, count);
}

/** Re-sends `player` their plank count (for resync). */
export function resendPlanks(player: Player) {
	hooks?.sendPlanks(player, planksOf(player));
}

/** A taken kid loses what they were carrying. */
export function dropPlanks(player: Player) {
	setPlanks(player, 0);
}

function playSound(parent: Instance, id: string) {
	const sound = new Instance("Sound");
	sound.SoundId = id;
	sound.Volume = 0.8;
	sound.RollOffMaxDistance = 80;
	sound.Parent = parent;
	sound.Play();
	task.delay(2, () => sound.Destroy());
}

/** Redraws an opening's planks and updates its prompts and blocker. */
function refresh(state: EntryState) {
	const { entry, barricade, visuals } = state;
	visuals.ClearAllChildren();
	const count = barricade.planks.size();
	// Spread the planks over the opening, each at a slight angle, on the house side.
	const tilts = [0.12, -0.1, 0.07, -0.05];
	for (let i = 0; i < count; i++) {
		const y = ((i + 1) / (gameConfig.plankSlots.Value + 1) - 0.5) * entry.height;
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
	const slots = gameConfig.plankSlots.Value;
	state.board.ActionText = `Board up (${count}/${slots})`;
	state.board.Enabled = canAddPlank(barricade, slots);
	state.takeDown.Enabled = count > 0;
}

function onBoard(player: Player, state: EntryState) {
	if (!hooks || !hooks.canAct(player) || !inReach(player, state.board)) {
		return;
	}
	if (planksOf(player) <= 0) {
		hooks.notify(player, "You need planks. There's a pile in the garage.");
		return;
	}
	const multiplier = hooks.isFirstNight() ? gameConfig.firstNightPlankMultiplier.Value : 1;
	if (!addPlank(state.barricade, gameConfig.plankSlots.Value, gameConfig.plankHealth.Value * multiplier)) {
		return;
	}
	setPlanks(player, planksOf(player) - 1);
	recordStat(player, "planksNailed");
	playSound(state.entry.slot, NAIL_SOUND);
	refresh(state);
}

function onTakeDown(player: Player, state: EntryState) {
	if (!hooks || !hooks.canAct(player) || !inReach(player, state.takeDown)) {
		return;
	}
	if (planksOf(player) >= gameConfig.plankCarryMax.Value) {
		hooks.notify(player, "Your hands are full.");
		return;
	}
	if (removePlank(state.barricade)) {
		setPlanks(player, planksOf(player) + 1);
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
		const take = planksToTake(planksOf(player), gameConfig.plankCarryMax.Value, pileStock);
		if (take <= 0) {
			hooks.notify(player, pileStock <= 0 ? "The pile is empty. More at dawn." : "Your hands are full.");
			return;
		}
		pileStock -= take;
		setPlanks(player, planksOf(player) + take);
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
		playSound(entry.slot, NAIL_SOUND);
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
