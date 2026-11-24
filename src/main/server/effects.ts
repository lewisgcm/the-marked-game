/** One-shot sounds and flashes, made on the server so everyone gets them. */

const HIT_FLASH = new Color3(1, 0.15, 0.15);
const HIT_FLASH_SECONDS = 0.3;

export interface SoundOptions {
	volume?: number;
	/** How far it carries, in studs. */
	range?: number;
	speed?: number;
}

/** Plays a sound at `parent`, then cleans it up. */
export function playSound(parent: Instance, id: string, options: SoundOptions = {}) {
	const sound = new Instance("Sound");
	sound.SoundId = id;
	sound.Volume = options.volume ?? 1;
	sound.PlaybackSpeed = options.speed ?? 1;
	if (options.range !== undefined) {
		sound.RollOffMaxDistance = options.range;
	}
	sound.Parent = parent;
	sound.Play();
	task.delay(2, () => sound.Destroy());
}

/** A red flash on a struck model. */
export function hitFlash(model: Model) {
	const highlight = new Instance("Highlight");
	highlight.Name = "HitFlash";
	highlight.FillColor = HIT_FLASH;
	highlight.FillTransparency = 0.3;
	highlight.OutlineColor = HIT_FLASH;
	highlight.DepthMode = Enum.HighlightDepthMode.Occluded;
	highlight.Parent = model;
	task.delay(HIT_FLASH_SECONDS, () => highlight.Destroy());
}
