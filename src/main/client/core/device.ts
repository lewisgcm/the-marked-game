import { UserInputService } from "@rbxts/services";

/** Whether this is a phone or tablet: touch and no mouse, so the joystick and jump button show. */
export function isTouch(): boolean {
	return UserInputService.TouchEnabled && !UserInputService.MouseEnabled;
}
