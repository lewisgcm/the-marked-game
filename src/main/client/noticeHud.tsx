import React from "@rbxts/react";
import { noticeStore, useStore } from "./gameState";

/** Short messages from the server ("You were taken.", "Sam was taken!"), shown for a few seconds. */

const NOTICE_SECONDS = 3;

export function NoticeHud() {
	const latest = useStore(noticeStore);
	const [notice, setNotice] = React.useState<string>();

	React.useEffect(() => {
		if (!latest) {
			return;
		}
		setNotice(latest.text);
		const thread = task.delay(NOTICE_SECONDS, () => setNotice(undefined));
		return () => task.cancel(thread);
	}, [latest]);

	if (notice === undefined) {
		return undefined;
	}
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={4}>
			<textlabel
				Size={new UDim2(0, 420, 0, 40)}
				Position={new UDim2(0.5, 0, 1, -110)}
				AnchorPoint={new Vector2(0.5, 1)}
				BackgroundColor3={new Color3(0.05, 0.05, 0.07)}
				BackgroundTransparency={0.25}
				BorderSizePixel={0}
				Font={Enum.Font.GothamBold}
				TextSize={18}
				TextColor3={new Color3(1, 0.85, 0.6)}
				Text={notice}
			>
				<uicorner CornerRadius={new UDim(0, 8)} />
			</textlabel>
		</screengui>
	);
}
