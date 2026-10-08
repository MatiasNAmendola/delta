/**
 * Everything about the world's shape that never changes between runs,
 * computed from the World Doc as plain typed arrays (no Babylon):
 * navigable water grid, shoreline rings, water and island triangulations,
 * shore distance textures and the ground splatmap.
 *
 * It is computed once at build time (scripts/bake/bakeWorlds.ts writes
 * public/worlds/<id>.layout.bin) so phones only download and upload it;
 * the browser computes it itself only when that file is missing or stale.
 * See docs/adr/0001-precalcular-el-mundo.md.
 */
import { splitByCells } from "./chunking";
import type { River, Vec2, WorldDoc } from "../WorldDoc";
import { createGrid, isSet, rasterizeAreas, riverCoverage, uncoveredRuns, type WaterGrid } from "../waterGeometry";
import { getPointOnPath } from "../../utils/helpers";
import earcut from "earcut";
import { indexRegions, roughenRing, ShoreIndex, shorelineRings, WORLD_RING, type IndexedPolygon } from "../shoreline";
import { WaterDistanceField } from "../WaterDistanceField";
import { fbm, smoothstep } from "./noise";

/** Bump when the layout algorithm changes: stale baked files are then ignored. */
export const LAYOUT_VERSION = 6;
/** Shoreline points are quantized to 1/256 unit (3 cm): small, exact deltas in the baked file. */
export const POINT_QUANTUM = 256;

/** Rivers this much inside water areas are drawn only where the areas miss them. */
const STRIP_SKIP_COVERAGE = 0.7;
/** Extra navigable width beside each river strip. */
const STRIP_COLLISION_MARGIN = 0.5;
/** Spacing of shoreline points and how far (world units, 8 m each) banks wander in and out. */
const SHORE_STEP = 0.5;
const SHORE_ROUGHNESS = 1.15;
/** Signed shore distance range (world units) of the shore SDF texture. */
export const SHORE_SDF_RANGE = 2;
export const SHORE_SDF_RES = 2048;
/** Shore distance (world units) encoded by the brightest water shore map value. */
export const SHORE_RANGE = 16;

/**
 * Textures are row-major with row 0 at the world's -z edge (v = 0), ready
 * for RawTexture uploads without flipping.
 */
export interface WorldLayout {
  version: number;
  /** Hash of the World Doc it was computed from. */
  source: string;
  size: number;
  /** Navigable water grid (cell (gx, gz) at gx * gridRes + gz), rasterized from the shoreline. */
  gridRes: number;
  grid: Uint8Array;
  /**
   * Every vertex of the shoreline, flat x, z: the rings one after the other
   * (ringStarts[k] is where ring k starts), then the world's 4 corners.
   * Water, islands and banks all index into it.
   */
  points: Float32Array;
  ringStarts: Uint32Array;
  /** The water surface and the islands, cut into 256-unit chunks (see chunking.ts). */
  water: ChunkedMesh;
  land: ChunkedMesh;
  /** Signed distance to the shore, 0.5 = shore, spanning +-SHORE_SDF_RANGE (R8). */
  shoreSdf: Uint8Array;
  /** Distance from water to the nearest bank, 0..SHORE_RANGE (R8), for the water shader. */
  shoreMapRes: number;
  shoreMap: Uint8Array;
  /** Ground splatmap: dirt and lush grass weights (lawn = the rest), 2 bytes per texel. */
  splatRes: number;
  splat: Uint8Array;
}

/**
 * A flat mesh cut into chunks. Each chunk's vertices are first references
 * to shoreline points (`refs`, ascending: tiny deltas in the file), then the
 * vertices made by the cuts (`extra`, x, z); its triangles index those
 * local vertices. `table` has 5 numbers per chunk: cell i, cell j, refs
 * count, extra count, index count.
 */
export interface ChunkedMesh {
  refs: Uint32Array;
  extra: Float32Array;
  indices: Uint32Array;
  table: Int32Array;
}

export const CHUNK_TABLE_STRIDE = 5;

