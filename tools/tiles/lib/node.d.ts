// The few Node built-ins the build script uses (@types/node isn't installed).
declare module "node:fs" {
	export function writeFileSync(path: string, data: string): void;
	export function mkdirSync(path: string, options: { recursive: boolean }): void;
	export function readdirSync(path: string): string[];
	export function existsSync(path: string): boolean;
	export function rmSync(path: string): void;
}
declare const process: { argv: string[]; exitCode: number | undefined };
declare const console: { log(...values: unknown[]): void };
