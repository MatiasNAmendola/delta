/**
 * Tiny low-poly modeling kit: flat-shaded primitives with per-face colors,
 * assembled into one triangle soup per model and written as glTF/GLB.
 *
 * Units are game units (1 unit ≈ 1 m at the scale of props). +Y up, the
 * bow of boats points to +Z.
 */
import { Document, NodeIO } from "@gltf-transform/core";

export type V3 = [number, number, number];
export type RGB = [number, number, number];

export interface Transform {
  at?: V3;
  /** Rotation around Y, X and Z (radians), applied in that order before `at`. */
  rotY?: number;
  rotX?: number;
  rotZ?: number;
}

/** Colors are written as sRGB hex for readability and converted to linear in the file. */
export function hex(h: string): RGB {
  const n = Number.parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Deterministic PRNG (mulberry32) so models are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Model {
  readonly positions: number[] = [];
  readonly colors: number[] = [];

  constructor(readonly name: string) {}

  get triangles(): number {
    return this.positions.length / 9;
  }

  tri(a: V3, b: V3, c: V3, color: RGB): void {
    this.positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.colors.push(...color);
  }

  /** Quad a-b-c-d (counter-clockwise seen from outside). */
  quad(a: V3, b: V3, c: V3, d: V3, color: RGB): void {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Appends another model's triangles under a transform. */
  add(other: Model, t: Transform = {}): this {
    for (let i = 0; i < other.positions.length; i += 9) {
      const p = (k: number) => apply([other.positions[i + k], other.positions[i + k + 1], other.positions[i + k + 2]], t);
      const c: RGB = [other.colors[(i / 3) * 3], other.colors[(i / 3) * 3 + 1], other.colors[(i / 3) * 3 + 2]];
      this.tri(p(0), p(3), p(6), c);
    }
    return this;
  }

  // ---- primitives (all accept a Transform) ----

  box(size: V3, color: RGB, t: Transform = {}, colors: Partial<Record<"top" | "bottom" | "side", RGB>> = {}): this {
    const [w, h, d] = size.map((s) => s / 2) as V3;
    const v = (x: number, y: number, z: number) => apply([x * w, y * h + h, z * d], t);
    const side = colors.side ?? color;
    this.quad(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1), side); // +z
    this.quad(v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), side); // -z
    this.quad(v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), side); // +x
    this.quad(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1), side); // -x
    this.quad(v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1), colors.top ?? color); // top
    this.quad(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1), colors.bottom ?? color); // bottom
    return this;
  }

  /** Gable roof: base w (x) × d (z) at y=0, ridge along z at height h, with overhang. */
  gable(w: number, d: number, h: number, roof: RGB, wall: RGB, t: Transform = {}): this {
    const x = w / 2, z = d / 2;
    const v = (a: number, b: number, c: number) => apply([a, b, c], t);
    this.quad(v(-x, 0, z), v(0, h, z), v(0, h, -z), v(-x, 0, -z), roof);
    this.quad(v(x, 0, -z), v(0, h, -z), v(0, h, z), v(x, 0, z), roof);
    this.tri(v(-x, 0, z), v(x, 0, z), v(0, h, z), wall);
    this.tri(v(x, 0, -z), v(-x, 0, -z), v(0, h, -z), wall);
    return this;
  }

  /** Frustum/cylinder/cone along Y from y=0 to y=h. */
  cylinder(rBottom: number, rTop: number, h: number, sides: number, color: RGB, t: Transform = {}, caps = true): this {
    const ring = (r: number, y: number) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (i / sides) * Math.PI * 2;
        return apply([Math.cos(a) * r, y, Math.sin(a) * r], t);
      });
    const lo = ring(rBottom, 0);
    const hi = ring(rTop, h);
    const top = apply([0, h, 0], t);
    const bottom = apply([0, 0, 0], t);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      if (rTop === 0) this.tri(lo[j], lo[i], top, color);
      else this.quad(lo[j], lo[i], hi[i], hi[j], color);
      if (caps && rTop > 0) this.tri(hi[j], hi[i], top, color);
      if (caps) this.tri(lo[i], lo[j], bottom, color);
    }
    return this;
  }

  /** Low-poly blob: icosahedron (optionally subdivided once), scaled and jittered. */
  blob(radius: V3, color: RGB, t: Transform = {}, opts: { subdivide?: boolean; jitter?: number; seed?: number; shade?: number } = {}): this {
    const r = rng(opts.seed ?? 1);
    let { verts, faces } = icosahedron();
    if (opts.subdivide) ({ verts, faces } = subdivide(verts, faces));
    const jitter = opts.jitter ?? 0.12;
    const moved = verts.map(([x, y, z]) => {
      const k = 1 + (r() - 0.5) * 2 * jitter;
      return apply([x * radius[0] * k, y * radius[1] * k, z * radius[2] * k], t);
    });
    for (const [a, b, c] of faces) {
      // Slight per-face shade variation reads as foliage instead of plastic
      const s = 1 + (r() - 0.5) * (opts.shade ?? 0.18);
      this.tri(moved[a], moved[b], moved[c], [color[0] * s, color[1] * s, color[2] * s].map((n) => Math.min(1, n)) as RGB);
    }
    return this;
  }

  /**
   * Boat hull from cross-sections along Z (stern at -L/2, bow at +L/2).
   * Each section: half-beam at deck, half-beam at the chine, depth; the bow
   * narrows to a point and the stern is a flat transom.
   */
  hull(opts: {
    length: number;
    beam: number;
    depth: number;
    /** 0..1: how far back the bow starts narrowing. */
    bowStart?: number;
    /** Extra height of the deck line at the bow (sheer). */
    sheer?: number;
    /** 0 = flat bottom (colectiva), 1 = deep V. */
    deadrise?: number;
    sections?: number;
    side: RGB;
    bottom: RGB;
    deck?: RGB;
    stripe?: RGB;
  }, t: Transform = {}): this {
    const { length, beam, depth } = opts;
    const n = opts.sections ?? 10;
    const bowStart = opts.bowStart ?? 0.7;
    const sheer = opts.sheer ?? depth * 0.25;
    const deadrise = opts.deadrise ?? 0.3;
    const sections: V3[][] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n; // 0 stern → 1 bow
      const z = -length / 2 + u * length;
      const taper = u <= bowStart ? 1 : Math.cos(((u - bowStart) / (1 - bowStart)) * (Math.PI / 2));
      const half = Math.max(0.0001, (beam / 2) * taper);
      const deckY = depth + sheer * u * u;
      const keelY = u > bowStart ? depth * 0.35 * ((u - bowStart) / (1 - bowStart)) : 0;
      const chineY = keelY + depth * 0.25 * (1 + deadrise);
      sections.push([
        apply([-half, deckY, z], t),
        apply([-half * 0.85, chineY, z], t),
        apply([0, keelY - depth * 0.15 * deadrise, z], t),
        apply([half * 0.85, chineY, z], t),
        apply([half, deckY, z], t),
      ]);
    }
    for (let i = 0; i < n; i++) {
      const a = sections[i], b = sections[i + 1];
      this.quad(a[1], b[1], b[0], a[0], opts.side);
      this.quad(a[4], b[4], b[3], a[3], opts.side);
      this.quad(a[2], b[2], b[1], a[1], opts.bottom);
      this.quad(a[3], b[3], b[2], a[2], opts.bottom);
      if (opts.deck) this.quad(a[0], b[0], b[4], a[4], opts.deck);
      if (opts.stripe) {
        // Thin colored band just below the deck line
        const lift = (p: V3, q: V3, k: number): V3 => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
        const out = 0.004;
        const s = (p: V3, side: number): V3 => [p[0] + side * out, p[1], p[2]];
        this.quad(s(lift(a[0], a[1], 0.25), -1), s(lift(b[0], b[1], 0.25), -1), s(b[0], -1), s(a[0], -1), opts.stripe);
        this.quad(s(a[4], 1), s(b[4], 1), s(lift(b[4], b[3], 0.25), 1), s(lift(a[4], a[3], 0.25), 1), opts.stripe);
      }
    }
    // Transom
    const s0 = sections[0];
    this.quad(s0[0], s0[4], s0[3], s0[1], opts.side);
    this.tri(s0[1], s0[3], s0[2], opts.bottom);
    return this;
  }
}

