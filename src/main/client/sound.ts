import { SoundService } from "@rbxts/services";

/** A built-in Studio sound, so no uploaded audio is needed. Swap for real assets later. */
export const PING = "rbxasset://sounds/electronicpingshort.wav";

/** Plays a short sound for this player only. */
export function playLocalSound(id: string, volume: number, speed = 1) {
	const sound = new Instance("Sound");
	sound.SoundId = id;
	sound.Volume = volume;
	sound.PlaybackSpeed = speed;
	SoundService.PlayLocalSound(sound);
	task.delay(2, () => sound.Destroy());
}
