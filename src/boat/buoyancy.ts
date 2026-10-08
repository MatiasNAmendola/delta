/**
 * How a hull sits on the water, as games usually do it: sample the water
 * height at a few points of the hull (bow, stern, port, starboard), derive
 * heave, pitch and roll from them, and follow those targets with damped
 * springs so the boat has weight. On top of that, the hydrodynamics of each
 * hull type at speed:
 *
 * - Displacement hulls (lancha colectiva, rowing boats, kayaks) lift the
 *   bow slightly and settle a bit at the stern, but never "dive".
 * - Planing hulls (motor launches) climb onto the "hump" (bow well up),
 *   then plane: the bow comes down a little and the whole hull rises.
 * - Turning: planing hulls bank into the turn, displacement hulls heel
 *   slightly outward.
 *
 * Pure (no Babylon) so it can be tested.
 */
export type HullType = "displacement" | "planing";

export interface BuoyancyParams {
  length: number;
  width: number;
  hull: HullType;
}

export type WaterHeight = (x: number, z: number) => number;

export interface FloatState {
  /** Height of the boat's waterline reference above the base water level. */
  y: number;
  /** Radians; positive = bow up. */
  pitch: number;
  /** Radians; positive = starboard side down. */
  roll: number;
}

/** A damped spring towards a target value (semi-implicit Euler). */
class Spring {
  value = 0;
  velocity = 0;

  constructor(
    private stiffness: number,
    private damping: number
  ) {}

  step(target: number, dt: number): number {
    const accel = (target - this.value) * this.stiffness - this.velocity * this.damping;
    this.velocity += accel * dt;
    this.value += this.velocity * dt;
    return this.value;
  }
}

export class Buoyancy {
  private heave: Spring;
  private pitch: Spring;
  private roll: Spring;

  constructor(private p: BuoyancyParams) {
    // Small boats react fast to every ripple, big ones are slow and heavy
    const k = 26 / Math.max(0.4, p.length);
    this.heave = new Spring(k, 2 * Math.sqrt(k) * 0.55);
    this.pitch = new Spring(k * 0.8, 2 * Math.sqrt(k * 0.8) * 0.6);
    this.roll = new Spring(k * 1.2, 2 * Math.sqrt(k * 1.2) * 0.45);
  }

  /** Targets from the water under the hull and the boat's motion. */
  static targets(
    p: BuoyancyParams,
    water: WaterHeight,
    x: number,
    z: number,
    heading: number,
    speedRatio: number,
    turn: number
  ): FloatState {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const sx = Math.cos(heading);
    const sz = -Math.sin(heading);
    const hl = p.length * 0.42;
    const hw = p.width * 0.45;
    const bow = water(x + fx * hl, z + fz * hl);
    const stern = water(x - fx * hl, z - fz * hl);
    const stbd = water(x + sx * hw, z + sz * hw);
    const port = water(x - sx * hw, z - sz * hw);

    const r = Math.min(1, Math.abs(speedRatio));
    let trim = 0;
    let lift = 0;
    if (p.hull === "planing") {
      // Hump around 35% of top speed, then planing: bow comes down, hull rises
      const hump = Math.exp(-(((r - 0.35) / 0.18) ** 2));
      trim = hump * 0.14 + r * 0.05;
      lift = Math.max(0, r - 0.3) * p.length * 0.06;
    } else {
      // Displacement: gentle bow up, stern settles a little (squat)
      trim = r * r * 0.035;
      lift = -r * r * p.length * 0.008;
    }
    // Reversing pushes the stern down instead
    if (speedRatio < 0) trim = -r * 0.03;

    const heel = (p.hull === "planing" ? 0.12 : -0.035) * turn * r;
    return {
      y: (bow + stern + stbd + port) / 4 + lift,
      pitch: Math.atan2(bow - stern, hl * 2) + trim,
      roll: Math.atan2(port - stbd, hw * 2) + heel,
    };
  }

  update(dt: number, target: FloatState): FloatState {
    const step = Math.min(dt, 1 / 30);
    return {
      y: this.heave.step(target.y, step),
      pitch: this.pitch.step(target.pitch, step),
      roll: this.roll.step(target.roll, step),
    };
  }

  /** Jumps straight to the target (spawn). */
  reset(target: FloatState): void {
    this.heave.value = target.y;
    this.pitch.value = target.pitch;
    this.roll.value = target.roll;
    this.heave.velocity = this.pitch.velocity = this.roll.velocity = 0;
  }
}
