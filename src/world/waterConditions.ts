/**
 * The living river (ADR 0009): tide level, current along each river, wind
 * waves, wakes of passing boats and the sudestada. Pure logic, no Babylon:
 * the renderer and the boats read from it.
 *
 * Units: world units (8 m) and seconds. Speeds are scaled to the game's
 * boats (a kayak tops at ~4 units/s), not real m/s, so the current is felt.
 */
import type { River } from "./WorldDoc";
import { froude, kelvinElevation, type WakeSource } from "./wakePhysics";
import { METERS_PER_UNIT } from "../utils/constants";

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
  /**
   * The shore near a point, for waves bouncing off it: the point mirrored
   * across the bank and how much that bank reflects (null far from any).
   */
  wall: ((x: number, z: number) => { mx: number; mz: number; kr: number } | null) | null = null;
  /** Today's real river: level offset (units) and wind, when the data arrived (liveConditions.ts). */
  private real: { offset: number; wind: { strength: number; x: number; z: number } | null } | null = null;
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
    // Today's wind if we have it, else a gentle breeze; a sudestada blows towards the north-west
    const base = this.real?.wind ?? { strength: 0.25 + 0.1 * Math.sin(this.time * 0.05), x: 0.6, z: 0.8 };
    this.wind.strength = base.strength + (1 - base.strength) * s.intensity;
    const nwx = -Math.SQRT1_2;
    const nwz = Math.SQRT1_2;
    this.wind.x = base.x + (nwx - base.x) * s.intensity;
    this.wind.z = base.z + (nwz - base.z) * s.intensity;
  }

  startSudestada(): void {
    this.sudestadaTarget = 1;
  }

  endSudestada(): void {
    this.sudestadaTarget = 0;
  }

  /** Water level relative to the base: tide plus the sudestada's surge (plus today's real level). */
  level(): number {
    return (this.real?.offset ?? 0) + TIDE_AMPLITUDE * Math.sin(this.tidePhase) + 0.1 * this.sudestada.intensity;
  }

  /**
   * Starts from today's real river: the level as an offset (units) and
   * whether it is rising; the tide goes on from there. Wind blowing
   * towards (x, z), strength 0..1.
   */
  useReal(offset: number, rising: boolean, wind: { strength: number; x: number; z: number } | null): void {
    // At sin = 0 the tide adds nothing now and keeps the real trend
    this.tidePhase = rising ? 0 : Math.PI;
    this.real = { offset, wind };
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
    // Short chop, a few metres long (~1 unit), that a hull feels: what makes a
    // boat pitch and roll even at rest. About 10 cm on a calm day, 40 cm or
    // so with a stiff wind; one train runs with the wind, one across it so
    // the hull also rolls (docs/adr/0009)
    h += (0.005 + 0.036 * w) * Math.sin(along * 5.8 - t * 3.6 + 0.8 * Math.sin(across * 1.3 + t * 0.4));
    h += (0.002 + 0.014 * w) * Math.sin(across * 6.7 + along * 2.1 - t * 4.1);
    if (this.wakes.length) {
      // Each wake, plus its reflection off a wall nearby (image method)
      const wall = this.wall?.(x, z) ?? null;
      for (const wake of this.wakes) {
        h += wakeHeight(wake, x, z, t);
        if (wall) h += wall.kr * wakeHeight(wake, wall.mx, wall.mz, t);
      }
    }
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

/** A lancha colectiva of the traffic: real top speed (m/s) and wave height there (m). */
const TRAFFIC_SPEED = 5.1;
const TRAFFIC_WAKE = 0.35;

/**
 * A passing boat's wake as felt at (x, z), in world units: the same Kelvin
 * physics the wake shader draws (wakePhysics.ts). Steady in the boat's
 * frame; it rocks you as the boat goes by.
 */
export function wakeHeight(w: Wake, x: number, z: number, _t = 0): number {
  const fx = Math.sin(w.heading);
  const fz = Math.cos(w.heading);
  const rx = x - w.x;
  const rz = z - w.z;
  // From the bow (half a hull ahead of the center), in metres
  const behind = (-(rx * fx + rz * fz) + w.length / 2) * METERS_PER_UNIT;
  const side = (rx * fz - rz * fx) * METERS_PER_UNIT;
  const L = w.length * METERS_PER_UNIT;
  const source: WakeSource = {
    U: TRAFFIC_SPEED * w.strength,
    L,
    beam: L * 0.31,
    height: TRAFFIC_WAKE,
    topFroude: froude(TRAFFIC_SPEED, L),
    hull: "displacement",
  };
  return kelvinElevation(behind, side, source) / METERS_PER_UNIT;
}
