import React from "@rbxts/react";
import { nightSummaryStore, useStore } from "./gameState";

/** Dawn: the night is over, and what it cost. The only thing that announces dawn (no banner). */

const SHOW_SECONDS = 6;

export function DawnCard() {
	const latest = useStore(nightSummaryStore);
	const [visible, setVisible] = React.useState(false);

	React.useEffect(() => {
		if (!latest) {
			return;
		}
		setVisible(true);
		const thread = task.delay(SHOW_SECONDS, () => setVisible(false));
		return () => task.cancel(thread);
	}, [latest]);

	if (!visible || !latest) {
		return undefined;
	}
	return (
		<screengui ResetOnSpawn={false} DisplayOrder={4}>
			<frame
				Size={new UDim2(0, 320, 0, 60 + latest.summary.lines.size() * 26)}
				Position={new UDim2(0.5, 0, 0.34, 0)}
				AnchorPoint={new Vector2(0.5, 0)}
				BackgroundColor3={new Color3(0.06, 0.05, 0.07)}
				BackgroundTransparency={0.2}
				BorderSizePixel={0}
			>
				<uicorner CornerRadius={new UDim(0, 10)} />
				<textlabel
					Size={new UDim2(1, 0, 0, 30)}
					Position={new UDim2(0, 0, 0, 10)}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBlack}
					TextSize={24}
					TextColor3={new Color3(1, 0.82, 0.8)}
					Text={latest.summary.title}
				/>
				{latest.summary.lines.map((line, i) => (
					<textlabel
						Size={new UDim2(1, -24, 0, 24)}
						Position={new UDim2(0, 12, 0, 46 + i * 26)}
						BackgroundTransparency={1}
						Font={Enum.Font.GothamBold}
						TextSize={17}
						TextTruncate={Enum.TextTruncate.AtEnd}
						TextColor3={new Color3(0.9, 0.9, 0.92)}
						Text={line}
					/>
				))}
			</frame>
		</screengui>
	);
}
