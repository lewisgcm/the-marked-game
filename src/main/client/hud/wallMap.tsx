import React from "@rbxts/react";
import { CollectionService, Players, ProximityPromptService, RunService } from "@rbxts/services";
import { rootOf } from "shared/core/characters";
import { HELD_AT_ATTRIBUTE } from "shared/combat/combat";
import { MAP_TILE_TAG, TRADER_TAG, WALL_MAP_TAG } from "shared/core/tags";
import { markMeter } from "shared/economy/baseMarks";
import { BaseStatus } from "shared/economy/walkie";
import { TILE_SIZE } from "shared/world/layout";
import { Edges, Ground, parseEdge, Side, turnEdges } from "shared/world/tiles";
import { MapBounds, mapBounds, MapTile, routesOut, tileGround, toMap } from "shared/world/wallMap";
import { upgradesStore, useStore, walkieStore } from "../core/gameState";
import { Panel } from "../core/panel";
import { useViewport } from "../core/useViewport";
import { GOLD, GREEN } from "../core/theme";

/**
 * The neighbourhood map (a workbench upgrade): pinned to the cork board in the hall, and full screen from
 * its prompt (house/wallMap.ts on the server). It draws the run's tiles and roads, each base with its mark
 * meter (red and pulsing while it's turning or calling for help, a cross once it's a nest), and every kid
 * as a dot. Never the infected: the dark stays dark.
 */

const PAPER = Color3.fromRGB(236, 226, 200);
const INK = Color3.fromRGB(60, 48, 40);
const ROAD = Color3.fromRGB(120, 112, 104);
const PATH = Color3.fromRGB(150, 118, 80);
const ALARM = Color3.fromRGB(205, 40, 30);
const GROUND_COLOUR: Record<Ground, Color3> = {
	Town: Color3.fromRGB(214, 200, 172),
	Grass: Color3.fromRGB(176, 196, 140),
	Forest: Color3.fromRGB(118, 150, 104),
	Swamp: Color3.fromRGB(140, 150, 112),
};
/** Each side's midpoint, from a tile's middle, as fractions of the tile. */
const SIDE_OFFSET: Record<Side, [number, number]> = {
	North: [0, -0.5],
	East: [0.5, 0],
	South: [0, 0.5],
	West: [-0.5, 0],
};
const PROMPT_NAME = "WallMapPrompt";

/** The run's tiles, read from the map's models (they don't change once it's built). */
function readTiles(): MapTile[] {
	const tiles: MapTile[] = [];
	for (const model of CollectionService.GetTagged(MAP_TILE_TAG)) {
		if (!model.IsA("Model")) {
			continue;
		}
		const edge = (side: Side) => (model.GetAttribute(side) as string | undefined) ?? "";
		const original: Edges = { North: edge("North"), East: edge("East"), South: edge("South"), West: edge("West") };
		const turned = turnEdges(original, (model.GetAttribute("Turns") as number | undefined) ?? 0);
		const pivot = model.GetPivot().Position;
		tiles.push({
			name: model.Name,
			x: pivot.X,
			z: pivot.Z,
			sides: {
				North: parseEdge(turned.North),
				East: parseEdge(turned.East),
				South: parseEdge(turned.South),
				West: parseEdge(turned.West),
			},
		});
	}
	return tiles;
}

function useTiles(): MapTile[] {
	const [tiles, setTiles] = React.useState(readTiles);
	React.useEffect(() => {
		const connection = CollectionService.GetInstanceAddedSignal(MAP_TILE_TAG).Connect(() => setTiles(readTiles()));
		return () => connection.Disconnect();
	}, []);
	return tiles;
}

interface KidDot {
	userId: number;
	name: string;
	me: boolean;
	/** Taken, and held at a nest. */
	held: boolean;
	x: number;
	z: number;
}

/** Every kid's position (or the nest they're held at), a few times a second. */
function useKids(): KidDot[] {
	const read = () => {
		const kids: KidDot[] = [];
		for (const player of Players.GetPlayers()) {
			const me = player === Players.LocalPlayer;
			const heldAt = player.GetAttribute(HELD_AT_ATTRIBUTE);
			const root = rootOf(player.Character);
			if (typeIs(heldAt, "Vector3")) {
				kids.push({
					userId: player.UserId,
					name: player.DisplayName,
					me,
					held: true,
					x: heldAt.X,
					z: heldAt.Z,
				});
			} else if (root) {
				kids.push({
					userId: player.UserId,
					name: player.DisplayName,
					me,
					held: false,
					x: root.Position.X,
					z: root.Position.Z,
				});
			}
		}
		return kids;
	};
	const [kids, setKids] = React.useState(read);
	React.useEffect(() => {
		let last = 0;
		const connection = RunService.Heartbeat.Connect(() => {
			if (os.clock() - last > 0.25) {
				last = os.clock();
				setKids(read());
			}
		});
		return () => connection.Disconnect();
	}, []);
	return kids;
}

/** On while something's happening at a base: the alarm pulses. */
function usePulse(): boolean {
	const [on, setOn] = React.useState(true);
	React.useEffect(() => {
		let alive = true;
		task.spawn(() => {
			while (alive) {
				task.wait(0.5);
				setOn((was) => !was);
			}
		});
		return () => {
			alive = false;
		};
	}, []);
	return on;
}