/** Cuts a flat indexed mesh (x, z points) into chunks. */
export function chunkFlatMesh(points: Float32Array, indices: Uint32Array): ChunkedMesh {
  const n = points.length / 2;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = points[i * 2];
    positions[i * 3 + 2] = points[i * 2 + 1];
  }
  const chunks = splitByCells({ positions, indices });
  const refs: number[] = [];
  const extra: number[] = [];
  const out: number[] = [];
  const table = new Int32Array(chunks.length * CHUNK_TABLE_STRIDE);
  chunks.forEach((c, k) => {
    const count = c.positions.length / 3;
    // Shoreline points in order, then the cut vertices along x
    const order = Array.from({ length: count }, (_, v) => v).sort((a, b) => {
      const sa = c.source[a];
      const sb = c.source[b];
      if (sa >= 0 && sb >= 0) return sa - sb;
      if (sa >= 0 || sb >= 0) return sa >= 0 ? -1 : 1;
      return c.positions[a * 3] - c.positions[b * 3] || c.positions[a * 3 + 2] - c.positions[b * 3 + 2];
    });
    const rank = new Uint32Array(count);
    let nRefs = 0;
    order.forEach((v, r) => {
      rank[v] = r;
      if (c.source[v] >= 0) {
        refs.push(c.source[v]);
        nRefs++;
      } else extra.push(quantize(c.positions[v * 3]), quantize(c.positions[v * 3 + 2]));
    });
    // Triangles sorted by their lowest vertex, rotated to start there (same
    // winding): consecutive indices stay close, which gzips much better
    const tris: Array<[number, number, number]> = [];
    for (let t = 0; t < c.indices.length; t += 3) {
      const [a, b, d] = [rank[c.indices[t]], rank[c.indices[t + 1]], rank[c.indices[t + 2]]];
      tris.push(a <= b && a <= d ? [a, b, d] : b <= a && b <= d ? [b, d, a] : [d, a, b]);
    }
    tris.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    for (const t of tris) out.push(t[0], t[1], t[2]);
    table.set([c.i, c.j, nRefs, count - nRefs, c.indices.length], k * CHUNK_TABLE_STRIDE);
  });
  return { refs: Uint32Array.from(refs), extra: Float32Array.from(extra), indices: Uint32Array.from(out), table };
}

function quantize(v: number): number {
  return Math.round(v * POINT_QUANTUM) / POINT_QUANTUM + 0;
}

