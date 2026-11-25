import { Players } from "@rbxts/services";
import { chooseHint, HintSituation } from "shared/run/hints";

/**
 * Sends each kid their Night 1 tip (rules in shared/run/hints.ts) whenever it changes.
 */

export interface HintHooks {
	/** Kids who should see tips (still in, during play). */
	getKids: () => Player[];
	/** The kid's situation right now. */
	situation: (player: Player) => HintSituation;
	/** Shows a tip; "" clears it. */
	sendHint: (player: Player, text: string) => void;
}

const CHECK_SECONDS = 0.5;

let hooks: HintHooks | undefined;
const showing = new Map<Player, string>();
Players.PlayerRemoving.Connect((player) => showing.delete(player));

function show(player: Player, text: string) {
	if ((showing.get(player) ?? "") !== text) {
		showing.set(player, text);
		hooks?.sendHint(player, text);
	}
}

/** Re-sends `player` their current tip (for resync). */
export function resendHint(player: Player) {
	hooks?.sendHint(player, showing.get(player) ?? "");
}

export function startHints(hintHooks: HintHooks) {
	hooks = hintHooks;
	task.spawn(() => {
		while (true) {
			const kids = hintHooks.getKids();
			for (const player of Players.GetPlayers()) {
				show(player, kids.includes(player) ? (chooseHint(hintHooks.situation(player)) ?? "") : "");
			}
			task.wait(CHECK_SECONDS);
		}
	});
}
