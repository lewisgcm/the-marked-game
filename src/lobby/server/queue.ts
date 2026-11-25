import { Players, TeleportService } from "@rbxts/services";
import { Zone } from "@rbxts/zone-plus";
import { clientSender, onClientMessage } from "shared/core/net";
import { savePartyAsync } from "shared/lobby/partyHandoff";
import { MAIN_GAME_PLACE_ID } from "shared/core/placeIds";
import { LobbyClientMessages, LobbyServerMessages } from "shared/core/remotes";
import { safeTeleport } from "shared/core/safeTeleport";
import { parsePartySize } from "./partySize";
import { LobbyWorld, LobbyZone } from "./world";

/**
 * Lifecycle of one teleport pad:
 *
 *   idle ──first player──▶ hosting ──Create──▶ open ⇄ counting ──▶ launching
 *
 * - **hosting**: the host is choosing a party size; others on the pad wait.
 * - **open**: the party exists but has fewer than LowestPlayer members.
 * - **counting**: enough players; counting down. Drops back to open if people leave.
 * - **launching**: teleport in flight; the party is locked.
 *
 * All party state lives here on the server. The only client request is the host's
 * Create, which is validated against this state. Leaving is done by walking off the pad.
 */
type ZoneState = "idle" | "hosting" | "open" | "counting" | "launching";

interface ZoneData {
	state: ZoneState;
	host?: Player;
	maxPlayers: number;
	players: Player[];
	zonePlus: Zone;
	/** Bumped on every reset/state change so stale timers and countdowns bail out. */
	generation: number;
}

/** If players are still in the lobby this long after a teleport, give the pad back. */
const LAUNCH_TIMEOUT = 30;

export class QueueManager {
	private readonly world: LobbyWorld;
	private readonly remote: RemoteEvent;
	private readonly send: ReturnType<typeof clientSender<LobbyServerMessages>>;
	private readonly config: LobbyWorld["configuration"];
	private readonly zoneData = new Map<LobbyZone, ZoneData>();

	constructor(world: LobbyWorld, remote: RemoteEvent) {
		this.world = world;
		this.remote = remote;
		this.send = clientSender<LobbyServerMessages>(remote);
		this.config = world.configuration;
	}

	public start() {
		for (const zone of this.world.zones) {
			const zonePlus = new Zone(zone.zoneContainer);
			this.zoneData.set(zone, { state: "idle", maxPlayers: 0, players: [], zonePlus, generation: 0 });
			zonePlus.playerEntered.Connect((player) => this.onPlayerEntered(zone, player));
			zonePlus.playerExited.Connect((player) => this.onPlayerExited(zone, player));
			this.resetZone(zone);
		}

		onClientMessage<LobbyClientMessages>(this.remote, {
			RequestCreate: (player, size) => this.onRequestCreate(player, size),
		});
		Players.PlayerRemoving.Connect((player) => this.onPlayerRemoving(player));
	}

	// --- Events -------------------------------------------------------------------------

	private onPlayerEntered(zone: LobbyZone, player: Player) {
		if (this.findZoneForPlayer(player)) {
			return; // already in a party elsewhere
		}
		const data = this.zoneData.get(zone)!;
		if (data.state === "idle") {
			this.becomeHost(zone, player);
		} else if ((data.state === "open" || data.state === "counting") && data.players.size() < data.maxPlayers) {
			this.joinParty(zone, player);
		}
		// While "hosting", newcomers are picked up when the host presses Create.
	}

	private onPlayerExited(zone: LobbyZone, player: Player) {
		const data = this.zoneData.get(zone)!;
		if (data.state !== "launching" && data.players.includes(player)) {
			this.leaveParty(zone, player);
		}
	}

	/** The host's Create request. `size` comes from the client, so it's validated here. */
	private onRequestCreate(player: Player, size: unknown) {
		const zone = this.findZoneForPlayer(player);
		if (!zone) {
			return;
		}
		const data = this.zoneData.get(zone)!;
		if (data.state !== "hosting" || data.host !== player) {
			return;
		}
		const lowest = this.config.lowestPlayers.Value;
		const highest = this.config.highestPlayers.Value;
		this.createParty(zone, parsePartySize(size, lowest, highest));
		// There is no leave request: players leave a party by walking off the pad.
	}

	private onPlayerRemoving(player: Player) {
		const zone = this.findZoneForPlayer(player);
		if (zone) {
			// Covers both quitting and a successful teleport out of the lobby.
			this.leaveParty(zone, player);
		}
	}

	// --- Party lifecycle ----------------------------------------------------------------

	private becomeHost(zone: LobbyZone, player: Player) {
		const data = this.zoneData.get(zone)!;
		data.state = "hosting";
		data.host = player;
		data.players = [player];
		const generation = ++data.generation;
		this.refreshDisplay(zone);

		this.send(player, "CreateParty", {
			lowest: this.config.lowestPlayers.Value,
			highest: this.config.highestPlayers.Value,
			expireSeconds: this.config.timeBeforeExpires.Value,
		});

		// Kick the host if they never create a party in time.
		task.delay(this.config.timeBeforeExpires.Value, () => {
			if (data.generation === generation && data.state === "hosting") {
				this.leaveParty(zone, player);
			}
		});
	}

	private createParty(zone: LobbyZone, maxPlayers: number) {
		const data = this.zoneData.get(zone)!;
		data.state = "open";
		data.maxPlayers = maxPlayers;
		data.generation++;

		// Switch the host's UI from the "Create Party" form to the in-party view.
		this.send(data.host!, "JoinParty", undefined);

		// Players who stepped on while the host was choosing never got added — add them now.
		for (const player of data.zonePlus.getPlayers()) {
			if (data.players.size() >= maxPlayers) {
				break;
			}
			if (!data.players.includes(player) && !this.findZoneForPlayer(player)) {
				data.players.push(player);
				this.send(player, "JoinParty", undefined);
			}
		}

		this.updateCountdown(zone);
	}

