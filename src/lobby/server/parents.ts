import { CollectionService, InsertService, Players, Workspace } from "@rbxts/services";
import { HABITS, Habit, HALL_GLITCH_ATTRIBUTE, PARENT_TAG } from "shared/lobby/hall";
import { GLITCH_EVERY, PARENT_MODELS, PARENT_SCALE, WALK_OUT_SECONDS } from "./config";
import { ParentSpot } from "./world";

/**
 * The parents waiting at the pick-up pads (GAMEPLAY.md §1): one at each of the hall's ParentSpot markers,
 * the model for its habit (tools/blender/assets/parent_*.py), or a plain avatar until that's imported.
 * They're tagged LobbyParent with their Habit; each client moves them (lobby/client/parents.ts), so the
 * server only stands them there. And every so often every screen in the hall glitches at once.
 */

/** The parents standing, by pad (the hall's order). */
const standing = new Map<number, Model>();

/** How long after leading a party out a parent is back at their pad (the next one's arrived). */
const BACK_AFTER = WALK_OUT_SECONDS + 6;

function isHabit(value: string): value is Habit {
	return (HABITS as readonly string[]).includes(value);
}

/** An imported parent (MODELLING.md → Import), its root lined up with the rig's root joint. Yields. */
function loadModel(habit: Habit): Model | undefined {
	const assetId = PARENT_MODELS[habit];
	if (assetId === 0) {
		return undefined;
	}
	const [ok, loaded] = pcall(() => InsertService.LoadAsset(assetId));
	const model = ok ? loaded.FindFirstChildOfClass("Model") : undefined;
	const root = model?.FindFirstChild("HumanoidRootPart");
	const rootJoint = root?.FindFirstChild("RootRigAttachment");
	const hipsJoint = model?.FindFirstChild("LowerTorso")?.FindFirstChild("RootRigAttachment");
	if (!model || !root?.IsA("BasePart") || !rootJoint?.IsA("Attachment") || !hipsJoint?.IsA("Attachment")) {
		warn(`[Lobby] Couldn't load the ${habit} parent's model, so a plain avatar stands in: ${loaded}`);
		return undefined;
	}
	// The importer leaves the root at the feet; put it where the rig's root joint says.
	root.CFrame = hipsJoint.WorldCFrame.mul(rootJoint.CFrame.Inverse());
	model.PrimaryPart = root;
	return model;
}

/** Shirt colours for the stand-ins, so the three tell apart. */
const STAND_IN_SHIRT: Record<Habit, Color3> = {
	Keys: Color3.fromRGB(168, 131, 90),
	Coat: Color3.fromRGB(63, 107, 79),
	Phone: Color3.fromRGB(91, 95, 102),
};

/** A plain R15 avatar in the habit's colours. Yields. */
function standIn(habit: Habit): Model {
	const look = new Instance("HumanoidDescription");
	const skin = Color3.fromRGB(190, 150, 120);
	look.HeadColor = skin;
	look.LeftArmColor = skin;
	look.RightArmColor = skin;
	look.TorsoColor = STAND_IN_SHIRT[habit];
	look.LeftLegColor = Color3.fromRGB(60, 64, 72);
	look.RightLegColor = Color3.fromRGB(60, 64, 72);
	return Players.CreateHumanoidModelFromDescription(look, Enum.HumanoidRigType.R15);
}

/** Stands `model` at `spot`, feet on the floor, facing the way the spot does, and anchors its root. */
function stand(model: Model, spot: ParentSpot, habit: Habit, parent: Instance) {
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None;
		humanoid.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff;
	}
	const root = model.PrimaryPart ?? model.FindFirstChild("HumanoidRootPart");
	if (root?.IsA("BasePart")) {
		root.Anchored = true;
		model.PrimaryPart = root;
	}
	model.ScaleTo(PARENT_SCALE);
	model.PivotTo(spot.at.mul(new CFrame(0, 10, 0)));
	const [box, size] = model.GetBoundingBox();
	model.PivotTo(model.GetPivot().add(new Vector3(0, spot.at.Y - (box.Y - size.Y / 2), 0)));
	model.Name = `Parent_${habit}`;
	model.SetAttribute("Habit", habit);
	CollectionService.AddTag(model, PARENT_TAG);
	model.Parent = parent;
}

/** Puts a parent at each spot. Loads in the background. */
export function startParents(spots: ParentSpot[]) {
	const folder = new Instance("Folder");
	folder.Name = "Parents";
	folder.Parent = Workspace;
	spots.forEach((spot, index) => {
		if (!isHabit(spot.habit)) {
			warn(`[Lobby] A ParentSpot says Habit = ${spot.habit}, which isn't one.`);
			return;
		}
		const habit = spot.habit;
		task.spawn(() => {
			const model = loadModel(habit) ?? standIn(habit);
			stand(model, spot, habit, folder);
			standing.set(index, model);
		});
	});
}

/**
 * The parent at pad `index` turns and leads their party out through `door`: each client walks them there
 * (lobby/client/parents.ts: LeavingAt is server time, LeaveTo where to). Later they're back at the pad.
 */
export function leadOut(index: number, door: CFrame) {
	const model = standing.get(index);
	if (!model) {
		return;
	}
	model.SetAttribute("LeaveTo", door.Position);
	model.SetAttribute("LeavingAt", Workspace.GetServerTimeNow());
	task.delay(BACK_AFTER, () => model.SetAttribute("LeavingAt", undefined));
}

/** Every so often, every screen in the hall glitches at once and the parents freeze: each client plays it. */
export function startHallGlitches() {
	const hall = Workspace.WaitForChild("Hall");
	task.spawn(() => {
		for (let count = 1; ; count++) {
			task.wait(math.random(GLITCH_EVERY[0], GLITCH_EVERY[1]));
			hall.SetAttribute(HALL_GLITCH_ATTRIBUTE, count);
		}
	});
}
