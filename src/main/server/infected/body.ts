import { InsertService, Players, ServerStorage } from "@rbxts/services";
import { gameConfig } from "../config";
import { Infected } from "./types";

/** What the infected look like: the bodies they're cloned from, eyes, walking, and the static. */

/** Rigged models from tools/blender/assets (infected_dad, infected_neighbour), owned by the game's owner. */
const DAD_MODEL = 85382776780557;
const NEIGHBOUR_MODEL = 113636936031842;
/** Where the painted eyes are, from the neck joint (the face in tools/blender/lib/blocky.py). */
const EYES_FROM_NECK = new Vector3(0, 0.63, -0.575);

const SKIN = new Color3(0.52, 0.55, 0.5);
const DAD_SHIRT = new Color3(0.25, 0.32, 0.45);
const EYE_COLOR = new Color3(1, 0.08, 0.05);
const STUNNED_EYE_COLOR = new Color3(0.3, 0.05, 0.05);
/** The default R15 walk animation. */
const WALK_ANIMATION = "rbxassetid://507777826";

/** Glowing eyes, `apart` either side of `at` (in the head's space; it faces -Z), and a faint red light. */
function addEyes(model: Model, head: BasePart, apart: number, size: Vector3, at: Vector3) {
	for (const x of [-apart, apart]) {
		const eye = new Instance("Part");
		eye.Name = "Eye";
		eye.Size = size;
		eye.Material = Enum.Material.Neon;
		eye.Color = EYE_COLOR;
		eye.CanCollide = false;
		eye.CanQuery = false;
		eye.Massless = true;
		eye.CFrame = head.CFrame.mul(new CFrame(at.add(new Vector3(x, 0, 0))));
		const weld = new Instance("WeldConstraint");
		weld.Part0 = head;
		weld.Part1 = eye;
		weld.Parent = eye;
		eye.Parent = model;
	}
	// So they read in the dark.
	const glow = new Instance("PointLight");
	glow.Color = EYE_COLOR;
	glow.Range = 6;
	glow.Brightness = 1.5;
	glow.Parent = head;
}

function setUpHumanoid(humanoid: Humanoid) {
	humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
	humanoid.BreakJointsOnDeath = false;
}

/**
 * Loads a rigged model (MODELLING.md), ready to clone, at `scale` times its own size. Yields.
 * Undefined if it can't be had.
 */
function loadRig(assetId: number, name: string, scale: number): Model | undefined {
	const [ok, loaded] = pcall(() => InsertService.LoadAsset(assetId));
	const model = ok ? loaded.FindFirstChildOfClass("Model") : undefined;
	const humanoid = model?.FindFirstChildOfClass("Humanoid");
	const root = model?.FindFirstChild("HumanoidRootPart");
	const head = model?.FindFirstChild("Head");
	const neck = head?.FindFirstChild("NeckRigAttachment");
	const rootJoint = root?.FindFirstChild("RootRigAttachment");
	const hipsJoint = model?.FindFirstChild("LowerTorso")?.FindFirstChild("RootRigAttachment");
	if (
		!model ||
		!humanoid ||
		!root?.IsA("BasePart") ||
		!head?.IsA("BasePart") ||
		!neck?.IsA("Attachment") ||
		!rootJoint?.IsA("Attachment") ||
		!hipsJoint?.IsA("Attachment")
	) {
		warn(`[Infected] Couldn't load ${name}'s model, so it gets the plain body: ${loaded}`);
		return undefined;
	}
	// The importer leaves the root at the feet; put it where the rig's root joint says.
	root.CFrame = hipsJoint.WorldCFrame.mul(rootJoint.CFrame.Inverse());
	model.PrimaryPart = root;
	setUpHumanoid(humanoid);
	// Just over the eyes painted on the mesh, so a stun can dim them. Measured from the neck, which is
	// the same on every model; a head's centre moves with its hair or hood.
	addEyes(model, head, 0.23, new Vector3(0.2, 0.13, 0.12), neck.Position.add(EYES_FROM_NECK));
	model.ScaleTo(scale); // takes the joints, eyes and hip height with it
	model.Name = name;
	model.Parent = ServerStorage;
	return model;
}

