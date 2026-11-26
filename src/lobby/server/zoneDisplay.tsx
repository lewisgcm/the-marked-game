import React from "@rbxts/react";
import { createPortal, createRoot } from "@rbxts/react-roblox";

/** A server-rendered BillboardGui showing a zone's player count and state. */
export interface ZoneDisplay {
	setPlayerCount(text: string): void;
	setState(text: string): void;
}

/**
 * Mounts a BillboardGui onto `mount` (parented to it) and adorns it to `adornee`.
 * Returns an updater that re-renders the two labels.
 */
export function createZoneDisplay(mount: Instance, adornee: PVInstance): ZoneDisplay {
	// Root in an empty folder, portal into `mount`: a root would clear `mount`'s other children.
	const root = createRoot(new Instance("Folder"));

	let playerCount = "0/4";
	let state = "Waiting for players...";

	const render = () => {
		root.render(
			createPortal(<ZoneDisplayComponent adornee={adornee} playerCount={playerCount} state={state} />, mount),
		);
	};
	render();

	return {
		setPlayerCount(text) {
			playerCount = text;
			render();
		},
		setState(text) {
			state = text;
			render();
		},
	};
}

interface ZoneDisplayProps {
	adornee: PVInstance;
	playerCount: string;
	state: string;
}

function ZoneDisplayComponent({ adornee, playerCount, state }: ZoneDisplayProps) {
	return (
		<billboardgui
			Size={new UDim2(0, 240, 0, 64)}
			StudsOffset={new Vector3(0, 9, 0)}
			AlwaysOnTop={true}
			Adornee={adornee}
		>
			<textlabel
				Size={new UDim2(1, 0, 0.6, 0)}
				Position={new UDim2(0, 0, 0, 0)}
				BackgroundTransparency={1}
				TextColor3={new Color3(1, 1, 1)}
				Font={Enum.Font.GothamBold}
				TextScaled={true}
				Text={playerCount}
			/>
			<textlabel
				Size={new UDim2(1, 0, 0.32, 0)}
				Position={new UDim2(0, 0, 0.66, 0)}
				BackgroundTransparency={1}
				TextColor3={new Color3(1, 0.85, 0.4)}
				Font={Enum.Font.Gotham}
				TextScaled={true}
				Text={state}
			/>
		</billboardgui>
	);
}
