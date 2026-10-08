/**
 * Where to lay a rowing course: a long, fairly straight stretch of a wide
 * river, run downstream as the Luján regattas always were (since 1924,
 * "siempre a favor de la corriente"), with every lane on open water.
 * Pure logic, no Babylon.
 */
import type { River, Vec2 } from "../world/WorldDoc";
import { offsetPolyline } from "../world/rowingRoute";

/** 2000 m, the Olympic distance; 1000 m where no river has room. */
export const COURSE_LENGTHS = [250, 125];
/** World units: 13.5 m lanes, as in FISA courses. */
export const LANE_WIDTH = 1.7;
const STEP = 2.5;
/** Total turn allowed along the course (radians). */
const MAX_BEND = 1.1;
/** Downstream in the Delta: towards the Río de la Plata (south-east). */
const DOWNSTREAM: Vec2 = [Math.SQRT1_2, -Math.SQRT1_2];

export interface Course {
  river: string;
  /** Centerline, start to finish, sampled every STEP units. */
  path: Vec2[];
  length: number;
  /** One polyline per lane, left to right looking downstream. */
  lanes: Vec2[][];
}

/** Lane k's offset from the centerline (right of travel positive). */
export function laneOffset(k: number, lanes: number): number {
  return (k - (lanes - 1) / 2) * LANE_WIDTH;
}

/** Evenly resampled polyline. */
export function resample(points: Vec2[], step: number): Vec2[] {
  const out: Vec2[] = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const seg = Math.hypot(bx - ax, bz - az);
    let d = step - carry;
    while (d <= seg) {
      const f = d / seg;
      out.push([ax + (bx - ax) * f, az + (bz - az) * f]);
      d += step;
    }
    carry = seg - (d - step);
  }
  return out;
}

function bend(path: Vec2[]): number {
  let total = 0;
  for (let i = 2; i < path.length; i++) {
    const a = Math.atan2(path[i - 1][0] - path[i - 2][0], path[i - 1][1] - path[i - 2][1]);
    const b = Math.atan2(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    total += Math.abs(d);
  }
  return total;
}

/**
 * The best course for `lanes` boats near (x, z): the Luján first, then the
 * widest rivers; null if no river has a clear stretch.
 */
export function planCourse(
  rivers: River[],
  isWater: (x: number, z: number) => boolean,
  near: { x: number; z: number },
  lanes = 4
): Course | null {
  const candidates = rivers
    .filter((r) => r.width >= 14 && r.points.length >= 2)
    .sort((a, b) => Number(/luj[aá]n/i.test(b.name)) - Number(/luj[aá]n/i.test(a.name)) || b.width - a.width);
  const half = ((lanes + 1) / 2) * LANE_WIDTH;
  for (const length of COURSE_LENGTHS) {
    const samples = Math.round(length / STEP);
    let best: Course | null = null;
    let bestScore = Infinity;
    for (const river of candidates) {
      let points = river.points;
      const [fx, fz] = points[0];
      const [lx, lz] = points[points.length - 1];
      if ((lx - fx) * DOWNSTREAM[0] + (lz - fz) * DOWNSTREAM[1] < 0) points = [...points].reverse();
      const line = resample(points, STEP);
      for (let start = 0; start + samples < line.length; start += 4) {
        const path = line.slice(start, start + samples + 1);
        if (bend(path) > MAX_BEND) continue;
        // Every lane and a margin outside the outer ones must be water
        const clear = [-half, 0, half].every((off) => offsetPolyline(path, off).every(([x, z]) => isWater(x, z)));
        if (!clear) continue;
        const [sx, sz] = path[0];
        // Prefer the Luján (sorted first), then closeness to the player
        const score = Math.hypot(sx - near.x, sz - near.z) + candidates.indexOf(river) * 400;
        if (score < bestScore) {
          bestScore = score;
          best = {
            river: river.name,
            path,
            length,
            lanes: Array.from({ length: lanes }, (_, k) => offsetPolyline(path, laneOffset(k, lanes))),
          };
        }
      }
      if (best && candidates.indexOf(river) === 0) break;
    }
    if (best) return best;
  }
  return null;
}

/**
 * Where a point is along a path: distance from the start (s) and signed
 * offset from the line (right of travel positive).
 */
export function project(path: Vec2[], x: number, z: number): { s: number; offset: number } {
  let best = { s: 0, offset: 0, d: Infinity };
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    const ex = bx - ax;
    const ez = bz - az;
    const len = Math.hypot(ex, ez) || 1;
    const u = Math.max(0, Math.min(len, ((x - ax) * ex + (z - az) * ez) / len));
    const px = ax + (ex / len) * u;
    const pz = az + (ez / len) * u;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) {
      // Right of travel for heading atan2(dx, dz) is (dz, -dx)
      const side = (x - px) * (ez / len) - (z - pz) * (ex / len);
      best = { s: acc + u, offset: side, d };
    }
    acc += len;
  }
  return { s: best.s, offset: best.offset };
}

/** Point and heading at distance s along a path. */
export function pointAt(path: Vec2[], s: number): { x: number; z: number; heading: number } {
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    if (acc + len >= s || i === path.length - 1) {
      const f = Math.max(0, Math.min(1, (s - acc) / len));
      return { x: ax + (bx - ax) * f, z: az + (bz - az) * f, heading: Math.atan2(bx - ax, bz - az) };
    }
    acc += len;
  }
  const [x, z] = path[0];
  return { x, z, heading: 0 };
}

/**
 * A rival crew's boat speed (units/s) at a point of the race: a quick
 * start, a steady middle and a sprint over the last 250 m.
 */
export function rivalSpeed(cruise: number, s: number, length: number, elapsed: number): number {
  const start = elapsed < 6 ? 0.55 + 0.45 * (elapsed / 6) + 0.15 * Math.sin((elapsed / 6) * Math.PI) : 1;
  const sprint = s > length - length / 8 ? 1.12 : 1;
  return cruise * start * sprint;
}
