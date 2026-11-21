import { Lighting, Workspace } from "@rbxts/services";
import { findMeshAsset } from "shared/assets";
import { configInt, getServerConfig } from "shared/serverConfig";
import {
	DEFAULT_COUNTDOWN,
	DEFAULT_HIGHEST_PLAYERS,
	DEFAULT_LOWEST_PLAYERS,
	DEFAULT_TIME_BEFORE_EXPIRES,
	LOBBY_CONFIG_NAME,
	STUDIO_LOWEST_PLAYERS,
	LOBBY_FLOOR_SIZE,
	LOBBY_ZONE_COUNT,
	ZONE_PLATFORM_SIZE,
	zoneX,
} from "./config";
import { buildDecor } from "./decor";
import { createZoneDisplay, ZoneDisplay } from "./zoneDisplay";

export interface LobbyZone {
	model: Model;
	zoneContainer: Part;
	display: ZoneDisplay;
}

/** Blood-crimson glow used by the platforms, corner beams and pad glow ring. */
const ZONE_COLOR = new Color3(0.7, 0.04, 0.07);

/**
 * Teleport pad model dimensions, in studs, mirroring tools/blender/assets/teleport_pad.py.
 *
 * The mesh is authored at its final size, and the MeshPart's Size stays at 1,1,1: a
 * MeshPart's Size is a *multiplier* of the mesh's own scale, not an absolute stud size,
 * so anything but 1,1,1 stretches the model. ZONE_PLATFORM_SIZE and these numbers
 * describe the authored mesh and move together if the model is ever rebuilt.
 */
const PAD_HEIGHT = 0.786;
const PAD_GROOVE_OUTER = 8.143;
const PAD_GROOVE_INNER = 5.429;
const PAD_GROOVE_FLOOR_Y = 0.214; // groove floor height above the pad's centre
const GLOW_THICKNESS = 0.079;

/** Where players spawn: on the path, just inside the gate. */
const LOBBY_SPAWN_Z = -(LOBBY_FLOOR_SIZE / 2 - 12);

/** Height of the invisible boundary walls; well above the tallest prop (bell tower ~32). */
const WALL_HEIGHT = 60;

/** Height of the invisible ZonePlus detection box above the pad. */
const ZONE_CONTAINER_HEIGHT = 10;

export interface LobbyWorld {
	configuration: {
		countdown: IntValue;
		lowestPlayers: IntValue;
		highestPlayers: IntValue;
		timeBeforeExpires: IntValue;
	};
	lobbyPos: Part;
	zones: LobbyZone[];
}

function createPart(name: string, size: Vector3, position: Vector3, parent: Instance): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Size = size;
	part.Position = position;
	part.Anchored = true;
	part.Parent = parent;
	return part;
}

/** Non-mesh platform used until the Blender pad has been uploaded. */
function createNeonPlatform(parent: Instance, x: number): Part {
	const platform = createPart(
		"Platform",
		new Vector3(ZONE_PLATFORM_SIZE, PAD_HEIGHT, ZONE_PLATFORM_SIZE),
		new Vector3(x, PAD_HEIGHT / 2, 0),
		parent,
	);
	platform.Material = Enum.Material.Neon;
	platform.Color = ZONE_COLOR;
	return platform;
}

/** Four Neon bars sitting in the pad mesh's groove, so the model glows without a texture. */
function createPadGlowRing(parent: Instance, padCFrame: CFrame): void {
	const band = (PAD_GROOVE_OUTER - PAD_GROOVE_INNER) / 2;
	const mid = (PAD_GROOVE_OUTER + PAD_GROOVE_INNER) / 4;
	const offsetY = PAD_GROOVE_FLOOR_Y + GLOW_THICKNESS / 2;

	const bars: Array<[Vector3, Vector3]> = [
		[new Vector3(PAD_GROOVE_OUTER, GLOW_THICKNESS, band), new Vector3(0, offsetY, mid)],
		[new Vector3(PAD_GROOVE_OUTER, GLOW_THICKNESS, band), new Vector3(0, offsetY, -mid)],
		[new Vector3(band, GLOW_THICKNESS, PAD_GROOVE_INNER), new Vector3(mid, offsetY, 0)],
		[new Vector3(band, GLOW_THICKNESS, PAD_GROOVE_INNER), new Vector3(-mid, offsetY, 0)],
	];

	for (const [size, offset] of bars) {
		const bar = new Instance("Part");
		bar.Name = "GlowRing";
		bar.Size = size;
		bar.CFrame = padCFrame.mul(new CFrame(offset));
		bar.Anchored = true;
		bar.CanCollide = false;
		bar.Material = Enum.Material.Neon;
		bar.Color = ZONE_COLOR;
		bar.Parent = parent;
	}
}