export function computeWorldLayout(world: WorldDoc, source: string, progress: (step: string) => void = () => {}): WorldLayout {
  const size = world.world.size;
  const res = Math.min(1600, Math.max(400, Math.round(size / 2)));

  // Navigable water: OSM water areas plus river strips where the areas miss them
  const grid = createGrid(size, res);
  let areaGrid: WaterGrid | null = null;
  const areas = world.waterAreas ?? [];
  if (areas.length > 0) {
    areaGrid = createGrid(size, res);
    rasterizeAreas(areaGrid, areas);
    grid.cells.set(areaGrid.cells);
  }
  for (const river of planStrips(world.rivers, areaGrid)) {
    const samples = river.points.length * 20;
    for (let i = 0; i <= samples; i++) {
      const [rx, rz] = getPointOnPath(river.points, i / samples);
      const halfW = river.width / 2 + STRIP_COLLISION_MARGIN;
      const minX = Math.floor(((rx - halfW + size / 2) / size) * res);
      const maxX = Math.ceil(((rx + halfW + size / 2) / size) * res);
      const minZ = Math.floor(((rz - halfW + size / 2) / size) * res);
      const maxZ = Math.ceil(((rz + halfW + size / 2) / size) * res);
      for (let gx = Math.max(0, minX); gx <= Math.min(res - 1, maxX); gx++) {
        for (let gz = Math.max(0, minZ); gz <= Math.min(res - 1, maxZ); gz++) grid.cells[gx * res + gz] = 1;
      }
    }
  }
  progress("agua: grilla");

  // One outline for everything: natural banks with coves and points
  const room = (x: number, z: number, nx: number, nz: number) => {
    const into = isSet(grid, x + nx * 0.6, z + nz * 0.6);
    for (let t = 0.6; t < 5; t += 0.3) if (isSet(grid, x + nx * t, z + nz * t) !== into) return t;
    return 5;
  };
  // Quantized right away: the baked file stores them exactly, so everything
  // built from them (collisions, meshes, banks) is identical baked or not
  const q = (v: number) => Math.round(v * POINT_QUANTUM) / POINT_QUANTUM + 0; // + 0 turns -0 into 0
  const rings = shorelineRings({ res, size, wet: (i, j) => grid.cells[i * res + j] === 1 })
    .map((r) => roughenRing(r, SHORE_STEP, SHORE_ROUGHNESS, room, size / 2).map(([x, z]): Vec2 => [q(x), q(z)]))
    .filter((r) => r.length >= 3);
  progress("agua: costas");

  let total = 0;
  for (const r of rings) total += r.length;
  const points = new Float32Array((total + 4) * 2);
  const ringStarts = new Uint32Array(rings.length + 1);
  let n = 0;
  rings.forEach((r, k) => {
    ringStarts[k] = n;
    for (const [x, z] of r) {
      points[n * 2] = x;
      points[n * 2 + 1] = z;
      n++;
    }
  });
  ringStarts[rings.length] = n;
  const h = size / 2;
  points.set([-h, -h, h, -h, h, h, -h, h], n * 2);
  // Read the rings back from the Float32 array, as the baked path will
  const exact = layoutRings({ points, ringStarts });

  const regions = indexRegions(exact);
  // Navigation is re-derived from the drawn shoreline: what you see is what you sail on
  const coarse = createGrid(size, res);
  const ringOf = (r: { ring: number; reversed: boolean }): Vec2[] => {
    const ring = r.ring === WORLD_RING ? [[-h, -h], [h, -h], [h, h], [-h, h]] as Vec2[] : exact[r.ring];
    return r.reversed ? [...ring].reverse() : ring;
  };
  rasterizeAreas(coarse, regions.water.map((p, i) => ({ id: `agua-${i}`, outer: ringOf(p.outer), holes: p.holes.map(ringOf) })));
  const water = chunkFlatMesh(points, triangulateIndexed(regions.water, points, ringStarts));
  const land = chunkFlatMesh(points, triangulateIndexed(regions.land, points, ringStarts));
  progress("agua: triangulación");

  const index = new ShoreIndex(exact, size, (x, z) => isSet(coarse, x, z));
  const shoreSdf = new Uint8Array(SHORE_SDF_RES * SHORE_SDF_RES);
  const texel = size / SHORE_SDF_RES;
  for (let j = 0; j < SHORE_SDF_RES; j++) {
    const z = -size / 2 + (j + 0.5) * texel;
    for (let i = 0; i < SHORE_SDF_RES; i++) {
      const d = index.signedDistance(-size / 2 + (i + 0.5) * texel, z, SHORE_SDF_RANGE);
      shoreSdf[j * SHORE_SDF_RES + i] = Math.round((0.5 + d / (2 * SHORE_SDF_RANGE)) * 255);
    }
  }
  progress("agua: distancia a la costa");

  const isCoarseWater = (x: number, z: number) => isSet(coarse, x, z);
  const shoreMapRes = size <= 800 ? 512 : 1024;
  const toBank = new WaterDistanceField(size, shoreMapRes, (x, z) => !isCoarseWater(x, z));
  const shoreMap = new Uint8Array(shoreMapRes * shoreMapRes);
  const halfCell = toBank.cell / 2;
  for (let j = 0; j < shoreMapRes; j++) {
    for (let i = 0; i < shoreMapRes; i++) {
      const d = Math.max(0, toBank.atCell(i, j) - halfCell);
      shoreMap[j * shoreMapRes + i] = Math.min(255, (d / SHORE_RANGE) * 255);
    }
  }

  // Ground: lawn almost everywhere, lush unmown patches, worn earth in spots and along the bank edge
  const splatRes = size <= 800 ? 256 : 1024;
  const toWater = new WaterDistanceField(size, splatRes, isCoarseWater);
  const splat = new Uint8Array(splatRes * splatRes * 2);
  for (let j = 0; j < splatRes; j++) {
    const z = -size / 2 + (j + 0.5) * toWater.cell;
    for (let i = 0; i < splatRes; i++) {
      const x = -size / 2 + (i + 0.5) * toWater.cell;
      const patches = smoothstep(0.58, 0.72, fbm(x * 0.03, z * 0.03, 3, 456));
      const edge = 1 - smoothstep(0.5, 2.5, toWater.atCell(i, j) + (fbm(x * 0.2, z * 0.2, 2, 457) - 0.5) * 2);
      const dirt = Math.max(0, Math.min(0.5, Math.max(patches * 0.3, edge * 0.45)));
      const lush = smoothstep(0.48, 0.68, fbm(x * 0.012 + 40, z * 0.012, 3, 458)) * (1 - dirt) * 0.85;
      const k = (j * splatRes + i) * 2;
      splat[k] = Math.round(dirt * 255);
      splat[k + 1] = Math.round(lush * 255);
    }
  }
  progress("islas: texturas");

  return {
    version: LAYOUT_VERSION,
    source,
    size,
    gridRes: res,
    grid: coarse.cells,
    points,
    ringStarts,
    water,
    land,
    shoreSdf,
    shoreMapRes,
    shoreMap,
    splatRes,
    splat,
  };
}

