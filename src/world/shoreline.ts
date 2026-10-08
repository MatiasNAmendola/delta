/**
 * Shoreline geometry from the navigable-water grid: the exact outline of
 * the water as closed rings, so the water surface, the islands and the
 * vertical river banks can all be built from (and match) the same edge.
 *
 * Engine-agnostic: no Babylon imports.
 */
import earcut from "earcut";
import type { Vec2 } from "./WorldDoc";

export interface CellGrid {
  /** Cells per side. */
  res: number;
  /** World size covered (square, centered on the origin). */
  size: number;
  /** True when cell (i, j) is water; i along x, j along z. */
  wet: (i: number, j: number) => boolean;
}

/**
 * Traces the boundary between water and land cells (marching squares on
 * cell corners). Rings are closed (first point not repeated) and oriented
 * with water on the LEFT of the direction of travel, so a ring around a
 * lake is counter-clockwise (positive area) and a ring around an island
 * inside water is clockwise (negative area).
 */
export function traceShorelines(grid: CellGrid): Vec2[][] {
  const { res, size } = grid;
  const cell = size / res;
  const wet = (i: number, j: number) => i >= 0 && j >= 0 && i < res && j < res && grid.wet(i, j);

  // Directed boundary edges between corner points, keyed by start corner.
  // Corner (ci, cj) sits at world (-size/2 + ci*cell, -size/2 + cj*cell).
  const next = new Map<number, number[]>();
  const key = (ci: number, cj: number) => ci * (res + 1) + cj;
  const add = (a: number, b: number) => {
    const list = next.get(a);
    if (list) list.push(b);
    else next.set(a, [b]);
  };
  for (let i = -1; i < res; i++) {
    for (let j = -1; j < res; j++) {
      const here = wet(i, j);
      // Edge between (i, j) and (i+1, j): shared vertical side at x corner i+1
      if (here !== wet(i + 1, j)) {
        const lo = key(i + 1, j);
        const hi = key(i + 1, j + 1);
        // Water on the left: water at -x means travelling +z (lo -> hi)
        if (here) add(lo, hi);
        else add(hi, lo);
      }
      // Edge between (i, j) and (i, j+1): shared horizontal side at z corner j+1
      if (here !== wet(i, j + 1)) {
        const lo = key(i, j + 1);
        const hi = key(i + 1, j + 1);
        // Water at -z means travelling -x (hi -> lo)
        if (here) add(hi, lo);
        else add(lo, hi);
      }
    }
  }

  const toWorld = (k: number): Vec2 => {
    const ci = Math.floor(k / (res + 1));
    const cj = k % (res + 1);
    return [-size / 2 + ci * cell, -size / 2 + cj * cell];
  };

  const rings: Vec2[][] = [];
  for (const start of [...next.keys()]) {
    while ((next.get(start)?.length ?? 0) > 0) {
      const ring: Vec2[] = [];
      let k = start;
      do {
        ring.push(toWorld(k));
        const outs = next.get(k)!;
        const n = outs.pop()!;
        if (outs.length === 0) next.delete(k);
        k = n;
      } while (k !== start && next.has(k));
      if (ring.length >= 4) rings.push(ring);
    }
  }
  return rings;
}

