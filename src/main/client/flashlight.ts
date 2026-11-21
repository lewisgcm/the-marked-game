import { Players, RunService, Workspace } from "@rbxts/services";
import { findMeshAsset } from "shared/assets";
import { BEAM_VISUAL_LENGTH, FLASHLIGHT_TOOL_NAME, beamDirection, findConePlanes, pointCone } from "shared/flashlight";

/**
 * Points every kid's flashlight cone, on this client, every frame.
 *
 * The cone comes straight out of the flashlight's lens (as this client renders the hand
 * holding it), in the direction the character faces — the same direction the server uses
 * for the reveal check. Nothing is sent to the server.
 *
 * Visible cone: once the LightCone mesh is uploaded (tools/blender/assets/light_cone.py),
 * each lit flashlight gets local, nested translucent cones — brightest near the torch where
 * all layers overlap, fading in steps further out — and the crossed Beam planes the server
 * builds are hidden. Until then the Beam planes are the cone.
 */

/** Nested cone lengths, as fractions of BEAM_VISUAL_LENGTH. Overlap near the torch = brighter. */
const CONE_LAYERS = [1, 0.66, 0.36];
/** Per layer; the layers overlap near the torch, so keep this high (playtest: 0.92 was too bright). */
const CONE_TRANSPARENCY = 0.965;

const coneTemplate = findMeshAsset("LightCone");
const coneFolder = new Instance("Folder");
coneFolder.Name = "LocalLightCones";
coneFolder.Parent = Workspace;

const meshCones = new Map<Player, MeshPart[]>();

function getMeshCones(player: Player, template: MeshPart): MeshPart[] {
	let layers = meshCones.get(player);
	if (!layers) {
		layers = CONE_LAYERS.map((scale) => {
			const cone = template.Clone();
			// The mesh is authored at full size and Size acts as a multiplier (see AGENTS.md),
			// so a uniform Size scales the whole cone.
			cone.Size = new Vector3(scale, scale, scale);
			cone.Material = Enum.Material.Neon;
			cone.Transparency = CONE_TRANSPARENCY;
			cone.CastShadow = false;
			cone.CanCollide = false;
			cone.CanQuery = false;
			cone.CanTouch = false;
			cone.Anchored = true;
			cone.Parent = coneFolder;
			return cone;
		});
		meshCones.set(player, layers);
	}
	return layers;
}

function removeMeshCones(player: Player) {
	meshCones.get(player)?.forEach((cone) => cone.Destroy());
	meshCones.delete(player);
}

export function startFlashlight() {
	Players.PlayerRemoving.Connect(removeMeshCones);

	RunService.RenderStepped.Connect(() => {
		for (const player of Players.GetPlayers()) {
			const character = player.Character;
			// An equipped Tool is parented to the character.
			const tool = character?.FindFirstChild(FLASHLIGHT_TOOL_NAME);
			const root = character?.FindFirstChild("HumanoidRootPart");
			const planes = tool && findConePlanes(tool);
			if (!tool || !planes || !root?.IsA("BasePart")) {
				removeMeshCones(player);
				continue;
			}

			const aim = beamDirection(root);
			pointCone(planes, aim); // aims the SpotLight (and the Beam fallback)

			if (!coneTemplate) {
				continue;
			}
			// The server switches the light on and off; the mesh cone follows it.
			const lit = planes[0][0].FindFirstChildOfClass("SpotLight")?.Enabled ?? false;
			tool.GetDescendants().forEach((d) => {
				if (d.IsA("Beam")) {
					d.Enabled = false; // the mesh cone replaces the Beam planes
				}
			});
			if (!lit) {
				removeMeshCones(player);
				continue;
			}
			const origin = planes[0][0].WorldPosition;
			getMeshCones(player, coneTemplate).forEach((cone, i) => {
				const length = BEAM_VISUAL_LENGTH * CONE_LAYERS[i];
				// The mesh's origin is its centre; its tip sits half a length behind it.
				const centre = origin.add(aim.mul(length / 2));
				cone.CFrame = CFrame.lookAt(centre, centre.add(aim));
			});
		}
	});
}
