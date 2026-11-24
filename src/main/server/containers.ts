import { CollectionService } from "@rbxts/services";
import { rootOf } from "shared/characters";
import { ItemId } from "shared/inventory";
import { ContainerKind, describeLoot, Loot, pickSome, rollLoot, rollRestock } from "shared/loot";
import { LOOT_CONTAINER_TAG, STONES_TAG } from "shared/tags";
import { addCoins } from "./coins";
import { gameConfig } from "./config";
import { giveItem, giveOrDrop } from "./inventory";
import { inReach, makePrompt, promptAnchor } from "./prompts";

/**
 * Searching the street for supplies (tables in shared/loot.ts). What's in a container is decided
 * when it's searched, and then it's empty for the run, except that every morning a few get something
 * the bases have on order. Garden stones come back every dawn. Searching makes a little noise.
 */

export interface ContainerHooks {
	/** Whether `player` may use prompts right now. */
	canAct: (player: Player) => boolean;
	notify: (player: Player, text: string) => void;
	getNight: () => number;
	/** Something made a noise here (wakes dormant infected nearby). */
	makeNoise: (position: Vector3, radius: number) => void;
}

const SEARCHED = new Color3(0.28, 0.27, 0.26);
const stonePrompts: ProximityPrompt[] = [];

interface Container {
	searched: boolean;
	/** What was put in since it was searched. */
	stash?: Loot;
	/** Makes it searchable again. */
	reopen: () => void;
}

const containers: Container[] = [];

function setUpContainer(box: BasePart, hooks: ContainerHooks) {
	const kind = box.GetAttribute("Kind") as ContainerKind;
	const prompt = makePrompt(
		promptAnchor(box, new Vector3(0, box.Size.Y / 2, 0)),
		"Search",
		Enum.KeyCode.E,
		gameConfig.searchSeconds.Value,
	);
	prompt.ObjectText = box.Name;
	const color = box.Color;
	const container: Container = {
		searched: false,
		reopen: () => {
			container.searched = false;
			prompt.Enabled = true;
			box.Color = color;
		},
	};
	containers.push(container);
	prompt.Triggered.Connect((player) => {
		if (container.searched || !hooks.canAct(player) || !inReach(player, prompt)) {
			return;
		}
		container.searched = true;
		prompt.Enabled = false;
		box.Color = SEARCHED;
		hooks.makeNoise(box.Position, gameConfig.searchNoise.Value);
		const finds = container.stash ? [container.stash] : rollLoot(kind, hooks.getNight(), () => math.random());
		container.stash = undefined;
		const spot = rootOf(player.Character)?.Position ?? box.Position;
		for (const find of finds) {
			if (find.item === "Coins") {
				addCoins(player, find.count);
			} else {
				giveOrDrop(player, find.item, find.count, spot);
			}
		}
		hooks.notify(player, describeLoot(finds));
	});
}

function setUpStones(patch: BasePart, hooks: ContainerHooks) {
	const prompt = makePrompt(promptAnchor(patch, new Vector3(0, 1, 0)), "Gather stones", Enum.KeyCode.E, 0.6);
	stonePrompts.push(prompt);
	prompt.Triggered.Connect((player) => {
		if (!hooks.canAct(player) || !inReach(player, prompt)) {
			return;
		}
		if (giveItem(player, "Stones", gameConfig.stonesPerPatch.Value) === 0) {
			hooks.notify(player, "Your pockets are full.");
			return;
		}
		prompt.Enabled = false; // until dawn
	});
}

/** Morning: a few searched containers get something from `items` (what the bases have on order). */
export function restockContainers(items: ItemId[]) {
	const random = () => math.random();
	const empty = containers.filter((c) => c.searched);
	const chosen = pickSome(empty, gameConfig.restockContainers.Value, random);
	rollRestock(items, chosen.size(), gameConfig.restockMost.Value, random).forEach((find, i) => {
		chosen[i].stash = find;
		chosen[i].reopen();
	});
}

/** Dawn: the gardens have stones again. */
export function refillGardens() {
	stonePrompts.forEach((prompt) => (prompt.Enabled = true));
}

/** Sets up everything searchable. Call once, after the neighbourhood is built. */
export function startContainers(hooks: ContainerHooks) {
	for (const box of CollectionService.GetTagged(LOOT_CONTAINER_TAG)) {
		if (box.IsA("BasePart")) {
			setUpContainer(box, hooks);
		}
	}
	for (const patch of CollectionService.GetTagged(STONES_TAG)) {
		if (patch.IsA("BasePart")) {
			setUpStones(patch, hooks);
		}
	}
}
