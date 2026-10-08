/**
 * Procedural trees of the Delta, as plain geometry (no Babylon imports).
 *
 * A tree is a recursive set of branches (tapered tubes that bend under
 * gravity or lean towards the light) ending in foliage: clumps of crossed
 * leaf cards, or for the weeping willow long cards hanging from the tips.
 * Foliage normals point out of the crown so cards shade like a volume
 * instead of flat planes. `detail` 0 is the near version, 1 the cheap one
 * used far away (fewer sides, branches and cards).
 */
export type Vec3 = [number, number, number];

export interface Geometry {
  positions: number[];
  normals: number[];
  indices: number[];
  /** Only foliage has UVs (leaf cards); bark is untextured. */
  uvs: number[];
  /** Per-vertex RGBA: bark tone or leaf tint. */
  colors: number[];
}

export interface TreeGeometry {
  trunk: Geometry;
  foliage: Geometry;
  height: number;
}

export interface Species {
  name: string;
  /** Trunk height and base radius. */
  trunkHeight: [number, number];
  trunkRadius: number;
  /** How far the trunk may lean (radians). */
  lean: number;
  levels: number;
  /** Children per branch and where along the parent they start (0..1). */
  children: [number, number];
  childStart: number;
  /** Angle of children from the parent direction (radians). */
  spread: [number, number];
  /** Child length relative to the parent. */
  lengthRatio: number;
  /** Positive bends branches down (willow), negative up (poplar). */
  gravity: number;
  foliage: "clump" | "hang";
  /** Card size (clump) or hanging length (hang). */
  cardSize: [number, number];
  /** Extra clumps spread along the outer branches, not only at tips. */
  clumpsPerBranch: number;
  barkColor: Vec3;
  leafTint: Vec3;
}

export const SPECIES: Record<string, Species> = {
  // Sauce llorón: leaning towards the water, arching branches, hanging curtains
  sauce: {
    name: "sauce",
    trunkHeight: [2.4, 3.2],
    trunkRadius: 0.22,
    lean: 0.35,
    levels: 2,
    children: [4, 6],
    childStart: 0.75,
    spread: [0.7, 1.2],
    lengthRatio: 0.85,
    gravity: 0.55,
    foliage: "hang",
    cardSize: [2.8, 4.2],
    clumpsPerBranch: 2,
    barkColor: [0.3, 0.25, 0.19],
    leafTint: [0.78, 0.9, 0.42],
  },
  // Casuarina: tall straight trunk, feathery dark tufts along the upper half
  casuarina: {
    name: "casuarina",
    // Real casuarinas of the Delta: 20-30 m, much taller than the houses (photos)
    trunkHeight: [9.5, 12.5],
    trunkRadius: 0.24,
    lean: 0.08,
    levels: 2,
    children: [7, 10],
    childStart: 0.35,
    spread: [0.9, 1.3],
    lengthRatio: 0.28,
    gravity: 0.15,
    foliage: "clump",
    cardSize: [2.2, 3.0],
    clumpsPerBranch: 1,
    barkColor: [0.33, 0.27, 0.22],
    leafTint: [0.42, 0.55, 0.3],
  },
  // Broadleaf (fresno, aliso, ceibo): spreading crown
  fronda: {
    name: "fronda",
    trunkHeight: [2.2, 3.0],
    trunkRadius: 0.2,
    lean: 0.18,
    levels: 3,
    children: [3, 4],
    childStart: 0.55,
    spread: [0.45, 0.85],
    lengthRatio: 0.72,
    gravity: -0.05,
    foliage: "clump",
    cardSize: [1.6, 2.3],
    clumpsPerBranch: 1,
    barkColor: [0.38, 0.33, 0.27],
    leafTint: [0.62, 0.8, 0.4],
  },
  // Álamo: tall, narrow, branches swept up
  alamo: {
    name: "alamo",
    trunkHeight: [6, 8],
    trunkRadius: 0.16,
    lean: 0.05,
    levels: 2,
    children: [6, 8],
    childStart: 0.3,
    spread: [0.25, 0.45],
    lengthRatio: 0.45,
    gravity: -0.3,
    foliage: "clump",
    cardSize: [1.3, 1.9],
    clumpsPerBranch: 2,
    barkColor: [0.55, 0.52, 0.45],
    leafTint: [0.6, 0.78, 0.38],
  },
};

type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec3): Vec3 => scale(a, 1 / (len(a) || 1));
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Any two unit vectors perpendicular to d and to each other. */
function basis(d: Vec3): [Vec3, Vec3] {
  const up: Vec3 = Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(d, up));
  return [u, norm(cross(d, u))];
}