export function apply(p: V3, t: Transform): V3 {
  let [x, y, z] = p;
  if (t.rotZ) [x, y] = [x * Math.cos(t.rotZ) - y * Math.sin(t.rotZ), x * Math.sin(t.rotZ) + y * Math.cos(t.rotZ)];
  if (t.rotX) [y, z] = [y * Math.cos(t.rotX) - z * Math.sin(t.rotX), y * Math.sin(t.rotX) + z * Math.cos(t.rotX)];
  if (t.rotY) [x, z] = [x * Math.cos(t.rotY) + z * Math.sin(t.rotY), -x * Math.sin(t.rotY) + z * Math.cos(t.rotY)];
  const [ax, ay, az] = t.at ?? [0, 0, 0];
  return [x + ax, y + ay, z + az];
}

function icosahedron(): { verts: V3[]; faces: [number, number, number][] } {
  const f = (1 + Math.sqrt(5)) / 2;
  const raw: V3[] = [
    [-1, f, 0], [1, f, 0], [-1, -f, 0], [1, -f, 0], [0, -1, f], [0, 1, f],
    [0, -1, -f], [0, 1, -f], [f, 0, -1], [f, 0, 1], [-f, 0, -1], [-f, 0, 1],
  ];
  const len = Math.hypot(1, f);
  const verts = raw.map(([x, y, z]) => [x / len, y / len, z / len] as V3);
  const faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { verts, faces };
}

