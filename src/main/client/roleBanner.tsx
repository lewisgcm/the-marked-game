import React from "@rbxts/react";

import { Role } from "shared/roles";

const COPY: Record<Role, { title: string; body: string; color: Color3 }> = {
	Ghost: {
		title: "You are the GHOST",
		body: "Stay hidden until the clock runs out. Flashlights reveal you.",
		color: new Color3(0.7, 0.82, 1),
	},
	Hunter: {
		title: "You are a HUNTER",
		body: "Find the keys, gather the book, candles and skull, and banish the ghost. Your flashlight reveals it.",
		color: new Color3(1, 0.75, 0.45),
	},
};

/** How long the banner stays up after a role is assigned. */
const SHOW_SECONDS = 8;

export function RoleBanner({ role }: { role?: Role }) {
	const [visible, setVisible] = React.useState(false);

	React.useEffect(() => {
		if (role === undefined) {
			return;
		}
		setVisible(true);
		const thread = task.delay(SHOW_SECONDS, () => setVisible(false));
		return () => task.cancel(thread);
	}, [role]);

	if (role === undefined) {
		return undefined;
	}
	const copy = COPY[role];
	return (
		<screengui ResetOnSpawn={false} Enabled={visible}>
			<frame
				Size={new UDim2(0, 520, 0, 110)}
				Position={new UDim2(0.5, 0, 0, 60)}
				AnchorPoint={new Vector2(0.5, 0)}
				BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
				BackgroundTransparency={0.25}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 10)} />
				<uipadding
					PaddingLeft={new UDim(0, 16)}
					PaddingRight={new UDim(0, 16)}
					PaddingTop={new UDim(0, 12)}
					PaddingBottom={new UDim(0, 12)}
				/>
				<textlabel
					Size={new UDim2(1, 0, 0, 40)}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBlack}
					TextSize={30}
					TextColor3={copy.color}
					Text={copy.title}
				/>
				<textlabel
					Size={new UDim2(1, 0, 1, -44)}
					Position={new UDim2(0, 0, 0, 44)}
					BackgroundTransparency={1}
					Font={Enum.Font.Gotham}
					TextSize={16}
					TextWrapped={true}
					TextColor3={new Color3(0.9, 0.9, 0.92)}
					Text={copy.body}
				/>
			</frame>
		</screengui>
	);
}