/** Twice the signed area (positive = counter-clockwise in x/z). */
export function signedArea2(ring: Vec2[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return a;
}

/** Chaikin corner cutting on a closed ring: rounds the grid's staircase. */
export function smoothRing(ring: Vec2[], iterations = 2): Vec2[] {
  let pts = ring;
  for (let it = 0; it < iterations; it++) {
    const out: Vec2[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[(i + 1) % pts.length];
      out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    pts = out;
  }
  return pts;
}

/** Drops nearly collinear points (closed ring), keeping shape within `tolerance`. */
export function simplifyRing(ring: Vec2[], tolerance: number): Vec2[] {
  if (ring.length < 8) return ring;
  // Douglas-Peucker on the ring split at its two farthest-apart points
  let far = 0;
  let best = 0;
  for (let i = 1; i < ring.length; i++) {
    const d = (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2;
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const a = douglasPeucker(ring.slice(0, far + 1), tolerance);
  const b = douglasPeucker([...ring.slice(far), ring[0]], tolerance);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function douglasPeucker(pts: Vec2[], tol: number): Vec2[] {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, az] = pts[s];
    const [bx, bz] = pts[e];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    let worst = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / len;
      if (d > worst) {
        worst = d;
        idx = i;
      }
    }
    if (worst > tol) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Polygon = outer ring plus holes (all in world x/z). */
export interface Polygon {
  outer: Vec2[];
  holes: Vec2[][];
}

/**
 * Groups shoreline rings into water polygons (lake/river outline with its
 * islands as holes) and land polygons (the world square or an island, with
 * the water inside it as holes).
 */
export function buildRegions(rings: Vec2[][], size: number): { water: Polygon[]; land: Polygon[] } {
  const info = rings.map((ring) => ({ ring, area: signedArea2(ring) / 2, box: bounds(ring) }));
  const waterOuters = info.filter((r) => r.area > 0);
  const islands = info.filter((r) => r.area < 0);
  const h = size / 2;
  const world: Vec2[] = [[-h, -h], [h, -h], [h, h], [-h, h]];

  // Each ring belongs inside the smallest ring of the opposite kind that contains it
  const smallestContaining = (r: (typeof info)[number], candidates: typeof info) => {
    let best: (typeof info)[number] | null = null;
    const [px, pz] = r.ring[0];
    for (const c of candidates) {
      const area = Math.abs(c.area);
      if (area <= Math.abs(r.area) || (best && area >= Math.abs(best.area))) continue;
      if (px < c.box[0] || px > c.box[2] || pz < c.box[1] || pz > c.box[3]) continue;
      if (pointInRing(px, pz, c.ring)) best = c;
    }
    return best;
  };

  const water: Polygon[] = waterOuters.map((r) => ({ outer: r.ring, holes: [] }));
  const land: Polygon[] = [{ outer: world, holes: [] }, ...islands.map((r) => ({ outer: [...r.ring].reverse(), holes: [] }))];

  for (const island of islands) {
    const host = smallestContaining(island, waterOuters);
    if (host) water[waterOuters.indexOf(host)].holes.push(island.ring);
  }
  for (const lake of waterOuters) {
    const host = smallestContaining(lake, islands);
    const target = host ? land[1 + islands.indexOf(host)] : land[0];
    target.holes.push([...lake.ring].reverse());
  }
  return { water, land };
}

/**
 * Shoreline rings ready for building geometry: traced, rounded (Chaikin)
 * and simplified, without the specks of water or land a cell or two big
 * that the rasterized grid leaves behind.
 */
export function shorelineRings(grid: CellGrid, minArea = 12): Vec2[][] {
  const cell = grid.size / grid.res;
  return traceShorelines(grid)
    .filter((r) => Math.abs(signedArea2(r) / 2) >= minArea)
    // Collapse the cell staircase to the line it approximates, round the
    // corners left behind, then drop the extra points rounding added
    .map((r) => simplifyRing(smoothRing(simplifyRing(r, cell * 0.75), 3), cell * 0.12))
    .filter((r) => r.length >= 3);
}

function bounds(ring: Vec2[]): [number, number, number, number] {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return [minX, minZ, maxX, maxZ];
}

export function pointInRing(x: number, z: number, ring: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[j];
    if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

/** Triangulates polygons into one x/z vertex buffer + indices. */
export function triangulate(polygons: Polygon[]): { vertices: Float32Array; indices: Uint32Array } {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const poly of polygons) {
    const flat: number[] = [];
    const holeIndices: number[] = [];
    for (const [x, z] of poly.outer) flat.push(x, z);
    for (const hole of poly.holes) {
      holeIndices.push(flat.length / 2);
      for (const [x, z] of hole) flat.push(x, z);
    }
    const base = vertices.length / 2;
    for (const i of earcut(flat, holeIndices, 2)) indices.push(base + i);
    for (const n of flat) vertices.push(n);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

/**
 * Exact water test against the shoreline rings, so collisions match the
 * banks that are drawn. Cells that a shore segment passes near are decided
 * by the side of the nearest segment (rings keep water on their left);
 * cells far from any shore are wholly water or land, decided once.
 */
export class ShoreIndex {
  private readonly res: number;
  private readonly cell: number;
  /** Segment ids per cell (null = no shore near this cell). */
  private readonly cells: Array<number[] | null>;
  /** For cells without shore: 1 water, 0 land. */
  private readonly solid: Uint8Array;
  private readonly ax: Float64Array;
  private readonly az: Float64Array;
  private readonly bx: Float64Array;
  private readonly bz: Float64Array;

  constructor(rings: Vec2[][], readonly size: number, coarseIsWater: (x: number, z: number) => boolean, cell = 4) {
    this.cell = cell;
    this.res = Math.ceil(size / cell);
    const res = this.res;
    const segs: number[] = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        segs.push(a[0], a[1], b[0], b[1]);
      }
    }
    const n = segs.length / 4;
    this.ax = new Float64Array(n);
    this.az = new Float64Array(n);
    this.bx = new Float64Array(n);
    this.bz = new Float64Array(n);
    this.cells = new Array(res * res).fill(null);
    const half = size / 2;
    for (let s = 0; s < n; s++) {
      const [ax, az, bx, bz] = segs.slice(s * 4, s * 4 + 4);
      this.ax[s] = ax;
      this.az[s] = az;
      this.bx[s] = bx;
      this.bz[s] = bz;
      // Register in every cell the segment's box touches, one cell of margin
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) + half) / cell) - 1);
      const i1 = Math.min(res - 1, Math.floor((Math.max(ax, bx) + half) / cell) + 1);
      const j0 = Math.max(0, Math.floor((Math.min(az, bz) + half) / cell) - 1);
      const j1 = Math.min(res - 1, Math.floor((Math.max(az, bz) + half) / cell) + 1);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const k = j * res + i;
          (this.cells[k] ??= []).push(s);
        }
      }
    }
    this.solid = new Uint8Array(res * res);
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        if (this.cells[j * res + i]) continue;
        this.solid[j * res + i] = coarseIsWater(-half + (i + 0.5) * cell, -half + (j + 0.5) * cell) ? 1 : 0;
      }
    }
  }

  isWater(x: number, z: number): boolean {
    const half = this.size / 2;
    const i = Math.floor((x + half) / this.cell);
    const j = Math.floor((z + half) / this.cell);
    if (i < 0 || j < 0 || i >= this.res || j >= this.res) return false;
    const k = j * this.res + i;
    const list = this.cells[k];
    if (!list) return this.solid[k] === 1;

    // Nearest segment decides; at a shared vertex prefer the segment whose
    // line is farther from the point (it resolves convex/concave corners)
    let best = Infinity;
    let side = 0;
    for (const s of list) {
      const ax = this.ax[s], az = this.az[s];
      const dx = this.bx[s] - ax, dz = this.bz[s] - az;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const px = ax + dx * t - x, pz = az + dz * t - z;
      const d2 = px * px + pz * pz;
      const cross = dx * (z - az) - dz * (x - ax);
      if (d2 < best - 1e-9 || (Math.abs(d2 - best) <= 1e-9 && Math.abs(cross) / Math.sqrt(l2) > Math.abs(side))) {
        best = d2;
        side = cross / Math.sqrt(l2);
      }
    }
    return side > 0;
  }
}
