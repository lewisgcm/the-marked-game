import { Players, ServerStorage } from "@rbxts/services";
import { Infected } from "./types";

/** What the infected look like: the body they're cloned from, Dad's shirt, walking, and the static. */

const SKIN = new Color3(0.52, 0.55, 0.5);
const DAD_SHIRT = new Color3(0.25, 0.32, 0.45);
const EYE_COLOR = new Color3(1, 0.08, 0.05);
const STUNNED_EYE_COLOR = new Color3(0.3, 0.05, 0.05);
/** The default R15 walk animation. */
const WALK_ANIMATION = "rbxassetid://507777826";

/** Builds the body every infected is cloned from. Yields (the rig is made by Roblox). */
export function buildTemplate(): Model | undefined {
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
		humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
		humanoid.BreakJointsOnDeath = false;
	}
	const head = model.FindFirstChild("Head");
	if (head && head.IsA("BasePart")) {
		head.FindFirstChild("face")?.Destroy(); // no friendly face
		for (const x of [-0.2, 0.2]) {
			const eye = new Instance("Part");
			eye.Name = "Eye";
			eye.Size = new Vector3(0.22, 0.12, 0.05);
			eye.Material = Enum.Material.Neon;
			eye.Color = EYE_COLOR;
			eye.CanCollide = false;
			eye.CanQuery = false;
			eye.Massless = true;
			// The head faces -Z (its LookVector).
			eye.CFrame = head.CFrame.mul(new CFrame(x, 0.12, -head.Size.Z / 2 - 0.01));
			const weld = new Instance("WeldConstraint");
			weld.Part0 = head;
			weld.Part1 = eye;
			weld.Parent = eye;
			eye.Parent = model;
		}
		// A faint red glow, so they read in the dark.
		const glow = new Instance("PointLight");
		glow.Color = EYE_COLOR;
		glow.Range = 6;
		glow.Brightness = 1.5;
		glow.Parent = head;
	}
	model.Parent = ServerStorage;
	return model;
}

/** Dad's blue shirt. */
export function dressAsDad(model: Model) {
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
