import { CollectionService, Workspace } from "@rbxts/services";
import { rootOf } from "shared/core/characters";
import { TRADER_TAG } from "shared/core/tags";
import {
	MarkSchedule,
	marksAfter,
	MARKS_TO_FALL,
	markTonight,
	planMarks,
	underAttackTonight,
} from "shared/economy/baseMarks";
import { Base, BaseId, BASES } from "shared/economy/bases";
import { BaseCondition, markLine, MUM, TURNING_LINE } from "shared/economy/walkie";
import { itemName } from "shared/items/inventory";
import { BROADCAST_ATTRIBUTE } from "shared/run/broadcast";
import { gameConfig } from "../core/config";
import { inReach, makePrompt, promptAnchor } from "../core/prompts";
import { getClock } from "../core/round";
import { giveOrDrop } from "../items/inventory";
import { addCoins } from "./coins";
import { say } from "./walkie";

/**
 * The Signal takes the adult bases (GAMEPLAY.md §7; the schedule: shared/economy/baseMarks.ts).
 *
 * - **The broadcast**, partway through every dusk: every screen flares (each client plays it, from
 *   the BROADCAST_ATTRIBUTE on Workspace), and each base due a mark gets one. Its trader says so.
 * - **Turning** ("Something's wrong with us…"): the dusk of its third mark, a garbled call and
 *   `turnSeconds` to get there. Trading stops; a Grab prompt at the counter gives each kid one of every lot
 *   it sells. The trader greys as it goes.
 * - **Fallen:** the trader's gone, infected stand in the base (back every morning), its screens glow
 *   red, and part of every wave sets off from there (the director asks for `nestFrames`).
 * - **"We're under attack!"**: some nights a standing base calls for help and infected gather at its
 *   counter. Bring them all down before dawn: coins for every kid there at the end.
 */

export interface SignalHooks {
	canAct: (player: Player) => boolean;
	notify: (player: Player, text: string) => void;
	notifyAll: (text: string) => void;
	alertAll: (text: string) => void;
	/** Kids still in the run. */
	getKids: () => Player[];
	/** Stands dormant infected at `spots` (they wake when they see a kid); returns them. Yields. */
	spawnGroup: (spots: CFrame[], night: number, leavesAtDawn: boolean) => Model[];
	/** A base's marks or condition changed: tell the walkie and the traders. */
	onChanged: () => void;
}

interface Signal {
	base: Base;
	schedule: MarkSchedule;
	marks: number;
	condition: BaseCondition;
	counter?: BasePart;
	grab?: ProximityPrompt;
	grabbed: Set<Player>;
	/** The infected attacking it tonight, until they're all down. */
	attackers?: Model[];
}

let hooks: SignalHooks | undefined;
const signals = new Map<BaseId, Signal>();
/** Where each nest's infected stand by day (the same frames every morning, so they're refilled). */
const guardSpots: CFrame[] = [];
/** Where each fallen base's share of a wave sets off from. */
const nests: CFrame[] = [];
let broadcasts = 0;
/** Bumped every night, so a call scheduled for an old night doesn't come. */
let nightCount = 0;

const RED = Color3.fromRGB(255, 40, 30);
/** What a turning trader's skin greys to. */
const TURNED_SKIN = Color3.fromRGB(120, 125, 110);

/** How the Signal's treating a base. Kids' bases are always Standing. */
export function signalOf(id: BaseId): { marks?: number; condition: BaseCondition; underAttack: boolean } {
	const signal = signals.get(id);
	if (!signal) {
		return { condition: "Standing", underAttack: false };
	}
	return { marks: signal.marks, condition: signal.condition, underAttack: signal.attackers !== undefined };
}

/** Where every fallen base's nest is: part of each wave sets off from there. */
export function nestFrames(): CFrame[] {
	return nests;
}

/** Where the nests' infected stand by day (the director refills these every morning). */
export function nestGuardSpots(): CFrame[] {
	return guardSpots;
}

/** Whether the base has made contact by now (its trader wouldn't radio before). */
function inContact(base: Base): boolean {
	return getClock().night >= base.opens || gameConfig.openAllBases.Value !== 0;
}

/** In the counter's space: +Z is behind it (where the trader stands), -Z out front. Root height. */
function atCounter(signal: Signal, x: number, z: number): CFrame | undefined {
	return signal.counter?.CFrame.mul(new CFrame(x, 1.5, z));
}

/** The tile (or whatever) the counter's in: what changes when the base falls. */
function buildingOf(signal: Signal): Instance | undefined {
	return signal.counter?.Parent;
}

function traderOf(signal: Signal): Model | undefined {
	const trader = buildingOf(signal)?.FindFirstChild(signal.base.trader);
	return trader?.IsA("Model") ? trader : undefined;
}

