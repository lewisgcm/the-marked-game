import { CollectionService } from "@rbxts/services";
import { Base, BASES, BaseId, findBase } from "shared/bases";
import { ItemId } from "shared/inventory";
import { coinsText, Stall, startStallDay, TradeView, tradeView } from "shared/pricing";
import { TRADER_TAG } from "shared/tags";
import { buyLot, isTrading, parseTradeRequest, SaleStatus, sellItems } from "shared/trade";
import { BaseReport } from "shared/walkie";
import { gameConfig } from "./config";
import { inReach, makePrompt, promptAnchor } from "./prompts";
import { getClock } from "./round";
import { walletOf } from "./wallet";

/**
 * Trading with the bases (who sells what: shared/bases.ts; prices and orders: shared/pricing.ts;
 * buying and selling: shared/trade.ts). Every morning each base restocks and places an order for
 * something it wants. A trader's prompt opens its list on the kid's screen; the client then only
 * says which item, and everything is checked here.
 */

export interface TradingHooks {
	/** Whether `player` may use prompts right now. */
	canAct: (player: Player) => boolean;
	notify: (player: Player, text: string) => void;
	/** Opens a base's list on `player`'s screen. */
	open: (player: Player, view: TradeView) => void;
	/** A base's stock or prices changed: update it for anyone who has it open. */
	update: (view: TradeView) => void;
	/** How much of an order is left changed. */
	onOrderChanged: () => void;
}

let hooks: TradingHooks | undefined;
const stalls = new Map<BaseId, Stall>();
const prompts = new Map<BaseId, ProximityPrompt>();

function stallOf(base: Base): Stall {
	let stall = stalls.get(base.id);
	if (!stall) {
		stall = { stock: new Map() };
		stalls.set(base.id, stall);
	}
	return stall;
}

function openAll(): boolean {
	return gameConfig.openAllBases.Value !== 0;
}

function isOpenNow(base: Base): boolean {
	const { night, phase } = getClock();
	return isTrading(base, night, phase === "Night", openAll());
}

/** Whether a base trades today, though maybe not right now. */
function isInContact(base: Base): boolean {
	return isTrading(base, getClock().night, false, openAll());
}

function viewOf(base: Base): TradeView {
	return tradeView(
		base,
		getClock().night,
		isOpenNow(base),
		stallOf(base),
		gameConfig.scarcePriceRise.Value,
		gameConfig.wantMultiplier.Value,
	);
}

/** Whether `player` can trade with `base` here and now; tells them if it's closed. */
function canTrade(player: Player, base: Base): boolean {
	const prompt = prompts.get(base.id);
	if (!hooks || !prompt || !hooks.canAct(player) || !inReach(player, prompt)) {
		return false;
	}
	if (isOpenNow(base)) {
		return true;
	}
	hooks.notify(
		player,
		isInContact(base) ? "Closed until morning." : `The ${base.name} starts trading on Day ${base.opens}.`,
	);
	return false;
}

/** The base and item a client asked for, if they can trade there. */
function checkRequest(player: Player, payload: unknown): { base: Base; item: ItemId } | undefined {
	const request = parseTradeRequest(payload, BASES);
	const base = request && findBase(request.base);
	return request && base && canTrade(player, base) ? { base, item: request.item } : undefined;
}

const REFUSAL: Record<SaleStatus, string | undefined> = {
	ok: undefined,
	soldOut: "Sold out until tomorrow.",
	tooExpensive: "You can't afford that.",
	noRoom: "Your pockets are full.",
};

/** "Buy": `payload` should be a TradeRequest (unknown — validated). */
export function onTradeBuyRequest(player: Player, payload: unknown) {
	const request = checkRequest(player, payload);
	const row = request && viewOf(request.base).sells.find((r) => r.item === request.item);
	if (!request || !row) {
		return;
	}
	const refusal = REFUSAL[buyLot(row, stallOf(request.base), walletOf(player))];
	if (refusal !== undefined) {
		hooks?.notify(player, refusal);
	} else {
		hooks?.update(viewOf(request.base));
	}
}

/** "Sell": `payload` should be a TradeRequest (unknown — validated). */
export function onTradeSellRequest(player: Player, payload: unknown) {
	const request = checkRequest(player, payload);
	const row = request && viewOf(request.base).buys.find((r) => r.item === request.item);
	if (request && row && sellItems(row, stallOf(request.base), walletOf(player)) > 0 && row.wanted > 0) {
		hooks?.update(viewOf(request.base));
		hooks?.onOrderChanged();
	}
}

/** How every base is doing right now, for the walkie. */
export function baseReports(): BaseReport[] {
	return BASES.map((base) => {
		const order = viewOf(base).buys.find((row) => row.wanted > 0);
		return {
			name: base.name,
			trader: base.trader,
			where: base.where,
			opens: base.opens,
			hello: base.hello,
			inContact: isInContact(base),
			openNow: isOpenNow(base),
			wanted: order?.item,
			wantedCount: order?.wanted ?? 0,
			wantedPrice: coinsText(order?.orderPrice ?? 0),
		};
	});
}

/** What the bases in contact have on order. */
export function itemsOnOrder(): ItemId[] {
	const items: ItemId[] = [];
	for (const report of baseReports()) {
		if (report.inContact && report.wanted !== undefined) {
			items.push(report.wanted);
		}
	}
	return items;
}

/** Morning: every base restocks and places an order, each for something different. */
export function startTradingDay() {
	const taken: ItemId[] = [];
	for (const base of BASES) {
		const stall = stallOf(base);
		startStallDay(stall, base, taken, gameConfig.orderFewest.Value, gameConfig.orderMost.Value, () =>
			math.random(),
		);
		if (stall.order) {
			taken.push(stall.order.item);
		}
	}
}

/** Updates every base's list for anyone who has it open (bases open, close and restock). */
export function refreshTrading() {
	BASES.forEach((base) => hooks?.update(viewOf(base)));
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
		const prompt = makePrompt(
			promptAnchor(counter, new Vector3(0, 1.5, 0)),
			"Trade",
			Enum.KeyCode.E,
			gameConfig.holdQuick.Value,
		);
		prompt.ObjectText = base.trader;
		prompts.set(base.id, prompt);
		prompt.Triggered.Connect((player) => {
			if (canTrade(player, base)) {
				tradingHooks.open(player, viewOf(base));
			}
		});
	}
}
