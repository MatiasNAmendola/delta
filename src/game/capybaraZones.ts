/**
 * Where capybara families cross (docs/investigacion/12-carpinchos.md, ADR
 * 0018). Pure: generated from the world, not placed by hand.
 *
 * A crossing is a stretch of a river or arroyo that is
 *  - narrow enough to swim across (12-48 m),
 *  - bordered on both sides by NATURAL banks (mud, not a wooden bulkhead),
 *  - fairly straight, and
 *  - far from docks and from the busy center of the zone (the spawn dock).
 * A few are kept per sector of the map, with a deterministic seed.
 */
import { probeChannel } from "./navigationRules";
import { METERS_PER_UNIT } from "../utils/constants";
import { seededRandom } from "../utils/helpers";

export type Pt = [number, number];

export interface ZoneRiver {
  name: string;
  points: Pt[];
}

export interface ZoneInputs {
  rivers: ZoneRiver[];
  isWater: (x: number, z: number) => boolean;
  /** Reflection coefficient of the shore at a point (RiverBanks.krAt): ~0.15 natural, ~0.9 bulkhead. */
  krAt: (x: number, z: number) => number;
  /** Docks and the zone's busy center, with how far (units) to stay from each. */
  avoid: Array<{ x: number; z: number; r: number }>;
  seed: number;
}

export interface CrossingZone {
  id: number;
  river: string;
  /** Middle of the crossing, in the water. */
  x: number;
  z: number;
  /** The two banks (water edge) and the unit vector from A to B. */
  a: Pt;
  b: Pt;
  dir: Pt;
  /** Unit vector along the river. */
  along: Pt;
  /** Distance between the banks (units). */
  width: number;
  /** Calves in the family (2-5), from the seed. */
  calves: number;
  /** Map sector this zone belongs to. */
  sector: string;
}

export const MIN_CROSSING_M = 12;
export const MAX_CROSSING_M = 48;
/** Max Kr of a bank that counts as natural (mud ~0.15, bulkhead ~0.9). */
export const NATURAL_KR = 0.4;
/** Side (units) of the map sectors that get a few crossings each. */
export const SECTOR = 350;
export const PER_SECTOR = 2;
/** Crossings are at least this far apart (units). */
export const MIN_SEPARATION = 60;
const STEP = 16;

interface Sample {
  x: number;
  z: number;
}

/** Points every `step` units along a polyline. */
export function resample(points: Pt[], step: number): Sample[] {
  const out: Sample[] = [];
  let next = step / 2;
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len === 0) continue;
    while (next <= walked + len) {
      const f = (next - walked) / len;
      out.push({ x: ax + (bx - ax) * f, z: az + (bz - az) * f });
      next += step;
    }
    walked += len;
  }
  return out;
}

export function generateCrossingZones(input: ZoneInputs): CrossingZone[] {
  const { isWater, krAt } = input;
  const minW = MIN_CROSSING_M / METERS_PER_UNIT;
  const maxW = MAX_CROSSING_M / METERS_PER_UNIT;
  type Candidate = Omit<CrossingZone, "id" | "calves">;
  const candidates: Candidate[] = [];

  for (const river of input.rivers) {
    if (river.points.length < 2) continue;
    const samples = resample(river.points, STEP);
    for (let i = 1; i < samples.length - 1; i++) {
      const s = samples[i];
      if (!isWater(s.x, s.z)) continue;
      if (input.avoid.some((v) => Math.hypot(s.x - v.x, s.z - v.z) < v.r)) continue;
      // Fairly straight: the river does not turn more than ~25 degrees around here
      const p = samples[i - 1];
      const q = samples[i + 1];
      const l1 = Math.hypot(s.x - p.x, s.z - p.z) || 1;
      const l2 = Math.hypot(q.x - s.x, q.z - s.z) || 1;
      const straight = ((s.x - p.x) * (q.x - s.x) + (s.z - p.z) * (q.z - s.z)) / (l1 * l2);
      if (straight < 0.9) continue;
      const cl = Math.hypot(q.x - p.x, q.z - p.z) || 1;
      const ax = (q.x - p.x) / cl;
      const az = (q.z - p.z) / cl;
      // Across the river: heading convention atan2(dx, dz), starboard = (cos h, -sin h)
      const heading = Math.atan2(ax, az);
      const probe = probeChannel(isWater, s.x, s.z, heading, maxW + 1);
      if (probe.width < minW || probe.width > maxW) continue;
      const sx = Math.cos(heading);
      const sz = -Math.sin(heading);
      // A = port bank, B = starboard bank
      const a: Pt = [s.x - sx * probe.port, s.z - sz * probe.port];
      const b: Pt = [s.x + sx * probe.starboard, s.z + sz * probe.starboard];
      const natural = (pt: Pt, dx: number, dz: number) =>
        Math.max(krAt(pt[0], pt[1]), krAt(pt[0] + dx * 0.3, pt[1] + dz * 0.3), krAt(pt[0] - dx * 0.3, pt[1] - dz * 0.3)) <= NATURAL_KR;
      if (!natural(a, -sx, -sz) || !natural(b, sx, sz)) continue;
      const w = probe.width;
      candidates.push({
        river: river.name,
        x: s.x,
        z: s.z,
        a,
        b,
        dir: [(b[0] - a[0]) / w, (b[1] - a[1]) / w],
        along: [ax, az],
        width: w,
        sector: `${Math.floor(s.x / SECTOR)},${Math.floor(s.z / SECTOR)}`,
      });
    }
  }

  // A few per sector, picked by a seeded shuffle of a stable ordering
  const rng = seededRandom(Math.max(1, Math.floor(input.seed) % 2147483646));
  const bySector = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const list = bySector.get(c.sector) ?? [];
    list.push(c);
    bySector.set(c.sector, list);
  }
  const chosen: Candidate[] = [];
  for (const key of [...bySector.keys()].sort()) {
    const list = bySector.get(key)!.sort((u, v) => u.x - v.x || u.z - v.z);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    let kept = 0;
    for (const c of list) {
      if (kept >= PER_SECTOR) break;
      if (chosen.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < MIN_SEPARATION)) continue;
      chosen.push(c);
      kept++;
    }
  }
  return chosen.map((c, id) => ({ ...c, id, calves: 2 + Math.floor(rng() * 4) }));
}
