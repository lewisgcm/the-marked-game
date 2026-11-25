/**
 * Who may stay in a main-game server. Pure, so it's unit-tested (tests/unit/admission.spec).
 *
 * - "allow": they're part of this round (or we can't tell — never turn a party member away).
 * - "lobby": send them to the lobby (public server, or not on the party list).
 * - "wait":  the party list isn't known yet; decide once it is.
 */
export type Admission = "allow" | "lobby" | "wait";

export interface AdmissionContext {
	/** Running in Studio: everyone is allowed, so testing works. */
	studio: boolean;
	/** A reserved server the lobby created for a party. */
	roundServer: boolean;
	/** Whether the party list has been looked up yet. */
	partyKnown: boolean;
	/** The party's user IDs, if a list was found. */
	partyUserIds?: number[];
}

export function decideAdmission(context: AdmissionContext, userId: number): Admission {
	if (context.studio) {
		return "allow";
	}
	if (!context.roundServer) {
		return "lobby";
	}
	if (!context.partyKnown) {
		return "wait";
	}
	if (context.partyUserIds === undefined) {
		return "allow"; // no list to check against; don't risk turning away the party
	}
	return context.partyUserIds.includes(userId) ? "allow" : "lobby";
}