/** Rotates direction d away from itself by `angle`, around azimuth `phi`. */
function tilt(d: Vec3, angle: number, phi: number): Vec3 {
  const [u, v] = basis(d);
  const side = add(scale(u, Math.cos(phi)), scale(v, Math.sin(phi)));
  return norm(add(scale(d, Math.cos(angle)), scale(side, Math.sin(angle))));
}

function emptyGeometry(): Geometry {
  return { positions: [], normals: [], indices: [], uvs: [], colors: [] };
}

class Builder {
  trunk = emptyGeometry();
  foliage = emptyGeometry();
  crownCenter: Vec3 = [0, 0, 0];
  private tips: Array<{ p: Vec3; d: Vec3 }> = [];

  constructor(private sp: Species, private rng: Rng, private detail: number) {}

  build(): TreeGeometry {
    const sp = this.sp;
    const r = this.rng;
    const h = sp.trunkHeight[0] + r() * (sp.trunkHeight[1] - sp.trunkHeight[0]);
    // Always lean towards +x: placement turns each tree to lean over the water
    const lean = sp.lean * (0.5 + r() * 0.5);
    const dir: Vec3 = [Math.sin(lean), Math.cos(lean), 0];
    this.branch([0, 0, 0], dir, h, sp.trunkRadius * (0.85 + r() * 0.3), 0);

    // Crown center: average of foliage anchors, used for volumetric normals
    let c: Vec3 = [0, 0, 0];
    for (const t of this.tips) c = add(c, t.p);
    this.crownCenter = this.tips.length ? scale(c, 1 / this.tips.length) : [0, h, 0];
    if (sp.foliage === "hang") this.crownCenter = add(this.crownCenter, [0, -1.2, 0]);
    for (const t of this.tips) this.addFoliage(t.p, t.d);

    let top = 0;
    for (let i = 1; i < this.foliage.positions.length; i += 3) top = Math.max(top, this.foliage.positions[i]);
    for (let i = 1; i < this.trunk.positions.length; i += 3) top = Math.max(top, this.trunk.positions[i]);
    return { trunk: this.trunk, foliage: this.foliage, height: top };
  }

