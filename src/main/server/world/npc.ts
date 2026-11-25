import { Players } from "@rbxts/services";

/** People who stand still in the world (traders). They can't be hurt or moved. */

export interface NpcLook {
	name: string;
	skin: Color3;
	top: Color3;
	legs: Color3;
	/** 1 is an adult; kids are shorter. */
	scale: number;
}

/** The default R15 idle animation. */
const IDLE_ANIMATION = "rbxassetid://507766388";

function playIdle(humanoid: Humanoid) {
	const animator = humanoid.FindFirstChildOfClass("Animator") ?? new Instance("Animator", humanoid);
	const animation = new Instance("Animation");
	animation.AnimationId = IDLE_ANIMATION;
	const [ok, track] = pcall(() => animator.LoadAnimation(animation));
	if (ok && typeIs(track, "Instance")) {
		track.Looped = true;
		track.Play();
	}
}

/** Stands someone at `feet` (on the floor, facing its LookVector). Yields: Roblox makes the rig. */
export function buildNpc(parent: Instance, look: NpcLook, feet: CFrame) {
	const description = new Instance("HumanoidDescription");
	description.HeadColor = look.skin;
	description.LeftArmColor = look.skin;
	description.RightArmColor = look.skin;
	description.TorsoColor = look.top;
	description.LeftLegColor = look.legs;
	description.RightLegColor = look.legs;
	description.HeightScale = look.scale;
	description.WidthScale = look.scale;
	description.DepthScale = look.scale;
	const [ok, model] = pcall(() => Players.CreateHumanoidModelFromDescription(description, Enum.HumanoidRigType.R15));
	const root = ok && typeIs(model, "Instance") && model.FindFirstChild("HumanoidRootPart");
	const humanoid = ok && typeIs(model, "Instance") && model.FindFirstChildOfClass("Humanoid");
	if (!root || !root.IsA("BasePart") || !humanoid) {
		warn(`[Npc] Couldn't build ${look.name}: ${model}`);
		return;
	}
	const rig = model as Model;
	rig.Name = look.name;
	humanoid.DisplayName = look.name;
	humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff;
	root.Anchored = true;
	rig.PivotTo(feet.mul(new CFrame(0, humanoid.HipHeight + root.Size.Y / 2, 0)));
	rig.Parent = parent;
	playIdle(humanoid);
}
