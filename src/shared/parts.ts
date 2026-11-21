/**
 * Helpers for building worlds out of plain parts at runtime (lobby set dressing, the main
 * game's map). Server-side use; everything is anchored.
 */

const DEFAULT_COLOR = new Color3(0.36, 0.35, 0.36);

export interface PartOptions {
	shape?: Enum.PartType;
	material?: Enum.Material;
	color?: Color3;
	collide?: boolean;
	transparency?: number;
	shadow?: boolean;
}

/** An anchored part. Defaults: Slate, mid grey, collidable, casts shadows. */
export function part(parent: Instance, name: string, size: Vector3, cframe: CFrame, opts: PartOptions = {}): Part {
	const p = new Instance("Part");
	p.Name = name;
	if (opts.shape) {
		p.Shape = opts.shape;
	}
	p.Size = size;
	p.CFrame = cframe;
	p.Anchored = true;
	p.CanCollide = opts.collide ?? true;
	p.Material = opts.material ?? Enum.Material.Slate;
	p.Color = opts.color ?? DEFAULT_COLOR;
	p.Transparency = opts.transparency ?? 0;
	p.CastShadow = opts.shadow ?? true;
	p.TopSurface = Enum.SurfaceType.Smooth;
	p.BottomSurface = Enum.SurfaceType.Smooth;
	p.Parent = parent;
	return p;
}

/** A cylinder running from `from` to `to` (Roblox cylinders lie along their X axis). */
export function limb(
	parent: Instance,
	name: string,
	from: Vector3,
	to: Vector3,
	diameter: number,
	opts: PartOptions = {},
) {
	const offset = to.sub(from);
	const mid = from.add(offset.div(2));
	const cframe =
		math.abs(offset.Unit.Y) > 0.999
			? new CFrame(mid).mul(CFrame.Angles(0, 0, math.pi / 2))
			: CFrame.lookAt(mid, to).mul(CFrame.Angles(0, math.pi / 2, 0));
	return part(parent, name, new Vector3(offset.Magnitude, diameter, diameter), cframe, {
		...opts,
		shape: Enum.PartType.Cylinder,
	});
}

export function folder(parent: Instance, name: string): Folder {
	const f = new Instance("Folder");
	f.Name = name;
	f.Parent = parent;
	return f;
}

/** A model whose parts are built around the origin, then moved into place with `place`. */
export function model(parent: Instance, name: string): Model {
	const m = new Instance("Model");
	m.Name = name;
	m.Parent = parent;
	return m;
}

export function place(m: Model, cframe: CFrame) {
	m.WorldPivot = new CFrame();
	m.PivotTo(cframe);
}
