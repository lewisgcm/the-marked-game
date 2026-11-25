import React from "@rbxts/react";
import { RunService, Workspace } from "@rbxts/services";
import { hitStore, hurtStore, useStore } from "../core/gameState";
import { WHITE } from "../core/theme";

/**
 * Melee feedback: a hit marker in the middle of the screen when your swing connects (red for a
 * kill), and a red flash with a camera jolt when you're struck. The server decides hits; this
 * only reacts to its HitResult / Hurt messages.
 */

const MARKER_SECONDS = 0.35;
const FLASH_SECONDS = 0.4;
const JOLT_SECONDS = 0.25;
const JOLT_BINDING = "HurtJolt";

/** True for `seconds` after `at` changes. */
function useBriefly(at: number | undefined, seconds: number): boolean {
	const [on, setOn] = React.useState(false);
	React.useEffect(() => {
		if (at === undefined) {
			return;
		}
		setOn(true);
		const thread = task.delay(seconds, () => setOn(false));
		return () => task.cancel(thread);
	}, [at]);
	return on;
}

function jolt() {
	const started = os.clock();
	RunService.UnbindFromRenderStep(JOLT_BINDING);
	RunService.BindToRenderStep(JOLT_BINDING, Enum.RenderPriority.Camera.Value + 2, () => {
		const camera = Workspace.CurrentCamera;
		const elapsed = os.clock() - started;
		if (!camera || elapsed > JOLT_SECONDS) {
			RunService.UnbindFromRenderStep(JOLT_BINDING);
			return;
		}
		const strength = math.rad(2.5) * (1 - elapsed / JOLT_SECONDS);
		camera.CFrame = camera.CFrame.mul(
			CFrame.Angles(math.noise(elapsed * 40, 1) * strength, math.noise(elapsed * 40, 2) * strength, 0),
		);
	});
}

export function CombatFeedback() {
	const hit = useStore(hitStore);
	const hurtAt = useStore(hurtStore);
	const showMarker = useBriefly(hit?.at, MARKER_SECONDS);
	const showFlash = useBriefly(hurtAt, FLASH_SECONDS);

	React.useEffect(() => {
		if (hurtAt !== undefined) {
			jolt();
		}
	}, [hurtAt]);

	return (
		<screengui ResetOnSpawn={false} DisplayOrder={7} IgnoreGuiInset={true}>
			{showFlash ? (
				<frame
					Size={new UDim2(1, 0, 1, 0)}
					BackgroundColor3={new Color3(0.8, 0, 0)}
					BackgroundTransparency={0.6}
					BorderSizePixel={0}
				/>
			) : undefined}
			{showMarker && hit ? <HitMarker kill={hit.kind === "Kill"} /> : undefined}
		</screengui>
	);
}

/**
 * A shooter-style hit marker: four short diagonal ticks around the screen centre. Drawn from
 * frames rather than a "✕" character, because Roblox fonts don't have that glyph (it showed as a
 * blank square). White for a hit, bigger and red for a kill.
 */
function HitMarker(props: { kill: boolean }) {
	const color = props.kill ? new Color3(1, 0.2, 0.2) : WHITE;
	const length = props.kill ? 16 : 12;
	const thickness = props.kill ? 4 : 3;
	const gap = props.kill ? 14 : 10; // distance from centre to the middle of each tick
	const offset = gap / math.sqrt(2);
	const ticks = [
		{ x: -offset, y: -offset, rotation: 45 },
		{ x: offset, y: -offset, rotation: -45 },
		{ x: -offset, y: offset, rotation: -45 },
		{ x: offset, y: offset, rotation: 45 },
	];
	return (
		<>
			{ticks.map((tick) => (
				<frame
					Size={new UDim2(0, length, 0, thickness)}
					Position={new UDim2(0.5, tick.x, 0.5, tick.y)}
					AnchorPoint={new Vector2(0.5, 0.5)}
					Rotation={tick.rotation}
					BackgroundColor3={color}
					BorderSizePixel={0}
				>
					<uistroke Color={new Color3(0, 0, 0)} Transparency={0.4} Thickness={1} />
				</frame>
			))}
		</>
	);
}