/**
 * The platform players stand on: the Blender pad model once it has a mesh, otherwise
 * a plain neon slab. Both sit *on* the floor — the floor's top is y = 0. The pad's Size
 * stays at 1,1,1 (the mesh is authored at its final size), so the code only positions it,
 * never resizes it: its centre goes at PAD_HEIGHT / 2 so the bottom lands on the floor.
 */
function createZonePlatform(parent: Instance, x: number, padTemplate: MeshPart | undefined): BasePart {
	if (padTemplate === undefined) {
		return createNeonPlatform(parent, x);
	}

	const pad = padTemplate.Clone();
	pad.Name = "Platform";
	pad.CFrame = new CFrame(new Vector3(x, PAD_HEIGHT / 2, 0));
	pad.Parent = parent;

	createPadGlowRing(parent, pad.CFrame);
	return pad;
}

/** Builds the lobby floor and the SpawnLocation that joining players start at. */
function buildFloorAndSpawn(): Part {
	const floor = createPart(
		"LobbyFloor",
		new Vector3(LOBBY_FLOOR_SIZE, 1, LOBBY_FLOOR_SIZE),
		new Vector3(0, -0.5, 0),
		Workspace,
	);
	// Churchyard grass, a muted green that sits with the low-poly kit's palette under moonlight.
	floor.Material = Enum.Material.Grass;
	floor.Color = new Color3(0.27, 0.34, 0.29);
	floor.TopSurface = Enum.SurfaceType.Smooth;
	floor.BottomSurface = Enum.SurfaceType.Smooth;

	// Invisible walls so players can't walk (or jump) off the edge. They must be far taller
	// than anything climbable inside — the fence, trees and chapel roof are all within
	// jumping range of an 8-stud wall.
	const half = LOBBY_FLOOR_SIZE / 2;
	const length = LOBBY_FLOOR_SIZE + 2; // overlap at the corners
	for (const [size, position] of [
		[new Vector3(length, WALL_HEIGHT, 1), new Vector3(0, WALL_HEIGHT / 2, half)],
		[new Vector3(length, WALL_HEIGHT, 1), new Vector3(0, WALL_HEIGHT / 2, -half)],
		[new Vector3(1, WALL_HEIGHT, length), new Vector3(half, WALL_HEIGHT / 2, 0)],
		[new Vector3(1, WALL_HEIGHT, length), new Vector3(-half, WALL_HEIGHT / 2, 0)],
	] as Array<[Vector3, Vector3]>) {
		const wall = createPart("LobbyWall", size, position, Workspace);
		wall.Transparency = 1;
		wall.CastShadow = false;
		wall.CanCollide = true;
	}

	const spawn = new Instance("SpawnLocation");
	spawn.Name = "LobbySpawn";
	// A big flat slab set into the flagstone path just inside the gate (see decor.ts).
	spawn.Size = new Vector3(8, 0.2, 8);
	spawn.Position = new Vector3(0, 0.1, LOBBY_SPAWN_Z);
	spawn.Material = Enum.Material.Slate;
	spawn.Color = new Color3(0.3, 0.29, 0.3);
	spawn.TopSurface = Enum.SurfaceType.Smooth;
	spawn.Anchored = true;
	spawn.Neutral = true;
	spawn.Duration = 0;
	spawn.Parent = Workspace;
	return spawn;
}

/** Server-only lobby tunables in ServerStorage (see config.ts). */
function buildConfiguration(): LobbyWorld["configuration"] {
	const config = getServerConfig(LOBBY_CONFIG_NAME);
	return {
		countdown: configInt(config, "Countdown", DEFAULT_COUNTDOWN),
		lowestPlayers: configInt(config, "LowestPlayer", DEFAULT_LOWEST_PLAYERS, STUDIO_LOWEST_PLAYERS),
		highestPlayers: configInt(config, "HighestPlayer", DEFAULT_HIGHEST_PLAYERS),
		timeBeforeExpires: configInt(config, "TimeBeforeExpires", DEFAULT_TIME_BEFORE_EXPIRES),
	};
}

