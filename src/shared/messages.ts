/**
 * What the one message bar shows (client/messageBar.tsx): one thing at a time, danger first. Pure
 * so it's unit-tested; client/messageQueue.ts feeds it and steps it.
 */

/** What the server can send as a notice. */
export type NoticeKind = "Danger" | "Info" | "Feedback";

export interface Notice {
	text: string;
	/** Danger and Info go in the bar; Feedback is a reply to what you just did, shown on its own line. */
	kind: NoticeKind;
}

export type BarKind = "Danger" | "Walkie" | "Info";

export interface BarMessage {
	kind: BarKind;
	text: string;
	/** Who's speaking (the walkie). */
	from?: string;
	/** How many more arrived with it (they're in the walkie's log). */
	more?: number;
	/** When it arrived. */
	at: number;
}

export interface Bar {
	showing?: BarMessage;
	/** When `showing` started. */
	since: number;
	queue: BarMessage[];
	/** The last message to finish, and when. */
	last?: { text: string; at: number };
	tip: string;
	/** Seconds the tip still has to be seen for. */
	tipLeft: number;
}

/** Seconds each kind shows for. */
export const SHOW_SECONDS: Record<BarKind, number> = { Danger: 4, Walkie: 6, Info: 3 };
/** Seconds each kind can wait its turn; after that it's old news. */
export const WAIT_SECONDS: Record<BarKind, number> = { Danger: math.huge, Walkie: 30, Info: 10 };
/** Seconds a new tip is seen for. */
export const TIP_SECONDS = 8;
/** The same text again within this many seconds is ignored. */
export const REPEAT_SECONDS = 5;

/** Who goes first. */
const ORDER: BarKind[] = ["Danger", "Walkie", "Info"];

export function emptyBar(): Bar {
	return { since: 0, queue: [], tip: "", tipLeft: 0 };
}

/** Adds a message, unless the same thing is showing, waiting, or only just went. */
export function pushMessage(bar: Bar, message: BarMessage) {
	const same = (m: BarMessage | undefined) => m !== undefined && m.text === message.text;
	const justWent =
		bar.last !== undefined && bar.last.text === message.text && message.at - bar.last.at < REPEAT_SECONDS;
	if (!same(bar.showing) && !bar.queue.some(same) && !justWent) {
		bar.queue.push(message);
	}
}

/** The current tip ("" for none). A new one gets its full time. */
export function setTip(bar: Bar, tip: string) {
	if (bar.tip !== tip) {
		bar.tip = tip;
		bar.tipLeft = TIP_SECONDS;
	}
}

function takeNext(bar: Bar): BarMessage | undefined {
	for (const kind of ORDER) {
		const i = bar.queue.findIndex((m) => m.kind === kind);
		if (i >= 0) {
			return bar.queue.remove(i);
		}
	}
	return undefined;
}

/** Danger takes over from anything else. A cut-off walkie message gets another turn. */
function interrupt(bar: Bar) {
	const showing = bar.showing;
	if (showing && showing.kind !== "Danger" && bar.queue.some((m) => m.kind === "Danger")) {
		bar.showing = undefined;
		if (showing.kind === "Walkie") {
			bar.queue.push(showing);
		}
	}
}

/** Moves the bar on to `now`, `dt` seconds since the last step. */
export function stepBar(bar: Bar, now: number, dt: number) {
	if (bar.showing && now - bar.since >= SHOW_SECONDS[bar.showing.kind]) {
		bar.last = { text: bar.showing.text, at: now };
		bar.showing = undefined;
	}
	bar.queue = bar.queue.filter((m) => now - m.at <= WAIT_SECONDS[m.kind]);
	interrupt(bar);
	if (!bar.showing) {
		bar.showing = takeNext(bar);
		bar.since = now;
	}
	if (!bar.showing) {
		bar.tipLeft = math.max(0, bar.tipLeft - dt);
	}
}

/** The tip, while it should be seen: only when nothing else is showing. */
export function visibleTip(bar: Bar): string | undefined {
	return bar.showing === undefined && bar.tip !== "" && bar.tipLeft > 0 ? bar.tip : undefined;
}
