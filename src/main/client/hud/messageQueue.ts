import { ReplicatedStorage, RunService, Workspace } from "@rbxts/services";
import { BarMessage, emptyBar, pushMessage, setTip, stepBar, visibleTip } from "shared/core/messages";
import { RUN_PHASE_ATTRIBUTE } from "shared/run/round";
import { freshMessages } from "shared/economy/walkie";
import { hintStore, noticeStore, Store, walkieOpenStore, walkieStore } from "../core/gameState";

/**
 * Feeds everything that wants to be said (notices, the walkie, Night 1 tips) through the one
 * message bar (rules in shared/core/messages.ts). messageBar.tsx draws the stores here.
 */

export interface BarView {
	message?: BarMessage;
	tip?: string;
}

/** Walkie messages older than this don't pop up (they're in the log), in seconds. */
const WALKIE_MAX_AGE = 30;
/** Seconds between steps. */
const STEP = 0.1;

/** What the bar shows now. */
export const barStore = new Store<BarView>({});
/** The latest reply to something you did. */
export const feedbackStore = new Store<{ text: string; at: number } | undefined>(undefined);

const bar = emptyBar();
let lastWalkie = 0;

function isPlaying(): boolean {
	return ReplicatedStorage.GetAttribute(RUN_PHASE_ATTRIBUTE) === "Playing";
}

function onNotice() {
	const notice = noticeStore.get();
	if (!notice) {
		return;
	}
	if (notice.kind === "Feedback") {
		feedbackStore.set({ text: notice.text, at: os.clock() });
	} else {
		pushMessage(bar, { kind: notice.kind, text: notice.text, at: os.clock() });
	}
}

/** However many arrive together, only the first pops up; the rest are in the log. */
function onWalkie() {
	const { messages } = walkieStore.get();
	const fresh = freshMessages(messages, lastWalkie, Workspace.GetServerTimeNow(), WALKIE_MAX_AGE);
	if (messages.size() > 0) {
		lastWalkie = messages[messages.size() - 1].id;
	}
	if (fresh.size() > 0 && !walkieOpenStore.get()) {
		const { from, text } = fresh[0];
		pushMessage(bar, { kind: "Walkie", from, text, more: fresh.size() - 1, at: os.clock() });
	}
}

function refreshView() {
	const message = bar.showing;
	const tip = visibleTip(bar);
	const shown = barStore.get();
	if (shown.message !== message || shown.tip !== tip) {
		barStore.set({ message, tip });
	}
}

/** Call once, before the server's first messages can arrive. */
export function startMessageQueue() {
	noticeStore.subscribe(onNotice);
	walkieStore.subscribe(onWalkie);
	hintStore.subscribe(() => setTip(bar, hintStore.get()));
	let elapsed = 0;
	RunService.Heartbeat.Connect((dt) => {
		elapsed += dt;
		if (elapsed < STEP) {
			return;
		}
		// Not behind the title card or the end screen.
		if (isPlaying()) {
			stepBar(bar, os.clock(), elapsed);
			refreshView();
		} else if (barStore.get().message || barStore.get().tip !== undefined) {
			barStore.set({});
		}
		elapsed = 0;
	});
}
