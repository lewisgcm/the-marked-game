import { ItemId } from "shared/items/inventory";
import type { BaseId } from "./bases";

/** How an adult base is holding up against the Signal (economy/signal.ts). Kids' bases are always Standing. */
export type BaseCondition = "Standing" | "Turning" | "Fallen";

/**
 * The walkie-talkie (GAMEPLAY.md §4): what's said every morning, how each base is doing, and which
 * messages pop up. Pure (only type imports); main/server/economy/walkie.ts keeps the log and sends it.
 */

export interface WalkieLine {
	from: string;
	text: string;
}

export interface WalkieMessage extends WalkieLine {
	/** Counts up from 1. */
	id: number;
	day: number;
	/** Server time it was sent. */
	at: number;
}

/** What the walkie knows about a base. */
export interface BaseReport {
	id: BaseId;
	name: string;
	trader: string;
	/** Where it is, e.g. "the left end of Maple Street". */
	where: string;
	/** The first day it trades. */
	opens: number;
	/** What it says the morning it opens. */
	hello: string;
	/** Whether it's made contact: it trades today, though maybe not right now. */
	inContact: boolean;
	openNow: boolean;
	/** What it still has on order today: what, how many, and what it pays for each ("6 coins"). */
	wanted?: ItemId;
	wantedCount: number;
	wantedPrice: string;
	/** An adult base's marks (0-3); undefined for kids' bases, which never turn. */
	marks?: number;
	condition: BaseCondition;
	/** It's calling for help: "We're under attack!" */
	underAttack: boolean;
}

/** A base as the walkie's list (and the wall map) shows it. */
export interface BaseStatus {
	id: BaseId;
	name: string;
	status: string;
	detail: string;
	open: boolean;
	/** An adult base's marks, for its meter. */
	marks?: number;
	condition: BaseCondition;
	/** Something's happening there now (turning, or under attack): shown in red. */
	alarm: boolean;
}

export interface WalkieState {
	/** Oldest first. */
	messages: WalkieMessage[];
	bases: BaseStatus[];
}

export const MUM = "Mum";
export const SUNDOWN = "The sun's going down. Get home.";

/** What Mum says on the morning of each day. Other days she's quiet. */
const MUM_LINES: Record<number, string | undefined> = {
	[1]: "I locked him out. I'm at the church. Board up the house before dark.",
	[2]: "You made it! Listen: don't let any grown-up near a screen. Three times and they're gone.",
	[3]: "They'll come harder every night now. Keep those planks up.",
};

/** Everything said on the morning of `day`, in order. */
export function morningReport(day: number, reports: BaseReport[]): WalkieLine[] {
	const lines: WalkieLine[] = [];
	const mum = MUM_LINES[day];
	if (mum !== undefined) {
		lines.push({ from: MUM, text: mum });
	}
	for (const base of reports) {
		if (!base.inContact) {
			continue;
		}
		if (base.opens === day) {
			lines.push({ from: base.trader, text: base.hello });
		}
		if (base.wanted !== undefined) {
			lines.push({
				from: base.trader,
				text: `We need ${base.wantedCount} ${base.wanted.lower()} today. ${base.wantedPrice} each.`,
			});
		}
	}
	return lines;
}

/** How a base is doing, for the walkie's list. */
export function baseStatus(base: BaseReport): BaseStatus {
	// Kids only know how a base is doing once they've met it.
	const known = base.inContact || base.condition !== "Standing";
	const status = (text: string, detail: string, open = false, alarm = false): BaseStatus => ({
		id: base.id,
		name: base.name,
		status: text,
		detail,
		open,
		marks: known ? base.marks : undefined,
		condition: base.condition,
		alarm,
	});
	if (base.condition === "Fallen") {
		return status("Gone", `The Signal took them. It's a nest now, at ${base.where}: keep away.`);
	}
	if (base.condition === "Turning") {
		return status("TURNING", `At ${base.where}. Grab what you can before they change!`, false, true);
	}
	if (base.underAttack) {
		return status("UNDER ATTACK", `At ${base.where}. They need help: coins for anyone who comes.`, false, true);
	}
	if (!base.inContact) {
		return status("No contact yet", `Trades from Day ${base.opens}`);
	}
	const want =
		base.wanted !== undefined
			? `. Wants ${base.wantedCount} ${base.wanted.lower()} (${base.wantedPrice} each)`
			: "";
	return status(base.openNow ? "Trading" : "Closed until morning", `At ${base.where}${want}`, base.openNow);
}

/** What an adult base's trader says after a broadcast gives it a mark (1 or 2; the third is the turning). */
export function markLine(marks: number): string {
	return marks <= 1
		? "That broadcast gave everyone here a headache. We're fine. We're fine."
		: "We're... not feeling right. If you need anything from us, come soon.";
}

/** The garbled call the dusk a base turns. */
export const TURNING_LINE = "S-something's wrong with us... the screens... come quick, take what you can, b-before...";

/** The newest `most` messages. */
export function trimLog(messages: WalkieMessage[], most: number): WalkieMessage[] {
	const from = math.max(0, messages.size() - most);
	return messages.filter((_, i) => i >= from);
}

/** Messages that should still pop up: newer than the last one shown, and not old news. */
export function freshMessages(
	messages: WalkieMessage[],
	lastShown: number,
	now: number,
	maxAge: number,
): WalkieMessage[] {
	return messages.filter((m) => m.id > lastShown && now - m.at <= maxAge);
}

/** How many messages are newer than the last one read. */
export function unreadCount(messages: WalkieMessage[], lastRead: number): number {
	return messages.filter((m) => m.id > lastRead).size();
}
