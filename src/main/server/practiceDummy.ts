import { CollectionService } from "@rbxts/services";
import { INFECTED_TAG } from "shared/combat";
import { folder, part } from "shared/parts";

/**
 * Studio-only stand-in for an infected, so melee can be tested before the real infected exist
 * (M1). A tagged, anchored block figure with a Humanoid and glowing red eyes. Brought down, it
 * comes back after a few seconds. Remove once infected spawn for real.
 */

const RESPAWN_SECONDS = 4;
const SKIN = { material: Enum.Material.SmoothPlastic, color: new Color3(0.55, 0.5, 0.47) };
const EYE = { material: Enum.Material.Neon, color: new Color3(1, 0.1, 0.1) };

function build(parent: Instance, at: CFrame): Model {
	const model = new Instance("Model");
	model.Name = "PracticeInfected";
	const root = part(model, "HumanoidRootPart", new Vector3(2, 2, 1), at.mul(new CFrame(0, 3, 0)), SKIN);
	part(model, "Legs", new Vector3(2, 2, 1), at.mul(new CFrame(0, 1, 0)), SKIN);
	const head = part(model, "Head", new Vector3(1.2, 1.2, 1.2), at.mul(new CFrame(0, 4.6, 0)), SKIN);
	// The model faces -Z (its LookVector), so the eyes go on the front of the head.
	for (const x of [-0.25, 0.25]) {
		part(model, "Eye", new Vector3(0.2, 0.15, 0.05), head.CFrame.mul(new CFrame(x, 0.15, -0.62)), EYE);
	}
	model.PrimaryPart = root;
	const humanoid = new Instance("Humanoid");
	humanoid.MaxHealth = 60;
	humanoid.Health = 60;
	humanoid.Parent = model;
	CollectionService.AddTag(model, INFECTED_TAG);
	model.Parent = parent;
	return model;
}

/** Puts a practice infected at `at` (facing its LookVector). Call only in Studio. */
export function spawnPracticeDummy(parent: Instance, at: CFrame) {
	const holder = folder(parent, "PracticeDummy");
	const place = () => {
		const model = build(holder, at);
		model.FindFirstChildOfClass("Humanoid")?.Died.Connect(() => {
			task.delay(0.5, () => model.Destroy());
			task.delay(RESPAWN_SECONDS, place);
		});
	};
	place();
}
