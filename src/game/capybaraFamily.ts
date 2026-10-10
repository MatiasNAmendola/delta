/**
 * A capybara family and its state machine (ADR 0018). Pure, no Babylon.
 *
 *   bank ──(player near, path clear)──> crossing ──> farBank ──(graze)──> bank (the other side)
 *     ^                                    │
 *     └────────────  farBank  <──  dived <─┘  (scared, or touched, from any phase)
 *
 * - bank: grazing on the shore, waiting for a quiet moment to cross.
 * - crossing: swimming in single file across the arroyo (only back and
 *   head show), then climbing out.
 * - farBank: on the other shore, grazing.
 * - dived: under water for a few seconds, then back up on the bank farthest
 *   from whoever scared them, spooked for a while.
 *
 * Sizes are game scale (a bit bigger than life, so they read from the
 * boat); speeds are in world units per second (8 m per unit).
 */
import type { CrossingZone, Pt } from "./capybaraZones";
import { METERS_PER_UNIT } from "../utils/constants";

export type FamilyPhase = "bank" | "crossing" | "farBank" | "dived";

/** Swimming speed in a group: a design value, 1.2 m/s (doc 12: sources say "up to ~8 km/h" when fleeing). */
export const SWIM_SPEED = 1.2 / METERS_PER_UNIT;
/** Gap between animals in the file (units). */
export const FILE_GAP = 0.34;
/** Land strip behind the water's edge where they graze (units). */
export const LAND_DEPTH = 0.7;
export const DIVE_SECONDS = 5;
/** After a scare they stay quiet this long (s). */
export const SPOOKED_SECONDS = 30;
/** The family starts crossing when the player is within this many units of the crossing. */
export const TRIGGER_UNITS = 45;
/** A boat closer than this to the crossing line keeps them on the bank (they wait for it to leave). */
export const BLOCKED_UNITS = 2.2;

export interface FamilyContext {
  /** Distance (units) from the player's boat to the middle of the crossing. */
  playerDist: number;
  /** The boat is sitting on the crossing line. */
  blocked: boolean;
}

export interface FamilyMember {
  x: number;
  z: number;
  heading: number;
  /** 0 on land, 1 swimming (only back and head above the water). */
  wet: number;
  hidden: boolean;
  /** Walking or swimming (else grazing). */
  moving: boolean;
  calf: boolean;
}