function subdivide(verts: V3[], faces: [number, number, number][]) {
  const out = verts.slice();
  const cache = new Map<string, number>();
  const mid = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    let i = cache.get(key);
    if (i === undefined) {
      const m: V3 = [(out[a][0] + out[b][0]) / 2, (out[a][1] + out[b][1]) / 2, (out[a][2] + out[b][2]) / 2];
      const l = Math.hypot(...m);
      i = out.push([m[0] / l, m[1] / l, m[2] / l]) - 1;
      cache.set(key, i);
    }
    return i;
  };
  const nf: [number, number, number][] = [];
  for (const [a, b, c] of faces) {
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }
  return { verts: out, faces: nf };
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Writes a model as a single-primitive GLB (flat normals, linear COLOR_0, no extensions). */
export async function toGLB(model: Model): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const positions = new Float32Array(model.positions);
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i], ay = positions[i + 1], az = positions[i + 2];
    const ux = positions[i + 3] - ax, uy = positions[i + 4] - ay, uz = positions[i + 5] - az;
    const vx = positions[i + 6] - ax, vy = positions[i + 7] - ay, vz = positions[i + 8] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 3; k++) normals.set([nx, ny, nz], i + k * 3);
  }
  const colors = new Float32Array(model.colors.map(toLinear));
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(positions).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(normals).setBuffer(buffer))
    .setAttribute("COLOR_0", doc.createAccessor().setType("VEC3").setArray(colors).setBuffer(buffer))
    .setMaterial(doc.createMaterial(`${model.name}-vertexcolor`).setRoughnessFactor(1).setMetallicFactor(0));
  const mesh = doc.createMesh(model.name).addPrimitive(prim);
  doc.createScene(model.name).addChild(doc.createNode(model.name).setMesh(mesh));
  return new NodeIO().writeBinary(doc);
}