/** Its skin greys over `seconds`. */
function greyTrader(signal: Signal, seconds: number) {
	const trader = traderOf(signal);
	const head = trader?.FindFirstChild("Head");
	if (!trader || !head?.IsA("BasePart")) {
		return;
	}
	const skin = head.Color;
	const parts = trader.GetDescendants().filter((p): p is BasePart => p.IsA("BasePart") && p.Color === skin);
	task.spawn(() => {
		const steps = 20;
		for (let i = 1; i <= steps && trader.Parent; i++) {
			task.wait(seconds / steps);
			parts.forEach((p) => (p.Color = skin.Lerp(TURNED_SKIN, i / steps)));
		}
	});
}

function startTurning(signal: Signal) {
	const seconds = gameConfig.turnSeconds.Value;
	signal.condition = "Turning";
	if (signal.grab) {
		signal.grab.Enabled = true;
	}
	say(signal.base.trader, TURNING_LINE);
	hooks?.alertAll(`The ${signal.base.name} is turning! ${seconds} seconds to grab what they've got.`);
	greyTrader(signal, seconds);
	task.delay(seconds, () => fall(signal));
}

/** Grab: one of every lot the base sells, once per kid. */
function onGrab(signal: Signal, player: Player) {
	if (!hooks || !signal.grab || !signal.counter || signal.condition !== "Turning") {
		return;
	}
	if (!hooks.canAct(player) || !inReach(player, signal.grab)) {
		return;
	}
	if (signal.grabbed.has(player)) {
		hooks.notify(player, "You've taken all you can from here.");
		return;
	}
	signal.grabbed.add(player);
	const drop = atCounter(signal, 0, -4)!.Position;
	for (const offer of signal.base.sells) {
		giveOrDrop(player, offer.item, offer.count, drop);
	}
	hooks.notify(player, `You grabbed ${signal.base.sells.map((o) => itemName(o.item).lower()).join(", ")}.`);
}

function fall(signal: Signal) {
	if (signal.condition === "Fallen") {
		return;
	}
	signal.condition = "Fallen";
	signal.marks = MARKS_TO_FALL;
	if (signal.grab) {
		signal.grab.Enabled = false;
	}
	traderOf(signal)?.Destroy();
	const building = buildingOf(signal);
	// Its screens glow red, and a red light hangs over the counter.
	for (const part of building?.GetDescendants() ?? []) {
		if (part.IsA("BasePart") && part.Name === "TV") {
			part.Color = RED;
			part.FindFirstChildOfClass("PointLight")?.Destroy();
		}
	}
	if (signal.counter) {
		const light = new Instance("PointLight");
		light.Color = RED;
		light.Range = 28;
		light.Brightness = 2;
		light.Parent = signal.counter;
	}
	const spots: CFrame[] = [];
	for (let i = 0; i < gameConfig.nestGuards.Value; i++) {
		// Behind the counter, where the trader stood, facing out.
		const spot = atCounter(signal, (i - (gameConfig.nestGuards.Value - 1) / 2) * 3, 3);
		if (spot) {
			spots.push(spot);
			guardSpots.push(spot);
		}
	}
	const nest = atCounter(signal, 0, -8);
	if (nest) {
		nests.push(nest);
	}
	task.spawn(() => hooks?.spawnGroup(spots, getClock().night, false));
	hooks?.notifyAll(`The ${signal.base.name} has gone quiet. It's a nest now.`);
	say(MUM, `Stay away from the ${signal.base.name}. Whatever's there now isn't them.`);
	hooks?.onChanged();
}

/** The dusk broadcast: every screen flares, and each base due a mark gets one. */
export function signalBroadcast(night: number) {
	broadcasts += 1;
	Workspace.SetAttribute(BROADCAST_ATTRIBUTE, broadcasts);
	for (const [, signal] of signals) {
		if (signal.condition !== "Standing" || !markTonight(signal.schedule, night)) {
			continue;
		}
		signal.marks = marksAfter(signal.schedule, night);
		if (signal.marks >= MARKS_TO_FALL) {
			startTurning(signal);
		} else if (inContact(signal.base)) {
			const marks = signal.marks;
			task.delay(5, () => say(signal.base.trader, markLine(marks)));
		}
	}
	hooks?.onChanged();
}

/** The infected gathering at a base's counter, facing it. */
function attackSpots(signal: Signal, count: number): CFrame[] {
	const spots: CFrame[] = [];
	const middle = atCounter(signal, 0, -1);
	for (let i = 0; i < count; i++) {
		const angle = math.rad(-70 + (140 * i) / math.max(1, count - 1));
		const at = atCounter(signal, math.sin(angle) * 6, -1 - math.cos(angle) * 6);
		if (at && middle) {
			spots.push(CFrame.lookAt(at.Position, new Vector3(middle.X, at.Y, middle.Z)));
		}
	}
	return spots;
}

