/**
 * The living river (ADR 0009): tide level, current along each river, wind
 * waves, wakes of passing boats and the sudestada. Pure logic, no Babylon:
 * the renderer and the boats read from it.
 *
 * Units: world units (8 m) and seconds. Speeds are scaled to the game's
 * boats (a kayak tops at ~4 units/s), not real m/s, so the current is felt.
 */
import type { River } from "./WorldDoc";

/** Game seconds per tide cycle (real: 12.42 h). One cycle in about 8 minutes of play. */
export const TIDE_PERIOD = 480;
/** Tide amplitude (units): ±0.05 = ±40 cm, the Delta's usual astronomical tide. */
export const TIDE_AMPLITUDE = 0.05;
/** River discharge towards the Río de la Plata (units/s). */
const BASE_FLOW = 0.35;
/** Tidal current at its peak (units/s): reverses the flow on the flood. */
const TIDE_FLOW = 0.9;
/** Downstream direction of the Delta: towards the south-east (+x east, +z north). */
const DOWNSTREAM: [number, number] = [Math.SQRT1_2, -Math.SQRT1_2];

export interface Wake {
  x: number;
  z: number;
  heading: number;
  /** 0..1 */
  strength: number;
  length: number;
}

export interface SudestadaState {
  /** 0 = calm, 1 = full sudestada. */
  intensity: number;
  active: boolean;
}

export class WaterConditions {
  time = 0;
  /** Tide phase in radians; the level is sin(phase), rising while cos(phase) > 0. */
  tidePhase: number;
  /** 0..1 wind strength and its direction (where it blows towards). */
  wind = { strength: 0.25, x: 0.6, z: 0.8 };
  sudestada: SudestadaState = { intensity: 0, active: false };
  wakes: Wake[] = [];
  private sudestadaTarget = 0;
  private segments: Array<{ ax: number; az: number; bx: number; bz: number; dx: number; dz: number }> = [];
  private cells = new Map<number, number[]>();
  private readonly cell = 24;

