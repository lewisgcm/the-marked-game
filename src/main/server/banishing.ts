import { Players, ReplicatedStorage, RunService, TweenService, Workspace } from "@rbxts/services";
import { BANISH_SITE_ATTRIBUTE } from "shared/round";
import { gameConfig } from "./config";
import { send } from "./gameRemote";
import { setRevealed } from "./ghostVisibility";
import { getGhost } from "./roles";

/**
 * The banishing cutscene, played between a completed ritual and the end screen:
 *
 *  1. A column of pale light bursts up from the altar; the ghost is dragged into it, made
 *     visible and held there, screaming.
 *  2. It rises up the column, spinning and writhing.
 *  3. A blinding flash: it dissolves into sparks and is gone.
 *
 * Server-driven, so everyone sees the same thing (the round has everyone frozen meanwhile).
 * Clients point their cameras at the altar (main/client/banishCamera.ts) using the
 * BanishSite attribute. Length: BanishCutsceneSeconds in config.
 */

const SCREAM_SOUND = "rbxasset://sounds/uuhhh.mp3";
const BURST_SOUND = "rbxasset://sounds/electronicpingshort.wav";
const LIGHT_COLOR = new Color3(0.85, 0.92, 1);
/** Ghost height above the floor: where it's dragged to, and how high it rises. */
const START_HEIGHT = 3.5;
const END_HEIGHT = 8.5;
/** Share of the cutscene spent rising before the dissolve. */
const RISE_SHARE = 0.7;

let site: Vector3 | undefined;

/** Records where the cutscene plays (the altar room's floor centre) and tells clients. */
export function setBanishSite(position: Vector3) {
	site = position;
	ReplicatedStorage.SetAttribute(BANISH_SITE_ATTRIBUTE, position);
}

function playSound(parent: Instance, id: string, speed: number, volume: number) {
	const sound = new Instance("Sound");
	sound.SoundId = id;
	sound.PlaybackSpeed = speed;
	sound.Volume = volume;
	sound.RollOffMaxDistance = 400; // heard across the house
	sound.Parent = parent;
	sound.Play();
	task.delay(6, () => sound.Destroy());
}

function tween(instance: Instance, seconds: number, goal: object) {
	const t = TweenService.Create(instance, new TweenInfo(seconds, Enum.EasingStyle.Quad), goal as never);
	t.Play();
	return t;
}

function buildColumn(at: Vector3): { column: Part; light: PointLight; sparks: ParticleEmitter } {
	const column = new Instance("Part");
	column.Name = "BanishColumn";
	column.Shape = Enum.PartType.Cylinder;
	column.Size = new Vector3(11.5, 0.5, 0.5); // a cylinder's length is its X; grows wider below
	column.CFrame = new CFrame(at.add(new Vector3(0, 5.75, 0))).mul(CFrame.Angles(0, 0, math.pi / 2));
	column.Material = Enum.Material.Neon;
	column.Color = LIGHT_COLOR;
	column.Transparency = 1;
	column.Anchored = true;
	column.CanCollide = false;
	column.CanQuery = false;
	column.CastShadow = false;
	column.Parent = Workspace;

	const light = new Instance("PointLight");
	light.Color = LIGHT_COLOR;
	light.Range = 30;
	light.Brightness = 0;
	light.Shadows = true;
	light.Parent = column;

	const sparks = new Instance("ParticleEmitter");
	sparks.Color = new ColorSequence(LIGHT_COLOR);
	sparks.LightEmission = 1;
	sparks.Size = new NumberSequence([new NumberSequenceKeypoint(0, 0.4), new NumberSequenceKeypoint(1, 0)]);
	sparks.Transparency = new NumberSequence(0.2, 1);
	sparks.Lifetime = new NumberRange(1, 2);
	sparks.Speed = new NumberRange(1, 3);
	sparks.SpreadAngle = new Vector2(180, 180);
	sparks.Acceleration = new Vector3(0, 4, 0);
	sparks.Rate = 40;
	sparks.Parent = column;
	return { column, light, sparks };
}

function fadeCharacter(character: Model, seconds: number) {
	for (const d of character.GetDescendants()) {
		if (d.IsA("BasePart") && d.Name !== "HumanoidRootPart") {
			tween(d, seconds, { Transparency: 1 });
		} else if (d.IsA("Decal")) {
			tween(d, seconds, { Transparency: 1 });
		} else if (d.IsA("Highlight")) {
			tween(d, seconds, { FillTransparency: 1, OutlineTransparency: 1 });
		}
	}
}

/** Plays the cutscene; yields until it's over. Does nothing without a site or a ghost body. */
export function playBanishing() {
	const total = math.max(1, gameConfig.banishCutsceneSeconds.Value);
	const ghost = getGhost();
	const character = ghost?.Character;
	const root = character?.FindFirstChild("HumanoidRootPart");
	if (!site || !ghost || !character || !root || !root.IsA("BasePart")) {
		task.wait(total);
		return;
	}
	const at = site;

	// Weapons away (tools would otherwise keep swinging and turning their holders).
	for (const player of Players.GetPlayers()) {
		player.Character?.FindFirstChildOfClass("Humanoid")?.UnequipTools();
	}

	// 1. The column bursts up and drags the ghost in, visible.
	const { column, light, sparks } = buildColumn(at);
	tween(column, 0.4, { Transparency: 0.55, Size: new Vector3(11.5, 4, 4) });
	tween(light, 0.4, { Brightness: 4 });
	root.Anchored = true;
	root.CFrame = new CFrame(at.add(new Vector3(0, START_HEIGHT, 0)));
	if (setRevealed(ghost, true)) {
		send(ghost, "GhostRevealed", true);
	}
	playSound(column, SCREAM_SOUND, 0.4, 4);

	// 2. Rise, spinning and writhing.
	const riseTime = total * RISE_SHARE;
	const started = os.clock();
	let angle = 0;
	const rise = RunService.Heartbeat.Connect((dt) => {
		const progress = math.min(1, (os.clock() - started) / riseTime);
		angle += dt * (2 + progress * 10); // spins faster as it goes
		const height = START_HEIGHT + (END_HEIGHT - START_HEIGHT) * progress * progress;
		const writhe = 0.25 + progress * 0.5;
		root.CFrame = new CFrame(at.add(new Vector3(0, height, 0)))
			.mul(CFrame.Angles(0, angle, 0))
			.mul(CFrame.Angles((math.random() * 2 - 1) * writhe * 0.3, 0, (math.random() * 2 - 1) * writhe * 0.3));
	});
	task.wait(riseTime);
	rise.Disconnect();

	// 3. Flash, burst of sparks, dissolve.
	const fadeTime = total - riseTime;
	light.Brightness = 12;
	light.Range = 50;
	sparks.Emit(120);
	playSound(column, BURST_SOUND, 0.3, 3);
	fadeCharacter(character, fadeTime * 0.6);
	tween(light, fadeTime, { Brightness: 0 });
	tween(column, fadeTime, { Transparency: 1, Size: new Vector3(11.5, 0.2, 0.2) });
	sparks.Rate = 0;
	task.wait(fadeTime);
	task.delay(3, () => column.Destroy()); // let the last sparks finish
}