/** The body shamblers are cloned from. Yields. */
export function buildTemplate(): Model | undefined {
	return loadRig(NEIGHBOUR_MODEL, "Infected", gameConfig.shamblerScale.Value) ?? buildPlain();
}

/** Dad's body: his own model, or the plain one in his blue shirt. Yields. */
export function buildDadTemplate(): Model | undefined {
	const own = loadRig(DAD_MODEL, "Dad", gameConfig.dadScale.Value);
	if (own) {
		return own;
	}
	const plain = buildPlain();
	if (plain) {
		dressAsDad(plain);
	}
	return plain;
}

/** A plain grey body, for when a model can't be loaded. Yields (the rig is made by Roblox). */
function buildPlain(): Model | undefined {
	const description = new Instance("HumanoidDescription");
	description.HeadColor = SKIN;
	description.TorsoColor = SKIN;
	description.LeftArmColor = SKIN;
	description.RightArmColor = SKIN;
	description.LeftLegColor = SKIN.Lerp(new Color3(0, 0, 0), 0.3);
	description.RightLegColor = SKIN.Lerp(new Color3(0, 0, 0), 0.3);
	const [ok, result] = pcall(() => Players.CreateHumanoidModelFromDescription(description, Enum.HumanoidRigType.R15));
	if (!ok || !typeIs(result, "Instance") || !result.IsA("Model")) {
		warn(`[Infected] Couldn't build the infected body: ${result}`);
		return undefined;
	}
	const model = result;
	model.Name = "Infected";
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		setUpHumanoid(humanoid);
	}
	const head = model.FindFirstChild("Head");
	if (head && head.IsA("BasePart")) {
		head.FindFirstChild("face")?.Destroy(); // no friendly face
		addEyes(model, head, 0.2, new Vector3(0.22, 0.12, 0.05), new Vector3(0, 0.12, -head.Size.Z / 2 - 0.01));
	}
	model.Parent = ServerStorage;
	return model;
}

/** Dad's blue shirt, on the plain body. */
function dressAsDad(model: Model) {
	for (const name of ["UpperTorso", "LowerTorso", "LeftUpperArm", "RightUpperArm"]) {
		const p = model.FindFirstChild(name);
		if (p && p.IsA("BasePart")) {
			p.Color = DAD_SHIRT;
		}
	}
}

export function eyesOf(model: Model): BasePart[] {
	return model.GetChildren().filter((c): c is BasePart => c.IsA("BasePart") && c.Name === "Eye");
}

/** Dims its eyes for `seconds` (a stun). */
export function dimEyes(inf: Infected, seconds: number) {
	inf.eyes.forEach((eye) => (eye.Color = STUNNED_EYE_COLOR));
	task.delay(seconds, () => inf.eyes.forEach((eye) => (eye.Color = EYE_COLOR)));
}

export function startWalkAnimation(humanoid: Humanoid) {
	const animator = humanoid.FindFirstChildOfClass("Animator") ?? new Instance("Animator", humanoid);
	const animation = new Instance("Animation");
	animation.AnimationId = WALK_ANIMATION;
	const [ok, track] = pcall(() => animator.LoadAnimation(animation));
	if (!ok || !typeIs(track, "Instance")) {
		return;
	}
	track.Looped = true;
	humanoid.Running.Connect((speed) => {
		if (speed > 0.5 && !track.IsPlaying) {
			track.Play();
		} else if (speed <= 0.5 && track.IsPlaying) {
			track.Stop();
		}
	});
}

/** Fades the body out in a flicker of static, then removes it. */
export function fadeToStatic(model: Model) {
	const parts = model.GetDescendants().filter((d): d is BasePart => d.IsA("BasePart"));
	for (const d of model.GetDescendants()) {
		if (d.IsA("SurfaceAppearance")) {
			d.Destroy(); // it would hide the flicker's colours
		}
	}
	task.spawn(() => {
		for (let i = 0; i < 8; i++) {
			const t = i / 8;
			for (const p of parts) {
				p.Material = Enum.Material.Neon;
				p.Color = i % 2 === 0 ? new Color3(0.9, 0.9, 0.95) : new Color3(0.2, 0.2, 0.25);
				p.Transparency = math.max(p.Transparency, t);
			}
			task.wait(0.08);
		}
		model.Destroy();
	});
}
