import { gameConfig } from "./config";
import { isAlive, takeKid } from "./life";

/**
 * Kids' health: their Humanoid's Health, which only the server changes. The infected hurt kids
 * through `damageKid`; at 0 a kid is taken (life.ts) instead of dying. No regeneration (life.ts
 * removes it); `healAll` at dawn.
 */

export interface HealthHooks {
	/** Tells a kid they were struck (red flash). */
	sendHurt: (player: Player) => void;
}

let hooks: HealthHooks | undefined;

function humanoidOf(player: Player): Humanoid | undefined {
	const humanoid = player.Character?.FindFirstChildOfClass("Humanoid");
	return humanoid && humanoid.Health > 0 ? humanoid : undefined;
}

/** Sets up a kid's character's health on spawn. */
export function setUpHealth(character: Model) {
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (humanoid) {
		humanoid.MaxHealth = gameConfig.kidMaxHealth.Value;
		humanoid.Health = humanoid.MaxHealth;
	}
}

/** Hurts a kid. At 0 health they're taken. */
export function damageKid(player: Player, amount: number) {
	const humanoid = humanoidOf(player);
	if (!humanoid || !isAlive(player) || amount <= 0) {
		return;
	}
	hooks?.sendHurt(player);
	if (humanoid.Health - amount <= 0) {
		takeKid(player);
	} else {
		humanoid.Health -= amount;
	}
}

/** Dawn: every kid still in is healed to full. */
export function healAll(kids: Player[]) {
	for (const player of kids) {
		const humanoid = humanoidOf(player);
		if (humanoid) {
			humanoid.Health = humanoid.MaxHealth;
		}
	}
}

export function startHealth(healthHooks: HealthHooks) {
	hooks = healthHooks;
}
