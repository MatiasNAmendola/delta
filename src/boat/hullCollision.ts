/**
 * Keeps the whole hull on the water, not just its center: the lancha is
 * 6 x 2 units, so a center-only test let half of it sit on the bank when
 * turning next to the shore.
 */
import { BOAT_LENGTH, BOAT_WIDTH } from "../utils/constants";

export type WaterTest = (x: number, z: number) => boolean;

export interface Pose {
  x: number;
  z: number;
  rotation: number;
}

/**
 * Hull outline in boat space (x = starboard, z = forward): bow tip, two
 * points along each side and the stern corners.
 */
const HULL: ReadonlyArray<readonly [number, number]> = (() => {
  const halfW = BOAT_WIDTH / 2;
  const halfL = BOAT_LENGTH / 2;
  return [
    [0, halfL],
    [-halfW * 0.6, halfL * 0.75], [halfW * 0.6, halfL * 0.75],
    [-halfW, halfL * 0.3], [halfW, halfL * 0.3],
    [-halfW, -halfL * 0.3], [halfW, -halfL * 0.3],
    [-halfW * 0.9, -halfL], [halfW * 0.9, -halfL],
    [0, -halfL],
  ] as const;
})();

/** How many hull points are over land at this pose (0 = fully afloat). */
export function pointsOnLand(pose: Pose, isWater: WaterTest): number {
  const s = Math.sin(pose.rotation);
  const c = Math.cos(pose.rotation);
  let n = 0;
  for (const [bx, bz] of HULL) {
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
export function canTake(from: Pose, to: Pose, isWater: WaterTest): boolean {
  const after = pointsOnLand(to, isWater);
  return after === 0 || after <= pointsOnLand(from, isWater);
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
  isWater: WaterTest
): { pose: Pose; hit: boolean; slid: boolean } {
  let pose = from;
  let hit = false;

  // Turning in place can swing the bow or stern onto the bank
  const turned = { ...pose, rotation: pose.rotation + turn };
  if (turn !== 0) {
    if (canTake(pose, turned, isWater)) pose = turned;
    else hit = true;
  }

  if (dx === 0 && dz === 0) return { pose, hit, slid: false };

  const moved = { ...pose, x: pose.x + dx, z: pose.z + dz };
  if (canTake(pose, moved, isWater)) return { pose: moved, hit, slid: false };

  // Slide along the bank on one axis
  const alongX = { ...pose, x: pose.x + dx };
  if (canTake(pose, alongX, isWater)) return { pose: alongX, hit: true, slid: true };
  const alongZ = { ...pose, z: pose.z + dz };
  if (canTake(pose, alongZ, isWater)) return { pose: alongZ, hit: true, slid: true };

  return { pose, hit: true, slid: false };
}

/** Heading (0..2π step 16) that best fits the hull at (x, z), for spawning. */
export function bestFitRotation(x: number, z: number, preferred: number, isWater: WaterTest): number {
  let best = preferred;
  let bestLand = pointsOnLand({ x, z, rotation: preferred }, isWater);
  for (let k = 1; k < 16 && bestLand > 0; k++) {
    const rotation = preferred + (k * Math.PI) / 8;
    const land = pointsOnLand({ x, z, rotation }, isWater);
    if (land < bestLand) {
      best = rotation;
      bestLand = land;
    }
  }
  return best;
}