  private branch(start: Vec3, dir: Vec3, length: number, radius: number, level: number): void {
    const sp = this.sp;
    const r = this.rng;
    // The far version stops a level earlier: no twigs, foliage on the branches
    const levels = this.detail ? Math.max(1, sp.levels - 1) : sp.levels;
    const outer = level === levels;
    // Thin outer twigs are barely visible: keep them very cheap
    const segments = level === 0 ? 4 : this.detail || outer ? 1 : 2;
    const sides = level === 0 ? (this.detail ? 5 : 7) : outer || this.detail ? 3 : 4;
    const pts: Vec3[] = [start];
    const dirs: Vec3[] = [];
    let p = start;
    let d = dir;
    for (let s = 0; s < segments; s++) {
      // Gravity bends the branch (weight grows towards the tip), plus a little wobble
      const bend = sp.gravity * (level === 0 ? 0.15 : 1) * (s + 1) / segments;
      d = norm(add(d, [(r() - 0.5) * 0.12, -bend * 0.6, (r() - 0.5) * 0.12]));
      dirs.push(d);
      p = add(p, scale(d, length / segments));
      pts.push(p);
    }
    dirs.push(d);
    const tipRadius = radius * (outer ? 0.25 : 0.55);
    this.tube(pts, dirs, radius, tipRadius, sides);

    if (outer) {
      this.tips.push({ p, d });
      // Extra foliage along the outer branch
      for (let k = 0; k < sp.clumpsPerBranch - this.detail; k++) {
        const t = 0.45 + r() * 0.4;
        const i = Math.min(pts.length - 1, Math.round(t * (pts.length - 1)));
        this.tips.push({ p: pts[i], d: dirs[Math.min(i, dirs.length - 1)] });
      }
      return;
    }

    const [cMin, cMax] = sp.children;
    // Fewer children deeper in the crown: the twig count multiplies per level
    const n = Math.max(2, Math.round((cMin + r() * (cMax - cMin)) * (this.detail ? 0.6 : 1) * (level > 0 ? 0.55 : 1)));
    const phase = r() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const t = sp.childStart + (1 - sp.childStart) * (n === 1 ? 1 : k / (n - 1)) * 0.95 + 0.02;
      const along = Math.min(pts.length - 1, t * (pts.length - 1));
      const i = Math.floor(along);
      const f = along - i;
      const a = pts[i];
      const b = pts[Math.min(i + 1, pts.length - 1)];
      const at: Vec3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
      // Spiral phyllotaxis around the parent
      const phi = phase + k * 2.399;
      const angle = sp.spread[0] + r() * (sp.spread[1] - sp.spread[0]);
      const childDir = tilt(dirs[Math.min(i, dirs.length - 1)], angle, phi);
      const childLen = length * sp.lengthRatio * (0.75 + r() * 0.5) * (level === 0 ? 1 - t * 0.5 : 1);
      this.branch(at, childDir, childLen, radius * 0.55 * (1 - t * 0.3), level + 1);
    }
  }

  private tube(pts: Vec3[], dirs: Vec3[], r0: number, r1: number, sides: number): void {
    const g = this.trunk;
    const base = g.positions.length / 3;
    const [cr, cg, cb] = this.sp.barkColor;
    for (let i = 0; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      const radius = r0 + (r1 - r0) * t;
      const [u, v] = basis(dirs[i]);
      // Bark darkens towards the ground (damp) and varies a little per ring
      const shade = 0.8 + 0.2 * Math.min(1, pts[i][1] / 2) + (this.rng() - 0.5) * 0.08;
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const n = add(scale(u, Math.cos(a)), scale(v, Math.sin(a)));
        const q = add(pts[i], scale(n, radius));
        g.positions.push(...q);
        g.normals.push(...n);
        g.colors.push(cr * shade, cg * shade, cb * shade, 1);
      }
    }
    for (let i = 0; i < pts.length - 1; i++) {
      for (let s = 0; s < sides; s++) {
        const a = base + i * sides + s;
        const b = base + i * sides + ((s + 1) % sides);
        const c = a + sides;
        const d = b + sides;
        g.indices.push(a, c, b, b, c, d);
      }
    }
  }

  private addFoliage(p: Vec3, d: Vec3): void {
    const sp = this.sp;
    const r = this.rng;
    const size = (sp.cardSize[0] + r() * (sp.cardSize[1] - sp.cardSize[0])) * (this.detail ? 1.35 : 1);
    const tintVar = 0.85 + r() * 0.3;
    const tint: Vec3 = [sp.leafTint[0] * tintVar, sp.leafTint[1] * tintVar, sp.leafTint[2] * (0.9 + r() * 0.2)];
    if (sp.foliage === "hang") {
      // Curtains of hanging twigs: crossed vertical cards from the tip down
      const cards = this.detail ? 1 : 2;
      const rot = r() * Math.PI;
      for (let k = 0; k < cards; k++) {
        const a = rot + (k * Math.PI) / cards;
        const across: Vec3 = [Math.cos(a), 0, Math.sin(a)];
        const width = size * 0.45;
        const top = add(p, [0, 0.3, 0]);
        const corners: Vec3[] = [
          add(top, scale(across, -width / 2)),
          add(top, scale(across, width / 2)),
          add(add(top, scale(across, width / 2)), [0, -size, 0]),
          add(add(top, scale(across, -width / 2)), [0, -size, 0]),
        ];
        this.card(corners, tint);
      }
      return;
    }
    // Clump: three crossed cards around the anchor, randomly oriented
    const cards = this.detail ? 2 : 3;
    const center = add(p, scale(d, size * 0.2));
    const ax = tilt([0, 1, 0], r() * 0.6, r() * Math.PI * 2);
    const [u, v] = basis(ax);
    for (let k = 0; k < cards; k++) {
      const a = (k / cards) * Math.PI + r() * 0.3;
      const along = add(scale(u, Math.cos(a)), scale(v, Math.sin(a)));
      const h = size / 2;
      const corners: Vec3[] = [
        add(add(center, scale(along, -h)), scale(ax, h)),
        add(add(center, scale(along, h)), scale(ax, h)),
        add(add(center, scale(along, h)), scale(ax, -h)),
        add(add(center, scale(along, -h)), scale(ax, -h)),
      ];
      this.card(corners, tint);
    }
  }

  /** One leaf card (two triangles), normals pointing out of the crown. */
  private card(c: Vec3[], tint: Vec3): void {
    const g = this.foliage;
    const base = g.positions.length / 3;
    const uv = [0, 0, 1, 0, 1, 1, 0, 1];
    for (let i = 0; i < 4; i++) {
      g.positions.push(...c[i]);
      const out = norm(add(scale(norm(add(c[i], scale(this.crownCenter, -1))), 0.8), [0, 0.6, 0]));
      g.normals.push(...out);
      g.uvs.push(uv[i * 2], uv[i * 2 + 1]);
      // Lower cards sit in the crown's shade
      const shade = i < 2 ? 1 : 0.82;
      g.colors.push(tint[0] * shade, tint[1] * shade, tint[2] * shade, 1);
    }
    g.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

export function generateTree(species: Species, seed: number, detail: 0 | 1 = 0): TreeGeometry {
  return new Builder(species, mulberry32(seed), detail).build();
}
