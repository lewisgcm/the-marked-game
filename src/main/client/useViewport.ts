import React from "@rbxts/react";
import { Workspace } from "@rbxts/services";

/** The screen size, kept up to date. For shrinking fixed-size panels to fit small screens. */
export function useViewport(): Vector2 {
	const camera = Workspace.CurrentCamera;
	const [size, setSize] = React.useState(camera ? camera.ViewportSize : new Vector2(1280, 720));
	React.useEffect(() => {
		if (!camera) {
			return;
		}
		const connection = camera.GetPropertyChangedSignal("ViewportSize").Connect(() => setSize(camera.ViewportSize));
		return () => connection.Disconnect();
	}, [camera]);
	return size;
}
