/** Flashlight tuning, shared by the server (reveal checks) and clients (visuals). */

/** How far the beam reaches, in studs. Also the reveal range. */
export const FLASHLIGHT_RANGE = 60;

/** Half-angle of the beam cone, in degrees. The ghost must be inside it to be revealed. */
export const FLASHLIGHT_HALF_ANGLE = 30;

/** How often the server re-checks reveals (per second). */
export const FLASHLIGHT_TICK_RATE = 10;

/** The beam tilts slightly down from the character's facing, so it lights the floor ahead. */
export const BEAM_DOWNWARD_TILT = 8;

/** Length of the visible light cone, in studs. It fades out before the light's full range. */
export const BEAM_VISUAL_LENGTH = 32;

/**
 * The visible cone is CONE_PLANES flat beams crossed around the beam's axis (like a fan seen
 * end-on), so from any side you look through several planes and it reads as a 3D volume.
 */
export const CONE_PLANES = 4;

/** Names of the instances the server builds, which the client looks up. */
export const FLASHLIGHT_TOOL_NAME = "Flashlight";

/** Attachments on the lens for cone plane `i`. Plane 0's start also holds the SpotLight. */
export function coneAttachmentNames(i: number): [string, string] {
	return [`ConeStart${i}`, `ConeEnd${i}`];
}

/**
 * Points the cone along `aim`: every plane starts at the lens and ends BEAM_VISUAL_LENGTH
 * along `aim`, each rolled a further 180/CONE_PLANES degrees around the axis. Plane 0's start
 * faces `aim`, which also aims the SpotLight. Each client does this every frame for every
 * hunter, so beams stay locked to the torch in the hand.
 */
export function pointCone(planes: Array<[Attachment, Attachment]>, aim: Vector3) {
	if (planes.size() === 0) {
		return;
	}
	const origin = planes[0][0].WorldPosition;
	const finish = origin.add(aim.mul(BEAM_VISUAL_LENGTH));
	planes.forEach(([start, stop], i) => {
		const roll = CFrame.Angles(0, 0, (math.pi * i) / planes.size());
		start.WorldCFrame = CFrame.lookAt(origin, finish).mul(roll);
		stop.WorldCFrame = CFrame.lookAt(finish, finish.add(aim)).mul(roll);
	});
}

/** Finds the cone attachments on a flashlight Tool, or undefined if it isn't built yet. */
export function findConePlanes(tool: Instance): Array<[Attachment, Attachment]> | undefined {
	const lens = tool.FindFirstChild("Lens");
	if (!lens) {
		return undefined;
	}
	const planes: Array<[Attachment, Attachment]> = [];
	for (let i = 0; i < CONE_PLANES; i++) {
		const [startName, endName] = coneAttachmentNames(i);
		const start = lens.FindFirstChild(startName);
		const stop = lens.FindFirstChild(endName);
		if (!start?.IsA("Attachment") || !stop?.IsA("Attachment")) {
			return undefined;
		}
		planes.push([start, stop]);
	}
	return planes;
}

/**
 * Where a hunter's beam points: straight ahead of the character, tilted slightly down.
 * Derived from the character's root part, so the server and every client agree on it without
 * any client input.
 */
export function beamDirection(root: BasePart): Vector3 {
	return root.CFrame.mul(CFrame.Angles(math.rad(-BEAM_DOWNWARD_TILT), 0, 0)).LookVector;
}

/**
 * Is `point` inside a beam from `origin` pointing along `aim` (a unit vector) — within `range`
 * studs and within the cone whose half-angle has cosine `cosHalfAngle`? Geometry only: walls
 * are checked separately with a raycast. Pure, so it's unit-tested (tests/unit).
 */
export function inBeamCone(
	origin: Vector3,
	aim: Vector3,
	point: Vector3,
	range: number,
	cosHalfAngle: number,
): boolean {
	const offset = point.sub(origin);
	const distance = offset.Magnitude;
	if (distance > range || distance < 0.01) {
		return false;
	}
	return offset.Unit.Dot(aim) >= cosHalfAngle;
}
