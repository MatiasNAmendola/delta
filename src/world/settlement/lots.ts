/**
 * Where people live in the Delta: houses along the banks, each facing the
 * river with its own muelle. Walks the shoreline rings and lays out lots,
 * denser in some stretches and wild in others, never on a sliver of land,
 * near the world's edge or in front of a public stop. Pure logic, no
 * Babylon, so it can be tested.
 *
 * Units: world units (8 m). The rings have the water on their left.
 */
import type { Vec2 } from "../WorldDoc";
import { fbm } from "../layout/noise";
import { seededRandom } from "../../utils/helpers";

export type HouseKind = "palafito" | "material" | "isleña" | "alpina";
export type DockKind = "simple" | "glorieta" | "te" | "ponton" | "bajada";

export interface Lot {
  /** Bank point where the dock starts (on the shoreline). */
  x: number;
  z: number;
  /** Unit vector from the bank towards the water. */
  nx: number;
  nz: number;
  /** Rotation for a prop whose local +z faces the water (propTransform convention). */
  rotation: number;
  /** House center, set back on land. */
  hx: number;
  hz: number;
  house: HouseKind;
  dock: DockKind;
  /** Dock length over the water (world units). */
  dockLength: number;
  seed: number;
}

export interface LotOptions {
  /** World spans -worldHalf..worldHalf. */
  worldHalf: number;
  /** Places to keep clear (public stops, etc.). */
  avoid: Array<{ x: number; z: number; r: number }>;
  seed: number;
  /** 0..1, how built-up the Delta is (fraction of the banks with houses). */
  density: number;
}

/** A grid of occupied circles, for "is anything within r of here?". */
export class ClearanceGrid {
  private cells = new Map<number, Array<[number, number, number]>>();

  constructor(private readonly cell = 4) {}

  add(x: number, z: number, r: number): void {
    const c = this.cell;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) {
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const key = i * 73856093 + j;
        const list = this.cells.get(key);
        if (list) list.push([x, z, r]);
        else this.cells.set(key, [[x, z, r]]);
      }
    }
  }

  /** True when a circle of radius r at (x, z) touches anything added. */
  blocked(x: number, z: number, r = 0): boolean {
    const list = this.cells.get(Math.floor(x / this.cell) * 73856093 + Math.floor(z / this.cell));
    if (list) for (const [px, pz, pr] of list) if (Math.hypot(px - x, pz - z) < pr + r) return true;
    if (r > 0) {
      // A wide query may reach into the neighbouring cells
      for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
        const other = this.cells.get(Math.floor((x + dx) / this.cell) * 73856093 + Math.floor((z + dz) / this.cell));
        if (other && other !== list) for (const [px, pz, pr] of other) if (Math.hypot(px - x, pz - z) < pr + r) return true;
      }
    }
    return false;
  }
}

/** Footprint radius of a house and its garden (world units). */
export const HOUSE_RADIUS = 1.1;
const MIN_SETBACK = 1.6;
const MAX_SETBACK = 2.6;

/** How far the water runs from (x, z) in direction (ux, uz), up to max. */
function waterRun(isWater: (x: number, z: number) => boolean, x: number, z: number, ux: number, uz: number, max: number): number {
  let t = 0.25;
  while (t < max && isWater(x + ux * t, z + uz * t)) t += 0.25;
  return t;
}

export function planLots(rings: Vec2[][], isWater: (x: number, z: number) => boolean, o: LotOptions): Lot[] {
  const rng = seededRandom(o.seed);
  const lots: Lot[] = [];
  const taken = new ClearanceGrid(4);
  const edge = o.worldHalf - 6;
  const dry = (x: number, z: number) => !isWater(x, z);

  for (const ring of rings) {
    let next = rng() * 8;
    let walked = 0;
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i];
      const [bx, bz] = ring[(i + 1) % ring.length];
      const len = Math.hypot(bx - ax, bz - az);
      if (len === 0) continue;
      while (next < walked + len) {
        const t = (next - walked) / len;
        // Houses every 35-90 m where people live
        next += 4.4 + rng() * 6.8;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        // Water on the left of the ring
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        if (Math.abs(x) > edge || Math.abs(z) > edge) continue;
        // Built-up and wild stretches: larger-scale noise, thresholded by density
        const busy = fbm(x * 0.0045, z * 0.0045, 3, o.seed);
        if (busy > 0.3 + 0.3 * o.density || rng() < 0.12) continue;
        if (o.avoid.some((a) => Math.hypot(a.x - x, a.z - z) < a.r)) continue;

        const setback = MIN_SETBACK + rng() * (MAX_SETBACK - MIN_SETBACK);
        const hx = x - nx * setback;
        const hz = z - nz * setback;
        if (taken.blocked(hx, hz, HOUSE_RADIUS)) continue;
        // The house and its garden on solid ground, the island deep enough behind it
        const sx = -nz;
        const sz = nx;
        const footprint = [
          [0, 0], [0.9, 0.9], [-0.9, 0.9], [0.9, -0.9], [-0.9, -0.9], [0, -2.2],
        ].every(([a, b]) => dry(hx + sx * a - nx * b, hz + sz * a - nz * b));
        if (!footprint || !dry(x - nx * 0.4, z - nz * 0.4)) continue;
        // Between house and river: land, not a little bay
        if (isWater(x - nx * (setback * 0.5), z - nz * (setback * 0.5))) continue;

        // The dock never takes more than a quarter of the channel
        const width = waterRun(isWater, x + nx * 0.2, z + nz * 0.2, nx, nz, 40);
        const roll = rng();
        let dock: DockKind;
        let dockLength: number;
        if (width < 3) {
          dock = "bajada";
          dockLength = 0;
        } else {
          dock = width > 9 && roll < 0.18 ? "ponton" : roll < 0.45 ? "simple" : roll < 0.75 ? "glorieta" : "te";
          dockLength = Math.min(width * 0.25, 0.7 + rng() * 0.8);
        }
        const h = rng();
        const house: HouseKind = h < 0.5 ? "palafito" : h < 0.7 ? "isleña" : h < 0.88 ? "material" : "alpina";
        taken.add(hx, hz, HOUSE_RADIUS);
        lots.push({
          x,
          z,
          nx,
          nz,
          rotation: Math.atan2(nx, nz),
          hx,
          hz,
          house,
          dock,
          dockLength,
          seed: Math.floor(rng() * 1e9),
        });
      }
      walked += len;
    }
  }
  return lots;
}