function buildZone(parent: Instance, index: number, padTemplate: MeshPart | undefined): LobbyZone {
	const x = zoneX(index);

	const model = new Instance("Model");
	model.Name = `TeleportZone${index + 1}`;
	model.Parent = parent;

	// The invisible detection region used by ZonePlus.
	const zoneContainer = createPart(
		"ZoneContainer",
		new Vector3(ZONE_PLATFORM_SIZE, ZONE_CONTAINER_HEIGHT, ZONE_PLATFORM_SIZE),
		new Vector3(x, ZONE_CONTAINER_HEIGHT / 2, 0),
		model,
	);
	zoneContainer.Transparency = 1;
	zoneContainer.CanCollide = false;

	// The visible glowing platform players stand on (Blender model, or a neon slab).
	const platform = createZonePlatform(model, x, padTemplate);

	// Corner beams to mark the zone boundary.
	const half = ZONE_PLATFORM_SIZE / 2;
	for (const corner of [
		new Vector3(half, 4, half),
		new Vector3(half, 4, -half),
		new Vector3(-half, 4, half),
		new Vector3(-half, 4, -half),
	]) {
		const beam = createPart("Beam", new Vector3(0.5, 8, 0.5), new Vector3(x + corner.X, 4, corner.Z), model);
		beam.Material = Enum.Material.Neon;
		beam.Color = ZONE_COLOR;
		beam.Transparency = 0.4;
		beam.CanCollide = false;
	}

	// Billboard showing the player count and state (rendered via react-luau).
	const display = createZoneDisplay(platform, platform);

	// A crimson light above the pad so it reads as a glowing portal, not a dark slab. It sits on
	// an invisible anchor part high above the pad, so it lights the whole circle.
	const lightAnchor = new Instance("Part");
	lightAnchor.Name = "PadLight";
	lightAnchor.Size = new Vector3(0.2, 0.2, 0.2);
	lightAnchor.Position = new Vector3(x, 5, 0);
	lightAnchor.Anchored = true;
	lightAnchor.CanCollide = false;
	lightAnchor.CanQuery = false;
	lightAnchor.CanTouch = false;
	lightAnchor.Transparency = 1;
	lightAnchor.Parent = model;

	const padLight = new Instance("PointLight");
	padLight.Name = "PadGlow";
	padLight.Color = ZONE_COLOR;
	padLight.Brightness = 3;
	padLight.Range = 28;
	padLight.Parent = lightAnchor;

	return {
		model,
		zoneContainer,
		display,
	};
}

/** Night-time lighting with blood-tinted haze for the horror vibe. */
function setupLighting(): void {
	const lighting = Lighting;
	// Synty-style night: a cool blue moonlit ambient, so the warm lanterns and candles and the
	// red ritual glow are the colour accents. At ClockTime 0 there is no sun, so ambient does
	// most of the work — keep it high enough to see by. Tuned live via the Studio MCP.
	lighting.ClockTime = 0;
	lighting.Ambient = new Color3(0.32, 0.35, 0.5);
	lighting.OutdoorAmbient = new Color3(0.34, 0.38, 0.55);
	lighting.Brightness = 1.6;
	lighting.ExposureCompensation = 0.35;
	lighting.EnvironmentDiffuseScale = 1;
	lighting.EnvironmentSpecularScale = 0.5;
	// Fog must stay see-through across the whole floor (LOBBY_FLOOR_SIZE = 120), or the
	// far side fades to black. Deep night blue, so it reads as distance rather than a void.
	lighting.FogColor = new Color3(0.07, 0.09, 0.17);
	lighting.FogStart = 40;
	lighting.FogEnd = 230;
	lighting.GlobalShadows = true;

	const grade = new Instance("ColorCorrectionEffect");
	grade.Name = "SpookyGrade";
	grade.TintColor = new Color3(0.93, 0.96, 1.05);
	grade.Saturation = 0.05;
	grade.Contrast = 0.12;
	grade.Brightness = 0;
	grade.Parent = lighting;

	const bloom = new Instance("BloomEffect");
	bloom.Name = "SpookyBloom";
	bloom.Intensity = 0.5;
	bloom.Size = 24;
	bloom.Threshold = 0.6;
	bloom.Parent = lighting;
}

export function buildLobbyWorld(): LobbyWorld {
	setupLighting();
	const lobbyPos = buildFloorAndSpawn();
	const padTemplate = findMeshAsset("TeleportPad");

	const teleportZones = new Instance("Folder");
	teleportZones.Name = "TeleportZones";
	teleportZones.Parent = Workspace;

	const configuration = buildConfiguration();

	buildDecor(LOBBY_SPAWN_Z);

	const zones: LobbyZone[] = [];
	for (let i = 0; i < LOBBY_ZONE_COUNT; i++) {
		zones.push(buildZone(teleportZones, i, padTemplate));
	}

	return { configuration, lobbyPos, zones };
}
