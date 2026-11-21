import { Lighting, RunService } from "@rbxts/services";
import { DayPhase } from "shared/phases";
import { gameConfig } from "./config";

/**
 * Lighting for the day/night clock. Each phase has a sky (time of day, sun brightness) and an
 * indoor ambient level; changes blend over a few seconds. The ambient is what lights the inside
 * of the house: DarkRoomLight (config) is the night level, and the other phases scale it up.
 */

interface PhaseLight {
	/** Lighting.ClockTime, 0-24. */
	clockTime: number;
	/** Lighting.Brightness (the sun and moon). */
	brightness: number;
	/** Multiplies DarkRoomLight for the indoor ambient. */
	ambientScale: number;
	/** Colour grade tint. */
	tint: Color3;
}

const PHASE_LIGHT: Record<DayPhase, PhaseLight> = {
	Day: { clockTime: 13, brightness: 2.5, ambientScale: 1.25, tint: new Color3(1, 1, 1) },
	Dusk: { clockTime: 18.2, brightness: 1.2, ambientScale: 1.05, tint: new Color3(1, 0.85, 0.72) },
	Night: { clockTime: 0, brightness: 0, ambientScale: 1, tint: new Color3(0.85, 0.9, 1) },
	Dawn: { clockTime: 6.4, brightness: 1, ambientScale: 1.1, tint: new Color3(1, 0.9, 0.88) },
};

/** Seconds a phase change takes to blend in. */
const BLEND_SECONDS = 6;

let grade: ColorCorrectionEffect | undefined;
let ambientScale = PHASE_LIGHT.Night.ambientScale;

/** Cool moonlight tint for the ambient: a touch of blue reads as "night" rather than "grey". */
function applyAmbient() {
	const l = math.clamp(gameConfig.darkness.Value * ambientScale, 0, 1);
	Lighting.Ambient = new Color3(l * 0.92, l * 0.94, math.min(1, l * 1.12));
	Lighting.OutdoorAmbient = new Color3(l * 0.6, l * 0.6, math.min(1, l * 0.72));
}

/**
 * Starts at night-dark lighting (the run begins on Day 1, which blends in from it). Call once,
 * at server start.
 */
export function setupLighting() {
	Lighting.ClockTime = PHASE_LIGHT.Night.clockTime;
	Lighting.Brightness = PHASE_LIGHT.Night.brightness;
	applyAmbient();
	gameConfig.darkness.Changed.Connect(applyAmbient);
	Lighting.EnvironmentDiffuseScale = 0;
	Lighting.EnvironmentSpecularScale = 0;
	Lighting.GlobalShadows = true;
	Lighting.FogEnd = 100000;

	grade = new Instance("ColorCorrectionEffect");
	grade.Name = "HouseGrade";
	grade.Saturation = -0.25;
	grade.Contrast = 0.04; // more contrast crushed the dark rooms to black
	grade.Parent = Lighting;
}

let blend: RBXScriptConnection | undefined;

/** Blends the lighting to `phase`'s over a few seconds. Time of day always moves forward. */
export function setPhaseLighting(phase: DayPhase) {
	const target = PHASE_LIGHT[phase];
	const fromClock = Lighting.ClockTime;
	const fromBrightness = Lighting.Brightness;
	const fromScale = ambientScale;
	const fromTint = grade?.TintColor ?? target.tint;
	// Forward through the day, wrapping past midnight (18 -> 24/0 -> 6).
	const clockDelta = (target.clockTime - fromClock + 24) % 24;

	blend?.Disconnect();
	let elapsed = 0;
	blend = RunService.Heartbeat.Connect((dt) => {
		elapsed = math.min(elapsed + dt, BLEND_SECONDS);
		const t = elapsed / BLEND_SECONDS;
		Lighting.ClockTime = (fromClock + clockDelta * t) % 24;
		Lighting.Brightness = fromBrightness + (target.brightness - fromBrightness) * t;
		ambientScale = fromScale + (target.ambientScale - fromScale) * t;
		applyAmbient();
		if (grade) {
			grade.TintColor = fromTint.Lerp(target.tint, t);
		}
		if (elapsed >= BLEND_SECONDS) {
			blend?.Disconnect();
			blend = undefined;
		}
	});
}
