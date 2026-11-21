import { Players, RunService, Workspace } from "@rbxts/services";
import {
	BEAM_VISUAL_LENGTH,
	CONE_PLANES,
	coneAttachmentNames,
	FLASHLIGHT_HALF_ANGLE,
	FLASHLIGHT_RANGE,
	FLASHLIGHT_TICK_RATE,
	FLASHLIGHT_TOOL_NAME,
	beamDirection,
	inBeamCone,
	pointCone,
} from "shared/flashlight";
import { gameConfig } from "./config";
import { recordStat } from "./roundStats";
import { isForceRevealed, setRevealed } from "./ghostVisibility";

/**
 * Hunters' flashlights, and the server-side check that reveals the ghost.
 *
 * The beam points the way the hunter's character faces (see `beamDirection`), so the server
 * needs no client input at all: it owns whether a light is on (Tool equip/activate events),
 * where the check starts (the hunter's head) and which way it points (the character's root),
 * and what it hits (cone + raycast against the ghost's server-side position).
 *
 * Visuals: the light and cone live on the flashlight's lens. Each client points every
 * hunter's beam from that lens along the same direction, so it comes straight out of the
 * torch in the hand (see client/flashlight).
 */

const BEAM_COLOR = new Color3(1, 0.95, 0.82);
const LENS_ON = new Color3(1, 0.95, 0.75);
const LENS_OFF = new Color3(0.2, 0.2, 0.2);

interface FlashlightParts {
	tool: Tool;
	lens: BasePart;
	light: SpotLight;
	cones: Beam[];
}

interface HunterLight extends FlashlightParts {
	owner: Player;
	head: BasePart;
	equipped: boolean;
	on: boolean;
	connections: RBXScriptConnection[];
}

const lights = new Map<Player, HunterLight>();
const cosHalfAngle = math.cos(math.rad(FLASHLIGHT_HALF_ANGLE));

function buildTool(): FlashlightParts {
	const tool = new Instance("Tool");
	tool.Name = FLASHLIGHT_TOOL_NAME;
	tool.ToolTip = "Click to switch on/off";
	tool.CanBeDropped = false;
	tool.RequiresHandle = true;

	const handle = new Instance("Part");
	handle.Name = "Handle";
	handle.Size = new Vector3(0.35, 0.35, 1.3);
	handle.Material = Enum.Material.Metal;
	handle.Color = new Color3(0.12, 0.12, 0.14);
	handle.CanCollide = false;
	handle.Massless = true;
	handle.Parent = tool;

	const lens = new Instance("Part");
	lens.Name = "Lens";
	lens.Size = new Vector3(0.45, 0.45, 0.12);
	lens.Material = Enum.Material.Neon;
	lens.Color = LENS_OFF;
	lens.CanCollide = false;
	lens.Massless = true;
	lens.CFrame = handle.CFrame.mul(new CFrame(0, 0, -0.68));
	lens.Parent = tool;
	const weld = new Instance("WeldConstraint");
	weld.Part0 = handle;
	weld.Part1 = lens;
	weld.Parent = lens;

	// The cone's planes all start at the lens's front face; plane 0 also carries the light.
	const planes: Array<[Attachment, Attachment]> = [];
	const cones: Beam[] = [];
	for (let i = 0; i < CONE_PLANES; i++) {
		const [startName, endName] = coneAttachmentNames(i);
		const start = new Instance("Attachment");
		start.Name = startName;
		start.Position = new Vector3(0, 0, -0.07);
		start.Parent = lens;
		const finish = new Instance("Attachment");
		finish.Name = endName;
		finish.Parent = lens;
		planes.push([start, finish]);
		cones.push(buildConePlane(start, finish));
	}
	pointCone(planes, lens.CFrame.LookVector);

	const light = new Instance("SpotLight");
	light.Face = Enum.NormalId.Front;
	light.Angle = FLASHLIGHT_HALF_ANGLE * 2;
	light.Range = FLASHLIGHT_RANGE;
	light.Brightness = 7;
	light.Color = BEAM_COLOR;
	light.Shadows = true;
	light.Enabled = false;
	light.Parent = planes[0][0];

	return { tool, lens, light, cones };
}

/**
 * One plane of the visible cone: a flat Beam that starts narrow at the lens and widens to the
 * cone's width at BEAM_VISUAL_LENGTH, fading out along the way. Its plane is set by its
 * attachments' roll (see pointCone), so CONE_PLANES of them cross to form a 3D volume. Each
 * is faint on its own; they add up where they overlap.
 */
function buildConePlane(start: Attachment, finish: Attachment): Beam {
	const cone = new Instance("Beam");
	cone.Name = "LightCone";
	cone.Attachment0 = start;
	cone.Attachment1 = finish;
	cone.FaceCamera = false;
	cone.Width0 = 0.5;
	cone.Width1 = 2 * BEAM_VISUAL_LENGTH * math.tan(math.rad(FLASHLIGHT_HALF_ANGLE));
	cone.Segments = 12;
	cone.Color = new ColorSequence(BEAM_COLOR);
	cone.LightEmission = 1;
	cone.LightInfluence = 0;
	cone.Transparency = new NumberSequence([
		new NumberSequenceKeypoint(0, 0.82),
		new NumberSequenceKeypoint(0.5, 0.93),
		new NumberSequenceKeypoint(1, 1),
	]);
	cone.Enabled = false;
	cone.Parent = start;
	return cone;
}

