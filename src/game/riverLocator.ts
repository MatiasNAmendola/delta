/**
 * Which river or arroyo the boat is on. Distance to each stretch (segment)
 * of the river's centre line, not to its vertices: the big rivers have
 * vertices kilometres apart, so going by vertices a small arroyo nearby
 * used to "win" in the middle of the Luján.
 *
 * Inside several channels (a confluence), the widest one wins: at the
 * mouth of an arroyo you are still on the river. Outside all of them, the
 * nearest bank's river.
 */
import type { River } from "../world/WorldDoc";

interface Segment {
  river: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

export interface RiverHit {
  name: string;
  /** True when the point is inside the channel (within half its width, with some margin). */
  inside: boolean;
  /** Distance (units) from the channel's edge (negative inside). */
  edge: number;
}

export class RiverLocator {
  private cells = new Map<number, Segment[]>();

  constructor(private rivers: River[], private cell = 32) {
    rivers.forEach((r, k) => {
      const pad = r.width / 2 + cell;
      for (let i = 1; i < r.points.length; i++) {
        const [ax, az] = r.points[i - 1];
        const [bx, bz] = r.points[i];
        const seg = { river: k, ax, az, bx, bz };
        // Every cell the segment (widened by half the channel) passes near
        const len = Math.hypot(bx - ax, bz - az);
        const steps = Math.max(1, Math.ceil(len / (cell / 2)));
        const seen = new Set<number>();
        for (let s = 0; s <= steps; s++) {
          const x = ax + ((bx - ax) * s) / steps;
          const z = az + ((bz - az) * s) / steps;
          const reach = Math.ceil(pad / cell);
          const ci = Math.floor(x / cell);
          const cj = Math.floor(z / cell);
          for (let di = -reach; di <= reach; di++) {
            for (let dj = -reach; dj <= reach; dj++) {
              const key = (ci + di) * 73856093 + (cj + dj);
              if (seen.has(key)) continue;
              seen.add(key);
              const list = this.cells.get(key);
              if (list) list.push(seg);
              else this.cells.set(key, [seg]);
            }
          }
        }
      }
    });
  }

  at(x: number, z: number): RiverHit | null {
    const list = this.cells.get(Math.floor(x / this.cell) * 73856093 + Math.floor(z / this.cell));
    if (!list) return null;
    let best: { river: number; edge: number; inside: boolean } | null = null;
    const nearest = new Map<number, number>();
    for (const s of list) {
      const ex = s.bx - s.ax;
      const ez = s.bz - s.az;
      const l2 = ex * ex + ez * ez || 1;
      const u = Math.max(0, Math.min(1, ((x - s.ax) * ex + (z - s.az) * ez) / l2));
      const d = Math.hypot(s.ax + ex * u - x, s.az + ez * u - z);
      const prev = nearest.get(s.river);
      if (prev === undefined || d < prev) nearest.set(s.river, d);
    }
    for (const [k, d] of nearest) {
      const r = this.rivers[k];
      // A little margin: the drawn banks wander around the centre line
      const edge = d - r.width * 0.6;
      const inside = edge <= 0;
      if (
        !best ||
        (inside && !best.inside) ||
        (inside && best.inside && r.width > this.rivers[best.river].width) ||
        (!inside && !best.inside && edge < best.edge)
      ) {
        best = { river: k, edge, inside };
      }
    }
    return best ? { name: this.rivers[best.river].name, inside: best.inside, edge: best.edge } : null;
  }
}
