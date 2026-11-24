import React from "@rbxts/react";
import { EndReason } from "shared/round";
import { ScoreCard } from "shared/scoreboard";
import { scoreboardStore, useStore } from "./gameState";
import { useViewport } from "./useViewport";
import { PALE, WHITE } from "./theme";

/**
 * The end screen: how the run ended, a card per kid (avatar, name, fun title, a few stats), and
 * a "Back to lobby" button so nobody has to wait for the timer. Designed at a fixed size and
 * shrunk with a UIScale to fit small screens.
 */

const END_TEXT: Record<EndReason, string> = {
	AllTaken: "Every kid was taken.",
};

const CARD_WIDTH = 170;
const CARD_HEIGHT = 200;
const GAP = 12;
const PER_ROW = 5;
const HEADER_HEIGHT = 130;
const FOOTER_HEIGHT = 80;

const TAKEN_COLOR = new Color3(1, 0.35, 0.35);
const KID_COLOR = new Color3(1, 0.8, 0.45);

function Card({ card, order }: { card: ScoreCard; order: number }) {
	const accent = card.taken ? TAKEN_COLOR : KID_COLOR;
	const text = (y: number, height: number, value: string, size: number, color: Color3, bold = false) => (
		<textlabel
			Size={new UDim2(1, -12, 0, height)}
			Position={new UDim2(0, 6, 0, y)}
			BackgroundTransparency={1}
			Font={bold ? Enum.Font.GothamBold : Enum.Font.Gotham}
			TextSize={size}
			TextColor3={color}
			TextTruncate={Enum.TextTruncate.AtEnd}
			Text={value}
		/>
	);
	return (
		<frame
			LayoutOrder={order}
			Size={new UDim2(0, CARD_WIDTH, 0, CARD_HEIGHT)}
			BackgroundColor3={new Color3(0.08, 0.08, 0.11)}
			BackgroundTransparency={0.1}
			BorderSizePixel={0}
		>
			<uicorner CornerRadius={new UDim(0, 10)} />
			<uistroke Color={accent} Thickness={1} Transparency={0.5} />
			<imagelabel
				Size={new UDim2(0, 64, 0, 64)}
				Position={new UDim2(0.5, 0, 0, 8)}
				AnchorPoint={new Vector2(0.5, 0)}
				BackgroundColor3={new Color3(0.15, 0.15, 0.18)}
				Image={`rbxthumb://type=AvatarHeadShot&id=${card.userId}&w=150&h=150`}
				ImageTransparency={card.taken ? 0.5 : 0}
				ImageColor3={card.taken ? new Color3(0.6, 0.6, 0.6) : WHITE}
			>
				<uicorner CornerRadius={new UDim(1, 0)} />
			</imagelabel>
			{text(76, 18, card.name, 14, new Color3(0.92, 0.92, 0.95), true)}
			{text(96, 22, card.title, 18, accent, true)}
			{text(118, 14, card.titleHint, 11, new Color3(0.6, 0.6, 0.66))}
			{card.lines.map((line, i) => text(140 + i * 17, 16, line, 13, new Color3(0.82, 0.82, 0.86)))}
		</frame>
	);
}

export function EndScreen({
	reason,
	nightsSurvived,
	secondsLeft,
	onLeave,
}: {
	reason?: EndReason;
	nightsSurvived: number;
	secondsLeft: number;
	onLeave: () => void;
}) {
	const cards = useStore(scoreboardStore) ?? [];
	const viewport = useViewport();
	const [leaving, setLeaving] = React.useState(false);

	// Lay the cards out in rows of up to PER_ROW, then scale the whole thing to fit the screen.
	const perRow = math.max(1, math.min(cards.size(), PER_ROW));
	const rows = math.max(1, math.ceil(cards.size() / PER_ROW));
	const width = math.max(560, perRow * (CARD_WIDTH + GAP) + GAP);
	const height = HEADER_HEIGHT + rows * (CARD_HEIGHT + GAP) + FOOTER_HEIGHT;
	const scale = math.min(1, (viewport.X * 0.96) / width, (viewport.Y * 0.94) / height);

	return (
		<frame
			Size={new UDim2(1, 0, 1, 0)}
			BackgroundColor3={new Color3(0, 0, 0)}
			BackgroundTransparency={0.3}
			BorderSizePixel={0}
		>
			<frame
				Size={new UDim2(0, width, 0, height)}
				Position={new UDim2(0.5, 0, 0.5, 0)}
				AnchorPoint={new Vector2(0.5, 0.5)}
				BackgroundTransparency={1}
			>
				<uiscale Scale={scale} />
				<textlabel
					Size={new UDim2(1, 0, 0, 70)}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBlack}
					TextSize={60}
					TextColor3={TAKEN_COLOR}
					TextStrokeTransparency={0.5}
					Text={`SURVIVED ${nightsSurvived} ${nightsSurvived === 1 ? "NIGHT" : "NIGHTS"}`}
				/>
				<textlabel
					Size={new UDim2(1, 0, 0, 30)}
					Position={new UDim2(0, 0, 0, 74)}
					BackgroundTransparency={1}
					Font={Enum.Font.GothamBold}
					TextSize={20}
					TextColor3={PALE}
					Text={END_TEXT[reason ?? "AllTaken"]}
				/>
				<frame
					Size={new UDim2(1, 0, 0, rows * (CARD_HEIGHT + GAP))}
					Position={new UDim2(0, 0, 0, HEADER_HEIGHT)}
					BackgroundTransparency={1}
				>
					<uigridlayout
						CellSize={new UDim2(0, CARD_WIDTH, 0, CARD_HEIGHT)}
						CellPadding={new UDim2(0, GAP, 0, GAP)}
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					{cards.map((card, i) => (
						<Card key={`card${card.userId}`} card={card} order={i} />
					))}
				</frame>
				<textbutton
					Size={new UDim2(0, 280, 0, 52)}
					Position={new UDim2(0.5, 0, 1, -10)}
					AnchorPoint={new Vector2(0.5, 1)}
					BackgroundColor3={leaving ? new Color3(0.2, 0.2, 0.24) : new Color3(0.3, 0.5, 0.35)}
					BorderSizePixel={0}
					AutoButtonColor={!leaving}
					Font={Enum.Font.GothamBold}
					TextSize={20}
					TextColor3={WHITE}
					Text={leaving ? "Heading back..." : `Back to lobby (${secondsLeft})`}
					Event={{
						Activated: () => {
							if (!leaving) {
								setLeaving(true);
								onLeave();
							}
						},
					}}
				>
					<uicorner CornerRadius={new UDim(0, 10)} />
				</textbutton>
			</frame>
		</frame>
	);
}
