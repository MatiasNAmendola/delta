/**
 * Keeps the whole hull on the water, not just its center: a center-only
 * test let half of a boat sit on the bank when turning next to the shore.
 */
import { BOAT_LENGTH, BOAT_WIDTH } from "../utils/constants";

export type WaterTest = (x: number, z: number) => boolean;

export interface Pose {
  x: number;
  z: number;
  rotation: number;
}

/** Hull outline in boat space (x = starboard, z = forward). */
export type Hull = ReadonlyArray<readonly [number, number]>;

/** Bow tip, two points along each side and the stern corners of a length x width boat. */
export function hullOutline(length: number, width: number): Hull {
  const halfW = width / 2;
  const halfL = length / 2;
  return [
    [0, halfL],
    [-halfW * 0.6, halfL * 0.75], [halfW * 0.6, halfL * 0.75],
    [-halfW, halfL * 0.3], [halfW, halfL * 0.3],
    [-halfW, -halfL * 0.3], [halfW, -halfL * 0.3],
    [-halfW * 0.9, -halfL], [halfW * 0.9, -halfL],
    [0, -halfL],
  ];
}

/** The lancha colectiva's hull, the default. */
const DEFAULT_HULL = hullOutline(BOAT_LENGTH, BOAT_WIDTH);

/** Deflections tried when a move hits the bank (degrees, small first, both ways). */
const SLIDE_ANGLES = [15, -15, 30, -30, 45, -45, 60, -60, 75, -75];

/** How many hull points are over land at this pose (0 = fully afloat). */
export function pointsOnLand(pose: Pose, isWater: WaterTest, hull: Hull = DEFAULT_HULL): number {
  const s = Math.sin(pose.rotation);
  const c = Math.cos(pose.rotation);
  let n = 0;
  for (const [bx, bz] of hull) {
    // Same convention as the boat's movement: forward = (sin r, cos r), starboard = (cos r, -sin r)
    const x = pose.x + bx * c + bz * s;
    const z = pose.z - bx * s + bz * c;
    if (!isWater(x, z)) n++;
  }
  return n;
}

/**
 * A pose change is allowed when the hull ends fully afloat, or — if the
 * boat is already touching land (e.g. spawned against a bank) — when it
 * gets no more stranded, so it can always work its way back out.
 */
export function canTake(from: Pose, to: Pose, isWater: WaterTest, hull: Hull = DEFAULT_HULL): boolean {
  const after = pointsOnLand(to, isWater, hull);
  return after === 0 || after <= pointsOnLand(from, isWater, hull);
}

/**
 * Applies a turn and a forward move with hull collision. Blocked moves try
 * to slide along the bank (x or z only); the returned `hit` tells the
 * caller to bounce/slow the boat.
 */
export function moveHull(
  from: Pose,
  turn: number,
  dx: number,
  dz: number,
  isWater: WaterTest,
  hull: Hull = DEFAULT_HULL
): { pose: Pose; hit: boolean; slid: boolean; turnBlocked: boolean } {
  let pose = from;
  let turnBlocked = false;

  // Turning in place can swing the bow or stern onto the bank: then the
  // turn is refused (not a collision: the boat keeps its speed)
  const turned = { ...pose, rotation: pose.rotation + turn };
  if (turn !== 0) {
    if (canTake(pose, turned, isWater, hull)) pose = turned;
    else turnBlocked = true;
  }

  if (dx === 0 && dz === 0) return { pose, hit: false, slid: false, turnBlocked };

  const moved = { ...pose, x: pose.x + dx, z: pose.z + dz };
  if (canTake(pose, moved, isWater, hull)) return { pose: moved, hit: false, slid: false, turnBlocked };

  // Slide along the bank: deflect the move a little at a time, keeping only
  // the part of it that runs along the shore (cos of the deflection), and
  // turn the bow with it, as a boat scraping a bank does
  for (const deg of SLIDE_ANGLES) {
    const a = (deg * Math.PI) / 180;
    const k = Math.cos(a);
    const sx = (dx * Math.cos(a) - dz * Math.sin(a)) * k;
    const sz = (dx * Math.sin(a) + dz * Math.cos(a)) * k;
    const slid = { x: pose.x + sx, z: pose.z + sz, rotation: pose.rotation };
    if (!canTake(pose, slid, isWater, hull)) continue;
    const aligned = { ...slid, rotation: pose.rotation - a * 0.08 };
    return { pose: canTake(slid, aligned, isWater, hull) ? aligned : slid, hit: true, slid: true, turnBlocked };
  }

  return { pose, hit: true, slid: false, turnBlocked };
}

/**
 * Spawn pose: the preferred heading at (x, z) if the whole hull floats;
 * otherwise other headings, then nearby spots in a widening spiral. Never
 * starting aground matters: once afloat, moves only accept fully afloat poses.
 */
export function findFloatingPose(x: number, z: number, preferred: number, isWater: WaterTest, hull: Hull = DEFAULT_HULL): Pose {
  for (let r = 0; r <= 12; r += 0.5) {
    const tries = r === 0 ? 1 : Math.max(8, Math.round(r * 6));
    for (let k = 0; k < tries; k++) {
      const a = (k / tries) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      for (let h = 0; h < 16; h++) {
        // Preferred heading first, then alternating turns away from it
        const turn = (Math.ceil(h / 2) * (h % 2 ? 1 : -1) * Math.PI) / 8;
        const pose = { x: px, z: pz, rotation: preferred + turn };
        if (pointsOnLand(pose, isWater, hull) === 0) return pose;
      }
    }
  }
  return { x, z, rotation: bestFitRotation(x, z, preferred, isWater, hull) };
}

/** Heading (0..2π step 16) that best fits the hull at (x, z). */
export function bestFitRotation(x: number, z: number, preferred: number, isWater: WaterTest, hull: Hull = DEFAULT_HULL): number {
  let best = preferred;
  let bestLand = pointsOnLand({ x, z, rotation: preferred }, isWater, hull);
  for (let k = 1; k < 16 && bestLand > 0; k++) {
    const rotation = preferred + (k * Math.PI) / 8;
    const land = pointsOnLand({ x, z, rotation }, isWater, hull);
    if (land < bestLand) {
      best = rotation;
      bestLand = land;
    }
  }
  return best;
}