	private joinParty(zone: LobbyZone, player: Player) {
		const data = this.zoneData.get(zone)!;
		data.players.push(player);
		this.send(player, "JoinParty", undefined);
		this.updateCountdown(zone);
	}

	private leaveParty(zone: LobbyZone, player: Player) {
		const data = this.zoneData.get(zone)!;
		data.players = data.players.filter((p) => p !== player);
		if (player.Parent) {
			this.send(player, "LeaveParty", undefined);
		}

		if (data.players.size() === 0 || (data.state === "hosting" && data.host === player)) {
			this.disband(zone, player);
		} else {
			this.updateCountdown(zone);
		}
	}

	/** Ends the party, then hands the pad to anyone still standing on it. */
	private disband(zone: LobbyZone, except?: Player) {
		const data = this.zoneData.get(zone)!;
		for (const player of data.players) {
			if (player.Parent) {
				this.send(player, "LeaveParty", undefined);
			}
		}
		this.resetZone(zone);

		const nextHost = data.zonePlus.getPlayers().find((p) => p !== except && !this.findZoneForPlayer(p));
		if (nextHost) {
			this.becomeHost(zone, nextHost);
		}
	}

	private resetZone(zone: LobbyZone) {
		const data = this.zoneData.get(zone)!;
		data.state = "idle";
		data.host = undefined;
		data.maxPlayers = 0;
		data.players = [];
		data.generation++;
		this.refreshDisplay(zone);
	}

	// --- Countdown & launch -------------------------------------------------------------

	/** Starts or cancels the countdown depending on whether the party has enough players. */
	private updateCountdown(zone: LobbyZone) {
		const data = this.zoneData.get(zone)!;
		const enough = data.players.size() >= this.config.lowestPlayers.Value;

		if (data.state === "open" && enough) {
			data.state = "counting";
			const generation = ++data.generation;
			task.spawn(() => this.runCountdown(zone, generation));
		} else if (data.state === "counting" && !enough) {
			data.state = "open";
			data.generation++; // cancels the running countdown
		}
		this.refreshDisplay(zone);
	}

	private runCountdown(zone: LobbyZone, generation: number) {
		const data = this.zoneData.get(zone)!;
		for (let i = this.config.countdown.Value; i > 0; i--) {
			if (data.generation !== generation) {
				return;
			}
			zone.display.setState(`Starting in ${i}...`);
			task.wait(1);
		}
		if (data.generation !== generation) {
			return;
		}
		data.state = "launching";
		data.generation++;
		this.refreshDisplay(zone);
		this.launch(zone, data.generation);
	}

	private launch(zone: LobbyZone, generation: number) {
		const data = this.zoneData.get(zone)!;
		const players = [...data.players];

		if (MAIN_GAME_PLACE_ID === 0) {
			print("[Lobby] Main game place ID not configured - skipping teleport.");
			this.disband(zone);
			return;
		}

		// Reserve the server first so the party list can be stored under its ID before
		// anyone arrives. The main server reads it back from MemoryStore — never from the
		// client — to know who is in the party and pick the ghost.
		if (!this.teleportParty(players)) {
			warn(`[Lobby] Launch failed for ${zone.model.Name}; disbanding.`);
			this.disband(zone);
			return;
		}

		// Players leave the lobby as they teleport (PlayerRemoving clears them). If some
		// never leave, free the pad rather than leaving it stuck on "Teleporting...".
		task.delay(LAUNCH_TIMEOUT, () => {
			if (data.generation === generation && data.state === "launching") {
				this.disband(zone);
			}
		});
	}

	/** Reserves a main-game server, records the party for it, and teleports everyone. */
	private teleportParty(players: Player[]): boolean {
		const [reserved, server] = pcall(() => {
			const [accessCode, privateServerId] = TeleportService.ReserveServer(MAIN_GAME_PLACE_ID);
			return { accessCode, privateServerId };
		});
		if (!reserved) {
			warn(`[Lobby] Could not reserve a server: ${server}`);
			return false;
		}

		const userIds = players.map((p) => p.UserId);
		if (!savePartyAsync(server.privateServerId, { userIds, lobbyPlaceId: game.PlaceId })) {
			return false;
		}

		const options = new Instance("TeleportOptions");
		options.ReservedServerAccessCode = server.accessCode;
		return safeTeleport(MAIN_GAME_PLACE_ID, players, options);
	}

	// --- Helpers ------------------------------------------------------------------------

	private refreshDisplay(zone: LobbyZone) {
		const data = this.zoneData.get(zone)!;
		const lowest = this.config.lowestPlayers.Value;
		const max = data.maxPlayers === 0 ? this.config.highestPlayers.Value : data.maxPlayers;
		zone.display.setPlayerCount(`${data.players.size()}/${max}`);

		if (data.state === "idle") {
			zone.display.setState("Waiting for players...");
		} else if (data.state === "hosting") {
			zone.display.setState("Host is setting up...");
		} else if (data.state === "open") {
			const needed = lowest - data.players.size();
			zone.display.setState(`Need ${needed} more player${needed === 1 ? "" : "s"}`);
		} else if (data.state === "launching") {
			zone.display.setState("Teleporting...");
		}
		// "counting" text is driven by runCountdown.
	}

	private findZoneForPlayer(player: Player): LobbyZone | undefined {
		for (const [zone, data] of this.zoneData) {
			if (data.players.includes(player)) {
				return zone;
			}
		}
		return undefined;
	}
}