function counterOf(base: BaseStatus): Vector3 | undefined {
	const counter = CollectionService.GetTagged(TRADER_TAG).find(
		(c): c is BasePart => c.IsA("BasePart") && c.GetAttribute("Base") === base.id,
	);
	return counter?.Position;
}

function at(bounds: MapBounds, x: number, z: number): UDim2 {
	const { u, v } = toMap(bounds, x, z);
	return new UDim2(u, 0, v, 0);
}

function Tile({ tile, bounds }: { tile: MapTile; bounds: MapBounds }) {
	const half = TILE_SIZE / 2;
	const nw = toMap(bounds, tile.x - half, tile.z - half);
	const se = toMap(bounds, tile.x + half, tile.z + half);
	const cell = { u: se.u - nw.u, v: se.v - nw.v };
	return (
		<frame
			Position={new UDim2(nw.u, 0, nw.v, 0)}
			Size={new UDim2(cell.u, 0, cell.v, 0)}
			BackgroundColor3={GROUND_COLOUR[tileGround(tile)]}
			BorderSizePixel={0}
		>
			<uistroke Color={PAPER} Thickness={1} Transparency={0.4} />
			{routesOut(tile).map(({ side, route }) => {
				const [dx, dz] = SIDE_OFFSET[side];
				const across = dx !== 0;
				const width = route === "Road" ? 0.07 : 0.03;
				// A strip from the tile's middle to that side's midpoint.
				return (
					<frame
						key={side}
						AnchorPoint={new Vector2(dx < 0 ? 1 : dx > 0 ? 0 : 0.5, dz < 0 ? 1 : dz > 0 ? 0 : 0.5)}
						Position={new UDim2(0.5, 0, 0.5, 0)}
						Size={
							across ? new UDim2(0.5 + width / 2, 0, width, 0) : new UDim2(width, 0, 0.5 + width / 2, 0)
						}
						BackgroundColor3={route === "Road" ? ROAD : PATH}
						BorderSizePixel={0}
					/>
				);
			})}
		</frame>
	);
}

function Pin(props: { base: BaseStatus; position: UDim2; pulse: boolean; scale: number }) {
	const { base, scale } = props;
	const fallen = base.condition === "Fallen";
	const colour = fallen || (base.alarm && props.pulse) ? ALARM : INK;
	const meter = base.marks !== undefined && !fallen ? `  ${markMeter(base.marks)}` : "";
	return (
		<frame Position={props.position} Size={new UDim2(0, 0, 0, 0)} BackgroundTransparency={1}>
			<textlabel
				AnchorPoint={new Vector2(0.5, 0.5)}
				Size={new UDim2(0, 22 * scale, 0, 22 * scale)}
				BackgroundColor3={fallen ? Color3.fromRGB(40, 10, 10) : PAPER}
				BorderSizePixel={0}
				Font={Enum.Font.GothamBlack}
				TextScaled={true}
				TextColor3={colour}
				Text={fallen ? "✕" : base.alarm ? "!" : "⌂"}
			>
				<uicorner CornerRadius={new UDim(1, 0)} />
				<uistroke Color={colour} Thickness={2 * scale} />
			</textlabel>
			{base.alarm && props.pulse ? (
				<frame
					AnchorPoint={new Vector2(0.5, 0.5)}
					Size={new UDim2(0, 44 * scale, 0, 44 * scale)}
					BackgroundTransparency={1}
				>
					<uicorner CornerRadius={new UDim(1, 0)} />
					<uistroke Color={ALARM} Thickness={3 * scale} />
				</frame>
			) : undefined}
			<textlabel
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0, 0, 0, 13 * scale)}
				Size={new UDim2(0, 220 * scale, 0, 18 * scale)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				TextSize={14 * scale}
				TextColor3={colour}
				TextStrokeColor3={PAPER}
				TextStrokeTransparency={0.3}
				Text={`${base.name}${meter}`}
			/>
			<textlabel
				AnchorPoint={new Vector2(0.5, 0)}
				Position={new UDim2(0, 0, 0, 30 * scale)}
				Size={new UDim2(0, 220 * scale, 0, 15 * scale)}
				BackgroundTransparency={1}
				Font={Enum.Font.Gotham}
				TextSize={12 * scale}
				TextColor3={colour}
				TextStrokeColor3={PAPER}
				TextStrokeTransparency={0.3}
				Text={fallen ? "NEST" : base.alarm ? base.status : ""}
			/>
		</frame>
	);
}

