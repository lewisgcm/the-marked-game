/**
 * Typed wrappers around RemoteEvents, driven by the message maps in shared/core/remotes.ts.
 *
 * Every message is sent as (name, payload). The types tie each name to its payload, so
 * sending or handling an unknown message, or the wrong payload, fails to compile.
 */

type Handlers<M, Args extends unknown[]> = { [K in keyof M]?: (...args: [...Args, M[K]]) => void };

// --- Server side --------------------------------------------------------------------------

/** Server: a typed `send(player, name, payload)` bound to one remote. */
export function clientSender<M>(remote: RemoteEvent) {
	return <K extends keyof M & string>(player: Player, name: K, payload: M[K]) =>
		remote.FireClient(player, name, payload);
}

/**
 * Server: handles messages from clients. Payloads arrive as `unknown` on purpose: anything a
 * client sends must be validated before use.
 */
export function onClientMessage<M>(
	remote: RemoteEvent,
	handlers: { [K in keyof M]?: (player: Player, payload: unknown) => void },
): RBXScriptConnection {
	return remote.OnServerEvent.Connect((player, name, payload) => {
		if (typeIs(name, "string")) {
			handlers[name as keyof M]?.(player, payload);
		}
	});
}

// --- Client side --------------------------------------------------------------------------

/** Client: a typed `send(name, payload)` to the server. */
export function serverSender<M>(remote: RemoteEvent) {
	return <K extends keyof M & string>(name: K, payload: M[K]) => remote.FireServer(name, payload);
}

/** Client: handles messages from the server. Call as often as needed; each call connects. */
export function onServerMessage<M>(remote: RemoteEvent, handlers: Handlers<M, []>): RBXScriptConnection {
	return remote.OnClientEvent.Connect((name: unknown, payload: unknown) => {
		if (typeIs(name, "string")) {
			(handlers[name as keyof M] as ((payload: unknown) => void) | undefined)?.(payload);
		}
	});
}