function rewardHelpers(signal: Signal) {
	const counter = signal.counter;
	if (!hooks || !counter) {
		return;
	}
	const reward = gameConfig.attackReward.Value;
	const helpers = hooks.getKids().filter((kid) => {
		const root = rootOf(kid.Character);
		return root !== undefined && root.Position.sub(counter.Position).Magnitude <= gameConfig.attackHelpRange.Value;
	});
	helpers.forEach((kid) => {
		addCoins(kid, reward);
		hooks?.notify(kid, `The ${signal.base.name} pays you ${reward} coins for the help.`);
	});
	say(
		signal.base.trader,
		helpers.size() > 0 ? "They're down! Thank you. We won't forget it." : "They're down. We're OK.",
	);
}

function underAttack(signal: Signal, night: number) {
	const count = gameConfig.attackSize.Value + math.floor(night / 3);
	signal.attackers = [];
	say(signal.base.trader, "We're under attack! Is anyone out there? Please!");
	hooks?.alertAll(`The ${signal.base.name} is under attack! They'll pay if you help, but the house is on its own.`);
	hooks?.onChanged();
	task.spawn(() => {
		const attackers = hooks?.spawnGroup(attackSpots(signal, count), night, true) ?? [];
		if (signal.attackers === undefined) {
			return; // dawn came first
		}
		if (attackers.size() === 0) {
			signal.attackers = undefined; // none could be made: nothing to call about
			hooks?.onChanged();
			return;
		}
		signal.attackers = attackers;
		let left = attackers.size();
		for (const model of attackers) {
			model.FindFirstChildOfClass("Humanoid")?.Died.Connect(() => {
				left -= 1;
				if (left === 0 && signal.attackers === attackers) {
					signal.attackers = undefined;
					rewardHelpers(signal);
					hooks?.onChanged();
				}
			});
		}
	});
}

/** Nightfall: maybe a base calls for help later tonight (one at most). */
export function signalNight(night: number) {
	nightCount += 1;
	const mine = nightCount;
	const at = gameConfig.attackFrom.Value + math.random() * (gameConfig.attackTo.Value - gameConfig.attackFrom.Value);
	task.delay(at * gameConfig.nightSeconds.Value, () => {
		const clock = getClock();
		if (mine !== nightCount || clock.phase !== "Night" || clock.night !== night) {
			return;
		}
		const chances = [
			gameConfig.attackChance0.Value,
			gameConfig.attackChance1.Value,
			gameConfig.attackChance2.Value,
		];
		const candidates: Signal[] = [];
		for (const [, signal] of signals) {
			if (signal.condition === "Standing" && signal.counter && inContact(signal.base)) {
				candidates.push(signal);
			}
		}
		const signal = candidates[math.random(1, math.max(1, candidates.size())) - 1];
		if (signal && underAttackTonight(night, signal.marks, chances, math.random())) {
			underAttack(signal, night);
		}
	});
}

/** Dawn: any attackers still standing leave (the director sends them off), and nobody's paid. */
export function signalDawn() {
	nightCount += 1;
	for (const [, signal] of signals) {
		if (signal.attackers) {
			signal.attackers = undefined;
			say(signal.base.trader, "They've gone. No thanks to anyone.");
			hooks?.onChanged();
		}
	}
}

/** Plans when each adult base falls, and puts a (hidden) Grab prompt on its counter. Call after the map's built. */
export function startSignal(signalHooks: SignalHooks) {
	hooks = signalHooks;
	const random = new Random();
	const override = gameConfig.fallNight.Value;
	for (const base of BASES) {
		if (!base.falls) {
			continue;
		}
		const schedule = planMarks(
			base.falls,
			base.opens,
			() => random.NextNumber(),
			override > 0 ? override : undefined,
		);
		print(`[Signal] The ${base.name} gets its marks on nights ${schedule.join(", ")}.`);
		const signal: Signal = { base, schedule, marks: 0, condition: "Standing", grabbed: new Set() };
		const counter = CollectionService.GetTagged(TRADER_TAG).find(
			(c): c is BasePart =>
				c.IsA("BasePart") && c.IsDescendantOf(Workspace) && c.GetAttribute("Base") === base.id,
		);
		if (counter) {
			signal.counter = counter;
			const grab = makePrompt(promptAnchor(counter, new Vector3(0, 1.5, 0)), "Grab supplies", Enum.KeyCode.E, 1);
			grab.ObjectText = base.name;
			grab.Enabled = false;
			grab.Triggered.Connect((player) => onGrab(signal, player));
			signal.grab = grab;
		} else {
			warn(`[Signal] The map has no counter for the ${base.name}.`);
		}
		signals.set(base.id, signal);
	}
}
