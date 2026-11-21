import React from "@rbxts/react";
import { Lighting, Players, ReplicatedStorage, RunService, Workspace } from "@rbxts/services";
import { ROUND_PHASE_ATTRIBUTE } from "shared/round";
import { PANIC_ATTRIBUTE, SANITY_ATTRIBUTE, SANITY_MAX } from "shared/sanity";

/**
 * The local hunter's sanity: a meter (above the inventory panel) and screen effects that
 * grow as sanity drops — colour drains away, the edges darken, and at very low sanity the
 * view blurs. Display only; the server owns the value (main/server/sanity.ts).
 */

const player = Players.LocalPlayer;

function readSanity(): number {
	const value = player.GetAttribute(SANITY_ATTRIBUTE);
	return typeIs(value, "number") ? value : SANITY_MAX;
}

function useSanity(): number {
	const [value, setValue] = React.useState(readSanity());
	React.useEffect(() => {
		const connection = player.GetAttributeChangedSignal(SANITY_ATTRIBUTE).Connect(() => setValue(readSanity()));
		return () => connection.Disconnect();
	}, []);
	return value;
}

function usePanicking(): boolean {
	const read = () => player.GetAttribute(PANIC_ATTRIBUTE) === true;
	const [value, setValue] = React.useState(read());
	React.useEffect(() => {
		const connection = player.GetAttributeChangedSignal(PANIC_ATTRIBUTE).Connect(() => setValue(read()));
		return () => connection.Disconnect();
	}, []);
	return value;
}

/** A small, noisy camera shake while panicking (applied after the camera scripts each frame). */
const SHAKE_BINDING = "PanicShake";
function setCameraShake(on: boolean) {
	RunService.UnbindFromRenderStep(SHAKE_BINDING);
	if (!on) {
		return;
	}
	RunService.BindToRenderStep(SHAKE_BINDING, Enum.RenderPriority.Camera.Value + 1, () => {
		const camera = Workspace.CurrentCamera;
		if (!camera) {
			return;
		}
		const t = os.clock();
		const amount = math.rad(0.6);
		camera.CFrame = camera.CFrame.mul(
			CFrame.Angles(math.noise(t * 6, 1) * amount, math.noise(t * 6, 2) * amount, math.noise(t * 6, 3) * amount),
		);
	});
}

function usePhase(): string {
	const read = () => (ReplicatedStorage.GetAttribute(ROUND_PHASE_ATTRIBUTE) as string | undefined) ?? "Waiting";
	const [phase, setPhase] = React.useState(read());
	React.useEffect(() => {
		const connection = ReplicatedStorage.GetAttributeChangedSignal(ROUND_PHASE_ATTRIBUTE).Connect(() =>
			setPhase(read()),
		);
		return () => connection.Disconnect();
	}, []);
	return phase;
}

/** Local-only post effects, created once and driven by `fear` (0 calm .. 1 terrified). */
const grade = new Instance("ColorCorrectionEffect");
grade.Name = "SanityGrade";
grade.Parent = Lighting;
const blur = new Instance("BlurEffect");
blur.Name = "SanityBlur";
blur.Size = 0;
blur.Parent = Lighting;

function applyEffects(fear: number) {
	grade.Saturation = -0.7 * fear;
	grade.Contrast = 0.2 * fear;
	grade.TintColor = new Color3(1, 1, 1).Lerp(new Color3(0.8, 0.85, 1), fear);
	// Blur only kicks in below 30% sanity.
	blur.Size = math.max(0, (fear - 0.7) / 0.3) * 8;
}

function Vignette({ fear }: { fear: number }) {
	const edge = 1 - 0.85 * fear;
	const sequence = new NumberSequence([
		new NumberSequenceKeypoint(0, edge),
		new NumberSequenceKeypoint(0.22, 1),
		new NumberSequenceKeypoint(0.78, 1),
		new NumberSequenceKeypoint(1, edge),
	]);
	const band = (rotation: number) => (
		<frame Size={new UDim2(1, 0, 1, 0)} BackgroundColor3={new Color3(0, 0, 0)} BorderSizePixel={0}>
			<uigradient Transparency={sequence} Rotation={rotation} />
		</frame>
	);
	return (
		<frame Size={new UDim2(1, 0, 1, 0)} BackgroundTransparency={1}>
			{band(0)}
			{band(90)}
		</frame>
	);
}

function Meter({ value, panicking }: { value: number; panicking: boolean }) {
	const fraction = value / SANITY_MAX;
	// While panicking, the label pulses between red and white.
	const [pulse, setPulse] = React.useState(false);
	React.useEffect(() => {
		if (!panicking) {
			return;
		}
		const connection = RunService.Heartbeat.Connect(() => setPulse(os.clock() % 0.8 < 0.4));
		return () => connection.Disconnect();
	}, [panicking]);
	const color = new Color3(0.85, 0.25, 0.25).Lerp(new Color3(0.55, 0.75, 1), fraction);
	return (
		<frame
			Size={new UDim2(0, 340, 0, 30)}
			Position={new UDim2(0, 12, 1, -84)}
			AnchorPoint={new Vector2(0, 1)}
			BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
			BackgroundTransparency={0.3}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={new UDim(0, 8)} />
			<frame
				Size={new UDim2(fraction, 0, 1, 0)}
				BackgroundColor3={color}
				BackgroundTransparency={0.25}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
			</frame>
			<textlabel
				Size={new UDim2(1, -16, 1, 0)}
				Position={new UDim2(0, 8, 0, 0)}
				BackgroundTransparency={1}
				Font={Enum.Font.GothamBold}
				TextSize={16}
				TextXAlignment={Enum.TextXAlignment.Left}
				TextColor3={panicking && pulse ? new Color3(1, 0.25, 0.25) : new Color3(1, 1, 1)}
				TextStrokeTransparency={0.5}
				Text={panicking ? `PANICKING — find light or a teammate (${value})` : `Sanity ${value}`}
			/>
		</frame>
	);
}

export function SanityHud({ isHunter }: { isHunter: boolean }) {
	const value = useSanity();
	const panicking = usePanicking();
	const phase = usePhase();
	const active = isHunter && phase === "Hunt";
	const fear = active ? 1 - value / SANITY_MAX : 0;

	React.useEffect(() => applyEffects(fear), [fear]);
	React.useEffect(() => {
		setCameraShake(active && panicking);
		return () => setCameraShake(false);
	}, [active, panicking]);

	if (!active) {
		return undefined;
	}
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={3} IgnoreGuiInset={true}>
			<Vignette fear={fear} />
			<Meter value={value} panicking={panicking} />
		</screengui>
	);
}
