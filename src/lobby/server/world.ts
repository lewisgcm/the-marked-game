import { CollectionService, Lighting, Workspace } from "@rbxts/services";
import { configInt, getServerConfig } from "shared/core/serverConfig";
import {
	DEFAULT_COUNTDOWN,
	DEFAULT_HIGHEST_PLAYERS,
	DEFAULT_LOWEST_PLAYERS,
	DEFAULT_TIME_BEFORE_EXPIRES,
	LOBBY_CONFIG_NAME,
	ZONE_PLATFORM_SIZE,
} from "./config";
import { createZoneDisplay, ZoneDisplay } from "./zoneDisplay";

/**
 * The lobby around the hall: the gym hall itself is a model Rojo puts in Workspace (`Hall`, built from
 * tools/tiles/lobby/Hall.ts, so it shows in Studio without playing). This puts a party zone at each of
 * its pick-up pads (`LobbyPad` markers, sorted by `Order`), and sets the light.
 */

export interface LobbyZone {
	model: Model;
	zoneContainer: Part;
	display: ZoneDisplay;
}

/** Height of the invisible ZonePlus detection box above the pad. */
const ZONE_CONTAINER_HEIGHT = 10;

const PAD_TAG = "LobbyPad";

export interface LobbyWorld {
	configuration: {
		countdown: IntValue;
		lowestPlayers: IntValue;
		highestPlayers: IntValue;
		timeBeforeExpires: IntValue;
	};
	zones: LobbyZone[];
}

/** The hall's pad markers, in order, then removed: where each pad's middle is, on the floor. */
function takePads(hall: Instance): CFrame[] {
	const found: Array<{ at: CFrame; order: number }> = [];
	for (const marker of CollectionService.GetTagged(PAD_TAG)) {
		if (marker.IsA("BasePart") && marker.IsDescendantOf(hall)) {
			const floor = marker.CFrame.mul(new CFrame(0, -marker.Size.Y / 2, 0));
			found.push({ at: floor, order: tonumber(marker.GetAttribute("Order")) ?? math.huge });
			marker.Destroy();
		}
	}
	found.sort((a, b) => a.order < b.order);
	return found.map((f) => f.at);
}

/** An invisible, non-colliding part. */
function hiddenPart(name: string, size: Vector3, at: CFrame, parent: Instance): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Size = size;
	part.CFrame = at;
	part.Anchored = true;
	part.CanCollide = false;
	part.CanQuery = false;
	part.CanTouch = false;
	part.Transparency = 1;
	part.Parent = parent;
	return part;
}

function buildZone(parent: Instance, index: number, pad: CFrame): LobbyZone {
	const model = new Instance("Model");
	model.Name = `TeleportZone${index + 1}`;
	model.Parent = parent;
	// The invisible box ZonePlus watches.
	const zoneContainer = hiddenPart(
		"ZoneContainer",
		new Vector3(ZONE_PLATFORM_SIZE, ZONE_CONTAINER_HEIGHT, ZONE_PLATFORM_SIZE),
		pad.mul(new CFrame(0, ZONE_CONTAINER_HEIGHT / 2, 0)),
		model,
	);
	// ZonePlus needs the box to be queryable.
	zoneContainer.CanQuery = true;
	// The billboard floats above this (zoneDisplay.tsx: StudsOffset).
	const anchor = hiddenPart("DisplayAnchor", new Vector3(0.2, 0.2, 0.2), pad, model);
	return { model, zoneContainer, display: createZoneDisplay(anchor, anchor) };
}

/** Server-only lobby tunables in ServerStorage (see config.ts). */
function buildConfiguration(): LobbyWorld["configuration"] {
	const config = getServerConfig(LOBBY_CONFIG_NAME);
	return {
		countdown: configInt(config, "Countdown", DEFAULT_COUNTDOWN),
		lowestPlayers: configInt(config, "LowestPlayer", DEFAULT_LOWEST_PLAYERS),
		highestPlayers: configInt(config, "HighestPlayer", DEFAULT_HIGHEST_PLAYERS),
		timeBeforeExpires: configInt(config, "TimeBeforeExpires", DEFAULT_TIME_BEFORE_EXPIRES),
	};
}

/** Late afternoon after the last bell: a low warm sun through the high windows, strip lights inside. */
function setupLighting() {
	Lighting.ClockTime = 17.3;
	Lighting.GeographicLatitude = 52;
	Lighting.Brightness = 2.2;
	Lighting.Ambient = new Color3(0.42, 0.4, 0.38);
	Lighting.OutdoorAmbient = new Color3(0.55, 0.5, 0.45);
	Lighting.ExposureCompensation = 0.1;
	Lighting.EnvironmentDiffuseScale = 0.6;
	Lighting.EnvironmentSpecularScale = 0.3;
	Lighting.FogColor = new Color3(0.85, 0.72, 0.55);
	Lighting.FogStart = 150;
	Lighting.FogEnd = 600;
	Lighting.GlobalShadows = true;

	const grade = new Instance("ColorCorrectionEffect");
	grade.Name = "AfternoonGrade";
	grade.TintColor = new Color3(1.04, 0.99, 0.92);
	grade.Saturation = -0.05;
	grade.Contrast = 0.08;
	grade.Parent = Lighting;

	const bloom = new Instance("BloomEffect");
	bloom.Name = "Bloom";
	bloom.Intensity = 0.35;
	bloom.Size = 24;
	bloom.Threshold = 0.85;
	bloom.Parent = Lighting;
}

export function buildLobbyWorld(): LobbyWorld {
	setupLighting();
	const hall = Workspace.WaitForChild("Hall");
	const teleportZones = new Instance("Folder");
	teleportZones.Name = "TeleportZones";
	teleportZones.Parent = Workspace;
	const pads = takePads(hall);
	if (pads.size() === 0) {
		warn("[Lobby] The hall has no LobbyPad markers: run `npm run tiles:build`, then sync again.");
	}
	return { configuration: buildConfiguration(), zones: pads.map((pad, i) => buildZone(teleportZones, i, pad)) };
}
