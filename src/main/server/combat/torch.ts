import { loadModel } from "../world/models";

/** The flashlight's looks: an uploaded torch model (tools/blender/assets/torch.py) over its handle. */

const TORCH_MODEL = 122507830393854;
/** Longest a kid's first flashlight waits for the model, in seconds; after that it's the plain one. */
const WAIT_SECONDS = 5;

/** The lens, sized and placed to sit in the torch's open front (its corners are hidden in the rim). */
const LENS_SIZE = new Vector3(0.42, 0.42, 0.08);
const LENS_AT = new CFrame(0, 0, -0.74);

let template: MeshPart | undefined;
let loading = true;

task.spawn(() => {
	const model = loadModel(TORCH_MODEL, "the torch, so flashlights are plain");
	const mesh = model?.FindFirstChild("Torch");
	if (mesh && mesh.IsA("MeshPart")) {
		mesh.Anchored = false;
		mesh.CanCollide = false;
		mesh.CanQuery = false;
		mesh.CanTouch = false;
		mesh.Massless = true;
		mesh.CastShadow = false; // it would shade its own beam
		mesh.Parent = undefined;
		template = mesh;
	}
	model?.Destroy();
	loading = false;
});

/** Waits for the model to load (or fail). */
export function waitForTorch() {
	const started = os.clock();
	while (loading && os.clock() - started < WAIT_SECONDS) {
		task.wait(0.1);
	}
}

function weld(to: BasePart, p: BasePart) {
	const joint = new Instance("WeldConstraint");
	joint.Part0 = to;
	joint.Part1 = p;
	joint.Parent = p;
}

/**
 * Joins `lens` to `handle`, inside the torch model if it's loaded. Without it, the handle stays as a
 * plain grey box with the lens at `plainLensAt`.
 */
export function fitTorch(tool: Tool, handle: BasePart, lens: BasePart, plainLensAt: CFrame) {
	if (!template) {
		lens.CFrame = handle.CFrame.mul(plainLensAt);
		weld(handle, lens);
		return;
	}
	const mesh = template.Clone();
	mesh.CFrame = handle.CFrame.mul(template.CFrame); // modelled round the handle's middle
	mesh.Parent = tool;
	weld(handle, mesh);
	lens.Size = LENS_SIZE;
	lens.CFrame = handle.CFrame.mul(LENS_AT);
	weld(handle, lens);
	handle.Transparency = 1;
}
