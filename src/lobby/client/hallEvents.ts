/**
 * What happens in the hall that the parents react to (hallGlitch.ts says when): a glitch through every
 * screen at once, when they all freeze; and the news trolley's screen glitching on its own, when one of them
 * twitches.
 */

type Listener = () => void;
const hallGlitch: Listener[] = [];
const tvGlitch: Listener[] = [];

export const onHallGlitch = (listener: Listener) => hallGlitch.push(listener);
export const onTvGlitch = (listener: Listener) => tvGlitch.push(listener);
export const hallGlitched = () => hallGlitch.forEach((listener) => listener());
export const tvGlitched = () => tvGlitch.forEach((listener) => listener());