/** Deterministic small numbers from the zone id and the member index. */
function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class CapybaraFamily {
  readonly size: number;
  phase: FamilyPhase = "bank";
  /** The bank (0 = A, 1 = B) the family is on, or leaves from. */
  side: 0 | 1;
  /** Seconds in the current phase (negative: a delay before it starts). */
  timer: number;
  /** Time left of being spooked. */
  spooked = 0;
  /** How many times the whole family has crossed. */
  crossings = 0;
  /** Distance travelled by the head of the file (units, from -LAND_DEPTH). */
  private travelled = 0;
  private diveTo: 0 | 1 = 0;

  constructor(readonly zone: CrossingZone) {
    this.size = 2 + zone.calves;
    this.side = hash(zone.id, 99) < 0.5 ? 0 : 1;
    this.timer = -(1 + hash(zone.id, 7) * 3);
  }

  private bank(side: 0 | 1): Pt {
    return side === 0 ? this.zone.a : this.zone.b;
  }

  /** Unit vector from the current side to the other. */
  private heading(side: 0 | 1): Pt {
    const [dx, dz] = this.zone.dir;
    return side === 0 ? [dx, dz] : [-dx, -dz];
  }

  update(dt: number, ctx: FamilyContext): void {
    this.spooked = Math.max(0, this.spooked - dt);
    this.timer += dt;
    switch (this.phase) {
      case "bank":
        if (this.timer >= 0 && this.spooked === 0 && !ctx.blocked && ctx.playerDist < TRIGGER_UNITS) {
          this.phase = "crossing";
          this.travelled = -LAND_DEPTH;
          this.timer = 0;
        }
        break;
      case "crossing": {
        this.travelled += SWIM_SPEED * dt;
        // Done when the last of the file is out of the water and onto the far shore
        if (this.travelled - (this.size - 1) * FILE_GAP >= this.zone.width + LAND_DEPTH * 0.5) {
          this.side = this.side === 0 ? 1 : 0;
          this.phase = "farBank";
          this.timer = 0;
          this.crossings++;
        }
        break;
      }
      case "farBank":
        // Graze a while (15-30 s, by zone), then be ready to cross back
        if (this.timer >= 15 + hash(this.zone.id, this.crossings) * 15 && this.spooked === 0) {
          this.phase = "bank";
          this.timer = 0;
        }
        break;
      case "dived":
        if (this.timer >= DIVE_SECONDS) {
          this.side = this.diveTo;
          this.phase = "farBank";
          this.timer = 0;
          this.spooked = SPOOKED_SECONDS;
        }
        break;
    }
  }

  /** Scared by a fast boat, its wave or a bump: dive and come up on the bank farthest from (px, pz). */
  scare(px: number, pz: number): void {
    if (this.phase === "dived") return;
    const da = Math.hypot(this.zone.a[0] - px, this.zone.a[1] - pz);
    const db = Math.hypot(this.zone.b[0] - px, this.zone.b[1] - pz);
    this.diveTo = da >= db ? 0 : 1;
    this.phase = "dived";
    this.timer = 0;
  }

  /** Where each animal of the file is: adult, calves, adult. */
  members(): FamilyMember[] {
    const out: FamilyMember[] = [];
    const W = this.zone.width;
    for (let i = 0; i < this.size; i++) {
      const calf = i > 0 && i < this.size - 1;
      if (this.phase === "dived") {
        out.push({ x: this.zone.x, z: this.zone.z, heading: 0, wet: 1, hidden: true, moving: true, calf });
        continue;
      }
      const side = this.side;
      const [dx, dz] = this.heading(side);
      const [ox, oz] = this.bank(side);
      // Where this animal grazes on the shore: spread along it and back from the edge
      const lateral = (hash(this.zone.id, i + 1) - 0.5) * 2.4 + (i - (this.size - 1) / 2) * 0.05;
      const back = 0.25 + hash(this.zone.id, i + 20) * (LAND_DEPTH - 0.25);
      const [ax, az] = this.zone.along;
      const spot = (s: 0 | 1, sign: number): Pt => {
        const [bx, bz] = this.bank(s);
        const [hx, hz] = this.heading(s);
        return [bx - hx * back * sign + ax * lateral, bz - hz * back * sign + az * lateral];
      };

      if (this.phase !== "crossing") {
        // Resting: on the current bank, facing the water or along the shore, head down
        const [gx, gz] = spot(side, 1);
        const face = Math.atan2(dx * 0.6 + ax * (lateral > 0 ? 1 : -1) * 0.8, dz * 0.6 + az * (lateral > 0 ? 1 : -1) * 0.8);
        out.push({ x: gx, z: gz, heading: face + (hash(this.zone.id, i + 40) - 0.5) * 0.8, wet: 0, hidden: false, moving: false, calf });
        continue;
      }

      // u: how far along the path this animal is (0 = water's edge of the origin bank)
      const u = this.travelled - i * FILE_GAP;
      const heading = Math.atan2(dx, dz);
      const [sx, sz] = spot(side, 1);
      const other: 0 | 1 = side === 0 ? 1 : 0;
      const [ex, ez] = spot(other, 1);
      if (u <= -LAND_DEPTH) {
        out.push({ x: sx, z: sz, heading: heading, wet: 0, hidden: false, moving: false, calf });
      } else if (u < 0) {
        const f = (u + LAND_DEPTH) / LAND_DEPTH;
        out.push({ x: sx + (ox - sx) * f, z: sz + (oz - sz) * f, heading, wet: 0, hidden: false, moving: true, calf });
      } else if (u <= W) {
        // The file wobbles a little as they paddle
        const wob = Math.sin(this.travelled * 4 + i * 1.7) * 0.025;
        out.push({
          x: ox + dx * u + ax * wob,
          z: oz + dz * u + az * wob,
          heading,
          wet: Math.min(1, Math.min(u, W - u) / 0.2),
          hidden: false,
          moving: true,
          calf,
        });
      } else if (u < W + LAND_DEPTH) {
        const f = (u - W) / LAND_DEPTH;
        const [bx, bz] = this.bank(other);
        out.push({ x: bx + (ex - bx) * f, z: bz + (ez - bz) * f, heading, wet: 0, hidden: false, moving: true, calf });
      } else {
        out.push({ x: ex, z: ez, heading, wet: 0, hidden: false, moving: false, calf });
      }
    }
    return out;
  }

  /** Distance (m) from (px, pz) to the nearest animal in sight (the middle of the crossing while under water). */
  distanceM(px: number, pz: number): number {
    let best = Infinity;
    for (const m of this.members()) {
      const x = m.hidden ? this.zone.x : m.x;
      const z = m.hidden ? this.zone.z : m.z;
      best = Math.min(best, Math.hypot(x - px, z - pz));
    }
    return best * METERS_PER_UNIT;
  }
}
