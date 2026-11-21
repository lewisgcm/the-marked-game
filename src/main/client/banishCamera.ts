import { ReplicatedStorage, RunService, Workspace } from "@rbxts/services";
import { BANISH_SITE_ATTRIBUTE, ROUND_PHASE_ATTRIBUTE } from "shared/round";
import { releaseSelfView } from "./ghostSelf";

/**
 * During the banishing cutscene every client's camera circles the altar, slightly below the
 * ceiling, looking at the ghost as it rises (the server plays the cutscene itself; see
 * main/server/banishing.ts). The normal camera comes back for the end screen.
 */

const BIND_NAME = "BanishCamera";
const ORBIT_RADIUS = 12;
const EYE_HEIGHT = 5;
const LOOK_HEIGHT = 5.5;
const ORBIT_SPEED = 0.3; // radians per second

export function startBanishCamera() {
	let active = false;

	const update = () => {
		const camera = Workspace.CurrentCamera;
		const phase = ReplicatedStorage.GetAttribute(ROUND_PHASE_ATTRIBUTE);
		const site = ReplicatedStorage.GetAttribute(BANISH_SITE_ATTRIBUTE);
		if (!camera) {
			return;
		}
		if (phase === "Banishing" && !active && typeIs(site, "Vector3")) {
			active = true;
			releaseSelfView();
			camera.CameraType = Enum.CameraType.Scriptable;
			// Start the orbit from where this player's camera already is, so it swings smoothly round.
			const from = camera.CFrame.Position.sub(site);
			const startAngle = math.atan2(from.Z, from.X);
			const started = os.clock();
			RunService.BindToRenderStep(BIND_NAME, Enum.RenderPriority.Camera.Value + 1, () => {
				const angle = startAngle + (os.clock() - started) * ORBIT_SPEED;
				const eye = site.add(
					new Vector3(math.cos(angle) * ORBIT_RADIUS, EYE_HEIGHT, math.sin(angle) * ORBIT_RADIUS),
				);
				const target = camera.CFrame.Lerp(CFrame.lookAt(eye, site.add(new Vector3(0, LOOK_HEIGHT, 0))), 0.15);
				camera.CFrame = target;
			});
		} else if (phase !== "Banishing" && active) {
			active = false;
			RunService.UnbindFromRenderStep(BIND_NAME);
			camera.CameraType = Enum.CameraType.Custom;
		}
	};

	ReplicatedStorage.GetAttributeChangedSignal(ROUND_PHASE_ATTRIBUTE).Connect(update);
	update();
}
