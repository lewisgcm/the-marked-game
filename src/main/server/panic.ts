import { gameConfig } from "./config";
import { setFlashlightDisabled } from "./flashlight";
import { setSpeedModifier } from "./speed";

/**
 * What panic does to a hunter (sanity hit 0; see shared/sanity.ts for when it starts/ends):
 * their flashlight dies, they slow down, and they scream every so often — loud enough to carry
 * across the house, so the ghost can home in and teammates know who needs help.
 *
 * Flashlight and speed effects are keyed by player, so resetting doesn't escape panic.
 */

// Placeholder: a built-in Studio sound, pitched down. Swap for a real scream asset later.
const SCREAM_SOUND = "rbxasset://sounds/uuhhh.mp3";

const screaming = new Set<Player>();

function scream(player: Player) {
	const hrp = player.Character?.FindFirstChild("HumanoidRootPart");
	if (!hrp || !hrp.IsA("BasePart")) {
		return;
	}
	const sound = new Instance("Sound");
	sound.Name = "PanicScream";
	sound.SoundId = SCREAM_SOUND;
	sound.PlaybackSpeed = 0.65;
	sound.Volume = 2;
	sound.RollOffMode = Enum.RollOffMode.InverseTapered;
	sound.RollOffMinDistance = 10;
	sound.RollOffMaxDistance = 160; // carries across the whole house
	sound.Parent = hrp;
	sound.Play();
	task.delay(4, () => sound.Destroy());
}

export function setPanicEffects(player: Player, panicking: boolean) {
	setFlashlightDisabled(player, panicking);
	setSpeedModifier(player, "panic", panicking ? gameConfig.panicSpeedFactor.Value : undefined);

	if (panicking && !screaming.has(player)) {
		screaming.add(player);
		task.spawn(() => {
			while (screaming.has(player) && player.Parent) {
				scream(player);
				task.wait(gameConfig.panicScreamInterval.Value);
			}
		});
	} else if (!panicking) {
		screaming.delete(player);
	}
}
