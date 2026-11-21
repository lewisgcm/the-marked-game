import { RunService, ServerStorage } from "@rbxts/services";

/**
 * Server-only tunables, exposed as IntValues in `Configuration` instances under ServerStorage.
 * ServerStorage never replicates, so players can't read or tamper with them.
 *
 * **Code is the source of truth.** Every value is written from code at server start,
 * overwriting anything saved in the place file — so settings can't drift out of git. Values
 * can still be tweaked live in Studio during a play session; the change just doesn't stick.
 */
export function getServerConfig(name: string): Configuration {
	const existing = ServerStorage.FindFirstChild(name);
	if (existing && existing.IsA("Configuration")) {
		return existing;
	}
	const config = new Instance("Configuration");
	config.Name = name;
	config.Parent = ServerStorage;
	return config;
}

/**
 * Sets `name` in `config` to `value`, creating the IntValue if needed.
 *
 * `studioValue`, if given, is used instead when running in Studio — for test-friendly
 * settings (short rounds, solo parties) that are version-controlled and can never reach a
 * live server.
 */
export function configInt(config: Configuration, name: string, value: number, studioValue?: number): IntValue {
	let intValue = config.FindFirstChild(name);
	if (!intValue || !intValue.IsA("IntValue")) {
		intValue?.Destroy();
		intValue = new Instance("IntValue");
		intValue.Name = name;
		intValue.Parent = config;
	}
	(intValue as IntValue).Value = RunService.IsStudio() && studioValue !== undefined ? studioValue : value;
	return intValue as IntValue;
}

/** Like `configInt`, for values that need decimals (rates, factors, seconds). */
export function configNumber(config: Configuration, name: string, value: number, studioValue?: number): NumberValue {
	let numberValue = config.FindFirstChild(name);
	if (!numberValue || !numberValue.IsA("NumberValue")) {
		numberValue?.Destroy();
		numberValue = new Instance("NumberValue");
		numberValue.Name = name;
		numberValue.Parent = config;
	}
	(numberValue as NumberValue).Value = RunService.IsStudio() && studioValue !== undefined ? studioValue : value;
	return numberValue as NumberValue;
}