/** Players whose flashlight is forced off (e.g. panicking). Survives respawns. */
const disabled = new Set<Player>();

function refresh(state: HunterLight) {
	const lit = state.equipped && state.on && !disabled.has(state.owner);
	state.light.Enabled = lit;
	state.cones.forEach((cone) => (cone.Enabled = lit));
	state.lens.Color = lit ? LENS_ON : LENS_OFF;
}

export function removeFlashlight(player: Player) {
	const state = lights.get(player);
	if (!state) {
		return;
	}
	state.connections.forEach((c) => c.Disconnect());
	state.tool.Destroy(); // the light, cone and attachments live inside it
	lights.delete(player);
}

/** Gives `player` a flashlight for this life. Call on each spawn. */
export function giveFlashlight(player: Player, character: Model) {
	removeFlashlight(player);
	const head = character.WaitForChild("Head", 5) as BasePart | undefined;
	const backpack = player.FindFirstChildOfClass("Backpack");
	if (!head || !backpack) {
		return;
	}

	const parts = buildTool();
	const state: HunterLight = {
		...parts,
		owner: player,
		head,
		equipped: false,
		on: true,
		connections: [],
	};
	const tool = state.tool;
	state.connections.push(
		tool.Equipped.Connect(() => {
			state.equipped = true;
			refresh(state);
		}),
		tool.Unequipped.Connect(() => {
			state.equipped = false;
			refresh(state);
		}),
		tool.Activated.Connect(() => {
			if (disabled.has(player)) {
				return; // dead flashlight: clicking does nothing
			}
			state.on = !state.on;
			refresh(state);
		}),
	);
	tool.Parent = backpack;
	lights.set(player, state);
	refresh(state);
}

/**
 * Forces `player`'s flashlight off (with a short dying flicker) or lets it work again.
 * While disabled the light can't be switched on, including after a respawn.
 */
export function setFlashlightDisabled(player: Player, value: boolean) {
	if (value === disabled.has(player)) {
		return;
	}
	if (value) {
		disabled.add(player);
	} else {
		disabled.delete(player);
	}
	const state = lights.get(player);
	if (!state) {
		return;
	}
	if (!value || !(state.equipped && state.on)) {
		refresh(state);
		return;
	}
	// Dying flicker: stutter a few times, then go dark.
	task.spawn(() => {
		for (const on of [false, true, false, true, false]) {
			if (lights.get(player) !== state) {
				return;
			}
			state.light.Enabled = on;
			state.cones.forEach((cone) => (cone.Enabled = on));
			task.wait(0.12);
		}
		refresh(state);
	});
}

/** Is any point of `target` inside a lit beam with nothing in the way? */
/** The hunters whose beams are on `target` right now (walls block beams). */
function litBy(target: Model): Player[] {
	const lighters: Player[] = [];
	const points: Vector3[] = [];
	for (const name of ["Head", "HumanoidRootPart", "UpperTorso", "Torso", "LeftFoot", "RightFoot"]) {
		const p = target.FindFirstChild(name);
		if (p && p.IsA("BasePart")) {
			points.push(p.Position);
		}
	}

	for (const [player, state] of lights) {
		const character = player.Character;
		const root = character?.FindFirstChild("HumanoidRootPart");
		if (!state.light.Enabled || !character || !root?.IsA("BasePart")) {
			continue;
		}
		const origin = state.head.Position;
		const aim = beamDirection(root);
		const params = new RaycastParams();
		params.FilterType = Enum.RaycastFilterType.Exclude;
		params.FilterDescendantsInstances = [character, target];

		for (const point of points) {
			if (!inBeamCone(origin, aim, point, FLASHLIGHT_RANGE, cosHalfAngle)) {
				continue;
			}
			// Walls and furniture block the beam.
			if (Workspace.Raycast(origin, point.sub(origin), params) === undefined) {
				lighters.push(player);
				break;
			}
		}
	}
	return lighters;
}

/**
 * Checks the ghost against every beam FLASHLIGHT_TICK_RATE times a second, and reveals it
 * while lit (plus RevealLinger) or while a forced reveal (forceReveal) is active. `onChange` fires when the ghost's visibility flips.
 * Returns a function that stops the loop (e.g. when the round ends).
 */
export function startRevealLoop(
	getGhost: () => Player | undefined,
	onChange: (ghost: Player, revealed: boolean) => void,
): () => void {
	let lastLitAt = -math.huge;
	let elapsed = 0;
	const connection = RunService.Heartbeat.Connect((dt) => {
		elapsed += dt;
		if (elapsed < 1 / FLASHLIGHT_TICK_RATE) {
			return;
		}
		elapsed = 0;

		const ghost = getGhost();
		const character = ghost?.Character;
		if (!ghost || !character) {
			return;
		}
		const lighters = litBy(character);
		if (lighters.size() > 0) {
			lastLitAt = os.clock();
		}
		for (const hunter of lighters) {
			recordStat(hunter, "lightSeconds", 1 / FLASHLIGHT_TICK_RATE);
		}
		// Lit by a beam (plus a short linger), or forced visible by something else (a trap).
		const revealed = os.clock() - lastLitAt < gameConfig.revealLinger.Value || isForceRevealed(ghost);
		if (setRevealed(ghost, revealed)) {
			onChange(ghost, revealed);
		}
	});
	return () => connection.Disconnect();
}

Players.PlayerRemoving.Connect((player) => {
	removeFlashlight(player);
	disabled.delete(player);
});
