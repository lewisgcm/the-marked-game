import { ItemId } from "shared/inventory";

/**
 * The walkie-talkie (GAMEPLAY.md §4): what's said every morning, how each base is doing, and which
 * messages pop up. Pure (only type imports); main/server/walkie.ts keeps the log and sends it.
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
	/** What it still has on order today: what, how many, and the coins it pays for each. */
	wanted?: ItemId;
	wantedCount: number;
	wantedPrice: number;
}

/** A base as the walkie's list shows it. */
export interface BaseStatus {
	name: string;
	status: string;
	detail: string;
	open: boolean;
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

function coins(count: number): string {
	return count === 1 ? "1 coin" : `${count} coins`;
}

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
				text: `We need ${base.wantedCount} ${base.wanted.lower()} today. ${coins(base.wantedPrice)} each.`,
			});
		}
	}
	return lines;
}

/** How a base is doing, for the walkie's list. */
export function baseStatus(base: BaseReport): BaseStatus {
	if (!base.inContact) {
		return { name: base.name, status: "No contact yet", detail: `Trades from Day ${base.opens}`, open: false };
	}
	const want =
		base.wanted !== undefined
			? `. Wants ${base.wantedCount} ${base.wanted.lower()} (${coins(base.wantedPrice)} each)`
			: "";
	return {
		name: base.name,
		status: base.openNow ? "Trading" : "Closed until morning",
		detail: `At ${base.where}${want}`,
		open: base.openNow,
	};
}

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