function Kid(props: { name: string; me: boolean; held: boolean; position: UDim2; scale: number }) {
	const { scale } = props;
	const colour = props.held ? ALARM : props.me ? GOLD : Color3.fromRGB(60, 120, 220);
	return (
		<frame Position={props.position} Size={new UDim2(0, 0, 0, 0)} BackgroundTransparency={1} ZIndex={3}>
			<frame
				AnchorPoint={new Vector2(0.5, 0.5)}
				Size={new UDim2(0, 12 * scale, 0, 12 * scale)}
				BackgroundColor3={colour}
				BorderSizePixel={0}
				ZIndex={3}
				Rotation={props.held ? 45 : 0}
			>
				<uicorner CornerRadius={new UDim(props.held ? 0 : 1, 0)} />
				<uistroke Color={PAPER} Thickness={2 * scale} />
			</frame>
			<textlabel
				AnchorPoint={new Vector2(0, 0.5)}
				Position={new UDim2(0, 9 * scale, 0, 0)}
				Size={new UDim2(0, 150 * scale, 0, 14 * scale)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				TextSize={12 * scale}
				TextColor3={INK}
				TextStrokeColor3={PAPER}
				TextStrokeTransparency={0.2}
				TextXAlignment={Enum.TextXAlignment.Left}
				ZIndex={3}
				Text={props.held ? `${props.name} (held!)` : props.name}
			/>
		</frame>
	);
}

/** The map itself, filling its parent. `scale` sizes the pins and labels. */
function MapView({ scale }: { scale: number }) {
	const tiles = useTiles();
	const kids = useKids();
	const pulse = usePulse();
	const { bases } = useStore(walkieStore);
	if (tiles.size() === 0) {
		return <frame Size={new UDim2(1, 0, 1, 0)} BackgroundColor3={PAPER} BorderSizePixel={0} />;
	}
	const bounds = mapBounds(tiles, TILE_SIZE);
	return (
		<frame Size={new UDim2(1, 0, 1, 0)} BackgroundColor3={PAPER} BorderSizePixel={0} ClipsDescendants={true}>
			{tiles.map((tile) => (
				<Tile key={`${tile.name}${tile.x},${tile.z}`} tile={tile} bounds={bounds} />
			))}
			{bases.map((base) => {
				const counter = counterOf(base);
				return counter ? (
					<Pin
						key={base.id}
						base={base}
						position={at(bounds, counter.X, counter.Z)}
						pulse={pulse}
						scale={scale}
					/>
				) : undefined;
			})}
			{kids.map((kid) => (
				<Kid
					key={`kid${kid.userId}`}
					name={kid.name}
					me={kid.me}
					held={kid.held}
					position={at(bounds, kid.x, kid.z)}
					scale={scale}
				/>
			))}
		</frame>
	);
}

function useBoard(): BasePart | undefined {
	const find = () => CollectionService.GetTagged(WALL_MAP_TAG).find((b): b is BasePart => b.IsA("BasePart"));
	const [board, setBoard] = React.useState(find);
	React.useEffect(() => {
		const connection = CollectionService.GetInstanceAddedSignal(WALL_MAP_TAG).Connect(() => setBoard(find()));
		return () => connection.Disconnect();
	}, []);
	return board;
}

/** The map on the board (or a note saying where to get one), and full screen from the board's prompt. */
export function WallMapUi() {
	const owned = useStore(upgradesStore).includes("WallMap");
	const board = useBoard();
	const viewport = useViewport();
	const [open, setOpen] = React.useState(false);

	React.useEffect(() => {
		const connection = ProximityPromptService.PromptTriggered.Connect((prompt) => {
			if (prompt.Name === PROMPT_NAME) {
				setOpen(true);
			}
		});
		return () => connection.Disconnect();
	}, []);

	const width = math.min(900, viewport.X * 0.9);
	const height = math.min(width / 1.5, viewport.Y * 0.8 - 70);
	return (
		<>
			{board ? (
				<surfacegui
					Adornee={board}
					Face={Enum.NormalId.Left}
					SizingMode={Enum.SurfaceGuiSizingMode.PixelsPerStud}
					PixelsPerStud={60}
					LightInfluence={0.6}
				>
					<frame
						Size={new UDim2(1, -24, 1, -24)}
						Position={new UDim2(0, 12, 0, 12)}
						BackgroundTransparency={1}
						Rotation={-0.6}
					>
						{owned ? (
							<MapView scale={1} />
						) : (
							<textlabel
								Size={new UDim2(0.6, 0, 0.4, 0)}
								Position={new UDim2(0.2, 0, 0.3, 0)}
								BackgroundColor3={PAPER}
								BorderSizePixel={0}
								Font={Enum.Font.PatrickHand}
								TextSize={30}
								TextColor3={INK}
								TextWrapped={true}
								Text={"A map would go here.\n(The workbench can make one.)"}
							/>
						)}
					</frame>
				</surfacegui>
			) : undefined}
			<screengui ResetOnSpawn={false} DisplayOrder={5}>
				{open && owned ? (
					<Panel
						title="Neighbourhood map"
						titleColor={GREEN}
						size={new Vector2(width + 24, height + 70)}
						position={new UDim2(0.5, 0, 0.5, 0)}
						anchor={new Vector2(0.5, 0.5)}
						contentHeight={height}
						gap={0}
						onClose={() => setOpen(false)}
					>
						<frame LayoutOrder={0} Size={new UDim2(0, width, 0, height)} BackgroundTransparency={1}>
							<MapView scale={1.3} />
						</frame>
					</Panel>
				) : undefined}
			</screengui>
		</>
	);
}
