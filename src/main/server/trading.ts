import { CollectionService } from "@rbxts/services";
import { Base, BASES, BaseId, findBase } from "shared/bases";
import { ItemId } from "shared/inventory";
import { pickWanted, SaleRow, TradeView, tradeView } from "shared/pricing";
import { TRADER_TAG } from "shared/tags";
import { isTrading, parseTradeRequest, saleStatus } from "shared/trade";
import { BaseReport } from "shared/walkie";
import { addCoins, coinsOf, spendCoins } from "./coins";
import { gameConfig } from "./config";
import { giveItem, itemRoom, takeItem } from "./inventory";
import { inReach, makePrompt, promptAnchor } from "./prompts";
import { getClock } from "./round";

/**
 * Trading with the bases (who sells what: shared/bases.ts; prices: shared/pricing.ts; rules:
 * shared/trade.ts). Every morning each base restocks and picks the one thing it wants most. A
 * trader's prompt opens its list on the kid's screen; the client then only says which item, and everything is checked here.
 */

export interface TradingHooks {
	/** Whether `player` may use prompts right now. */
	canAct: (player: Player) => boolean;
	notify: (player: Player, text: string) => void;
	/** Opens a base's list on `player`'s screen. */
	open: (player: Player, view: TradeView) => void;
	/** A base's stock or prices changed: update it for anyone who has it open. */
	update: (view: TradeView) => void;
}

interface Stall {
	wanted?: ItemId;
	stock: Map<ItemId, number>;
	prompt?: ProximityPrompt;
}

let hooks: TradingHooks | undefined;
const stalls: Record<BaseId, Stall> = {
	Treehouse: { stock: new Map() },
	FireStation: { stock: new Map() },
};

function viewOf(base: Base): TradeView {
	const stall = stalls[base.id];
	return tradeView(
		base,
		getClock().night,
		stall.wanted,
		(item) => stall.stock.get(item) ?? 0,
		gameConfig.scarcePriceRise.Value,
		gameConfig.wantMultiplier.Value,
	);
}

function openAll(): boolean {
	return gameConfig.openAllBases.Value !== 0;
}

/** Whether `player` can trade with `base` here and now; tells them if it's closed. */
function canTrade(player: Player, base: Base): boolean {
	const prompt = stalls[base.id].prompt;
	if (!hooks || !prompt || !hooks.canAct(player) || !inReach(player, prompt)) {
		return false;
	}
	const { night, phase } = getClock();
	if (isTrading(base, night, phase === "Night", openAll())) {
		return true;
	}
	const closedTonight = isTrading(base, night, false, openAll());
	hooks.notify(
		player,
		closedTonight ? "Closed until morning." : `The ${base.name} starts trading on Day ${base.opens}.`,
	);
	return false;
}

/** The base and item a client asked for, if they can trade there. */
function checkRequest(player: Player, payload: unknown): { base: Base; item: ItemId } | undefined {
	const request = parseTradeRequest(payload, BASES);
	const base = request && findBase(request.base);
	return request && base && canTrade(player, base) ? { base, item: request.item } : undefined;
}

function whyNot(row: SaleRow, player: Player): string | undefined {
	const status = saleStatus(row, coinsOf(player), itemRoom(player, row.item));
	if (status === "soldOut") {
		return "Sold out until tomorrow.";
	}
	if (status === "noRoom") {
		return "Your pockets are full.";
	}
	return status === "tooExpensive" ? "You can't afford that." : undefined;
}

/** "Buy": `payload` should be a TradeRequest (unknown — validated). */
export function onTradeBuyRequest(player: Player, payload: unknown) {
	const request = checkRequest(player, payload);
	const row = request && viewOf(request.base).sells.find((r) => r.item === request.item);
	if (!request || !row) {
		return;
	}
	const reason = whyNot(row, player);
	if (reason !== undefined) {
		hooks?.notify(player, reason);
		return;
	}
	if (!spendCoins(player, row.price)) {
		return;
	}
	stalls[request.base.id].stock.set(row.item, row.stock - 1);
	giveItem(player, row.item, row.count);
	hooks?.update(viewOf(request.base));
}

/** "Sell": one of an item. `payload` should be a TradeRequest (unknown — validated). */
export function onTradeSellRequest(player: Player, payload: unknown) {
	const request = checkRequest(player, payload);
	const row = request && viewOf(request.base).buys.find((r) => r.item === request.item);
	if (row && takeItem(player, row.item, 1)) {
		addCoins(player, row.price);
	}
}

/** How every base is doing right now, for the walkie. */
export function baseReports(): BaseReport[] {
	const { night, phase } = getClock();
	return BASES.map((base) => {
		const want = viewOf(base).buys.find((row) => row.wanted);
		return {
			name: base.name,
			trader: base.trader,
			where: base.where,
			opens: base.opens,
			hello: base.hello,
			inContact: isTrading(base, night, false, openAll()),
			openNow: isTrading(base, night, phase === "Night", openAll()),
			wanted: want?.item,
			wantedPrice: want?.price ?? 0,
		};
	});
}

/** Morning: every base restocks and picks what it wants. */
export function startTradingDay() {
	for (const base of BASES) {
		const stall = stalls[base.id];
		base.sells.forEach((offer) => stall.stock.set(offer.item, offer.stock));
		stall.wanted = pickWanted(
			base.buys.map((want) => want.item),
			stall.wanted,
			math.random(),
		);
		hooks?.update(viewOf(base));
	}
}

/** Sets up the traders' prompts. Call once, after the bases are built. */
export function startTrading(tradingHooks: TradingHooks) {
	hooks = tradingHooks;
	for (const counter of CollectionService.GetTagged(TRADER_TAG)) {
		const base = BASES.find((b) => b.id === counter.GetAttribute("Base"));
		if (!base || !counter.IsA("BasePart")) {
			warn(`[Trading] ${counter.GetFullName()} isn't a known base's counter.`);
			continue;
		}
		const prompt = makePrompt(promptAnchor(counter, new Vector3(0, 1.5, 0)), "Trade", Enum.KeyCode.E, 0.2);
		prompt.ObjectText = base.trader;
		stalls[base.id].prompt = prompt;
		prompt.Triggered.Connect((player) => {
			if (canTrade(player, base)) {
				tradingHooks.open(player, viewOf(base));
			}
		});
	}
}
