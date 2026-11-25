import { gameConfig } from "../core/config";
import { buildBases, staffTiledBases } from "./bases";
import { buildNeighbourhood, Neighbourhood } from "./neighbourhood";
import { buildTiledMap, pickSeed } from "./tiledMap";
import { buildMainWorld, MainWorld } from "./world";

/**
 * Builds the whole map: the family house, and around it either the tiled map (MAP.md) or the old
 * one built in code, as `UseTiledMap` says.
 */
export function buildMap(): { world: MainWorld; street: Neighbourhood } {
	if (gameConfig.useTiledMap.Value === 1) {
		const tiled = buildTiledMap(pickSeed(gameConfig.mapSeed.Value));
		const world = buildMainWorld({ infectedSpawns: tiled.infectedSpawns });
		staffTiledBases(tiled.map);
		return { world, street: tiled };
	}
	const world = buildMainWorld();
	const street = buildNeighbourhood();
	buildBases();
	return { world, street };
}
