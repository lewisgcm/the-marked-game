import { Workspace } from "@rbxts/services";
import {
	BaseReport,
	baseStatus,
	morningReport,
	trimLog,
	WalkieLine,
	WalkieMessage,
	WalkieState,
} from "shared/economy/walkie";
import { gameConfig } from "../core/config";
import { getClock } from "../core/round";

/**
 * The walkie-talkie: one log for the whole party, and how each base is doing (what's said:
 * shared/economy/walkie.ts). Anything in the game can speak over it with `say`.
 */

export interface WalkieHooks {
	/** How every base is doing right now. */
	getReports: () => BaseReport[];
	send: (player: Player, state: WalkieState) => void;
	sendAll: (state: WalkieState) => void;
}

let hooks: WalkieHooks | undefined;
let messages: WalkieMessage[] = [];
let lastId = 0;

function currentState(reports: BaseReport[]): WalkieState {
	return { messages, bases: reports.map(baseStatus) };
}

/** Sends everyone the latest (after a base opens or closes). */
export function refreshWalkie() {
	if (hooks) {
		hooks.sendAll(currentState(hooks.getReports()));
	}
}

/** Re-sends `player` the log (for resync). */
export function resendWalkie(player: Player) {
	if (hooks) {
		hooks.send(player, currentState(hooks.getReports()));
	}
}

function add(line: WalkieLine) {
	lastId += 1;
	messages.push({
		from: line.from,
		text: line.text,
		id: lastId,
		day: getClock().night,
		at: Workspace.GetServerTimeNow(),
	});
	messages = trimLog(messages, gameConfig.walkieLog.Value);
}

/** Someone speaks over the walkie, to everyone. */
export function say(from: string, text: string) {
	add({ from, text });
	refreshWalkie();
}

/** The morning report: Mum, then every base in contact. */
export function sayMorningReport(day: number) {
	if (hooks) {
		morningReport(day, hooks.getReports()).forEach(add);
		refreshWalkie();
	}
}

export function startWalkie(walkieHooks: WalkieHooks) {
	hooks = walkieHooks;
}
