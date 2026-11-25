/** Small lookups on characters and NPCs, for both server and clients. */

/** A character's root part, if it has one. */
export function rootOf(model: Model | undefined): BasePart | undefined {
	const hrp = model?.FindFirstChild("HumanoidRootPart");
	return hrp && hrp.IsA("BasePart") ? hrp : undefined;
}

/** A character's Humanoid, while it's alive. */
export function aliveHumanoidOf(model: Model | undefined): Humanoid | undefined {
	const humanoid = model?.FindFirstChildOfClass("Humanoid");
	return humanoid && humanoid.Health > 0 ? humanoid : undefined;
}
