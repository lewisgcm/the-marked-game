import { part } from "shared/parts";

/**
 * Things that burn and smoke, for looks only (they don't hurt anyone). Particles are drawn by each
 * client, so they cost the server nothing once made; rates are kept low for phones.
 */

export type FireKind = "Fire" | "Smoke" | "Steam";

const FIRE_TEXTURE = "rbxasset://textures/particles/fire_main.dds";
const SMOKE_TEXTURE = "rbxasset://textures/particles/smoke_main.dds";

const FLAME = new ColorSequence([
	new ColorSequenceKeypoint(0, new Color3(1, 0.85, 0.45)),
	new ColorSequenceKeypoint(0.4, new Color3(1, 0.45, 0.1)),
	new ColorSequenceKeypoint(1, new Color3(0.4, 0.08, 0.03)),
]);
const SOOT = new ColorSequence(new Color3(0.16, 0.15, 0.15), new Color3(0.3, 0.29, 0.29));
const VAPOUR = new ColorSequence(new Color3(0.8, 0.82, 0.85));

/** Grows, or swells then shrinks, over a particle's life. Sizes are for a source 1 stud across. */
function sizes(scale: number, start: number, middle: number, finish: number) {
	return new NumberSequence([
		new NumberSequenceKeypoint(0, start * scale),
		new NumberSequenceKeypoint(0.35, middle * scale),
		new NumberSequenceKeypoint(1, finish * scale),
	]);
}

/** Fades in to `clear` (its least transparency), then out. */
function fade(clear: number) {
	return new NumberSequence([
		new NumberSequenceKeypoint(0, 1),
		new NumberSequenceKeypoint(0.15, clear),
		new NumberSequenceKeypoint(0.6, clear + (1 - clear) * 0.4),
		new NumberSequenceKeypoint(1, 1),
	]);
}

function emitter(source: BasePart, texture: string): ParticleEmitter {
	const e = new Instance("ParticleEmitter");
	e.Texture = texture;
	e.EmissionDirection = Enum.NormalId.Top;
	e.Rotation = new NumberRange(0, 360);
	e.RotSpeed = new NumberRange(-25, 25);
	e.Parent = source;
	return e;
}

function addFlames(source: BasePart, scale: number) {
	const e = emitter(source, FIRE_TEXTURE);
	e.Color = FLAME;
	e.Size = sizes(scale, 0.5, 0.9, 0.1);
	e.Transparency = fade(0.15);
	e.Lifetime = new NumberRange(0.6, 1.1);
	e.Rate = 14;
	e.Speed = new NumberRange(1.5 * scale, 2.5 * scale);
	e.SpreadAngle = new Vector2(12, 12);
	e.LightEmission = 0.9;
	e.LightInfluence = 0;

	const glow = new Instance("PointLight");
	glow.Color = new Color3(1, 0.55, 0.2);
	glow.Range = 14 + 4 * scale;
	glow.Brightness = 1.5;
	glow.Shadows = false;
	glow.Parent = source;
}

function addSmoke(source: BasePart, scale: number) {
	const e = emitter(source, SMOKE_TEXTURE);
	e.Color = SOOT;
	e.Size = sizes(scale, 0.8, 2, 4.5);
	e.Transparency = fade(0.45);
	e.Lifetime = new NumberRange(4, 6);
	e.Rate = 6;
	e.Speed = new NumberRange(3, 4.5);
	e.SpreadAngle = new Vector2(8, 8);
	e.Acceleration = new Vector3(0.5, 0.2, 0); // drifts along the street
	e.LightInfluence = 1; // dark at night
}

function addSteam(source: BasePart, scale: number) {
	const e = emitter(source, SMOKE_TEXTURE);
	e.Color = VAPOUR;
	e.Size = sizes(scale, 0.3, 0.9, 1.8);
	e.Transparency = fade(0.75);
	e.Lifetime = new NumberRange(1.5, 2.5);
	e.Rate = 5;
	e.Speed = new NumberRange(1.5, 2.5);
	e.SpreadAngle = new Vector2(15, 15);
	e.LightInfluence = 1;
}

const MAKERS: Record<FireKind, (source: BasePart, scale: number) => void> = {
	Fire: addFlames,
	Smoke: addSmoke,
	Steam: addSteam,
};

/** Starts `kind` rising from a patch `scale` studs across at `at`. */
export function addFire(parent: Instance, kind: FireKind, at: CFrame, scale: number) {
	const source = part(parent, kind, new Vector3(scale, 0.2, scale), at, {
		collide: false,
		transparency: 1,
		shadow: false,
	});
	source.CanQuery = false; // beams and shots go through
	source.CanTouch = false;
	MAKERS[kind](source, scale);
}