  constructor(
    rivers: River[],
    /** Distance from a water point to the nearest bank (units). */
    private distanceToBank: (x: number, z: number) => number,
    seed = Math.random()
  ) {
    this.tidePhase = seed * Math.PI * 2;
    for (const r of rivers) {
      for (let i = 1; i < r.points.length; i++) {
        const [ax, az] = r.points[i - 1];
        const [bx, bz] = r.points[i];
        const len = Math.hypot(bx - ax, bz - az) || 1;
        let dx = (bx - ax) / len;
        let dz = (bz - az) / len;
        // Rivers flow towards the Río de la Plata (south-east)
        if (dx * DOWNSTREAM[0] + dz * DOWNSTREAM[1] < 0) {
          dx = -dx;
          dz = -dz;
        }
        const id = this.segments.push({ ax, az, bx, bz, dx, dz }) - 1;
        const minI = Math.floor(Math.min(ax, bx) / this.cell) - 1;
        const maxI = Math.floor(Math.max(ax, bx) / this.cell) + 1;
        const minJ = Math.floor(Math.min(az, bz) / this.cell) - 1;
        const maxJ = Math.floor(Math.max(az, bz) / this.cell) + 1;
        for (let ci = minI; ci <= maxI; ci++) {
          for (let cj = minJ; cj <= maxJ; cj++) {
            const key = ci * 100003 + cj;
            const list = this.cells.get(key);
            if (list) list.push(id);
            else this.cells.set(key, [id]);
          }
        }
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.tidePhase += (dt / TIDE_PERIOD) * Math.PI * 2;
    // The sudestada builds up and dies down over tens of seconds
    const s = this.sudestada;
    s.intensity += Math.sign(this.sudestadaTarget - s.intensity) * Math.min(Math.abs(this.sudestadaTarget - s.intensity), dt / 25);
    s.active = s.intensity > 0.15;
    // South-east wind: blows towards the north-west
    const calmWind = 0.25 + 0.1 * Math.sin(this.time * 0.05);
    this.wind.strength = calmWind + (1 - calmWind) * s.intensity;
    const nwx = -Math.SQRT1_2;
    const nwz = Math.SQRT1_2;
    this.wind.x = 0.6 + (nwx - 0.6) * s.intensity;
    this.wind.z = 0.8 + (nwz - 0.8) * s.intensity;
  }

  startSudestada(): void {
    this.sudestadaTarget = 1;
  }

  endSudestada(): void {
    this.sudestadaTarget = 0;
  }

  /** Water level relative to the base: tide plus the sudestada's surge. */
  level(): number {
    return TIDE_AMPLITUDE * Math.sin(this.tidePhase) + 0.1 * this.sudestada.intensity;
  }

  /** "creciente" (rising, flood) or "bajante" (falling, ebb). */
  tideTrend(): "creciente" | "bajante" {
    return Math.cos(this.tidePhase) > 0 || this.sudestada.intensity > 0.5 ? "creciente" : "bajante";
  }

  /**
   * Current at a water point (units/s): along the nearest river, downstream
   * on the ebb, upstream on the flood or with a sudestada; strongest
   * mid-channel, fading to nothing at the banks.
   */
  current(x: number, z: number): [number, number] {
    const seg = this.nearestSegment(x, z);
    if (!seg) return [0, 0];
    const flood = Math.cos(this.tidePhase);
    const along = BASE_FLOW - TIDE_FLOW * Math.max(0, flood) * 0.9 + TIDE_FLOW * Math.max(0, -flood) * 0.3 - 1.4 * this.sudestada.intensity;
    const bank = Math.min(1, this.distanceToBank(x, z) / 3);
    const speed = along * bank * (0.4 + 0.6 * bank);
    return [seg.dx * speed, seg.dz * speed];
  }

  /**
   * Height of the water surface (relative to the base level) at a point:
   * tide, wind waves (bigger with the wind) and the wakes of passing boats.
   */
  height(x: number, z: number): number {
    const t = this.time;
    const w = this.wind.strength;
    const along = x * this.wind.x + z * this.wind.z;
    const across = x * this.wind.z - z * this.wind.x;
    let h = this.level();
    h += (0.004 + 0.035 * w * w) * Math.sin(along * 1.6 - t * 2.1);
    h += (0.003 + 0.02 * w * w) * Math.sin(along * 2.7 + across * 0.9 - t * 3.0);
    h += 0.002 * Math.sin(across * 3.3 + t * 1.3);
    for (const wake of this.wakes) h += wakeHeight(wake, x, z, t);
    return h;
  }

  private nearestSegment(x: number, z: number) {
    const list = this.cells.get(Math.floor(x / this.cell) * 100003 + Math.floor(z / this.cell));
    if (!list) return null;
    let best = null;
    let bestD = Infinity;
    for (const id of list) {
      const s = this.segments[id];
      const ex = s.bx - s.ax;
      const ez = s.bz - s.az;
      const l2 = ex * ex + ez * ez || 1;
      const u = Math.max(0, Math.min(1, ((x - s.ax) * ex + (z - s.az) * ez) / l2));
      const d = (s.ax + ex * u - x) ** 2 + (s.az + ez * u - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }
}

/**
 * A boat's wake as felt at (x, z): waves inside the V behind it (Kelvin
 * angle ~19.5°), fading with distance.
 */
export function wakeHeight(w: Wake, x: number, z: number, t: number): number {
  const fx = Math.sin(w.heading);
  const fz = Math.cos(w.heading);
  const rx = x - w.x;
  const rz = z - w.z;
  const behind = -(rx * fx + rz * fz) - w.length * 0.3;
  if (behind < 0 || behind > 14) return 0;
  const side = Math.abs(rx * fz - rz * fx);
  const edge = behind * 0.354 + w.length * 0.3; // tan(19.5°) ≈ 0.354
  if (side > edge + 0.8) return 0;
  // Strongest along the arms of the V, where the wave crests pile up
  const arm = Math.exp(-(((side - edge) / 0.6) ** 2));
  const d = Math.hypot(behind, side);
  return 0.045 * w.strength * arm * Math.exp(-d / 6) * Math.sin(d * 3.2 - t * 5);
}
