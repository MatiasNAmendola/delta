/**
 * Engine-agnostic pieces of the rowing-boat (yola) traffic: following a river
 * back and forth, and the Delta courtesy rule of slowing down near rowers.
 */
import type { Vec2 } from "./WorldDoc";

/** A polyline the yola rows along, there and back again forever. */
export class PingPongRoute {
  readonly length: number;
  private readonly cumulative: number[];

  constructor(readonly points: Vec2[]) {
    if (points.length < 2) throw new Error("A route needs at least two points");
    this.cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1];
      const [bx, bz] = points[i];
      this.cumulative.push(this.cumulative[i - 1] + Math.hypot(bx - ax, bz - az));
    }
    this.length = this.cumulative[this.cumulative.length - 1];
  }

  /**
   * Position and heading after rowing `traveled` units from the start.
   * Heading follows the game convention: 0 = +z, atan2(dx, dz).
   */
  at(traveled: number): { x: number; z: number; heading: number } {
    const period = this.length * 2;
    const t = ((traveled % period) + period) % period;
    const forward = t <= this.length;
    const s = forward ? t : period - t;

    let i = 1;
    while (i < this.cumulative.length - 1 && this.cumulative[i] < s) i++;
    const [ax, az] = this.points[i - 1];
    const [bx, bz] = this.points[i];
    const seg = this.cumulative[i] - this.cumulative[i - 1] || 1;
    const f = (s - this.cumulative[i - 1]) / seg;
    const dx = (bx - ax) * (forward ? 1 : -1);
    const dz = (bz - az) * (forward ? 1 : -1);
    return { x: ax + (bx - ax) * f, z: az + (bz - az) * f, heading: Math.atan2(dx, dz) };
  }
}

/** Polyline shifted sideways by `offset` (positive = right of travel direction). */
export function offsetPolyline(points: Vec2[], offset: number): Vec2[] {
  return points.map(([x, z], i) => {
    const [px, pz] = points[Math.max(0, i - 1)];
    const [nx, nz] = points[Math.min(points.length - 1, i + 1)];
    const dx = nx - px;
    const dz = nz - pz;
    const len = Math.hypot(dx, dz) || 1;
    // Right of travel direction for heading atan2(dx, dz) is (dz, -dx)
    return [x + (dz / len) * offset, z - (dx / len) * offset];
  });
}

/** World units (8 m each): about 25 m around the rowers. */
export const COURTESY_RADIUS = 3;
/** Fraction of top speed above which the lancha's wake swamps the rowers. */
export const COURTESY_SPEED = 0.55;

/**
 * Delta rule: lanchas slow down when passing rowers, or their wake swamps
 * them. Returns true when this pass breaks the rule.
 */
export function breaksWakeCourtesy(distance: number, speedRatio: number): boolean {
  return distance < COURTESY_RADIUS && Math.abs(speedRatio) > COURTESY_SPEED;
}
