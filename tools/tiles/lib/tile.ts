import { CFrame, round } from "./cframe.ts";
import type { Style } from "./styles.ts";

/**
 * A tile being built: parts grouped into folders, written out as a Rojo model file. See MAP.md for
 * the rules (200x200 around the origin, ground at y = 0, north is -Z).
 */

export type Route = "Road" | "Path" | "None";
export type Ground = "Town" | "Grass" | "Forest" | "Swamp";
export type Edge = `${Route}/${Ground}`;
export type Side = "North" | "East" | "South" | "West";

/** What a loot container holds (the loot tables in src/shared/items/loot.ts). */
export type LootKind = "Kitchen" | "Drawers" | "Garage" | "Car";

/** One instance in a Rojo model file. */
export interface Instance {
	name: string;
	className: string;
	properties?: Record<string, unknown>;
	attributes?: Record<string, string | number | boolean>;
	children?: Instance[];
}

export interface PartOptions {
	className?: "Part" | "WedgePart";
	shape?: "Cylinder" | "Ball";
	tags?: string[];
	attributes?: Record<string, string>;
	children?: Instance[];
}

export class Tile {
	readonly name: string;
	readonly edges: Record<Side, Edge>;
	private readonly folders = new Map<string, Instance[]>();
	private current = "Ground";

	constructor(name: string, edges: Record<Side, Edge>) {
		this.name = name;
		this.edges = edges;
	}

	/** Puts what's added next in folder `name` (made on first use). */
	folder(name: string): this {
		this.current = name;
		return this;
	}

	/** Adds what `build` makes to folder `name`, then carries on in the folder from before. */
	inFolder(name: string, build: () => void): this {
		const before = this.current;
		this.current = name;
		build();
		this.current = before;
		return this;
	}

	/** An anchored part of `size`, its middle at `cframe`. */
	part(name: string, size: [number, number, number], cframe: CFrame, style: Style, options: PartOptions = {}) {
		const properties: Record<string, unknown> = {
			Anchored: true,
			Size: size.map(round),
			CFrame: cframe.toArray(),
			Material: style.material,
			Color: style.color,
		};
		if (options.shape) properties.Shape = options.shape;
		if (style.collide === false) properties.CanCollide = false;
		if (style.shadow === false) properties.CastShadow = false;
		if (style.transparency) properties.Transparency = style.transparency;
		if (options.tags) properties.Tags = options.tags;
		const instance: Instance = { name, className: options.className ?? "Part", properties };
		if (options.attributes) instance.attributes = options.attributes;
		if (options.children) instance.children = options.children;
		const list = this.folders.get(this.current) ?? [];
		list.push(instance);
		this.folders.set(this.current, list);
	}

	/**
	 * An uploaded mesh, its middle at `cframe`, drawn at its own `size` (Size and InitialSize both that:
	 * a mesh scaled in a tile file vanishes when its middle leaves the screen). Use `kitMesh` in kit.ts.
	 */
	mesh(name: string, size: [number, number, number], cframe: CFrame, properties: Record<string, unknown>) {
		const instance: Instance = {
			name,
			className: "MeshPart",
			properties: {
				Anchored: true,
				Size: size.map(round),
				InitialSize: size.map(round),
				CFrame: cframe.toArray(),
				...properties,
			},
		};
		const list = this.folders.get(this.current) ?? [];
		list.push(instance);
		this.folders.set(this.current, list);
	}

	/** A box `sx` by `sy` by `sz`, its middle at `x, y, z` in `frame`'s space. */
	box(
		name: string,
		x: number,
		y: number,
		z: number,
		sx: number,
		sy: number,
		sz: number,
		style: Style,
		frame = new CFrame(),
		options?: PartOptions,
	) {
		this.part(name, [sx, sy, sz], frame.at(x, y, z), style, options);
	}

	/** A flat slab from (x0, z0) to (x1, z1), its top at `top`. */
	slab(
		name: string,
		x0: number,
		x1: number,
		z0: number,
		z1: number,
		top: number,
		style: Style,
		frame = new CFrame(),
		thick = 1,
	) {
		this.box(name, (x0 + x1) / 2, top - thick / 2, (z0 + z1) / 2, x1 - x0, thick, z1 - z0, style, frame);
	}

	/** The whole tile, as a Rojo model file. One part per line, so a diff shows what changed. */
	toJson(): string {
		const line = (value: unknown) => JSON.stringify(value).replace(/,"/g, ', "').replace(/":/g, '": ');
		const folders = [...this.folders];
		const out = ["{", '\t"className": "Model",', `\t"attributes": ${line(this.edges)},`, '\t"children": ['];
		folders.forEach(([name, parts], i) => {
			out.push("\t\t{", `\t\t\t"name": "${name}",`, '\t\t\t"className": "Folder",', '\t\t\t"children": [');
			parts.forEach((part, j) => out.push(`\t\t\t\t${line(part)}${j < parts.length - 1 ? "," : ""}`));
			out.push("\t\t\t]", `\t\t}${i < folders.length - 1 ? "," : ""}`);
		});
		out.push("\t]", "}", "");
		return out.join("\n");
	}
}
