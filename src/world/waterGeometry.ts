/**
 * Engine-agnostic geometry for World Doc water areas: rasterizing them into
 * the water lookup grid, triangulating them for rendering, and measuring how
 * much of a river center line they already cover.
 */
import earcut from "earcut";
import type { River, Vec2, WaterArea } from "./WorldDoc";

/** Square grid over the world: cell (gx, gz) is stored at gx * res + gz. */
export interface WaterGrid {
  size: number;
  res: number;
  cells: Uint8Array;
}

export function createGrid(size: number, res: number): WaterGrid {
  return { size, res, cells: new Uint8Array(res * res) };
}

export function gridIndex(grid: WaterGrid, x: number, z: number): number {
  const gx = Math.floor(((x + grid.size / 2) / grid.size) * grid.res);
  const gz = Math.floor(((z + grid.size / 2) / grid.size) * grid.res);
  if (gx < 0 || gx >= grid.res || gz < 0 || gz >= grid.res) return -1;
  return gx * grid.res + gz;
}

export function isSet(grid: WaterGrid, x: number, z: number): boolean {
  const i = gridIndex(grid, x, z);
  return i !== -1 && grid.cells[i] === 1;
}

/**
 * Marks every cell whose center lies inside a water area (even-odd rule, so
 * islands stay dry). Scanline per grid column: O(cells + edges · columns).
 */
export function rasterizeAreas(grid: WaterGrid, areas: WaterArea[]): void {
  const { size, res } = grid;
  const cell = size / res;
  for (const area of areas) {
    const rings = [area.outer, ...area.holes];
    let minX = Infinity, maxX = -Infinity;
    for (const [x] of area.outer) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    const gx0 = Math.max(0, Math.floor((minX + size / 2) / cell));
    const gx1 = Math.min(res - 1, Math.ceil((maxX + size / 2) / cell));
    const crossings: number[] = [];
    for (let gx = gx0; gx <= gx1; gx++) {
      const x = -size / 2 + (gx + 0.5) * cell;
      crossings.length = 0;
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [ax, az] = ring[i];
          const [bx, bz] = ring[j];
          if ((ax > x) !== (bx > x)) crossings.push(az + ((x - ax) / (bx - ax)) * (bz - az));
        }
      }
      crossings.sort((a, b) => a - b);
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const gz0 = Math.max(0, Math.ceil((crossings[k] + size / 2) / cell - 0.5));
        const gz1 = Math.min(res - 1, Math.floor((crossings[k + 1] + size / 2) / cell - 0.5));
        for (let gz = gz0; gz <= gz1; gz++) grid.cells[gx * res + gz] = 1;
      }
    }
  }
}

/** Fraction (0..1) of a river's center line that lies inside the grid's water. */
export function riverCoverage(river: River, grid: WaterGrid, step = 2): number {
  let inside = 0;
  let total = 0;
  for (let i = 1; i < river.points.length; i++) {
    const [ax, az] = river.points[i - 1];
    const [bx, bz] = river.points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let s = 0; s < n; s++) {
      const t = s / n;
      total++;
      if (isSet(grid, ax + (bx - ax) * t, az + (bz - az) * t)) inside++;
    }
  }
  return total === 0 ? 0 : inside / total;
}

export interface Triangulation {
  /** x, z pairs. */
  vertices: Float32Array;
  indices: Uint32Array;
}

/** Triangulates all areas (holes included) into one merged vertex/index buffer. */
export function triangulateAreas(areas: WaterArea[]): Triangulation {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const area of areas) {
    const flat: number[] = [];
    const holeIndices: number[] = [];
    const pushRing = (ring: Vec2[]) => {
      for (const [x, z] of ring) flat.push(x, z);
    };
    pushRing(area.outer);
    for (const hole of area.holes) {
      holeIndices.push(flat.length / 2);
      pushRing(hole);
    }
    const base = vertices.length / 2;
    for (const i of earcut(flat, holeIndices, 2)) indices.push(base + i);
    for (const n of flat) vertices.push(n);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

/**
 * Pieces of a river center line that the grid's water does NOT cover, as
 * polylines resampled every `step` units. Each piece reaches one sample into
 * the covered water on both ends so the drawn strip joins the area seamlessly.
 */
export function uncoveredRuns(river: River, grid: WaterGrid, step = 4): Vec2[][] {
  const samples: Vec2[] = [];
  for (let i = 1; i < river.points.length; i++) {
    const [ax, az] = river.points[i - 1];
    const [bx, bz] = river.points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let s = 0; s < n; s++) samples.push([ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n]);
  }
  samples.push(river.points[river.points.length - 1]);

  const runs: Vec2[][] = [];
  let start = -1;
  for (let k = 0; k <= samples.length; k++) {
    const dry = k < samples.length && !isSet(grid, samples[k][0], samples[k][1]);
    if (dry && start === -1) start = k;
    if (!dry && start !== -1) {
      const run = samples.slice(Math.max(0, start - 1), Math.min(samples.length, k + 1));
      if (run.length >= 2) runs.push(run);
      start = -1;
    }
  }
  return runs;
}