/** Shoreline rings back as point lists (Float32 precision, same as everything built from them). */
export function layoutRings(layout: Pick<WorldLayout, "points" | "ringStarts">): Vec2[][] {
  const rings: Vec2[][] = [];
  for (let k = 0; k + 1 < layout.ringStarts.length; k++) {
    const ring: Vec2[] = [];
    for (let n = layout.ringStarts[k]; n < layout.ringStarts[k + 1]; n++) {
      ring.push([layout.points[n * 2], layout.points[n * 2 + 1]]);
    }
    rings.push(ring);
  }
  return rings;
}

/** Earcut each polygon over the shared point array; returns global point indices. */
function triangulateIndexed(polys: IndexedPolygon[], points: Float32Array, ringStarts: Uint32Array): Uint32Array {
  const corners = ringStarts[ringStarts.length - 1];
  const out: number[] = [];
  for (const poly of polys) {
    const ids: number[] = [];
    const holeStarts: number[] = [];
    const push = (r: { ring: number; reversed: boolean }) => {
      const from = r.ring === WORLD_RING ? corners : ringStarts[r.ring];
      const to = r.ring === WORLD_RING ? corners + 4 : ringStarts[r.ring + 1];
      const span: number[] = [];
      for (let k = from; k < to; k++) span.push(k);
      if (r.reversed) span.reverse();
      ids.push(...span);
    };
    push(poly.outer);
    for (const hole of poly.holes) {
      holeStarts.push(ids.length);
      push(hole);
    }
    const flat = new Float64Array(ids.length * 2);
    ids.forEach((id, k) => {
      flat[k * 2] = points[id * 2];
      flat[k * 2 + 1] = points[id * 2 + 1];
    });
    for (const local of earcut(flat as unknown as number[], holeStarts, 2)) out.push(ids[local]);
  }
  return Uint32Array.from(out);
}

/**
 * River strips to rasterize: whole rivers, except those already mostly
 * covered by their real polygon — for those only the stretches it misses.
 */
function planStrips(rivers: River[], areaGrid: WaterGrid | null): River[] {
  const strips: River[] = [];
  for (const river of rivers) {
    if (!areaGrid || riverCoverage(river, areaGrid) < STRIP_SKIP_COVERAGE) {
      strips.push(river);
      continue;
    }
    uncoveredRuns(river, areaGrid, 6).forEach((points, k) => strips.push({ ...river, id: `${river.id}-tramo-${k}`, points }));
  }
  return strips;
}

/** Stable short hash of a string (FNV-1a, 32 bit, hex). */
export function hashText(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}
